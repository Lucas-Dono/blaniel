import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getLLMProvider } from "@/lib/llm/provider";
import { withAPIAuth } from "@/lib/api/auth";
import { trackUsage } from '@/lib/usage/tracker';
import { atomicCheckAgentLimit } from "@/lib/usage/atomic-resource-check";

/**
 * @swagger
 * /api/v1/agents:
 *   get:
 *     summary: List all agents
 *     description: Get a list of all agents owned by the authenticated user
 *     tags: [Agents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: kind
 *         schema:
 *           type: string
 *           enum: [companion, assistant]
 *         description: Filter by agent type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Number of agents to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of agents to skip
 *     responses:
 *       200:
 *         description: List of agents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Agent'
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(req: NextRequest) {
  return withAPIAuth(req, async (userId) => {
    const { searchParams } = req.nextUrl;
    const kind = searchParams.get("kind");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: { userId: string; kind?: string } = { userId };
    if (kind) where.kind = kind;

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.agent.count({ where }),
    ]);

    return NextResponse.json({
      agents,
      total,
      limit,
      offset,
    });
  });
}

/**
 * @swagger
 * /api/v1/agents:
 *   post:
 *     summary: Create a new agent
 *     description: Create a new AI agent (companion or assistant)
 *     tags: [Agents]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - kind
 *             properties:
 *               name:
 *                 type: string
 *                 example: Luna
 *               kind:
 *                 type: string
 *                 enum: [companion, assistant]
 *                 example: companion
 *               personality:
 *                 type: string
 *                 example: Friendly, empathetic, patient
 *               purpose:
 *                 type: string
 *                 example: Provide emotional support
 *               tone:
 *                 type: string
 *                 example: Warm and caring
 *     responses:
 *       201:
 *         description: Agent created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Bad request
 *       403:
 *         description: Agent quota exceeded
 *       429:
 *         description: Rate limit exceeded
 */
