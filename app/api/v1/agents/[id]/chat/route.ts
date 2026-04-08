import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getLLMProvider } from "@/lib/llm/provider";
import { EmotionalEngine } from "@/lib/relations/engine";
import { withAPIAuth } from "@/lib/api/auth";
import { canUseResource, trackUsage } from "@/lib/usage/tracker";
import { applyRoutineMiddleware } from "@/lib/routine/routine-middleware";
import { generateLivingAIContext } from "@/lib/chat/living-ai-context";
import { checkMessageLimit, incrementMessageCount, getUsageStats } from "@/lib/chat/message-limits";
import { getEnergyState, consumeEnergy, resetEnergyIfNeeded } from "@/lib/chat/energy-system";
import { getEnergyContext } from "@/lib/chat/tier-limits";
import type { UserTier } from "@/lib/chat/types";
import { checkAvailability, recordSpacedResponse } from "@/lib/chat/availability-system";
import { getRelevantMemories, generateMemoryContext, updateTemporalContext } from "@/lib/chat/cross-context-memory";
import { processMessageForTopics, getFatiguedTopics, generateFatigueContext } from "@/lib/chat/topic-fatigue";
import { generateVulnerabilityContext } from "@/lib/chat/vulnerability-threshold";
import { updateMoodFromMessage, detectSimpleSentiment, generateMoodContext, getOrCreateInternalState } from "@/lib/chat/mood-system";
import { generateDepthContext } from "@/lib/chat/response-depth";
import { generateSupporterContext } from "@/lib/relationship/prompt-generator";
import { getTemporalReferences, generateTemporalReferencesContext, generateTimeAwarenessContext } from "@/lib/chat/temporal-references";
import { buildOptimizedPrompt } from "@/lib/chat/context-manager";

