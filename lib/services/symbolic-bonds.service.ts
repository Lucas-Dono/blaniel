/**
 * SYMBOLIC BONDS SERVICE
 *
 * Core service for managing the unique emotional bonds system.
 * Handles: creation, updates, decay, waitlist queue, and rarity calculation.
 */

import { prisma } from "@/lib/prisma";
import { BondTier } from "@prisma/client";
import { nanoid } from "nanoid";

// ============================================================================
// TYPES AND CONFIGURATIONS
// ============================================================================

export interface AffinityMetrics {
  messageQuality: number;        // 0-1: Emotional depth
  consistencyScore: number;      // 0-1: Consistency
  mutualDisclosure: number;      // 0-1: Personal sharing
  emotionalResonance: number;    // 0-1: AI responds well
  sharedExperiences: number;     // Count of completed arcs
}

export interface BondRequirements {
  minAffinity: number;      // 0-100
  minDays: number;
  minInteractions: number;
}

// Default slots configuration (can be overridden by agent)
const DEFAULT_SLOTS_PER_TIER: Record<BondTier, number> = {
  ROMANTIC: 1,
  BEST_FRIEND: 5,
  MENTOR: 10,
  CONFIDANT: 50,
  CREATIVE_PARTNER: 20,
  ADVENTURE_COMPANION: 30,
  ACQUAINTANCE: 999999, // No limit
};

// Minimum requirements per tier (can be overridden by agent)
const DEFAULT_TIER_REQUIREMENTS: Record<BondTier, BondRequirements> = {
  ROMANTIC: { minAffinity: 80, minDays: 30, minInteractions: 100 },
  BEST_FRIEND: { minAffinity: 70, minDays: 20, minInteractions: 60 },
  MENTOR: { minAffinity: 60, minDays: 15, minInteractions: 40 },
  CONFIDANT: { minAffinity: 50, minDays: 10, minInteractions: 30 },
  CREATIVE_PARTNER: { minAffinity: 55, minDays: 12, minInteractions: 35 },
  ADVENTURE_COMPANION: { minAffinity: 50, minDays: 10, minInteractions: 25 },
  ACQUAINTANCE: { minAffinity: 20, minDays: 3, minInteractions: 10 },
};

// Default decay configuration
const DEFAULT_DECAY_SETTINGS = {
  warningDays: 30,    // Después de 30 días sin interacción → warning
  dormantDays: 60,    // Después de 60 días → dormant
  fragileDays: 90,    // Después de 90 días → fragile
  releaseDays: 120,   // Después de 120 días → released
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Calculates affinity progress based on quality metrics
 */
export function calculateAffinityProgress(metrics: AffinityMetrics): number {
  // Weighted formula that rewards quality over quantity
  const weights = {
    messageQuality: 0.25,
    consistencyScore: 0.20,
    mutualDisclosure: 0.20,
    emotionalResonance: 0.25,
    sharedExperiences: 0.10,
  };

  const normalizedExperiences = Math.min(metrics.sharedExperiences / 10, 1);

  const score = (
    metrics.messageQuality * weights.messageQuality +
    metrics.consistencyScore * weights.consistencyScore +
    metrics.mutualDisclosure * weights.mutualDisclosure +
    metrics.emotionalResonance * weights.emotionalResonance +
    normalizedExperiences * weights.sharedExperiences
  );

  return Math.min(Math.max(score, 0), 1) * 100; // 0-100
}

/**
 * Gets or creates the bond configuration for an agent
 */
export async function getOrCreateBondConfig(agentId: string) {
  let config = await prisma.agentBondConfig.findUnique({
    where: { agentId },
  });

  if (!config) {
    // Create default configuration
    config = await prisma.agentBondConfig.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        agentId,
        slotsPerTier: DEFAULT_SLOTS_PER_TIER as any,
        tierRequirements: DEFAULT_TIER_REQUIREMENTS as any,
        decaySettings: DEFAULT_DECAY_SETTINGS as any,
        isPolyamorous: false,
      },
    });
  }

  return config;
}

