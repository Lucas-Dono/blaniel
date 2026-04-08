/**
 * BOND PROGRESSION SERVICE
 *
 * Gestiona la progresión de los bonds integrando:
 * - LLM quality analysis
 * - Emotional system
 * - Memory system
 * - Gaming detection
 *
 * Este servicio decide cuándo y cómo progresar los bonds de forma inteligente.
 */

import { prisma } from "@/lib/prisma";
import {
  analyzeConversationQuality,
  analyzeInteractionQuality,
  detectGamingBehavior,
  shouldGrantBond,
  ConversationQualityAnalysis,
} from "./llm-quality-analyzer";
import { invalidateBondCache } from "@/lib/redis/bonds-cache";

export interface BondProgressionResult {
  success: boolean;
  newAffinityLevel: number;
  affinityChange: number;
  qualityAnalysis?: ConversationQualityAnalysis;
  message: string;
  milestone?: string;
  narrativeUnlocked?: string;
}

/**
 * Procesar una nueva interacción y actualizar el bond si aplica
 */
export async function processInteractionForBond(
  bondId: string,
  userMessage: string,
  agentResponse: string,
  metadata?: {
    conversationId?: string;
    emotionalState?: any;
    memoryCreated?: boolean;
  }
): Promise<BondProgressionResult> {
  try {
    // Get bond
    const bond = await prisma.symbolicBond.findUnique({
      where: { id: bondId },
      include: {
        User: true,
        Agent: true,
      },
    });

    if (!bond) {
      return {
        success: false,
        newAffinityLevel: 0,
        affinityChange: 0,
        message: "Bond not found",
      };
    }

    if (bond.status !== "active") {
      return {
        success: false,
        newAffinityLevel: bond.affinityLevel,
        affinityChange: 0,
        message: "Bond is not active",
      };
    }

    // Analyze interaction quality (light check)
    const qualityCheck = await analyzeInteractionQuality(
      userMessage,
      agentResponse
    );

    // Calculate affinity change based on quality
    let affinityChange = 0;

    if (qualityCheck.isHighQuality) {
      affinityChange = 2; // +2 for high quality
    } else if (qualityCheck.score >= 50) {
      affinityChange = 1; // +1 for decent quality
    } else if (qualityCheck.score < 30) {
      affinityChange = -1; // -1 for poor quality (decay)
    }

    // Bonus for emotional depth or memory creation
    if (metadata?.emotionalState?.intensity > 0.7) {
      affinityChange += 1;
    }
    if (metadata?.memoryCreated) {
      affinityChange += 1;
    }

    // Update bond
    const newAffinityLevel = Math.max(
      0,
      Math.min(100, bond.affinityLevel + affinityChange)
    );

    const updatedBond = await prisma.symbolicBond.update({
      where: { id: bondId },
      data: {
        affinityLevel: newAffinityLevel,
        totalInteractions: { increment: 1 },
        lastInteraction: new Date(),
        durationDays: Math.floor(
          (Date.now() - new Date(bond.createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
        ),
      },
    });

    // Invalidate cache
    await invalidateBondCache(bondId, bond.userId, bond.agentId);

    // Check for milestones
    const milestone = checkMilestone(updatedBond);

    // Check for narrative unlocks
    const narrative = checkNarrativeUnlock(updatedBond);

    return {
      success: true,
      newAffinityLevel,
      affinityChange,
      message:
        affinityChange > 0
          ? `Bond strengthened (+${affinityChange})`
          : affinityChange < 0
          ? `Bond weakened (${affinityChange})`
          : "Bond maintained",
      milestone,
      narrativeUnlocked: narrative,
    };
  } catch (error) {
    console.error(
      "[Bond Progression] Error processing interaction:",
      error
    );
    return {
      success: false,
      newAffinityLevel: 0,
      affinityChange: 0,
      message: "Error processing interaction",
    };
  }
}

/**
 * Evaluación completa para determinar si otorgar un bond
 */
export async function evaluateBondEligibility(
  userId: string,
  agentId: string
): Promise<{
  eligible: boolean;
  reason: string;
  qualityAnalysis?: ConversationQualityAnalysis;
  confidence: number;
}> {
  try {
    // Get recent conversation history
    const recentMessages = await prisma.message.findMany({
      where: {
        userId,
        agentId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        content: true,
        role: true,
        createdAt: true,
      },
    });

    if (recentMessages.length < 20) {
      return {
        eligible: false,
        reason: "Insufficient conversation history (minimum 20 messages)",
        confidence: 0,
      };
    }

    // Get conversation stats
    const totalMessages = await prisma.message.count({
      where: { userId, agentId },
    });

    const firstMessage = await prisma.message.findFirst({
      where: { userId, agentId },
      orderBy: { createdAt: "asc" },
    });

    const durationDays = firstMessage
      ? Math.floor(
          (Date.now() - new Date(firstMessage.createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    // Analyze conversation quality with LLM
    const qualityAnalysis = await analyzeConversationQuality(
      userId,
      agentId,
      recentMessages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: msg.createdAt,
      })),
      {
        totalMessages,
        durationDays,
        avgMessagesPerDay: totalMessages / Math.max(durationDays, 1),
        topics: [], // Could extract from conversation
      }
    );

    // Check for gaming behavior
    const avgLength =
      recentMessages.reduce((sum, msg) => sum + msg.content.length, 0) /
      recentMessages.length;

    const uniqueWords = new Set(
      recentMessages
        .map((msg) => msg.content.toLowerCase().split(/\s+/))
        .flat()
    ).size;

    const gamingCheck = await detectGamingBehavior(
      recentMessages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      {
        messagesInLast24h: recentMessages.filter(
          (msg) =>
            Date.now() - new Date(msg.createdAt).getTime() <
            24 * 60 * 60 * 1000
        ).length,
        avgMessageLength: avgLength,
        uniqueWords,
        repetitivePatterns: 0, // Could implement pattern detection
      }
    );

    if (gamingCheck.isGaming) {
      return {
        eligible: false,
        reason: `Gaming behavior detected: ${gamingCheck.reasons.join(", ")}`,
        qualityAnalysis,
        confidence: gamingCheck.confidence,
      };
    }

    // Use LLM recommendation
    const bondDecision = shouldGrantBond(qualityAnalysis);

    return {
      eligible: bondDecision.shouldGrant,
      reason: bondDecision.reasoning,
      qualityAnalysis,
      confidence: bondDecision.confidence,
    };
  } catch (error) {
    console.error("[Bond Progression] Error evaluating eligibility:", error);
    return {
      eligible: false,
      reason: "Error during evaluation",
      confidence: 0,
    };
  }
}

/**
 * Recalcular rareza de un bond considerando calidad de conversación
 */
export async function recalculateBondRarityWithQuality(
  bondId: string
): Promise<{ newRarityScore: number; newRarityTier: string }> {
  try {
    const bond = await prisma.symbolicBond.findUnique({
      where: { id: bondId },
      include: {
        User: true,
        Agent: true,
      },
    });

    if (!bond) {
      throw new Error("Bond not found");
    }

    // Get conversation quality
    const recentMessages = await prisma.message.findMany({
      where: {
        userId: bond.userId,
        agentId: bond.agentId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        content: true,
        role: true,
        createdAt: true,
      },
    });

    let qualityMultiplier = 1.0;

    if (recentMessages.length >= 10) {
      const qualityAnalysis = await analyzeConversationQuality(
        bond.userId,
        bond.agentId,
        recentMessages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: msg.createdAt,
        }))
      );

      // Quality affects rarity: high quality = rarer
      qualityMultiplier = 0.8 + (qualityAnalysis.overallScore / 100) * 0.4; // 0.8 to 1.2
    }

    // Base rarity calculation (from original system)
    const tierMultipliers: Record<string, number> = {
      ROMANTIC: 1.5,
      BEST_FRIEND: 1.3,
      MENTOR: 1.2,
      CONFIDANT: 1.4,
      CREATIVE_PARTNER: 1.1,
      ADVENTURE_COMPANION: 1.1,
      ACQUAINTANCE: 1.0,
    };

    const tierMultiplier = tierMultipliers[bond.tier] || 1.0;

    // Get agent's total active bonds for scarcity
    const agentActiveBonds = await prisma.symbolicBond.count({
      where: {
        agentId: bond.agentId,
        status: "active",
      },
    });

    const scarcityScore = Math.max(0, 1 - agentActiveBonds / 100);
    const durationScore = Math.min(bond.durationDays / 365, 1);
    const affinityScore = bond.affinityLevel / 100;

    // Final rarity score with quality multiplier
    let rarityScore =
      scarcityScore * 0.3 +
      durationScore * 0.2 +
      affinityScore * 0.3 +
      tierMultiplier * 0.2;

    rarityScore = rarityScore * qualityMultiplier;
    rarityScore = Math.max(0, Math.min(1, rarityScore));

    // Determine tier
    let rarityTier = "Common";
    if (rarityScore >= 0.95) rarityTier = "Mythic";
    else if (rarityScore >= 0.85) rarityTier = "Legendary";
    else if (rarityScore >= 0.7) rarityTier = "Epic";
    else if (rarityScore >= 0.5) rarityTier = "Rare";
    else if (rarityScore >= 0.3) rarityTier = "Uncommon";

    // Update bond
    await prisma.symbolicBond.update({
      where: { id: bondId },
      data: {
        rarityScore,
        rarityTier,
      },
    });

    // Invalidate cache
    await invalidateBondCache(bondId, bond.userId, bond.agentId);

    return { newRarityScore: rarityScore, newRarityTier: rarityTier };
  } catch (error) {
    console.error("[Bond Progression] Error recalculating rarity:", error);
    throw error;
  }
}