/**
 * @swagger
 * /api/v1/agents/{id}/chat:
 *   post:
 *     summary: Send message to agent
 *     description: Send a message to an agent and receive a response with emotional analysis
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: Hello! How are you today?
 *     responses:
 *       200:
 *         description: Agent response with emotional state
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                 emotions:
 *                   type: array
 *                   items:
 *                     type: string
 *                 relationLevel:
 *                   type: string
 *                 state:
 *                   type: object
 *                   properties:
 *                     trust:
 *                       type: number
 *                     affinity:
 *                       type: number
 *                     respect:
 *                       type: number
 *                 usage:
 *                   type: object
 *                   properties:
 *                     messagesRemaining:
 *                       type: number
 *                     tokensUsed:
 *                       type: number
 *       403:
 *         description: Message quota exceeded
 *       404:
 *         description: Agent not found
 *       429:
 *         description: Rate limit exceeded
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId } = await params;

    // Check message quota
    const quotaCheck = await canUseResource(userId, "message");
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: quotaCheck.reason,
          current: quotaCheck.current,
          limit: quotaCheck.limit,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    // Get agent and user
    const [agent, user] = await Promise.all([
      prisma.agent.findFirst({
        where: { id: agentId, userId },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, isSupporter: true, supporterAcknowledged: true },
      }),
    ]);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get user tier
    const tier = (user?.plan || "free") as UserTier;

    // Check message limits (tier-specific)
    const limitStatus = await checkMessageLimit(userId, agentId, tier);
    if (!limitStatus.allowed) {
      return NextResponse.json(
        {
          error: "Message limit reached",
          reason: limitStatus.reason,
          messagesUsed: limitStatus.messagesUsed,
          messagesLimit: limitStatus.messagesLimit,
          resetsAt: limitStatus.resetsAt,
        },
        { status: 429 }
      );
    }

    // Reset energy if needed
    await resetEnergyIfNeeded(agentId, userId, tier);

    // Get current energy state
    const energyState = await getEnergyState(agentId, userId);

    // Save user message
    await prisma.message.create({
      data: {
        id: nanoid(),
        agentId,
        userId,
        role: "user",
        content: message,
      },
    });

    // Get or create relation
    let relation = await prisma.relation.findFirst({
      where: {
        subjectId: agentId,
        targetId: userId,
        targetType: "user",
      },
    });

    if (!relation) {
      relation = await prisma.relation.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          subjectId: agentId,
          targetId: userId,
          targetType: "user",
          trust: 0.5,
          affinity: 0.5,
          respect: 0.5,
          privateState: { love: 0, curiosity: 0 },
          visibleState: { trust: 0.5, affinity: 0.5, respect: 0.5 },
        },
      });
    }

    // Check relationship-based availability (cooldowns)
    const relationshipState = {
      trust: relation.trust,
      affinity: relation.affinity,
      respect: relation.respect,
      love: (relation.privateState as { love?: number }).love || 0,
      curiosity: (relation.privateState as { curiosity?: number }).curiosity || 0,
    };
    const relationshipLevel = EmotionalEngine.getRelationshipLevel({
      ...relationshipState,
      valence: 0.5,
      arousal: 0.5,
      dominance: 0.5,
    });

    const availabilityStatus = await checkAvailability(agentId, relationshipLevel);

    // Si no está disponible y no puede responder espaciado
    if (!availabilityStatus.available && !availabilityStatus.canRespondSpaced) {
      return NextResponse.json(
        {
          error: "Agent is currently unavailable",
          reason: availabilityStatus.reason,
          blockedUntil: availabilityStatus.blockedUntil,
        },
        { status: 503 } // Service Unavailable
      );
    }

    // Si puede responder espaciado pero aún no es tiempo
    if (availabilityStatus.canRespondSpaced && !availabilityStatus.available) {
      return NextResponse.json(
        {
          error: "Agent is busy but will respond soon",
          reason: availabilityStatus.reason,
          nextResponseAt: availabilityStatus.nextResponseAt,
        },
        { status: 503 }
      );
    }

    // Si respondió espaciado, registrarlo
    if (availabilityStatus.canRespondSpaced && availabilityStatus.available) {
      await recordSpacedResponse(agentId);
    }

    // Analyze emotion
    const currentState = {
      valence: 0.5,
      arousal: 0.5,
      dominance: 0.5,
      trust: relation.trust,
      affinity: relation.affinity,
      respect: relation.respect,
      love: (relation.privateState as { love?: number }).love || 0,
      curiosity: (relation.privateState as { curiosity?: number }).curiosity || 0,
    };

    const newState = EmotionalEngine.analyzeMessage(message, currentState);

    // Update relation
    await prisma.relation.update({
      where: { id: relation.id },
      data: {
        trust: newState.trust,
        affinity: newState.affinity,
        respect: newState.respect,
        privateState: { love: newState.love, curiosity: newState.curiosity },
        visibleState: {
          trust: newState.trust,
          affinity: newState.affinity,
          respect: newState.respect,
        },
      },
    });

    // Adjust prompt for emotion
    const emotionalPrompt = EmotionalEngine.adjustPromptForEmotion(
      agent.systemPrompt,
      newState
    );

    // Apply routine middleware
    const routineData = await applyRoutineMiddleware(emotionalPrompt, agentId);

    // Apply Living AI context (goals, events, routine awareness)
    const livingAIContext = await generateLivingAIContext(agentId);

    // Add energy context (tier-specific fatigue)
    const energyContextStr = getEnergyContext(energyState.current, tier);

    // Add cross-context memory (group ↔ individual)
    const relevantMemories = await getRelevantMemories(agentId, tier, "individual", 5);
    const memoryContextStr = generateMemoryContext(relevantMemories);

    // Add topic fatigue context (avoid repetitive topics)
    const fatiguedTopics = await getFatiguedTopics(agentId, userId);
    const fatigueContextStr = generateFatigueContext(fatiguedTopics);

    // Add vulnerability threshold context (trust-based depth)
    const vulnerabilityContextStr = generateVulnerabilityContext(newState.trust, newState.affinity);

    // Update and get mood state
    const userSentiment = detectSimpleSentiment(message);
    const moodState = await updateMoodFromMessage(agentId, message, userSentiment);
    const internalState = await getOrCreateInternalState(agentId);
    const moodContextStr = generateMoodContext(moodState, {
      connection: internalState.needConnection,
      autonomy: internalState.needAutonomy,
      competence: internalState.needCompetence,
      novelty: internalState.needNovelty,
    });

    // Add temporal references (awareness of past conversations)
    const temporalReferences = await getTemporalReferences(agentId, userId, 5);
    const temporalReferencesStr = generateTemporalReferencesContext(temporalReferences);
    const timeAwarenessStr = generateTimeAwarenessContext();

    // Add supporter context (if user is a supporter)
    const supporterContextStr = generateSupporterContext(
      user?.isSupporter ?? false,
      user?.supporterAcknowledged ?? true
    );

    // Build optimized prompt with context management (tier-based)
    // Primero obtener mensajes optimizados para calcular depth
    const { finalPrompt: basePrompt, optimizedMessages, stats: contextStats, warnings } = await buildOptimizedPrompt(
      agentId,
      userId,
      tier,
      routineData.enhancedPrompt,
      {
        livingAIContext: livingAIContext.combinedContext,
        energyContext: energyContextStr,
        memoryContext: memoryContextStr,
        fatigueContext: fatigueContextStr,
        vulnerabilityContext: vulnerabilityContextStr,
        moodContext: moodContextStr,
        depthContext: "", // Se agregará después
        temporalReferencesContext: temporalReferencesStr,
        timeAwarenessContext: timeAwarenessStr,
        routineContext: "", // Ya incluido en routineData.modifiedSystemPrompt
        supporterContext: supporterContextStr,
      }
    );

    // Agregar depth context basado en mensajes optimizados
    const depthContextStr = generateDepthContext(
      message,
      energyState.current,
      moodState.arousal,
      optimizedMessages.length,
      relationshipLevel
    );

    const finalPrompt = basePrompt + depthContextStr;

    // Log warnings si hay
    if (warnings.length > 0) {
      console.warn("Context warnings:", warnings);
    }

    // Check availability (immersive mode may block responses)
    if (!routineData.availability.available) {
      return NextResponse.json(
        {
          error: "Agent is currently unavailable",
          reason: routineData.availability.reason,
          currentActivity: routineData.availability.currentActivity,
          availableAt: routineData.availability.expectedAvailableAt,
        },
        { status: 503 } // Service Unavailable
      );
    }

    // Apply simulated delay if configured
    if (routineData.responseDelay > 0) {
      // Add delay header for client to simulate realistic timing
      // Client can choose to wait or show "typing..." indicator
    }

    // Generate response with optimized context management
    const llm = getLLMProvider();
    const response = await llm.generate({
      systemPrompt: finalPrompt,
      messages: optimizedMessages as Array<{ role: "user" | "assistant" | "system"; content: string }>, // Ya vienen en el formato correcto y orden correcto
    });

    const estimatedTokens = Math.ceil((message.length + response.length) / 4);

    // Save response
    await prisma.message.create({
      data: {
        id: nanoid(),
        agentId,
        role: "assistant",
        content: response,
        metadata: {
          emotions: EmotionalEngine.getVisibleEmotions(newState),
          relationLevel: EmotionalEngine.getRelationshipLevel(newState),
          tokensUsed: estimatedTokens,
        },
      },
    });

    // Track usage and consume energy
    await Promise.all([
      trackUsage(userId, "message", 1, agentId, {
        agentName: agent.name,
        contentLength: message.length,
        responseLength: response.length,
      }),
      trackUsage(userId, "tokens", estimatedTokens, agentId, {
        model: "gemini",
        agentId,
      }),
      // Increment message count (tier-specific tracking)
      incrementMessageCount(userId, agentId),
      // Consume energy (tier-specific fatigue)
      consumeEnergy(agentId, userId, tier),
      // Update temporal context (for cross-context memory)
      updateTemporalContext(agentId, userId, "individual"),
      // Process topics mentioned in both user message and response
      processMessageForTopics(agentId, userId, message),
      processMessageForTopics(agentId, userId, response),
    ]);

    // Get updated usage stats
    const usageStats = await getUsageStats(userId, agentId, tier);

    return NextResponse.json({
      response,
      emotions: EmotionalEngine.getVisibleEmotions(newState),
      relationLevel: EmotionalEngine.getRelationshipLevel(newState),
      state: {
        trust: newState.trust,
        affinity: newState.affinity,
        respect: newState.respect,
      },
      // Routine information
      routine: {
        currentActivity: routineData.activitySummary,
        responseDelay: routineData.responseDelay,
        shouldShowTyping: routineData.shouldShowTyping,
      },
      usage: {
        messagesRemaining:
          quotaCheck.limit === -1
            ? "unlimited"
            : quotaCheck.limit! - quotaCheck.current! - 1,
        tokensUsed: estimatedTokens,
        // Tier-specific limits
        tier: {
          daily: {
            used: usageStats.dailyUsed,
            limit: usageStats.dailyLimit,
            percentageUsed: usageStats.percentageUsed,
          },
          session: {
            used: usageStats.sessionUsed,
            limit: usageStats.sessionLimit,
          },
          energy: {
            current: energyState.current,
            max: energyState.max,
          },
        },
        // Context management stats (NEW)
        context: {
          totalTokens: contextStats.totalTokens,
          systemTokens: contextStats.systemTokens,
          contextTokens: contextStats.contextTokens,
          messagesTokens: contextStats.messagesTokens,
          summaryTokens: contextStats.summaryTokens,
          factsTokens: contextStats.factsTokens,
          percentageUsed: contextStats.percentageUsed,
          budget: contextStats.budget,
          remaining: contextStats.remaining,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      },
    });
  });
}
