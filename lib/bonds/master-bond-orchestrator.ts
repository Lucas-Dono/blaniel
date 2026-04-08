/**
 * MASTER BOND ORCHESTRATOR
 * 
 * Orchestrates ALL Symbolic Bonds system integrations:
 * - LLM Quality Analysis
 * - Emotional System Integration
 * - Memory System Integration
 * - Dynamic Narrative Arcs
 * 
 * This is the main entry point to use the complete system.
 */

import { processInteractionForBond } from "./bond-progression-service";
import {
  getBondEmotionalModifiers,
  applyBondToEmotionalState,
  enhancePromptWithBondEmotions,
} from "./emotional-bond-integration";
import {
  getBondMemoryModifiers,
  generateBondMemoryContext,
  createBondSpecialMemory,
  isSpecialMoment,
} from "./memory-bond-integration";
import { generateNarrativeContext, checkNarrativeProgression } from "./narrative-arcs-system";
import { prisma } from "@/lib/prisma";

export interface BondEnhancedMessageContext {
  basePrompt: string;
  emotionalContext: string;
  memoryContext: string;
  narrativeContext: string;
  fullPrompt: string;
  bondId?: string;
  bondStatus?: string;
  affinityLevel?: number;
}

/**
 * Generar contexto completo para un mensaje considerando el bond
 */
export async function generateBondEnhancedContext(
  userId: string,
  agentId: string,
  basePrompt: string,
  _userMessage: string
): Promise<BondEnhancedMessageContext> {
  try {
    // Check if there's an active bond
    const bond = await prisma.symbolicBond.findFirst({
      where: {
        userId,
        agentId,
        status: { in: ["active", "dormant", "fragile", "at_risk"] },
      },
    });

    if (!bond) {
      // No bond, return base context
      return {
        basePrompt,
        emotionalContext: "",
        memoryContext: "",
        narrativeContext: "",
        fullPrompt: basePrompt,
      };
    }

    // Get all integration contexts
    const [emotionalContext, memoryContext, narrativeContext] = await Promise.all([
      enhancePromptWithBondEmotions(userId, agentId, ""),
      generateBondMemoryContext(userId, agentId),
      generateNarrativeContext(bond.id),
    ]);

    // Combine all contexts
    const fullPrompt = `${basePrompt}

${emotionalContext}

${memoryContext}

${narrativeContext}`;

    return {
      basePrompt,
      emotionalContext: emotionalContext.replace(basePrompt, "").trim(),
      memoryContext,
      narrativeContext,
      fullPrompt,
      bondId: bond.id,
      bondStatus: bond.status,
      affinityLevel: bond.affinityLevel,
    };
  } catch (error) {
    console.error("[Bond Orchestrator] Error generating context:", error);
    return {
      basePrompt,
      emotionalContext: "",
      memoryContext: "",
      narrativeContext: "",
      fullPrompt: basePrompt,
    };
  }
}

/** Process a complete interaction with all integrations */
export async function processBondEnhancedInteraction(
  userId: string,
  agentId: string,
  userMessage: string,
  agentResponse: string,
  metadata?: {
    emotionalState?: any;
    emotionalIntensity?: number;
    conversationId?: string;
  }
): Promise<{
  bondUpdated: boolean;
  affinityChange: number;
  newAffinityLevel: number;
  specialMemoryCreated: boolean;
  narrativeProgression: boolean;
  milestone?: string;
  narrativeUnlocked?: string;
}> {
  try {
    // Check if there's an active bond
    const bond = await prisma.symbolicBond.findFirst({
      where: {
        userId,
        agentId,
        status: { in: ["active", "dormant", "fragile", "at_risk"] },
      },
    });

    if (!bond) {
      return {
        bondUpdated: false,
        affinityChange: 0,
        newAffinityLevel: 0,
        specialMemoryCreated: false,
        narrativeProgression: false,
      };
    }

    // 1. Process bond progression with quality analysis
    const progressionResult = await processInteractionForBond(
      bond.id,
      userMessage,
      agentResponse,
      {
        conversationId: metadata?.conversationId,
        emotionalState: metadata?.emotionalState,
        memoryCreated: false, // Will be set later
      }
    );

    // 2. Check if this is a special moment (memory integration)
    let specialMemoryCreated = false;
    const bondMemoryModifiers = await getBondMemoryModifiers(userId, agentId);

    if (
      bondMemoryModifiers &&
      isSpecialMoment(
        userMessage,
        metadata?.emotionalIntensity || 0,
        bondMemoryModifiers
      )
    ) {
      await createBondSpecialMemory(
        bond.id,
        "Momento Especial",
        `${userMessage.substring(0, 100)}...`,
        metadata?.emotionalState || {},
        { timestamp: new Date().toISOString() }
      );
      specialMemoryCreated = true;
    }

    // 3. Check narrative progression
    const narrativeCheck = await checkNarrativeProgression(bond.id);

    return {
      bondUpdated: progressionResult.success,
      affinityChange: progressionResult.affinityChange,
      newAffinityLevel: progressionResult.newAffinityLevel,
      specialMemoryCreated,
      narrativeProgression: narrativeCheck.newChapterUnlocked,
      milestone: progressionResult.milestone,
      narrativeUnlocked: progressionResult.narrativeUnlocked,
    };
  } catch (error) {
    console.error("[Bond Orchestrator] Error processing interaction:", error);
    return {
      bondUpdated: false,
      affinityChange: 0,
      newAffinityLevel: 0,
      specialMemoryCreated: false,
      narrativeProgression: false,
    };
  }
}