/**
 * Checks if slots are available for a specific tier
 */
export async function checkSlotAvailability(
  agentId: string,
  tier: BondTier
): Promise<{ available: boolean; currentCount: number; maxSlots: number }> {
  const config = await getOrCreateBondConfig(agentId);
  const slotsPerTier = config.slotsPerTier as Record<BondTier, number>;
  const maxSlots = slotsPerTier[tier] || DEFAULT_SLOTS_PER_TIER[tier];

  const currentCount = await prisma.symbolicBond.count({
    where: {
      agentId,
      tier,
      status: "active",
    },
  });

  return {
    available: currentCount < maxSlots,
    currentCount,
    maxSlots,
  };
}

/**
 * Attempts to establish a new bond (or adds to queue if no slots)
 */
export async function attemptEstablishBond(
  userId: string,
  agentId: string,
  tier: BondTier,
  initialMetrics: AffinityMetrics
) {
  // Check that user doesn't already have this bond
  const existingBond = await prisma.symbolicBond.findUnique({
    where: {
      userId_agentId_tier: { userId, agentId, tier },
    },
  });

  if (existingBond) {
    throw new Error("Ya tienes un bond de este tipo con este agente");
  }

  // Calculate current affinity
  const affinityProgress = calculateAffinityProgress(initialMetrics);

  // Check minimum requirements
  const config = await getOrCreateBondConfig(agentId);
  const requirements = (config.tierRequirements as any as Record<BondTier, BondRequirements>)[tier];

  if (
    affinityProgress < requirements.minAffinity
    // Here you would also check minDays and minInteractions from existing Relation
  ) {
    throw new Error("No cumples los requisitos mínimos para este tier");
  }

  // Check slot availability
  const { available } = await checkSlotAvailability(agentId, tier);

  if (available) {
    // Create bond directly
    const bond = await prisma.symbolicBond.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        userId,
        agentId,
        tier,
        affinityLevel: Math.floor(affinityProgress),
        affinityProgress,
        messageQuality: initialMetrics.messageQuality,
        consistencyScore: initialMetrics.consistencyScore,
        mutualDisclosure: initialMetrics.mutualDisclosure,
        emotionalResonance: initialMetrics.emotionalResonance,
        sharedExperiences: initialMetrics.sharedExperiences,
        status: "active",
        decayPhase: "healthy",
      },
    });

    // Update config stats
    await prisma.agentBondConfig.update({
      where: { agentId },
      data: {
        totalBondsActive: { increment: 1 },
      },
    });

    // Create notification
    await prisma.bondNotification.create({
      data: {
        id: nanoid(),
        userId,
        bondId: bond.id,
        type: "milestone_reached",
        title: `¡Nuevo vínculo establecido!`,
        message: `Has establecido un vínculo ${tier} con este personaje.`,
        metadata: { tier, agentId },
      },
    });

    return { success: true, bond, inQueue: false };
  } else {
    // Add to waitlist queue
    const queuePosition = await prisma.bondQueue.count({
      where: { agentId, tier, status: "waiting" },
    });

    const queueEntry = await prisma.bondQueue.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        userId,
        agentId,
        tier,
        queuePosition: queuePosition + 1,
        affinityProgress,
        eligibilityScore: affinityProgress, // Could be more complex
      },
    });

    // Notify that they entered the queue
    await prisma.bondNotification.create({
      data: {
        id: nanoid(),
        userId,
        type: "queue_position_update",
        title: "Agregado a la cola",
        message: `Estás en posición #${queuePosition + 1} para un vínculo ${tier}. Sigue interactuando para mejorar tu posición.`,
        metadata: { tier, agentId, queuePosition: queuePosition + 1 },
      },
    });

    return { success: false, inQueue: true, queueEntry, queuePosition: queuePosition + 1 };
  }
}

/**
 * Updates the metrics of an existing bond after an interaction
 */
