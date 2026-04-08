/**
 * Message Service
 *
 * Handles all message-related business logic with optimized database queries
 * Eliminates N+1 query problems by using strategic includes and parallel queries
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from "nanoid";
import { getLLMProvider } from '@/lib/llm/provider';
import { getVeniceClient } from '@/lib/emotional-system/llm/venice';
import { createMemoryManager } from '@/lib/memory/manager';
import { behaviorOrchestrator } from '@/lib/behavior-system';
import { hybridEmotionalOrchestrator } from '@/lib/emotional-system/hybrid-orchestrator';
import { getContextualModularPrompt } from '@/lib/behavior-system/prompts/modular-prompts';
import { getRelationshipStage, shouldAdvanceStage, getEvolutionLimitNotice, type UserPlan } from '@/lib/relationship/stages';
import { getPromptForStage, getPromptForMessageNumber } from '@/lib/relationship/prompt-generator';
import { getRevelationMoment, generatePersonalizedRevelation } from '@/lib/relationship/revelation-moments';
import { getEmotionalSummary } from '@/lib/emotions/system';
import { interceptKnowledgeCommand, buildExpandedPrompt, logCommandUsage } from '@/lib/profile/knowledge-interceptor';
import { getTopRelevantCommand } from '@/lib/profile/command-detector';
import { getKnowledgeGroup } from '@/lib/profile/knowledge-retrieval';
import { buildTemporalPrompt } from '@/lib/context/temporal';
import { interceptRememberCommands, buildReminderContext } from '@/lib/events/remember-interceptor';
import { interceptPersonCommands, buildPeopleContext } from '@/lib/people/person-interceptor';
import { getUserWeather, buildWeatherPrompt } from '@/lib/context/weather';
import { markProactiveMessageResponded } from '@/lib/proactive/proactive-service';
import { interceptSearchCommand } from '@/lib/memory/search-interceptor';
import { storeMessageSelectively } from '@/lib/memory/selective-storage';
import { memoryQueryHandler } from '@/lib/memory/memory-query-handler';
import { processInteractionForBond } from '@/lib/bonds/bond-progression-service';
import type { StagePrompts } from '@/lib/relationship/prompt-generator';
import type { RelationshipStage } from '@/lib/relationship/stages';

import { createLogger, startTimer } from '@/lib/logger';
import { getContextLimit } from '@/lib/usage/context-limits';
import { trackLLMCall } from '@/lib/cost-tracking/tracker';
import { estimateTokens } from '@/lib/cost-tracking/calculator';
import { compressContext } from '@/lib/memory/context-compression';
import { detectMemoryReferences } from '@/lib/memory/memory-reference-detector';
import { encryptMessage, decryptMessageIfNeeded } from '@/lib/encryption/message-encryption';

type EmotionType = 'joy' | 'trust' | 'fear' | 'surprise' | 'sadness' | 'disgust' | 'anger' | 'anticipation';

const log = createLogger('MessageService');

interface ProcessMessageInput {
  agentId: string;
  userId: string;
  content: string;
  messageType?: 'text' | 'audio' | 'gif' | 'image';
  metadata?: Record<string, unknown>;
  userPlan?: string; // User plan to determine context limit
}

interface ProcessMessageOutput {
  userMessage: {
    id: string;
    content: string;
    createdAt: Date;
  };
  assistantMessage: {
    id: string;
    content: string;
    createdAt: Date;
    metadata: Record<string, unknown>;
  };
  emotions: {
    dominant: string[];
    secondary: string[];
    mood: string;
    pad: { valence: number; arousal: number; dominance: number };
    detailed: Record<string, number>;
  };
  state: {
    trust: number;
    affinity: number;
    respect: number;
  };
  relationship: {
    stage: string;
    totalInteractions: number;
    stageChanged: boolean;
    evolutionLimit?: {
      reached: boolean;
      message: string;
      currentStageName: string;
      nextStageName: string | null;
      upgradeOptions: { plan: string; stage: string }[];
    };
  };
  behaviors: {
    active: string[];
    phase?: number;
    safetyLevel: string;
    triggers: string[];
  };
  usage: {
    messagesRemaining: number | 'unlimited';
    tokensUsed: number;
  };
}

export class MessageService {
  /**
   * Process incoming message and generate response
   *
   * ✅ OPTIMIZED: Single query with strategic includes to avoid N+1
   * ✅ PARALLEL: Independent operations run concurrently
   */
  async processMessage(input: ProcessMessageInput): Promise<ProcessMessageOutput> {
    const timer = startTimer();
    const { agentId, userId, content, messageType = 'text', metadata = {}, userPlan = 'free' } = input;

    log.info({ agentId, userId, messageType, userPlan }, 'Processing message');

    // Get dynamic context limit based on tier
    const contextLimit = getContextLimit(userPlan);
    log.debug({ userPlan, contextLimit }, 'Dynamic context limit applied');

    try {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // OPTIMIZATION 1: Single query with all related data
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const [agent, recentMessages] = await Promise.all([
        prisma.agent.findUnique({
          where: { id: agentId },
          include: {
            PersonalityCore: true,
            InternalState: true,
            SemanticMemory: true,
            CharacterGrowth: true,
            BehaviorProfile: true,
            User: {
              select: {
                location: true,
              },
            },
          },
        }),
        prisma.message.findMany({
          where: { agentId },
          orderBy: { createdAt: 'desc' },
          take: contextLimit, // 🔥 DYNAMIC: 10 (free) | 30 (plus) | 100 (ultra)
          select: {
            id: true,
            role: true,
            content: true,
            iv: true,
            authTag: true,
            createdAt: true,
            metadata: true,
            userId: true,
            agentId: true,
          },
        }),
      ]);

      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Allow access to:
      // 1. User's own agents (agent.userId === userId)
      // 2. System/predefined agents (agent.userId === null)
      // 3. Public agents (agent.visibility === 'public')
      const isOwnAgent = agent.userId === userId;
      const isSystemAgent = agent.userId === null;
      const isPublicAgent = agent.visibility === 'public';

      if (!isOwnAgent && !isSystemAgent && !isPublicAgent) {
        throw new Error('Forbidden: Agent is not accessible');
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // DESENCRIPTAR MENSAJES RECIENTES
      // Messages are encrypted in DB, decrypt them for processing
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const decryptedRecentMessages = recentMessages.map(msg => ({
        ...msg,
        content: decryptMessageIfNeeded(msg.content, msg.iv, msg.authTag),
      }));

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // OPTIMIZATION 2: Determine AI-facing content
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      let contentForAI = content;
      const contentForUser = content;
      let messageMetadata: Record<string, unknown> = { ...metadata };

      if (messageType === 'gif' && metadata.description) {
        contentForAI = `[User sent a GIF of: ${metadata.description}]`;
        messageMetadata = {
          ...metadata,
          messageType: 'gif',
          gifDescription: metadata.description,
        };
      } else if (messageType === 'audio') {
        messageMetadata = {
          ...metadata,
          messageType: 'audio',
          audioDuration: metadata.duration,
        };
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PARALLEL EXECUTION 1: Save user message + Get/Create relation
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // Encrypt user message content
      const userMessageEncryption = encryptMessage(contentForUser);

      const [userMessage, relation] = await Promise.all([
        prisma.message.create({
          data: {
            id: nanoid(),
            agentId,
            userId,
            role: 'user',
            content: userMessageEncryption.encrypted,
            iv: userMessageEncryption.iv,
            authTag: userMessageEncryption.authTag,
            metadata: messageMetadata as any,
          },
        }),
        this.getOrCreateRelation(agentId, userId),
      ]);

      // Check if this is a response to a proactive message
      const lastAssistantMessage = await prisma.message.findFirst({
        where: {
          agentId,
          role: 'assistant',
          createdAt: {
            lt: userMessage.createdAt,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (lastAssistantMessage) {
        // Mark proactive message as responded if applicable
        markProactiveMessageResponded(lastAssistantMessage.id).catch(err =>
          log.warn({ error: err, messageId: lastAssistantMessage.id }, 'Failed to mark proactive message as responded')
        );
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // RELATIONSHIP PROGRESSION
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const newTotalInteractions = relation.totalInteractions + 1;
      const newStage = getRelationshipStage(newTotalInteractions);
      const stageChanged = shouldAdvanceStage(
        newTotalInteractions,
        relation.stage as RelationshipStage
      );

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // REVELATION MOMENTS (when relationship stage advances)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      let revelationContext = "";
      let revelationMoment: ReturnType<typeof getRevelationMoment> = null;

      if (stageChanged) {
        revelationMoment = getRevelationMoment(
          relation.stage as RelationshipStage,
          newStage
        );

        if (revelationMoment) {
          // Extract character Big Five personality (if available)
          const personality = agent.PersonalityCore ? {
            extraversion: agent.PersonalityCore.extraversion,
            neuroticism: agent.PersonalityCore.neuroticism,
            agreeableness: agent.PersonalityCore.agreeableness,
            openness: agent.PersonalityCore.openness,
            conscientiousness: agent.PersonalityCore.conscientiousness,
          } : undefined;

          // Generate custom revelation context
          revelationContext = generatePersonalizedRevelation(
            revelationMoment,
            agent.name,
            personality
          );

          log.info(
            {
              agentId,
              fromStage: relation.stage,
              toStage: newStage,
              revelationType: revelationMoment.revelationType,
              importance: revelationMoment.importance,
            },
            'Revelation moment detected - relationship stage advanced'
          );
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // EMOTIONAL SYSTEM PROCESSING
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      log.debug({ agentId }, 'Processing emotions with Hybrid System');
      const emotionTimer = startTimer();

      const hybridResult = await hybridEmotionalOrchestrator.processMessage({
        agentId,
        userMessage: contentForAI,
        userId,
        generateResponse: false,
      });

      log.debug(
        { duration: emotionTimer(), path: hybridResult.metadata.path },
        'Emotional processing complete'
      );

      const newEmotionState = hybridResult.emotionState;
      const activeDyads = hybridResult.activeDyads;
      const emotionalSummary = getEmotionalSummary(newEmotionState);

      // Add dyads to summary
      emotionalSummary.secondary = activeDyads.slice(0, 3).map(d => d.label);

      // Map emotions to relation metrics
      const trust = newEmotionState.trust;
      const affinity = (newEmotionState.joy + newEmotionState.trust) / 2;
      const respect = (newEmotionState.trust + newEmotionState.anticipation) / 2;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // BEHAVIOR SYSTEM PROCESSING
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const behaviorOrchestration = await behaviorOrchestrator.processIncomingMessage({
        agent,
        userMessage,
        recentMessages: decryptedRecentMessages,
        dominantEmotion: (emotionalSummary.dominant[0] || 'joy') as any,
        emotionalState: {
          valence: emotionalSummary.pad.valence,
          arousal: emotionalSummary.pad.arousal,
          dominance: emotionalSummary.pad.dominance,
        },
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // BUILD ENHANCED PROMPT (con sistema de mensajes progresivos)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const stagePrompts = agent.stagePrompts as StagePrompts | null;

      // Calculate agent message number (how many messages it has sent)
      const agentMessageCount = await prisma.message.count({
        where: {
          agentId,
          userId,
          role: 'assistant',
        },
      });

      const messageNumber = agentMessageCount + 1;

      // Use progressive message system (1-3) or stage-based (4+)
      const basePrompt = messageNumber <= 3
        ? getPromptForMessageNumber(messageNumber, newTotalInteractions, stagePrompts, {
            systemPrompt: agent.systemPrompt,
            name: agent.name,
          })
        : getPromptForStage(stagePrompts, newStage, agent.systemPrompt);

      // Emotional context with dyads
      const emotionalContext = this.buildEmotionalContext(
        emotionalSummary,
        activeDyads as any,
        hybridResult.metadata
      );

      // Weather context (if user has location configured)
      let weatherContext: string | undefined;
      if (agent.User?.location) {
        const weather = await getUserWeather(agent.User.location);
        if (weather) {
          weatherContext = buildWeatherPrompt(weather);
        }
      }

      // Temporal context (date, time, special events, weather)
      const temporalContext = buildTemporalPrompt(newStage, undefined, weatherContext);

      // Reminder context (important events to remember)
      const reminderContext = await buildReminderContext(agentId, userId, newStage);

      // People context (important people in user's life)
      const peopleContext = await buildPeopleContext(agentId, userId, newStage);

      let enhancedPrompt = basePrompt + '\n\n' + emotionalContext + '\n\n' + temporalContext;

      if (reminderContext) {
        enhancedPrompt += reminderContext;
      }

      if (peopleContext) {
        enhancedPrompt += peopleContext;
      }

      // Inject revelation context if there was a stage change
      if (revelationContext) {
        enhancedPrompt += '\n\n' + revelationContext;
      }

      // Add behavior system prompt
      if (behaviorOrchestration.enhancedSystemPrompt) {
        enhancedPrompt += '\n\n' + behaviorOrchestration.enhancedSystemPrompt;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PROACTIVE KNOWLEDGE LOADING (Embeddings-based)
      // Detects which profile information is relevant and loads it
      // BEFORE sending to LLM, avoiding roundtrips
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      try {
        const relevantCommand = await getTopRelevantCommand(content, agentId);

        if (relevantCommand) {
          log.debug({ relevantCommand, query: content.substring(0, 50) }, 'Comando relevante detectado');

          // Cargar el conocimiento relevante
          const knowledgeContext = await getKnowledgeGroup(agentId, relevantCommand);

          // Agregar al prompt
          enhancedPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          enhancedPrompt += `📌 INFORMACIÓN RELEVANTE PARA ESTA CONVERSACIÓN:\n`;
          enhancedPrompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          enhancedPrompt += knowledgeContext;
          enhancedPrompt += `\n\n⚠️ IMPORTANT: This information is relevant to the user's question.\n`;
          enhancedPrompt += `Úsala naturalmente en tu respuesta, pero NO menciones que "consultaste" algo.\n`;
          enhancedPrompt += `Respond as if you had always had this information in your memory.\n`;
        }
      } catch (error) {
        log.warn({ error }, 'Error in proactive knowledge detection, continuing without it');
        // Do not fail the entire message if detection fails
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // MEMORY QUERY DETECTION (Semantic Search)
      // Detect questions about the past ("do you remember when...?")
       // and retrieves relevant memories BEFORE generating response
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      try {
        const memoryQueryResult = await memoryQueryHandler.handleQuery(
          content,
          agentId,
          userId,
          {
            maxMemories: 5,
            minSimilarity: 0.5,
            maxTokens: 1000,
            useSemanticSearch: true,
          }
        );

        if (memoryQueryResult.detected && memoryQueryResult.contextPrompt) {
          log.info(
            {
              queryType: memoryQueryResult.detection.queryType,
              confidence: memoryQueryResult.detection.confidence,
              memoriesFound: memoryQueryResult.metadata.memoriesFound,
              searchTimeMs: memoryQueryResult.metadata.searchTimeMs,
            },
            'Memory query detected - adding memory context'
          );

          // Add memory context to prompt
          enhancedPrompt += '\n\n' + memoryQueryResult.contextPrompt;
        }
      } catch (error) {
        log.warn({ error }, 'Error en memory query detection, continuando sin ella');
        // Don't fail the entire message if detection fails
      }

      // RAG: Build enhanced prompt with memory context
      const memoryManager = createMemoryManager(agentId, userId);
      const finalPrompt = await memoryManager.buildEnhancedPrompt(
        enhancedPrompt,
        contentForAI
      );

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🆕 SFW PROTECTION INJECTION (nivel de usuario)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const { injectSFWProtection } = await import('@/lib/middleware/sfw-injector');

      // Inject SFW protection if applicable
      const promptWithSFW = await injectSFWProtection(finalPrompt, userId, agentId);

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PROMPT MODULAR INJECTION (with dialectal adaptation)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Extract character information for dialectal adaptation
      const agentProfile = agent.profile as any;
      const characterOrigin =
        agentProfile?.origin ||
        agentProfile?.nationality ||
        agentProfile?.country ||
        agentProfile?.birthplace ||
        agentProfile?.world ||
        undefined;

      // Inject modular prompt based on personality, relationship, and context
      const modularPrompt = await getContextualModularPrompt({
        // ✅ NEW: Use explicit field from the DB (preferred)
        personalityVariant: agent.personalityVariant || undefined,
        // ⚠️ FALLBACK: Solo si no hay variant asignado (agentes antiguos)
        personalityTraits: !agent.personalityVariant ? (agent.personality || '') : undefined,
        relationshipStage: relation.stage,
        recentMessages: decryptedRecentMessages.map(m => m.content).slice(0, 5),
        nsfwMode: agent.nsfwMode,
        // ✅ NEW: User tier for intelligent classification
        userTier: userPlan === 'ultra' ? 'ultra' : userPlan === 'plus' ? 'plus' : 'free',
        characterInfo: characterOrigin ? {
          origin: characterOrigin,
          name: agent.name,
          age: agentProfile?.age,
        } : undefined,
      });

      // Agregar prompt modular al prompt con SFW protection
      let enhancedPromptFinal = promptWithSFW;
      if (modularPrompt) {
        enhancedPromptFinal += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        enhancedPromptFinal += '🎯 GUÍA CONTEXTUAL DE COMPORTAMIENTO:\n';
        enhancedPromptFinal += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        enhancedPromptFinal += modularPrompt;
        enhancedPromptFinal += '\n\n⚠️ IMPORTANTE: Esta guía define CÓMO debes comportarte según tu personalidad y el contexto actual. Síguela naturalmente.\n';

        log.info({
          agentId,
          hasModularPrompt: true,
          hasDialectAdaptation: !!characterOrigin,
          characterOrigin: characterOrigin || 'none'
        }, 'Modular prompt injected with dialect adaptation');
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // LLM GENERATION WITH VENICE (24B UNCENSORED)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const veniceClient = getVeniceClient();

      log.info({ agentId, userId, model: 'venice-uncensored' }, 'Generating response with Venice');

      // Build message array: recent messages + current user message
      const allMessages = [
        ...decryptedRecentMessages.reverse().map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          id: m.id,
          createdAt: m.createdAt,
        })),
        {
          role: 'user' as const,
          content: contentForAI,
          id: userMessage.id,
          createdAt: userMessage.createdAt,
        }
      ];

      // Apply context compression (optimizes old messages)
      const compressionResult = await compressContext(allMessages, contextLimit);

      if (compressionResult.compressionApplied) {
        log.info({
          originalCount: compressionResult.originalCount,
          compressedCount: compressionResult.compressedCount,
          contextLimit,
        }, 'Context compression applied');
      }

      // Use compressed messages for LLM
      const conversationMessages = compressionResult.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Generate respuesta con Venice (uncensored, 24b params)
      const veniceResponse = await veniceClient.generateWithMessages({
        systemPrompt: enhancedPromptFinal,
        messages: conversationMessages,
        temperature: 0.95, // Mayor creatividad para IA de 24b
        maxTokens: 1500,   // Longer and more detailed responses
        model: 'venice-uncensored',
      });

      let response = veniceResponse;

      // Track Venice cost (async, non-blocking)
      const inputTokensFirst = estimateTokens(
        enhancedPromptFinal + '\n' + conversationMessages.map(m => m.content).join('\n')
      );
      const outputTokensFirst = estimateTokens(response);
      trackLLMCall({
        userId,
        agentId,
        provider: 'venice',
        model: 'venice-uncensored',
        inputTokens: inputTokensFirst,
        outputTokens: outputTokensFirst,
        metadata: { messageType, stage: 'initial-generation', hasModularPrompt: !!modularPrompt },
      }).catch(err => log.warn({ error: err.message }, 'Failed to track Venice cost'));

      // Knowledge command interception
      const interceptResult = await interceptKnowledgeCommand(agentId, response);

      if (interceptResult.shouldIntercept && interceptResult.knowledgeContext) {
        log.debug({ command: interceptResult.command }, 'Knowledge command detected');

        await logCommandUsage(
          agentId,
          interceptResult.command!,
          interceptResult.knowledgeContext.length
        );

        const expandedPrompt = buildExpandedPrompt(
          finalPrompt,
          interceptResult.knowledgeContext,
          interceptResult.command!
        );

        // Regenerate with Venice and expanded knowledge
        const veniceExpandedResponse = await veniceClient.generateWithMessages({
          systemPrompt: expandedPrompt,
          messages: conversationMessages,
          temperature: 0.95,
          maxTokens: 1500,
          model: 'venice-uncensored',
        });

        response = veniceExpandedResponse;

        // Track knowledge expansion Venice cost
        const inputTokensExpanded = estimateTokens(
          expandedPrompt + '\n' + conversationMessages.map(m => m.content).join('\n')
        );
        const outputTokensExpanded = estimateTokens(response);
        trackLLMCall({
          userId,
          agentId,
          provider: 'venice',
          model: 'venice-uncensored',
          inputTokens: inputTokensExpanded,
          outputTokens: outputTokensExpanded,
          metadata: { messageType, stage: 'knowledge-expansion', command: interceptResult.command },
        }).catch(err => log.warn({ error: err.message }, 'Failed to track Venice cost'));

        // Limpiar tags de conocimiento de la nueva respuesta
        const finalInterceptResult = await interceptKnowledgeCommand(agentId, response);
        response = finalInterceptResult.cleanResponse;
      } else {
        // If no command, but clean any remaining tags
        response = interceptResult.cleanResponse;
      }

      // SEARCH command interception (memoria inteligente)
      const searchResult = await interceptSearchCommand(agentId, userId, response);
      let memoryContext = ''; // Initialize memory context variable

      if (searchResult.shouldIntercept && searchResult.memoryContext) {
        memoryContext = searchResult.memoryContext; // Capture memory context for later use
        log.debug(
          { searchQuery: searchResult.searchQuery },
          'SEARCH command detected, executing memory search'
        );

        // Add memory context to prompt and regenerate
        const expandedPromptWithMemory = finalPrompt + searchResult.memoryContext;

        const llmProvider = getLLMProvider();
        response = await llmProvider.generate({
          systemPrompt: expandedPromptWithMemory,
          messages: conversationMessages,
        });

        // Track memory search LLM cost
        const inputTokensSearch = estimateTokens(
          expandedPromptWithMemory + '\n' + conversationMessages.map(m => m.content).join('\n')
        );
        const outputTokensSearch = estimateTokens(response);
        trackLLMCall({
          userId,
          agentId,
          provider: 'google',
          model: process.env.GEMINI_MODEL_LITE || 'gemini-2.5-flash-lite',
          inputTokens: inputTokensSearch,
          outputTokens: outputTokensSearch,
          metadata: { messageType, stage: 'memory-search', searchQuery: searchResult.searchQuery },
        }).catch(err => log.warn({ error: err.message }, 'Failed to track LLM cost'));

        // Limpiar el response en caso de que la IA siga teniendo [SEARCH:...]
        response = searchResult.cleanResponse;
      }

      // REMEMBER command interception
      const rememberResult = await interceptRememberCommands(agentId, userId, response);

      if (rememberResult.shouldIntercept) {
        log.debug(
          { count: rememberResult.commands.length },
          'REMEMBER commands detected and saved'
        );
        // Use clean response (with [REMEMBER:...] removed)
        response = rememberResult.cleanResponse;
      }

      // PERSON command interception
      const personResult = await interceptPersonCommands(agentId, userId, response);

      if (personResult.shouldIntercept) {
        log.debug(
          { count: personResult.commands.length },
          'PERSON commands detected and saved'
        );
        // Use clean response (with [PERSON:...] removed)
        response = personResult.cleanResponse;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // SAFETY: Check for empty response after all interceptors
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (!response || response.trim().length === 0) {
        log.error(
          { originalResponse: response },
          'Response became empty after interceptors - regenerating'
        );

        // Regenerate without commands
        const llmProvider = getLLMProvider();
        response = await llmProvider.generate({
          systemPrompt: finalPrompt + '\n\n⚠️ IMPORTANTE: NO uses comandos ([INTERESTS], [WORK], etc.) en tu respuesta. Responde directamente con texto natural.',
          messages: conversationMessages,
        });

        // Clean again just in case
        const finalClean = await interceptKnowledgeCommand(agentId, response);
        response = finalClean.cleanResponse;

        // If STILL empty, provide fallback
        if (!response || response.trim().length === 0) {
          response = 'Hola! ¿Cómo estás? 😊';
          log.warn('Using fallback response after empty regeneration');
        }
      }

      // Content moderation for behaviors
      if (behaviorOrchestration.activeBehaviors.length > 0) {
        const primaryBehavior = behaviorOrchestration.activeBehaviors[0];
        const behaviorProfile = agent.BehaviorProfile.find(
          bp => bp.behaviorType === primaryBehavior.behaviorType
        );

        const moderation = behaviorOrchestration.moderator.moderateResponse(
          response,
          primaryBehavior.behaviorType,
          behaviorProfile?.currentPhase || 1,
          agent.nsfwMode || false
        );

        if (!moderation.allowed) {
          response = moderation.warning || 'Lo siento, no puedo continuar con este tipo de contenido.';
        } else if (moderation.modifiedResponse) {
          response = moderation.modifiedResponse;
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // MULTIMEDIA PROCESSING
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const { multimedia, finalResponse, isAsync } = await this.processMultimedia(
        response,
        agentId,
        {
          name: agent.name,
          personality: agent.personality,
          description: agent.description,
          referenceImageUrl: agent.referenceImageUrl,
          voiceId: agent.voiceId,
          systemPrompt: agent.systemPrompt,
        },
        userId,
        userPlan  // Pass tier to apply limits
      );

      // If generation is asynchronous, the message was already sent
      // and finalResponse contains the waiting message
      if (isAsync) {
        log.info({ agentId, userId }, 'Async image generation started - returning waiting message');
      }

      const estimatedTokens = Math.ceil((content.length + finalResponse.length) / 4);

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // MEMORY REFERENCE DETECTION (🆕 Memory Highlights Feature)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const memoryReferences = detectMemoryReferences(finalResponse, memoryContext as any);

      if (memoryReferences.length > 0) {
        log.info(
          { agentId, userId, referenceCount: memoryReferences.length },
          'Memory references detected in agent response'
        );
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PARALLEL EXECUTION 2: Save all data + Track usage
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // Encriptar respuesta del asistente
      const assistantMessageEncryption = encryptMessage(finalResponse);

      const [assistantMessage] = await Promise.all([
        prisma.message.create({
          data: {
            id: nanoid(),
            agentId,
            userId, // Important: Include userId so messages are scoped to user
            role: 'assistant',
            content: assistantMessageEncryption.encrypted,
            iv: assistantMessageEncryption.iv,
            authTag: assistantMessageEncryption.authTag,
            metadata: {
              multimedia: multimedia.length > 0 ? multimedia : undefined,
              emotions: {
                dominant: emotionalSummary.dominant,
                secondary: emotionalSummary.secondary,
                mood: emotionalSummary.mood,
                pad: emotionalSummary.pad,
                visible: emotionalSummary.dominant,
              },
              relationLevel: newStage, // Use relationship stage instead of mood
              tokensUsed: estimatedTokens,
              behaviors: {
                active: behaviorOrchestration.metadata.behaviorsActive,
                phase: behaviorOrchestration.metadata.phase,
                safetyLevel: behaviorOrchestration.metadata.safetyLevel,
                triggers: behaviorOrchestration.metadata.triggers,
              },
              // 🆕 Memory Highlights: Add detected memory references
              memoryReferences: memoryReferences.length > 0
                ? memoryReferences.map(ref => ({
                    type: ref.type,
                    content: ref.content,
                    originalTimestamp: ref.originalTimestamp?.toISOString(),
                    context: ref.context,
                    confidence: ref.confidence,
                  }))
                : undefined,
              // 🆕 Revelation Moment: Mark if this message contains a revelation
              revelationMoment: revelationMoment ? {
                fromStage: revelationMoment.fromStage,
                toStage: revelationMoment.toStage,
                revelationType: revelationMoment.revelationType,
                importance: revelationMoment.importance,
              } : undefined,
            } as any,
          },
        }),
        // Update relation
        prisma.relation.update({
          where: { id: relation.id },
          data: {
            trust,
            affinity,
            respect,
            privateState: {
              love: (newEmotionState.joy + newEmotionState.trust) / 2,
              curiosity: (newEmotionState.surprise + newEmotionState.anticipation) / 2,
            },
            visibleState: { trust, affinity, respect },
            totalInteractions: newTotalInteractions,
            stage: newStage,
            lastInteractionAt: new Date(),
          },
        }),
        // Update internal state
        prisma.internalState.update({
          where: { agentId },
          data: {
            currentEmotions: newEmotionState as any,
            moodValence: emotionalSummary.pad.valence,
            moodArousal: emotionalSummary.pad.arousal,
            moodDominance: emotionalSummary.pad.dominance,
            lastUpdated: new Date(),
          },
        }),
        // Save revelation moment as episodic memory (if applicable)
        ...(stageChanged && revelationMoment ? [
          prisma.episodicMemory.create({
            data: {
              id: nanoid(),
              agentId,
              event: `Momento de revelación: La relación avanzó a ${newStage}`,
              userEmotion: 'connection',
              characterEmotion: revelationMoment.revelationType,
              emotionalValence: 0.8, // Positivo
              importance: revelationMoment.importance / 5, // Normalizar a 0-1
              metadata: {
                type: 'revelation_moment',
                fromStage: relation.stage,
                toStage: newStage,
                revelationType: revelationMoment.revelationType,
                timestamp: new Date().toISOString(),
              },
            },
          })
        ] : []),
      ]);

      // Store embeddings SELECTIVAMENTE (solo mensajes importantes, no bloqueante)
      // This reduces costs by 95% (~40K embeddings/day → ~2K embeddings/day)
      storeMessageSelectively(
        userMessage.id,
        content,
        'user',
        agentId,
        userId
      ).catch(err =>
        log.warn({ error: err.message }, 'Failed to store user message embedding')
      );

      storeMessageSelectively(
        assistantMessage.id,
        finalResponse,
        'assistant',
        agentId,
        userId
      ).catch(err =>
        log.warn({ error: err.message }, 'Failed to store assistant message embedding')
      );

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // BOND PROGRESSION: Update symbolic bond (non-blocking)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      this.getOrCreateBond(agentId, userId)
        .then(bond => {
          return processInteractionForBond(
            bond.id,
            content, // user message
            finalResponse, // agent response
            {
              emotionalState: {
                intensity: Math.max(
                  emotionalSummary.pad.valence,
                  emotionalSummary.pad.arousal
                ),
                valence: emotionalSummary.pad.valence,
              },
              memoryCreated: memoryReferences.length > 0,
            }
          );
        })
        .then(result => {
          if (result.success && result.milestone) {
            log.info(
              { bondId: result, milestone: result.milestone, affinityChange: result.affinityChange },
              'Bond milestone reached'
            );
          }
        })
        .catch(err =>
          log.warn({ error: err.message }, 'Failed to process bond progression')
        );

      log.info({ duration: timer(), agentId, userId }, 'Message processed successfully');

      return {
        userMessage: {
          id: userMessage.id,
          content: decryptMessageIfNeeded(userMessage.content, userMessage.iv, userMessage.authTag),
          createdAt: userMessage.createdAt,
        },
        assistantMessage: {
          id: assistantMessage.id,
          content: decryptMessageIfNeeded(assistantMessage.content, assistantMessage.iv, assistantMessage.authTag),
          createdAt: assistantMessage.createdAt,
          metadata: assistantMessage.metadata as Record<string, unknown>,
        },
        emotions: {
          dominant: emotionalSummary.dominant,
          secondary: emotionalSummary.secondary,
          mood: emotionalSummary.mood,
          pad: emotionalSummary.pad,
          detailed: {
            joy: Math.round(newEmotionState.joy * 100),
            trust: Math.round(newEmotionState.trust * 100),
            fear: Math.round(newEmotionState.fear * 100),
            surprise: Math.round(newEmotionState.surprise * 100),
            sadness: Math.round(newEmotionState.sadness * 100),
            disgust: Math.round(newEmotionState.disgust * 100),
            anger: Math.round(newEmotionState.anger * 100),
            anticipation: Math.round(newEmotionState.anticipation * 100),
          },
        },
        state: { trust, affinity, respect },
        relationship: {
          stage: newStage,
          totalInteractions: newTotalInteractions,
          stageChanged,
          evolutionLimit: getEvolutionLimitNotice(
            agent.name,
            userPlan as UserPlan,
            newStage as any,
            trust
          ) || undefined,
        },
        behaviors: {
          active: behaviorOrchestration.metadata.behaviorsActive,
          phase: behaviorOrchestration.metadata.phase,
          safetyLevel: behaviorOrchestration.metadata.safetyLevel,
          triggers: behaviorOrchestration.metadata.triggers,
        },
        usage: {
          messagesRemaining: 'unlimited', // TODO: Implement quota
          tokensUsed: estimatedTokens,
        },
      };
    } catch (error) {
      log.error({ error, agentId, userId, duration: timer() }, 'Failed to process message');
      throw error;
    }
  }

  /**
   * Save user message to the database (Phase 1 of async flow)
   * Encrypts content, creates message record, and ensures relation exists.
   * Returns the saved message ID and relation ID for use in the async job.
   */
  async saveUserMessage(input: {
    agentId: string;
    userId: string;
    content: string;
    messageType?: 'text' | 'audio' | 'gif' | 'image';
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string; content: string; createdAt: Date; relationId: string }> {
    const { agentId, userId, content, messageType = 'text', metadata = {} } = input;

    let contentForUser = content;
    let messageMetadata: Record<string, unknown> = { ...metadata };

    if (messageType === 'gif' && metadata.description) {
      messageMetadata = {
        ...metadata,
        messageType: 'gif',
        gifDescription: metadata.description,
      };
    } else if (messageType === 'audio') {
      messageMetadata = {
        ...metadata,
        messageType: 'audio',
        audioDuration: metadata.duration,
      };
    }

    const userMessageEncryption = encryptMessage(contentForUser);

    const [userMessage, relation] = await Promise.all([
      prisma.message.create({
        data: {
          id: nanoid(),
          agentId,
          userId,
          role: 'user',
          content: userMessageEncryption.encrypted,
          iv: userMessageEncryption.iv,
          authTag: userMessageEncryption.authTag,
          metadata: messageMetadata as any,
        },
      }),
      this.getOrCreateRelation(agentId, userId),
    ]);

    return {
      id: userMessage.id,
      content: contentForUser,
      createdAt: userMessage.createdAt,
      relationId: relation.id,
    };
  }

  /**
   * Generate AI response for an existing user message (Phase 2 of async flow)
   * Called by the BullMQ worker after saveUserMessage has already been called.
   * Returns the same ProcessMessageOutput shape (without re-saving user message).
   */
  async generateAIResponse(input: {
    userMessageId: string;
    agentId: string;
    userId: string;
    content: string;
    messageType?: 'text' | 'audio' | 'gif' | 'image';
    metadata?: Record<string, unknown>;
    userPlan?: string;
  }): Promise<ProcessMessageOutput> {
    const timer = startTimer();
    const { userMessageId, agentId, userId, content, messageType = 'text', metadata = {}, userPlan = 'free' } = input;

    log.info({ agentId, userId, userMessageId, userPlan }, 'Generating AI response (async)');

    const contextLimit = getContextLimit(userPlan);

    try {
      const [agent, recentMessages, userMessage] = await Promise.all([
        prisma.agent.findUnique({
          where: { id: agentId },
          include: {
            PersonalityCore: true,
            InternalState: true,
            SemanticMemory: true,
            CharacterGrowth: true,
            BehaviorProfile: true,
            User: {
              select: {
                location: true,
              },
            },
          },
        }),
        prisma.message.findMany({
          where: { agentId },
          orderBy: { createdAt: 'desc' },
          take: contextLimit,
          select: {
            id: true,
            role: true,
            content: true,
            iv: true,
            authTag: true,
            createdAt: true,
            metadata: true,
            userId: true,
            agentId: true,
          },
        }),
        prisma.message.findUnique({
          where: { id: userMessageId },
        }),
      ]);

      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      if (!userMessage) {
        throw new Error(`User message ${userMessageId} not found`);
      }

      const isOwnAgent = agent.userId === userId;
      const isSystemAgent = agent.userId === null;
      const isPublicAgent = agent.visibility === 'public';

      if (!isOwnAgent && !isSystemAgent && !isPublicAgent) {
        throw new Error('Forbidden: Agent is not accessible');
      }

      const decryptedRecentMessages = recentMessages.map(msg => ({
        ...msg,
        content: decryptMessageIfNeeded(msg.content, msg.iv, msg.authTag),
      }));

      let contentForAI = content;
      if (messageType === 'gif' && metadata.description) {
        contentForAI = `[User sent a GIF of: ${metadata.description}]`;
      }

      const relation = await this.getOrCreateRelation(agentId, userId);

      // Mark proactive message as responded (async, non-blocking)
      const lastAssistantMessage = await prisma.message.findFirst({
        where: {
          agentId,
          role: 'assistant',
          createdAt: { lt: userMessage.createdAt },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (lastAssistantMessage) {
        markProactiveMessageResponded(lastAssistantMessage.id).catch(err =>
          log.warn({ error: err, messageId: lastAssistantMessage.id }, 'Failed to mark proactive message as responded')
        );
      }

      const newTotalInteractions = relation.totalInteractions + 1;
      const newStage = getRelationshipStage(newTotalInteractions);
      const stageChanged = shouldAdvanceStage(
        newTotalInteractions,
        relation.stage as RelationshipStage
      );

      let revelationContext = "";
      let revelationMoment: ReturnType<typeof getRevelationMoment> = null;

      if (stageChanged) {
        revelationMoment = getRevelationMoment(
          relation.stage as RelationshipStage,
          newStage
        );

        if (revelationMoment) {
          const personality = agent.PersonalityCore ? {
            extraversion: agent.PersonalityCore.extraversion,
            neuroticism: agent.PersonalityCore.neuroticism,
            agreeableness: agent.PersonalityCore.agreeableness,
            openness: agent.PersonalityCore.openness,
            conscientiousness: agent.PersonalityCore.conscientiousness,
          } : undefined;

          revelationContext = generatePersonalizedRevelation(
            revelationMoment,
            agent.name,
            personality
          );
        }
      }

      log.debug({ agentId }, 'Processing emotions with Hybrid System');
      const emotionTimer = startTimer();

      const hybridResult = await hybridEmotionalOrchestrator.processMessage({
        agentId,
        userMessage: contentForAI,
        userId,
        generateResponse: false,
      });

      log.debug(
        { duration: emotionTimer(), path: hybridResult.metadata.path },
        'Emotional processing complete'
      );

      const newEmotionState = hybridResult.emotionState;
      const activeDyads = hybridResult.activeDyads;
      const emotionalSummary = getEmotionalSummary(newEmotionState);
      emotionalSummary.secondary = activeDyads.slice(0, 3).map(d => d.label);

      const trust = newEmotionState.trust;
      const affinity = (newEmotionState.joy + newEmotionState.trust) / 2;
      const respect = (newEmotionState.trust + newEmotionState.anticipation) / 2;

      const behaviorOrchestration = await behaviorOrchestrator.processIncomingMessage({
        agent,
        userMessage,
        recentMessages: decryptedRecentMessages,
        dominantEmotion: (emotionalSummary.dominant[0] || 'joy') as any,
        emotionalState: {
          valence: emotionalSummary.pad.valence,
          arousal: emotionalSummary.pad.arousal,
          dominance: emotionalSummary.pad.dominance,
        },
      });

      const stagePrompts = agent.stagePrompts as StagePrompts | null;

      const agentMessageCount = await prisma.message.count({
        where: {
          agentId,
          userId,
          role: 'assistant',
        },
      });

      const messageNumber = agentMessageCount + 1;

      const basePrompt = messageNumber <= 3
        ? getPromptForMessageNumber(messageNumber, newTotalInteractions, stagePrompts, {
            systemPrompt: agent.systemPrompt,
            name: agent.name,
          })
        : getPromptForStage(stagePrompts, newStage, agent.systemPrompt);

      const emotionalContext = this.buildEmotionalContext(
        emotionalSummary,
        activeDyads as any,
        hybridResult.metadata
      );

      let weatherContext: string | undefined;
      if (agent.User?.location) {
        const weather = await getUserWeather(agent.User.location);
        if (weather) {
          weatherContext = buildWeatherPrompt(weather);
        }
      }

      const temporalContext = buildTemporalPrompt(newStage, undefined, weatherContext);
      const reminderContext = await buildReminderContext(agentId, userId, newStage);
      const peopleContext = await buildPeopleContext(agentId, userId, newStage);

      let enhancedPrompt = basePrompt + '\n\n' + emotionalContext + '\n\n' + temporalContext;

      if (reminderContext) {
        enhancedPrompt += reminderContext;
      }

      if (peopleContext) {
        enhancedPrompt += peopleContext;
      }

      if (revelationContext) {
        enhancedPrompt += '\n\n' + revelationContext;
      }

      if (behaviorOrchestration.enhancedSystemPrompt) {
        enhancedPrompt += '\n\n' + behaviorOrchestration.enhancedSystemPrompt;
      }

      try {
        const relevantCommand = await getTopRelevantCommand(content, agentId);
        if (relevantCommand) {
          const knowledgeContext = await getKnowledgeGroup(agentId, relevantCommand);
          enhancedPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          enhancedPrompt += `📌 INFORMACIÓN RELEVANTE PARA ESTA CONVERSACIÓN:\n`;
          enhancedPrompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          enhancedPrompt += knowledgeContext;
          enhancedPrompt += `\n\n⚠️ IMPORTANT: This information is relevant to the user's question.\n`;
          enhancedPrompt += `Úsala naturalmente en tu respuesta, pero NO menciones que "consultaste" algo.\n`;
          enhancedPrompt += `Respond as if you had always had this information in your memory.\n`;
        }
      } catch (error) {
        log.warn({ error }, 'Error in proactive knowledge detection, continuing without it');
      }

      try {
        const memoryQueryResult = await memoryQueryHandler.handleQuery(
          content,
          agentId,
          userId,
          {
            maxMemories: 5,
            minSimilarity: 0.5,
            maxTokens: 1000,
            useSemanticSearch: true,
          }
        );

        if (memoryQueryResult.detected && memoryQueryResult.contextPrompt) {
          enhancedPrompt += '\n\n' + memoryQueryResult.contextPrompt;
        }
      } catch (error) {
        log.warn({ error }, 'Error en memory query detection, continuando sin ella');
      }

      const memoryManager = createMemoryManager(agentId, userId);
      const finalPrompt = await memoryManager.buildEnhancedPrompt(
        enhancedPrompt,
        contentForAI
      );

      const { injectSFWProtection } = await import('@/lib/middleware/sfw-injector');
      const promptWithSFW = await injectSFWProtection(finalPrompt, userId, agentId);

      const agentProfile = agent.profile as any;
      const characterOrigin =
        agentProfile?.origin ||
        agentProfile?.nationality ||
        agentProfile?.country ||
        agentProfile?.birthplace ||
        agentProfile?.world ||
        undefined;

      const modularPrompt = await getContextualModularPrompt({
        personalityVariant: agent.personalityVariant || undefined,
        personalityTraits: !agent.personalityVariant ? (agent.personality || '') : undefined,
        relationshipStage: relation.stage,
        recentMessages: decryptedRecentMessages.map(m => m.content).slice(0, 5),
        nsfwMode: agent.nsfwMode,
        userTier: userPlan === 'ultra' ? 'ultra' : userPlan === 'plus' ? 'plus' : 'free',
        characterInfo: characterOrigin ? {
          origin: characterOrigin,
          name: agent.name,
          age: agentProfile?.age,
        } : undefined,
      });

      let enhancedPromptFinal = promptWithSFW;
      if (modularPrompt) {
        enhancedPromptFinal += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        enhancedPromptFinal += '🎯 GUÍA CONTEXTUAL DE COMPORTAMIENTO:\n';
        enhancedPromptFinal += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        enhancedPromptFinal += modularPrompt;
        enhancedPromptFinal += '\n\n⚠️ IMPORTANTE: Esta guía define CÓMO debes comportarte según tu personalidad y el contexto actual. Síguela naturalmente.\n';
      }

      const veniceClient = getVeniceClient();

      const allMessages = [
        ...decryptedRecentMessages.reverse().map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          id: m.id,
          createdAt: m.createdAt,
        })),
        {
          role: 'user' as const,
          content: contentForAI,
          id: userMessage.id,
          createdAt: userMessage.createdAt,
        }
      ];

      const compressionResult = await compressContext(allMessages, contextLimit);
      const conversationMessages = compressionResult.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const veniceResponse = await veniceClient.generateWithMessages({
        systemPrompt: enhancedPromptFinal,
        messages: conversationMessages,
        temperature: 0.95,
        maxTokens: 1500,
        model: 'venice-uncensored',
      });

      let response = veniceResponse;

      const inputTokensFirst = estimateTokens(
        enhancedPromptFinal + '\n' + conversationMessages.map(m => m.content).join('\n')
      );
      const outputTokensFirst = estimateTokens(response);
      trackLLMCall({
        userId,
        agentId,
        provider: 'venice',
        model: 'venice-uncensored',
        inputTokens: inputTokensFirst,
        outputTokens: outputTokensFirst,
        metadata: { messageType, stage: 'initial-generation' },
      }).catch(err => log.warn({ error: err.message }, 'Failed to track Venice cost'));

      const interceptResult = await interceptKnowledgeCommand(agentId, response);

      if (interceptResult.shouldIntercept && interceptResult.knowledgeContext) {
        await logCommandUsage(agentId, interceptResult.command!, interceptResult.knowledgeContext.length);

        const expandedPrompt = buildExpandedPrompt(finalPrompt, interceptResult.knowledgeContext, interceptResult.command!);
        const veniceExpandedResponse = await veniceClient.generateWithMessages({
          systemPrompt: expandedPrompt,
          messages: conversationMessages,
          temperature: 0.95,
          maxTokens: 1500,
          model: 'venice-uncensored',
        });

        response = veniceExpandedResponse;

        trackLLMCall({
          userId,
          agentId,
          provider: 'venice',
          model: 'venice-uncensored',
          inputTokens: estimateTokens(expandedPrompt + '\n' + conversationMessages.map(m => m.content).join('\n')),
          outputTokens: estimateTokens(response),
          metadata: { messageType, stage: 'knowledge-expansion', command: interceptResult.command },
        }).catch(err => log.warn({ error: err.message }, 'Failed to track Venice cost'));

        const finalInterceptResult = await interceptKnowledgeCommand(agentId, response);
        response = finalInterceptResult.cleanResponse;
      } else {
        response = interceptResult.cleanResponse;
      }

      const searchResult = await interceptSearchCommand(agentId, userId, response);
      let memoryContext = '';

      if (searchResult.shouldIntercept && searchResult.memoryContext) {
        memoryContext = searchResult.memoryContext;
        const expandedPromptWithMemory = finalPrompt + searchResult.memoryContext;
        const llmProvider = getLLMProvider();
        response = await llmProvider.generate({
          systemPrompt: expandedPromptWithMemory,
          messages: conversationMessages,
        });

        trackLLMCall({
          userId,
          agentId,
          provider: 'google',
          model: process.env.GEMINI_MODEL_LITE || 'gemini-2.5-flash-lite',
          inputTokens: estimateTokens(expandedPromptWithMemory + '\n' + conversationMessages.map(m => m.content).join('\n')),
          outputTokens: estimateTokens(response),
          metadata: { messageType, stage: 'memory-search', searchQuery: searchResult.searchQuery },
        }).catch(err => log.warn({ error: err.message }, 'Failed to track LLM cost'));

        response = searchResult.cleanResponse;
      }

      const rememberResult = await interceptRememberCommands(agentId, userId, response);
      if (rememberResult.shouldIntercept) {
        response = rememberResult.cleanResponse;
      }

      const personResult = await interceptPersonCommands(agentId, userId, response);
      if (personResult.shouldIntercept) {
        response = personResult.cleanResponse;
      }

      if (!response || response.trim().length === 0) {
        log.error({ originalResponse: response }, 'Response became empty after interceptors - regenerating');
        const llmProvider = getLLMProvider();
        response = await llmProvider.generate({
          systemPrompt: finalPrompt + '\n\n⚠️ IMPORTANTE: NO uses comandos ([INTERESTS], [WORK], etc.) en tu respuesta. Responde directamente con texto natural.',
          messages: conversationMessages,
        });

        const finalClean = await interceptKnowledgeCommand(agentId, response);
        response = finalClean.cleanResponse;

        if (!response || response.trim().length === 0) {
          response = 'Hola! ¿Cómo estás? 😊';
          log.warn('Using fallback response after empty regeneration');
        }
      }

      if (behaviorOrchestration.activeBehaviors.length > 0) {
        const primaryBehavior = behaviorOrchestration.activeBehaviors[0];
        const behaviorProfile = agent.BehaviorProfile.find(
          bp => bp.behaviorType === primaryBehavior.behaviorType
        );

        const moderation = behaviorOrchestration.moderator.moderateResponse(
          response,
          primaryBehavior.behaviorType,
          behaviorProfile?.currentPhase || 1,
          agent.nsfwMode || false
        );

        if (!moderation.allowed) {
          response = moderation.warning || 'Lo siento, no puedo continuar con este tipo de contenido.';
        } else if (moderation.modifiedResponse) {
          response = moderation.modifiedResponse;
        }
      }

      const { multimedia, finalResponse, isAsync } = await this.processMultimedia(
        response,
        agentId,
        {
          name: agent.name,
          personality: agent.personality,
          description: agent.description,
          referenceImageUrl: agent.referenceImageUrl,
          voiceId: agent.voiceId,
          systemPrompt: agent.systemPrompt,
        },
        userId,
        userPlan
      );

      if (isAsync) {
        log.info({ agentId, userId }, 'Async image generation started - returning waiting message');
      }

      const estimatedTokens = Math.ceil((content.length + finalResponse.length) / 4);

      const memoryReferences = detectMemoryReferences(finalResponse, memoryContext as any);

      const assistantMessageEncryption = encryptMessage(finalResponse);

      const [assistantMessage] = await Promise.all([
        prisma.message.create({
          data: {
            id: nanoid(),
            agentId,
            userId,
            role: 'assistant',
            content: assistantMessageEncryption.encrypted,
            iv: assistantMessageEncryption.iv,
            authTag: assistantMessageEncryption.authTag,
            metadata: {
              multimedia: multimedia.length > 0 ? multimedia : undefined,
              emotions: {
                dominant: emotionalSummary.dominant,
                secondary: emotionalSummary.secondary,
                mood: emotionalSummary.mood,
                pad: emotionalSummary.pad,
                visible: emotionalSummary.dominant,
              },
              relationLevel: newStage,
              tokensUsed: estimatedTokens,
              behaviors: {
                active: behaviorOrchestration.metadata.behaviorsActive,
                phase: behaviorOrchestration.metadata.phase,
                safetyLevel: behaviorOrchestration.metadata.safetyLevel,
                triggers: behaviorOrchestration.metadata.triggers,
              },
              memoryReferences: memoryReferences.length > 0
                ? memoryReferences.map(ref => ({
                    type: ref.type,
                    content: ref.content,
                    originalTimestamp: ref.originalTimestamp?.toISOString(),
                    context: ref.context,
                    confidence: ref.confidence,
                  }))
                : undefined,
              revelationMoment: revelationMoment ? {
                fromStage: revelationMoment.fromStage,
                toStage: revelationMoment.toStage,
                revelationType: revelationMoment.revelationType,
                importance: revelationMoment.importance,
              } : undefined,
            } as any,
          },
        }),
        prisma.relation.update({
          where: { id: relation.id },
          data: {
            trust,
            affinity,
            respect,
            privateState: {
              love: (newEmotionState.joy + newEmotionState.trust) / 2,
              curiosity: (newEmotionState.surprise + newEmotionState.anticipation) / 2,
            },
            visibleState: { trust, affinity, respect },
            totalInteractions: newTotalInteractions,
            stage: newStage,
            lastInteractionAt: new Date(),
          },
        }),
        prisma.internalState.update({
          where: { agentId },
          data: {
            currentEmotions: newEmotionState as any,
            moodValence: emotionalSummary.pad.valence,
            moodArousal: emotionalSummary.pad.arousal,
            moodDominance: emotionalSummary.pad.dominance,
            lastUpdated: new Date(),
          },
        }),
        ...(stageChanged && revelationMoment ? [
          prisma.episodicMemory.create({
            data: {
              id: nanoid(),
              agentId,
              event: `Momento de revelación: La relación avanzó a ${newStage}`,
              userEmotion: 'connection',
              characterEmotion: revelationMoment.revelationType,
              emotionalValence: 0.8,
              importance: revelationMoment.importance / 5,
              metadata: {
                type: 'revelation_moment',
                fromStage: relation.stage,
                toStage: newStage,
                revelationType: revelationMoment.revelationType,
                timestamp: new Date().toISOString(),
              },
            },
          })
        ] : []),
      ]);

      storeMessageSelectively(userMessageId, content, 'user', agentId, userId)
        .catch(err => log.warn({ error: err.message }, 'Failed to store user message embedding'));

      storeMessageSelectively(assistantMessage.id, finalResponse, 'assistant', agentId, userId)
        .catch(err => log.warn({ error: err.message }, 'Failed to store assistant message embedding'));

      this.getOrCreateBond(agentId, userId)
        .then(bond => {
          return processInteractionForBond(
            bond.id,
            content,
            finalResponse,
            {
              emotionalState: {
                intensity: Math.max(emotionalSummary.pad.valence, emotionalSummary.pad.arousal),
                valence: emotionalSummary.pad.valence,
              },
              memoryCreated: memoryReferences.length > 0,
            }
          );
        })
        .catch(err => log.warn({ error: err.message }, 'Failed to process bond progression'));

      log.info({ duration: timer(), agentId, userId }, 'AI response generated successfully (async)');

      return {
        userMessage: {
          id: userMessageId,
          content,
          createdAt: userMessage.createdAt,
        },
        assistantMessage: {
          id: assistantMessage.id,
          content: decryptMessageIfNeeded(assistantMessage.content, assistantMessage.iv, assistantMessage.authTag),
          createdAt: assistantMessage.createdAt,
          metadata: assistantMessage.metadata as Record<string, unknown>,
        },
        emotions: {
          dominant: emotionalSummary.dominant,
          secondary: emotionalSummary.secondary,
          mood: emotionalSummary.mood,
          pad: emotionalSummary.pad,
          detailed: {
            joy: Math.round(newEmotionState.joy * 100),
            trust: Math.round(newEmotionState.trust * 100),
            fear: Math.round(newEmotionState.fear * 100),
            surprise: Math.round(newEmotionState.surprise * 100),
            sadness: Math.round(newEmotionState.sadness * 100),
            disgust: Math.round(newEmotionState.disgust * 100),
            anger: Math.round(newEmotionState.anger * 100),
            anticipation: Math.round(newEmotionState.anticipation * 100),
          },
        },
        state: { trust, affinity, respect },
        relationship: {
          stage: newStage,
          totalInteractions: newTotalInteractions,
          stageChanged,
          evolutionLimit: getEvolutionLimitNotice(
            agent.name,
            userPlan as UserPlan,
            newStage as any,
            trust
          ) || undefined,
        },
        behaviors: {
          active: behaviorOrchestration.metadata.behaviorsActive,
          phase: behaviorOrchestration.metadata.phase,
          safetyLevel: behaviorOrchestration.metadata.safetyLevel,
          triggers: behaviorOrchestration.metadata.triggers,
        },
        usage: {
          messagesRemaining: 'unlimited',
          tokensUsed: estimatedTokens,
        },
      };
    } catch (error) {
      log.error({ error, agentId, userId, userMessageId, duration: timer() }, 'Failed to generate AI response');
      throw error;
    }
  }

  /**
   * Get or create relation between agent and user
   * OPTIMIZED: Uses findFirst with upsert pattern
   */
  private async getOrCreateRelation(agentId: string, userId: string) {
    const existing = await prisma.relation.findFirst({
      where: {
        subjectId: agentId,
        targetId: userId,
        targetType: 'user',
      },
    });

    if (existing) return existing;

    return prisma.relation.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        subjectId: agentId,
        targetId: userId,
        targetType: 'user',
        trust: 0.5,
        affinity: 0.5,
        respect: 0.5,
        privateState: { love: 0, curiosity: 0 },
        visibleState: { trust: 0.5, affinity: 0.5, respect: 0.5 },
        stage: 'stranger',
        totalInteractions: 0,
      },
    });
  }

  /**
   * Get or create symbolic bond between agent and user
   * Bonds track the deeper relationship progression beyond basic stats
   */
  private async getOrCreateBond(agentId: string, userId: string) {
    const existing = await prisma.symbolicBond.findFirst({
      where: {
        agentId,
        userId,
      },
    });

    if (existing) return existing;

    // Create new bond starting as ACQUAINTANCE
    return prisma.symbolicBond.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        agentId,
        userId,
        tier: 'ACQUAINTANCE',
        status: 'active',
        affinityLevel: 0,
        totalInteractions: 0,
        durationDays: 0,
        rarityScore: 0.1,
        rarityTier: 'Common',
      },
    });
  }

  /**
   * Build emotional context string for prompt
   */
  private buildEmotionalContext(
    emotionalSummary: {
      dominant: string[];
      mood: string;
      pad: { valence: number; arousal: number; dominance: number };
    },
    activeDyads: Array<{
      label: string;
      intensity: number;
      components: [string, string, string];
    }>,
    metadata: {
      emotionalStability: number;
      path: string;
    }
  ): string {
    let context = `\nEstado emocional actual:\n- Emociones primarias: ${emotionalSummary.dominant.join(', ')}\n`;

    if (activeDyads.length > 0) {
      const dyadDescriptions = activeDyads.slice(0, 3).map(dyad => {
        const intensity = (dyad.intensity * 100).toFixed(0);
        return `${dyad.label} (${intensity}% - ${dyad.components[0]}+${dyad.components[2]})`;
      }).join(', ');

      context += `- Emociones secundarias (dyads): ${dyadDescriptions}\n`;
    }

    context += `- Mood general: ${emotionalSummary.mood}\n`;
    context += `- Valence (placer): ${(emotionalSummary.pad.valence * 100).toFixed(0)}%\n`;
    context += `- Arousal (activación): ${(emotionalSummary.pad.arousal * 100).toFixed(0)}%\n`;
    context += `- Estabilidad emocional: ${(metadata.emotionalStability * 100).toFixed(0)}%\n`;
    context += `\nRefleja estas emociones de manera sutil en tu tono y respuestas.`;

    return context;
  }

  /**
   * Process multimedia tags in response
   * 
   * Detects if there are [IMAGE:] tags and decides whether to generate synchronously (fast) or asynchronously (AI Horde with long times)
   * 
   * IMPORTANT: Applies configurable limits based on tier and strategy (.env)
   */
  private async processMultimedia(
    response: string,
    agentId: string,
    agent: {
      name: string;
      personality: string | null;
      description: string | null;
      referenceImageUrl: string | null;
      voiceId: string | null;
      systemPrompt?: string;
    },
    userId: string,
    userPlan: string = 'free'
  ): Promise<{ multimedia: Array<Record<string, unknown>>; finalResponse: string; isAsync?: boolean }> {
    const { parseMultimediaTags, validateMultimediaUsage } = await import('@/lib/multimedia/parser');

    const parsedResponse = parseMultimediaTags(response);
    const multimediaValidation = validateMultimediaUsage(parsedResponse);

    if (!parsedResponse.hasMultimedia || !multimediaValidation.valid) {
      return { multimedia: [], finalResponse: response };
    }

    // Detect if there are images (that require asynchronous generation)
    const imageTags = parsedResponse.multimediaTags.filter((tag) => tag.type === 'image');
    const audioTags = parsedResponse.multimediaTags.filter((tag) => tag.type === 'audio');

    // If there are images, verify limits and use ASYNCHRONOUS generation
    if (imageTags.length > 0) {
      log.info({ count: imageTags.length, userPlan }, 'Detected image tags - checking limits');

      // Verify limits for FREE users
      const { canUseFreeMultimedia } = await import('@/lib/multimedia/limits');
      const limitCheck = await canUseFreeMultimedia(userId, 'image', userPlan);

      if (!limitCheck.allowed) {
        log.warn(
          { userId, userPlan, reason: limitCheck.reason },
          'Image generation blocked by limits'
        );

        // Retornar mensaje de upgrade en lugar de la imagen
        return {
          multimedia: [],
          finalResponse: limitCheck.upgradeMessage || 'Actualiza a Plus para usar generación de imágenes.',
          isAsync: false,
        };
      }

      // If allowed, generate
      const { asyncImageGenerator } = await import('@/lib/multimedia/async-image-generator');

      // Generate only the FIRST image asynchronously
      const firstImageTag = imageTags[0];

      const result = await asyncImageGenerator.startAsyncGeneration({
        agentId,
        agentName: agent.name,
        agentPersonality: agent.personality || agent.description || '',
        agentSystemPrompt: agent.systemPrompt,
        userId,
        referenceImageUrl: agent.referenceImageUrl || undefined,
        description: firstImageTag.description,
      });

      // If it is trial lifetime, add information to the wait message
      if (limitCheck.current !== undefined && limitCheck.limit !== undefined) {
        const remaining = limitCheck.limit - limitCheck.current - 1; // -1 because one is already being used
        result.waitingMessage.content += ` (Fotos restantes: ${remaining}/${limitCheck.limit})`;
      }

      // Return the wait message (without multimedia yet)
      return {
        multimedia: [],
        finalResponse: result.waitingMessage.content,
        isAsync: true,
      };
    }

    // If only audio, verify limits and generate synchronously (it's fast with ElevenLabs)
    if (audioTags.length > 0) {
      log.debug({ count: audioTags.length, userPlan }, 'Detected audio tags - checking limits');

      // Check limits for FREE users
      const { canUseFreeMultimedia } = await import('@/lib/multimedia/limits');
      const limitCheck = await canUseFreeMultimedia(userId, 'voice', userPlan);

      if (!limitCheck.allowed) {
        log.warn(
          { userId, userPlan, reason: limitCheck.reason },
          'Voice generation blocked by limits'
        );

        // Retornar mensaje de upgrade en lugar del audio
        return {
          multimedia: [],
          finalResponse: limitCheck.upgradeMessage || 'Actualiza a Plus para usar mensajes de voz.',
          isAsync: false,
        };
      }

      // If allowed, generate
      const { MultimediaGenerator } = await import('@/lib/multimedia/generator');
      const generator = new MultimediaGenerator();

      const multimedia = await generator.generateMultimediaContent(audioTags, {
        agentId,
        agentName: agent.name,
        agentPersonality: agent.personality || agent.description || '',
        referenceImageUrl: agent.referenceImageUrl || undefined,
        voiceId: agent.voiceId || undefined,
        userId,
      });

      // If it is trial lifetime, add information to the response
      let finalResponse = parsedResponse.textContent;
      if (limitCheck.current !== undefined && limitCheck.limit !== undefined) {
        const remaining = limitCheck.limit - limitCheck.current - 1;
        finalResponse += ` (Mensajes de voz restantes: ${remaining}/${limitCheck.limit})`;
      }

      return {
        multimedia: multimedia as unknown as Array<Record<string, unknown>>,
        finalResponse,
      };
    }

    return { multimedia: [], finalResponse: response };
  }

  /**
   * Process demo message (simplified version without database persistence)
   * For landing page chat demos
   */
  async processDemoMessage({
    agentId,
    content,
    session,
  }: {
    agentId: string;
    content: string;
    session: import('@/lib/services/demo-session.service').DemoSession;
  }): Promise<{
    content: string;
    emotions: {
      mood: string;
      dominant: string[];
      secondary: string[];
      pad: { valence: number; arousal: number; dominance: number };
      detailed: Record<string, number>;
    };
    emotionalState: import('@/lib/services/demo-session.service').DemoEmotionalState;
  }> {
    const timer = startTimer();
    log.info({ agentId, sessionId: session.id }, 'Processing demo message');

    try {
      // 1. Get agent with necessary relations
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        include: {
          PersonalityCore: true,
          InternalState: true,
          SemanticMemory: true,
        },
      });

      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // 2. Build conversation history from session
      const conversationMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = session.history.map((msg) => ({
        role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: msg.content,
      }));

      // Add current user message
      conversationMessages.push({
        role: 'user' as const,
        content,
      });

      log.debug({ messageCount: conversationMessages.length }, 'Built conversation history');

      // 3. Basic emotional processing (simplified)
      let emotionalState = session.emotionalState;

      // Detect sentiment from message to update emotions
      const _contentLower = content.toLowerCase();
      const isPositive = /gracias|bien|genial|excelente|feliz|alegre|bueno/i.test(content);
      const isNegative = /mal|triste|terrible|horrible|difícil|problema/i.test(content);

      if (isPositive) {
        emotionalState = {
          ...emotionalState,
          mood: 'happy',
          emotions: {
            joy: Math.min(1, (emotionalState.emotions.joy || 0) + 0.1),
            anticipation: Math.min(1, (emotionalState.emotions.anticipation || 0) + 0.05),
            trust: Math.min(1, (emotionalState.emotions.trust || 0) + 0.05),
          },
          valence: 0.7,
          arousal: 0.6,
          dominance: 0.5,
        };
      } else if (isNegative) {
        emotionalState = {
          ...emotionalState,
          mood: 'empathetic',
          emotions: {
            sadness: Math.min(1, (emotionalState.emotions.sadness || 0) + 0.1),
            fear: Math.min(1, (emotionalState.emotions.fear || 0) + 0.05),
          },
          valence: 0.3,
          arousal: 0.4,
          dominance: 0.4,
        };
      }

      // 4. Build enhanced prompt for demo using same system as normal chat
      // Count messages to determine which prompt to use (simulate first contact for demo)
      const userMessagesInSession = session.history.filter(m => m.role === 'user').length;
      const messageNumber = userMessagesInSession + 1; // +1 because we're about to process a new message

      log.debug({ messageNumber, historyLength: session.history.length }, 'Demo message number');

      // Use the same prompt system as normal chat, but for first 3 messages
      // This ensures Luna behaves exactly the same as in real chat
      const basePrompt = getPromptForMessageNumber(
        Math.min(messageNumber, 3), // Cap at 3 since demo only has 3 messages
        messageNumber, // totalInteractions = messageNumber for demo
        null, // stagePrompts not needed for messages 1-3
        {
          systemPrompt: agent.systemPrompt,
          name: agent.name,
        }
      );

      const emotionalContext = `\n\nESTADO EMOCIONAL ACTUAL: ${emotionalState.mood}
Emociones: ${Object.entries(emotionalState.emotions).map(([emotion, value]) => `${emotion}: ${(value * 100).toFixed(0)}%`).join(', ')}
Responde de manera coherente con este estado emocional.`;

      const demoContext = `\n\nCONTEXTO DEMO - AJUSTE DE LONGITUD:
Esta es una conversación demo. Mantén tus respuestas BREVES (2-3 oraciones cortas).
Conserva tu personalidad completa, pero sé más concisa que de costumbre.`;

      const finalPrompt = basePrompt + emotionalContext + demoContext;

      // 5. Generate response with LLM
      log.debug('Getting LLM provider');
      const llmProvider = getLLMProvider();

      log.debug({ promptLength: finalPrompt.length, messageCount: conversationMessages.length }, 'Calling LLM generate');
      const response = await llmProvider.generate({
        systemPrompt: finalPrompt,
        messages: conversationMessages,
        temperature: 0.9,
        maxTokens: 200, // Short but natural responses for demos (2-3 sentences with full personality)
      });

      log.debug({ responseLength: response.length }, 'LLM response received');

      // 6. Build emotional summary for response
      const emotions = emotionalState.emotions;
      const sortedEmotions = Object.entries(emotions)
        .sort(([, a], [, b]) => b - a)
        .map(([emotion]) => emotion);

      const emotionalSummary = {
        mood: emotionalState.mood,
        dominant: sortedEmotions.slice(0, 2),
        secondary: sortedEmotions.slice(2, 5),
        pad: {
          valence: emotionalState.valence || 0.5,
          arousal: emotionalState.arousal || 0.5,
          dominance: emotionalState.dominance || 0.5,
        },
        detailed: emotions,
      };

      const elapsed = timer();
      log.info({ sessionId: session.id, elapsed, responseLength: response.length }, 'Demo message processed');

      return {
        content: response,
        emotions: emotionalSummary,
        emotionalState,
      };
    } catch (error: any) {
      log.error({ error, sessionId: session.id }, 'Error processing demo message');
      throw new Error(`Failed to process demo message: ${error.message}`);
    }
  }
}

// Export singleton instance
export const messageService = new MessageService();