/** Apply all bond modifiers to the emotional state */
export async function applyBondModifiersToEmotion(
  userId: string,
  agentId: string,
  baseEmotionalState: any
): Promise<any> {
  try {
    const bondModifiers = await getBondEmotionalModifiers(userId, agentId);
    return applyBondToEmotionalState(baseEmotionalState, bondModifiers);
  } catch (error) {
    console.error(
      "[Bond Orchestrator] Error applying emotional modifiers:",
      error
    );
    return baseEmotionalState;
  }
}

/**
 * Main hook to integrate bonds into the message generation flow
 * 
 * USAGE:
 * 1. Before generating response: Call generateBondEnhancedContext()
 * 2. Use the generated fullPrompt for the LLM
 * 3. After generating response: Call processBondEnhancedInteraction()
 */
export async function bondAwareMessageGeneration(params: {
  userId: string;
  agentId: string;
  userMessage: string;
  basePrompt: string;
  baseEmotionalState: any;
  generateResponse: (prompt: string, emotionalState: any) => Promise<string>;
}): Promise<{
  response: string;
  bondContext: BondEnhancedMessageContext;
  bondUpdate: Awaited<ReturnType<typeof processBondEnhancedInteraction>>;
}> {
  const { userId, agentId, userMessage, basePrompt, baseEmotionalState, generateResponse } =
    params;

  try {
    // 1. Generate bond-enhanced context
    const bondContext = await generateBondEnhancedContext(
      userId,
      agentId,
      basePrompt,
      userMessage
    );

    // 2. Apply bond modifiers to emotional state
    const enhancedEmotionalState = await applyBondModifiersToEmotion(
      userId,
      agentId,
      baseEmotionalState
    );

    // 3. Generate response with enhanced context
    const response = await generateResponse(
      bondContext.fullPrompt,
      enhancedEmotionalState
    );

    // 4. Process the interaction (update bond, check narratives, etc.)
    const bondUpdate = await processBondEnhancedInteraction(
      userId,
      agentId,
      userMessage,
      response,
      {
        emotionalState: enhancedEmotionalState,
        emotionalIntensity: calculateEmotionalIntensity(enhancedEmotionalState),
      }
    );

    return {
      response,
      bondContext,
      bondUpdate,
    };
  } catch (error) {
    console.error("[Bond Orchestrator] Error in bond-aware generation:", error);

    // Fallback: generate without bond enhancements
    const response = await params.generateResponse(
      basePrompt,
      baseEmotionalState
    );

    return {
      response,
      bondContext: {
        basePrompt,
        emotionalContext: "",
        memoryContext: "",
        narrativeContext: "",
        fullPrompt: basePrompt,
      },
      bondUpdate: {
        bondUpdated: false,
        affinityChange: 0,
        newAffinityLevel: 0,
        specialMemoryCreated: false,
        narrativeProgression: false,
      },
    };
  }
}

/**
 * Calcular intensidad emocional para determinar si es un momento especial
 */
function calculateEmotionalIntensity(emotionalState: any): number {
  if (!emotionalState || !emotionalState.plutchik) {
    return 0;
  }

  // Calculate average intensity of all emotions
  const emotions = Object.values(emotionalState.plutchik) as number[];
  const sum = emotions.reduce((acc, val) => acc + Math.abs(val), 0);
  return sum / emotions.length;
}

/** Helper: Check if a user has an active bond with an agent */
export async function hasActiveBond(
  userId: string,
  agentId: string
): Promise<boolean> {
  try {
    const bond = await prisma.symbolicBond.findFirst({
      where: {
        userId,
        agentId,
        status: { in: ["active", "dormant", "fragile", "at_risk"] },
      },
    });

    return !!bond;
  } catch (error) {
    console.error("[Bond Orchestrator] Error checking active bond:", error);
    return false;
  }
}

/** Helper: Get summary information of the bond */
export async function getBondSummary(userId: string, agentId: string) {
  try {
    const bond = await prisma.symbolicBond.findFirst({
      where: {
        userId,
        agentId,
        status: { in: ["active", "dormant", "fragile", "at_risk"] },
      },
      include: {
        Agent: {
          select: { name: true, avatar: true },
        },
      },
    });

    if (!bond) {
      return null;
    }

    return {
      id: bond.id,
      tier: bond.tier,
      status: bond.status,
      affinityLevel: bond.affinityLevel,
      durationDays: bond.durationDays,
      rarityTier: bond.rarityTier,
      totalInteractions: bond.totalInteractions,
      agentName: bond.Agent.name,
      agentAvatar: bond.Agent.avatar,
    };
  } catch (error) {
    console.error("[Bond Orchestrator] Error getting bond summary:", error);
    return null;
  }
}

export default {
  generateBondEnhancedContext,
  processBondEnhancedInteraction,
  applyBondModifiersToEmotion,
  bondAwareMessageGeneration,
  hasActiveBond,
  getBondSummary,
};