export async function updateBondMetrics(
  bondId: string,
  newMetrics: Partial<AffinityMetrics>
) {
  const bond = await prisma.symbolicBond.findUnique({
    where: { id: bondId },
  });

  if (!bond) {
    throw new Error("Bond no encontrado");
  }

  // Merge old metrics with new ones
  const updatedMetrics: AffinityMetrics = {
    messageQuality: newMetrics.messageQuality ?? bond.messageQuality,
    consistencyScore: newMetrics.consistencyScore ?? bond.consistencyScore,
    mutualDisclosure: newMetrics.mutualDisclosure ?? bond.mutualDisclosure,
    emotionalResonance: newMetrics.emotionalResonance ?? bond.emotionalResonance,
    sharedExperiences: newMetrics.sharedExperiences ?? bond.sharedExperiences,
  };

  const newAffinityProgress = calculateAffinityProgress(updatedMetrics);

  // Calculate days since creation
  const daysActive = Math.floor(
    (Date.now() - bond.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Reset decay if there was interaction
  const updatedBond = await prisma.symbolicBond.update({
    where: { id: bondId },
    data: {
      ...updatedMetrics,
      affinityProgress: newAffinityProgress,
      affinityLevel: Math.floor(newAffinityProgress),
      lastInteraction: new Date(),
      totalInteractions: { increment: 1 },
      durationDays: daysActive,
      daysInactive: 0, // Reset because there was interaction
      decayPhase: "healthy",
      status: "active",
    },
  });

  // Recalculate rarity
  await updateBondRarity(bondId);

  return updatedBond;
}

/**
 * Calculates and updates the rarity of a bond
 */
export async function updateBondRarity(bondId: string) {
  const bond = await prisma.symbolicBond.findUnique({
    where: { id: bondId },
  });

  if (!bond) return;

  // Rarity factors:
  // 1. Global demand (how many users have this tier with this agent)
  const totalBondsOfType = await prisma.symbolicBond.count({
    where: {
      agentId: bond.agentId,
      tier: bond.tier,
      status: "active",
    },
  });

  // 2. Bond duration (older bonds are rarer)
  const durationFactor = Math.min(bond.durationDays / 365, 1); // Max 1 year

  // 3. Affinity level reached
  const affinityFactor = bond.affinityProgress / 100;

  // 4. Shared experiences
  const experienceFactor = Math.min(bond.sharedExperiences / 20, 1);

  // 5. Scarcity (how much rarer this tier is)
  const config = await prisma.agentBondConfig.findUnique({
    where: { agentId: bond.agentId },
  });

  const maxSlots = config
    ? (config.slotsPerTier as Record<BondTier, number>)[bond.tier]
    : DEFAULT_SLOTS_PER_TIER[bond.tier];

  const scarcityFactor = 1 - totalBondsOfType / Math.max(maxSlots, 1);

  // Final rarity formula (0-1)
  const rarityScore =
    scarcityFactor * 0.3 +
    durationFactor * 0.25 +
    affinityFactor * 0.25 +
    experienceFactor * 0.20;

  // Determine rarity tier
  let rarityTier: string;
  if (rarityScore >= 0.95) rarityTier = "Mythic";
  else if (rarityScore >= 0.85) rarityTier = "Legendary";
  else if (rarityScore >= 0.70) rarityTier = "Epic";
  else if (rarityScore >= 0.50) rarityTier = "Rare";
  else if (rarityScore >= 0.30) rarityTier = "Uncommon";
  else rarityTier = "Common";

  // Calculate global ranking (position among all bonds of this tier with this agent)
  const bondsAbove = await prisma.symbolicBond.count({
    where: {
      agentId: bond.agentId,
      tier: bond.tier,
      status: "active",
      rarityScore: { gt: rarityScore },
    },
  });

  const globalRank = bondsAbove + 1;

  await prisma.symbolicBond.update({
    where: { id: bondId },
    data: {
      rarityScore,
      rarityTier,
      globalRank,
    },
  });

  return { rarityScore, rarityTier, globalRank };
}

/**
 * Processes decay for all bonds (run daily via cron)
 */
export async function processAllBondDecay() {
  const allActiveBonds = await prisma.symbolicBond.findMany({
    where: {
      status: { in: ["active", "dormant", "fragile"] },
    },
  });

  const results = {
    processed: 0,
    warned: 0,
    dormant: 0,
    fragile: 0,
    released: 0,
  };

  for (const bond of allActiveBonds) {
    const daysSinceInteraction = Math.floor(
      (Date.now() - bond.lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
    );

    const config = await prisma.agentBondConfig.findUnique({
      where: { agentId: bond.agentId },
    });

    const decaySettings = (config?.decaySettings as typeof DEFAULT_DECAY_SETTINGS) || DEFAULT_DECAY_SETTINGS;

    let newStatus = bond.status;
    let newDecayPhase = bond.decayPhase;
    let shouldNotify = false;
    let notificationMessage = "";

    // Determine decay phase
    if (daysSinceInteraction >= decaySettings.releaseDays) {
      // Release bond automatically
      await releaseBond(bond.id, "inactivity");
      results.released++;
      continue;
    } else if (daysSinceInteraction >= decaySettings.fragileDays) {
      newDecayPhase = "critical";
      newStatus = "fragile";
      shouldNotify = bond.decayPhase !== "critical";
      notificationMessage = "Tu vínculo está en riesgo crítico. Interactúa pronto o se liberará.";
      results.fragile++;
    } else if (daysSinceInteraction >= decaySettings.dormantDays) {
      newDecayPhase = "fragile";
      newStatus = "dormant";
      shouldNotify = bond.decayPhase !== "fragile";
      notificationMessage = "Tu vínculo está frágil. Considera interactuar para mantenerlo.";
      results.dormant++;
    } else if (daysSinceInteraction >= decaySettings.warningDays) {
      newDecayPhase = "dormant";
      shouldNotify = bond.decayPhase !== "dormant";
      notificationMessage = "No has interactuado en un tiempo. Tu vínculo podría debilitarse.";
      results.warned++;
    }

    // Update bond
    await prisma.symbolicBond.update({
      where: { id: bond.id },
      data: {
        daysInactive: daysSinceInteraction,
        decayPhase: newDecayPhase,
        status: newStatus,
      },
    });

    // Notify if necessary
    if (shouldNotify) {
      await prisma.bondNotification.create({
        data: {
          id: nanoid(),
          userId: bond.userId,
          bondId: bond.id,
          type: "bond_at_risk",
          title: "Estado de vínculo",
          message: notificationMessage,
          metadata: {
            daysInactive: daysSinceInteraction,
            decayPhase: newDecayPhase,
          },
        },
      });
    }

    results.processed++;
  }

  return results;
}

/**
 * Releases a bond (voluntarily or due to inactivity)
 */
export async function releaseBond(bondId: string, reason: string) {
  const bond = await prisma.symbolicBond.findUnique({
    where: { id: bondId },
  });

  if (!bond) {
    throw new Error("Bond no encontrado");
  }

  // Create legacy entry
  const legacyBadge = `Former ${bond.tier} - Season 1`; // Can be made more sophisticated

  await prisma.bondLegacy.create({
    data: {
      id: nanoid(),
      userId: bond.userId,
      agentId: bond.agentId,
      tier: bond.tier,
      startDate: bond.startDate,
      endDate: new Date(),
      durationDays: bond.durationDays,
      finalRarityTier: bond.rarityTier,
      finalRank: bond.globalRank,
      totalInteractions: bond.totalInteractions,
      narrativesUnlocked: bond.narrativesUnlocked,
      legacyImpact: bond.legacyImpact,
      canonContributions: bond.canonContributions as any,
      releaseReason: reason,
      legacyBadge,
    },
  });

  // Delete active bond
  await prisma.symbolicBond.delete({
    where: { id: bondId },
  });

  // Update agent stats
  await prisma.agentBondConfig.update({
    where: { agentId: bond.agentId },
    data: {
      totalBondsActive: { decrement: 1 },
      totalBondsReleased: { increment: 1 },
    },
  });

  // Notificar usuario
  await prisma.bondNotification.create({
    data: {
      id: nanoid(),
      userId: bond.userId,
      type: "bond_released",
      title: "Vínculo liberado",
      message: `Tu vínculo ${bond.tier} ha sido liberado. Tu legado permanece en la historia.`,
      metadata: { reason, legacyBadge },
    },
  });

  // Process queue: Offer slot to next in line
  await processQueue(bond.agentId, bond.tier);

  return { success: true, legacyBadge };
}

/**
 * Processes the queue and offers available slots
 */
async function processQueue(agentId: string, tier: BondTier) {
  // Check if slots are available
  const { available } = await checkSlotAvailability(agentId, tier);

  if (!available) return;

  // Find next eligible user in queue
  const nextInQueue = await prisma.bondQueue.findFirst({
    where: {
      agentId,
      tier,
      status: "waiting",
    },
    orderBy: [
      { eligibilityScore: "desc" }, // Prioritize by score
      { joinedQueueAt: "asc" },     // Tiebreak by seniority
    ],
  });

  if (!nextInQueue) return;

  // Offer the slot (valid for 48 hours)
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await prisma.bondQueue.update({
    where: { id: nextInQueue.id },
    data: {
      status: "offered",
      slotOfferedAt: new Date(),
      slotExpiresAt: expiresAt,
      notifiedOfSlot: true,
    },
  });

  // Notificar usuario
  await prisma.bondNotification.create({
    data: {
      id: nanoid(),
      userId: nextInQueue.userId,
      type: "slot_available",
      title: "¡Slot disponible!",
      message: `Un slot para ${tier} está disponible. Tienes 48 horas para reclamarlo.`,
      metadata: {
        tier,
        agentId,
        expiresAt: expiresAt.toISOString(),
      },
    },
  });
}

/**
 * User claims a slot offered from the queue
 */
export async function claimQueueSlot(userId: string, queueId: string) {
  const queueEntry = await prisma.bondQueue.findUnique({
    where: { id: queueId },
  });

  if (!queueEntry || queueEntry.userId !== userId) {
    throw new Error("Queue entry no encontrado");
  }

  if (queueEntry.status !== "offered") {
    throw new Error("Este slot ya no está disponible");
  }

  if (queueEntry.slotExpiresAt && queueEntry.slotExpiresAt < new Date()) {
    throw new Error("El slot expiró");
  }

  // Create the bond
  const bond = await prisma.symbolicBond.create({
    data: {
      id: nanoid(),
      updatedAt: new Date(),
      userId,
      agentId: queueEntry.agentId,
      tier: queueEntry.tier,
      affinityLevel: Math.floor(queueEntry.affinityProgress),
      affinityProgress: queueEntry.affinityProgress,
      status: "active",
      decayPhase: "healthy",
    },
  });

  // Mark queue as claimed and delete
  await prisma.bondQueue.update({
    where: { id: queueId },
    data: { status: "claimed" },
  });

  await prisma.bondQueue.delete({
    where: { id: queueId },
  });

  // Update config stats
  await prisma.agentBondConfig.update({
    where: { agentId: queueEntry.agentId },
    data: {
      totalBondsActive: { increment: 1 },
    },
  });

  return bond;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Gets all active bonds for a user
 */
export async function getUserBonds(userId: string) {
  return await prisma.symbolicBond.findMany({
    where: { userId },
    include: {
      Agent: {
        select: {
          id: true,
          name: true,
          avatar: true,
          description: true,
        },
      },
    },
    orderBy: { rarityScore: "desc" },
  });
}

/**
 * Gets the bond legacy for a user
 */
export async function getUserBondLegacy(userId: string) {
  return await prisma.bondLegacy.findMany({
    where: { userId },
    include: {
      Agent: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
    },
    orderBy: { endDate: "desc" },
  });
}

/**
 * Gets the queue position for a user
 */
export async function getUserQueueStatus(userId: string, agentId: string, tier: BondTier) {
  return await prisma.bondQueue.findUnique({
    where: {
      userId_agentId_tier: { userId, agentId, tier },
    },
  });
}