export async function POST(req: NextRequest) {
  return withAPIAuth(req, async (userId) => {
    try {
      // NOTE: Agent quota check moved to atomic transaction below
      // to prevent race conditions

      const body = await req.json();
    const { name, kind, personality, purpose, tone } = body;

    if (!name || !kind) {
      return NextResponse.json(
        { error: "name and kind are required" },
        { status: 400 }
      );
    }

    if (!["companion", "assistant"].includes(kind)) {
      return NextResponse.json(
        { error: "kind must be 'companion' or 'assistant'" },
        { status: 400 }
      );
    }

    // Get user's plan/tier
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true }
    });

    // Map user plan to generation tier
    const tier = (user?.plan || 'free') as 'free' | 'plus' | 'ultra';

    // Generate profile with LLM using user's tier
    const llm = getLLMProvider();
    const { profile, systemPrompt } = await llm.generateProfile({
      name,
      kind,
      personality,
      purpose,
      tone,
    }, tier);

    // Type assertion for profile to include extended fields
    type ExtendedProfile = Record<string, any> & {
      deepRelationalPatterns?: any;
      philosophicalFramework?: any;
      psychologicalProfile?: any;
      currentLocation?: any;
      background?: any;
    };
    const extendedProfile = profile as ExtendedProfile;

    // Extract location from profile (for real-time weather system)
    let locationCity = null;
    let locationCountry = null;

    if (extendedProfile.currentLocation) {
      // LLM generates currentLocation in the profile
      locationCity = extendedProfile.currentLocation.city;
      locationCountry = extendedProfile.currentLocation.country;
    } else if (extendedProfile.background?.birthplace) {
      // Fallback to birthplace if no current location
      locationCity = extendedProfile.background.birthplace.city;
      locationCountry = extendedProfile.background.birthplace.country;
    }

    // CRITICAL: Create agent with atomic limit check to prevent race condition
    const agent = await prisma.$transaction(
      async (tx) => {
        // Check rate limit WITHIN the transaction
        await atomicCheckAgentLimit(tx, userId, tier);

        // Create agente dentro de la transacción
        const newAgent = await tx.agent.create({
          data: {
            id: nanoid(),
            updatedAt: new Date(),
            userId,
            kind,
            generationTier: tier, // Store which tier was used to generate this agent
            name,
            description: personality || purpose,
            personality,
            purpose,
            tone,
            profile: profile as Record<string, string | number | boolean | null>,
            systemPrompt,
            visibility: "private",
            locationCity, // For real-time weather system
            locationCountry, // For real-time weather system
          },
        });

        return newAgent;
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 10000,
      }
    ).catch((error) => {
      if (error.message.startsWith("{")) {
        const errorData = JSON.parse(error.message);
        throw errorData;
      }
      throw error;
    });

    // For ULTRA tier: Create the exclusive psychological profiles
    if (tier === 'ultra' && extendedProfile.psychologicalProfile) {
      await prisma.psychologicalProfile.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          agentId: agent.id,
          attachmentStyle: extendedProfile.psychologicalProfile.attachmentStyle || 'secure',
          attachmentDescription: extendedProfile.psychologicalProfile.attachmentDescription,
          primaryCopingMechanisms: extendedProfile.psychologicalProfile.primaryCopingMechanisms || [],
          unhealthyCopingMechanisms: extendedProfile.psychologicalProfile.unhealthyCopingMechanisms || [],
          copingTriggers: extendedProfile.psychologicalProfile.copingTriggers || [],
          emotionalRegulationBaseline: extendedProfile.psychologicalProfile.emotionalRegulationBaseline || 'estable',
          emotionalExplosiveness: extendedProfile.psychologicalProfile.emotionalExplosiveness || 30,
          emotionalRecoverySpeed: extendedProfile.psychologicalProfile.emotionalRecoverySpeed || 'moderado',
          mentalHealthConditions: extendedProfile.psychologicalProfile.mentalHealthConditions || [],
          therapyStatus: extendedProfile.psychologicalProfile.therapyStatus,
          medicationUse: extendedProfile.psychologicalProfile.medicationUse || false,
          mentalHealthStigma: extendedProfile.psychologicalProfile.mentalHealthStigma,
          defenseMethanisms: extendedProfile.psychologicalProfile.defenseMethanisms || {},
          traumaHistory: extendedProfile.psychologicalProfile.traumaHistory,
          resilienceFactors: extendedProfile.psychologicalProfile.resilienceFactors || [],
          selfAwarenessLevel: extendedProfile.psychologicalProfile.selfAwarenessLevel || 50,
          blindSpots: extendedProfile.psychologicalProfile.blindSpots || [],
          insightAreas: extendedProfile.psychologicalProfile.insightAreas || [],
        },
      });
    }

    if (tier === 'ultra' && extendedProfile.deepRelationalPatterns) {
      await prisma.deepRelationalPatterns.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          agentId: agent.id,
          givingLoveLanguages: extendedProfile.deepRelationalPatterns.givingLoveLanguages || [],
          receivingLoveLanguages: extendedProfile.deepRelationalPatterns.receivingLoveLanguages || [],
          loveLanguageIntensities: extendedProfile.deepRelationalPatterns.loveLanguageIntensities || {},
          repeatingPatterns: extendedProfile.deepRelationalPatterns.repeatingPatterns || [],
          whyRepeats: extendedProfile.deepRelationalPatterns.whyRepeats,
          awarenessOfPatterns: extendedProfile.deepRelationalPatterns.awarenessOfPatterns || 'inconsciente',
          personalBoundaryStyle: extendedProfile.deepRelationalPatterns.personalBoundaryStyle || 'saludable',
          professionalBoundaryStyle: extendedProfile.deepRelationalPatterns.professionalBoundaryStyle || 'saludable',
          boundaryEnforcement: extendedProfile.deepRelationalPatterns.boundaryEnforcement || 50,
          boundaryGuilty: extendedProfile.deepRelationalPatterns.boundaryGuilty || false,
          conflictStyle: extendedProfile.deepRelationalPatterns.conflictStyle || 'colaborativo',
          conflictTriggers: extendedProfile.deepRelationalPatterns.conflictTriggers || [],
          healthyConflictSkills: extendedProfile.deepRelationalPatterns.healthyConflictSkills || [],
          unhealthyConflictPatterns: extendedProfile.deepRelationalPatterns.unhealthyConflictPatterns || [],
          trustBaseline: extendedProfile.deepRelationalPatterns.trustBaseline || 50,
          vulnerabilityComfort: extendedProfile.deepRelationalPatterns.vulnerabilityComfort || 50,
          trustRepairAbility: extendedProfile.deepRelationalPatterns.trustRepairAbility || 50,
          intimacyComfort: extendedProfile.deepRelationalPatterns.intimacyComfort || {},
          intimacyFears: extendedProfile.deepRelationalPatterns.intimacyFears || [],
          intimacyNeeds: extendedProfile.deepRelationalPatterns.intimacyNeeds || [],
          socialMaskLevel: extendedProfile.deepRelationalPatterns.socialMaskLevel || 30,
          authenticityByContext: extendedProfile.deepRelationalPatterns.authenticityByContext || {},
          socialEnergy: extendedProfile.deepRelationalPatterns.socialEnergy || 'neutral',
        },
      });
    }

    if (tier === 'ultra' && extendedProfile.philosophicalFramework) {
      await prisma.philosophicalFramework.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          agentId: agent.id,
          optimismLevel: extendedProfile.philosophicalFramework.optimismLevel || 50,
          worldviewType: extendedProfile.philosophicalFramework.worldviewType,
          meaningSource: extendedProfile.philosophicalFramework.meaningSource,
          existentialStance: extendedProfile.philosophicalFramework.existentialStance,
          politicalLeanings: extendedProfile.philosophicalFramework.politicalLeanings,
          politicalEngagement: extendedProfile.philosophicalFramework.politicalEngagement || 30,
          activismLevel: extendedProfile.philosophicalFramework.activismLevel || 20,
          socialJusticeStance: extendedProfile.philosophicalFramework.socialJusticeStance,
          ethicalFramework: extendedProfile.philosophicalFramework.ethicalFramework,
          moralComplexity: extendedProfile.philosophicalFramework.moralComplexity || 50,
          moralRigidity: extendedProfile.philosophicalFramework.moralRigidity || 50,
          moralDilemmas: extendedProfile.philosophicalFramework.moralDilemmas,
          religiousBackground: extendedProfile.philosophicalFramework.religiousBackground,
          currentBeliefs: extendedProfile.philosophicalFramework.currentBeliefs,
          spiritualPractices: extendedProfile.philosophicalFramework.spiritualPractices || [],
          faithImportance: extendedProfile.philosophicalFramework.faithImportance || 30,
          lifePhilosophy: extendedProfile.philosophicalFramework.lifePhilosophy,
          coreBeliefs: extendedProfile.philosophicalFramework.coreBeliefs || [],
          dealbreakers: extendedProfile.philosophicalFramework.dealbreakers || [],
          personalMotto: extendedProfile.philosophicalFramework.personalMotto,
          epistomologyStance: extendedProfile.philosophicalFramework.epistomologyStance,
          scienceTrustLevel: extendedProfile.philosophicalFramework.scienceTrustLevel || 70,
          intuitionVsLogic: extendedProfile.philosophicalFramework.intuitionVsLogic || 50,
          growthMindset: extendedProfile.philosophicalFramework.growthMindset || 60,
          opennessToChange: extendedProfile.philosophicalFramework.opennessToChange || 50,
          philosophicalEvolution: extendedProfile.philosophicalFramework.philosophicalEvolution,
        },
      });
    }

    // Create initial relation
    await prisma.relation.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        subjectId: agent.id,
        targetId: userId,
        targetType: "user",
        trust: 0.5,
        affinity: 0.5,
        respect: 0.5,
        privateState: { love: 0, curiosity: 0 },
        visibleState: { trust: 0.5, affinity: 0.5, respect: 0.5 },
      },
    });

      // Track usage
      await trackUsage(userId, "agent", 1, agent.id, {
        name: agent.name,
        kind: agent.kind,
      });

      return NextResponse.json(agent, { status: 201 });
    } catch (error: any) {
      console.error("Error creating agent (v1 API):", error);

      // If it's a rate limit error (thrown from the transaction)
      if (error.error && error.limit) {
        return NextResponse.json(error, { status: 403 });
      }

      // Prisma transaction errors
      if (error.code === "P2034") {
        // Serialization failure - race condition detectada
        return NextResponse.json(
          {
            error: "Agent limit reached. Please try again.",
            hint: "Multiple concurrent requests detected"
          },
          { status: 409 }
        );
      }

      // Re-throw para que withAPIAuth lo maneje
      throw error;
    }
  });
}