/**
 * Check if a milestone was reached
 */
function checkMilestone(bond: any): string | undefined {
  const milestones = [
    { days: 7, name: "Primera Semana" },
    { days: 30, name: "Primer Mes" },
    { affinity: 50, name: "Media Afinidad" },
    { affinity: 75, name: "Alta Afinidad" },
    { interactions: 100, name: "100 Interacciones" },
    { interactions: 500, name: "500 Interacciones" },
  ];

  for (const milestone of milestones) {
    if ("days" in milestone && bond.durationDays === milestone.days) {
      return milestone.name;
    }
    if (
      "affinity" in milestone &&
      milestone.affinity !== undefined &&
      bond.affinityLevel >= milestone.affinity &&
      bond.affinityLevel - 5 < milestone.affinity
    ) {
      return milestone.name;
    }
    if (
      "interactions" in milestone &&
      bond.totalInteractions === milestone.interactions
    ) {
      return milestone.name;
    }
  }

  return undefined;
}

/**
 * Check if a narrative was unlocked
 */
function checkNarrativeUnlock(bond: any): string | undefined {
  const narratives = [
    { affinity: 30, name: "Conociendo tu Pasado" },
    { affinity: 50, name: "Sueños y Aspiraciones" },
    { affinity: 70, name: "Confesiones Profundas" },
    { affinity: 90, name: "Vínculo Inquebrantable" },
  ];

  for (const narrative of narratives) {
    if (
      bond.affinityLevel >= narrative.affinity &&
      bond.affinityLevel - 5 < narrative.affinity
    ) {
      return narrative.name;
    }
  }

  return undefined;
}
