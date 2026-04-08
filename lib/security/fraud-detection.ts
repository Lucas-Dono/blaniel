/**
 * FRAUD DETECTION SYSTEM
 *
 * ML-lite system to detect fraud in bonds:
 * - Accounts created only for farming
 * - Coordinated attacks (multiple users attacking same bond)
 * - Metrics manipulation
 * - Anomaly detection
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { calculateGenuinenessScore } from "./anti-gaming-detector";

export interface FraudSignal {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number; // 0-1
  description: string;
  evidence: any;
}

export interface FraudAnalysisResult {
  fraudulent: boolean;
  fraudScore: number; // 0-1, where 1 = definitely fraud
  signals: FraudSignal[];
  recommendedAction: "allow" | "flag" | "block" | "manual_review";
}

/**
 * Analyzes if a bond establishment attempt is fraudulent
 */
export async function analyzeBondEstablishmentForFraud(
  userId: string,
  agentId: string
): Promise<FraudAnalysisResult> {
  const signals: FraudSignal[] = [];
  let fraudScore = 0;

  // Signal 1: Very new account trying high value bond
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, plan: true },
  });

  if (user) {
    const accountAgeHours =
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60);

    if (accountAgeHours < 24) {
      signals.push({
        type: "NEW_ACCOUNT",
        severity: "medium",
        confidence: 0.8,
        description: `Account created ${accountAgeHours.toFixed(1)}h ago trying bond`,
        evidence: { accountAgeHours },
      });
      fraudScore += 0.3;
    }
  }

  // Signal 2: User has multiple bonds in short period
  const recentBonds = await prisma.symbolicBond.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  if (recentBonds.length >= 3) {
    signals.push({
      type: "RAPID_BONDING",
      severity: "high",
      confidence: 0.9,
      description: `${recentBonds.length} bonds in last week`,
      evidence: { bondCount: recentBonds.length },
    });
    fraudScore += 0.4;
  }

  // Signal 3: Genuineness score very low
  const genuineness = await calculateGenuinenessScore(userId, agentId);

  if (genuineness < 0.3) {
    signals.push({
      type: "LOW_GENUINENESS",
      severity: "high",
      confidence: 0.85,
      description: `Very low genuineness score (${(genuineness * 100).toFixed(1)}%)`,
      evidence: { genuinenessScore: genuineness },
    });
    fraudScore += 0.5;
  }

  // Signal 4: Anomalous interaction pattern
  const messageCount = await prisma.message.count({
    where: {
      userId,
      agentId,
      role: "user",
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  // Too many messages in 24h = farming
  if (messageCount > 200) {
    signals.push({
      type: "EXCESSIVE_MESSAGES",
      severity: "critical",
      confidence: 0.95,
      description: `${messageCount} messages in 24h (inhuman)`,
      evidence: { messageCount },
    });
    fraudScore += 0.6;
  }

  // Signal 5: Coordinated attack detection
  const similarBondAttempts = await detectCoordinatedAttack(agentId);
  if (similarBondAttempts.suspicious) {
    signals.push({
      type: "COORDINATED_ATTACK",
      severity: "critical",
      confidence: 0.9,
      description: "Multiple users with identical patterns",
      evidence: similarBondAttempts,
    });
    fraudScore += 0.7;
  }

  // Normalize score
  fraudScore = Math.min(fraudScore, 1);

  // Determine recommended action
  let recommendedAction: FraudAnalysisResult["recommendedAction"] = "allow";
  if (fraudScore >= 0.8) {
    recommendedAction = "block";
  } else if (fraudScore >= 0.6) {
    recommendedAction = "manual_review";
  } else if (fraudScore >= 0.4) {
    recommendedAction = "flag";
  }

  return {
    fraudulent: fraudScore >= 0.6,
    fraudScore,
    signals,
    recommendedAction,
  };
}

/**
 * Detects coordinated attacks (multiple users with same pattern)
 */
async function detectCoordinatedAttack(agentId: string): Promise<{
  suspicious: boolean;
  userIds: string[];
  pattern: string;
}> {
  // Search for users that:
  // 1. Created accounts in same period
  // 2. Interact with same agent
  // 3. Have similar message patterns

  const recentUsers = await prisma.message.groupBy({
    by: ["userId"],
    where: {
      agentId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    _count: { id: true },
    having: {
      id: { _count: { gt: 50 } }, // Very active users
    },
  });

  if (recentUsers.length < 3) {
    return { suspicious: false, userIds: [], pattern: "" };
  }

  // Get users data
  const userIds = recentUsers.map((u) => u.userId).filter((id): id is string => id !== null);
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  // Check if accounts created in 1 hour window
  const timestamps = users.map((u) => u.createdAt.getTime());
  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);

  const windowHours = (maxTimestamp - minTimestamp) / (1000 * 60 * 60);

  if (windowHours < 1 && users.length >= 3) {
    return {
      suspicious: true,
      userIds: users.map((u) => u.id),
      pattern: "same_creation_window",
    };
  }

  return { suspicious: false, userIds: [], pattern: "" };
}

/**
 * Detects anomalies in affinity progress
 */
export async function detectAffinityAnomaly(
  userId: string,
  agentId: string,
  newAffinityLevel: number
): Promise<{ anomalous: boolean; reason: string }> {
  // Get existing bond (if any)
  const bond = await prisma.symbolicBond.findFirst({
    where: { userId, agentId },
  });

  if (!bond) {
    // New bond, check if initial level is suspiciously high
    if (newAffinityLevel > 50) {
      return {
        anomalous: true,
        reason: `Initial affinity very high (${newAffinityLevel})`,
      };
    }
    return { anomalous: false, reason: "" };
  }

  // Check for anomalous increment
  const increment = newAffinityLevel - bond.affinityLevel;
  const daysSinceStart =
    (Date.now() - bond.startDate.getTime()) / (1000 * 60 * 60 * 24);

  // Increment of >20 points in one day = suspicious
  if (increment > 20 && daysSinceStart < 1) {
    return {
      anomalous: true,
      reason: `Increment of ${increment} points in ${daysSinceStart.toFixed(1)} days`,
    };
  }

  // Increment of >50 points from start is impossible without farming
  if (newAffinityLevel - bond.affinityLevel > 50) {
    return {
      anomalous: true,
      reason: `Total increment of ${newAffinityLevel - bond.affinityLevel} points`,
    };
  }

  return { anomalous: false, reason: "" };
}

/**
 * Analyzes user's complete history to detect fraud
 */
export async function analyzeUserHistoryForFraud(
  userId: string
): Promise<FraudAnalysisResult> {
  const signals: FraudSignal[] = [];
  let fraudScore = 0;

  // Get all user's bonds
  const allBonds = await prisma.symbolicBond.findMany({
    where: { userId },
    include: {
      Agent: {
        select: { name: true },
      },
    },
  });

  // Signal: Too many active bonds simultaneously
  const activeBonds = allBonds.filter((b) => b.status === "active");
  if (activeBonds.length > 5) {
    signals.push({
      type: "EXCESSIVE_ACTIVE_BONDS",
      severity: "high",
      confidence: 0.8,
      description: `${activeBonds.length} simultaneous active bonds`,
      evidence: { count: activeBonds.length },
    });
    fraudScore += 0.4;
  }

  // Signal: All bonds with same progression pattern
  if (allBonds.length >= 3) {
    const affinities = allBonds.map((b) => b.affinityLevel);
    const avg = affinities.reduce((a, b) => a + b, 0) / affinities.length;
    const variance =
      affinities.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
      affinities.length;

    // Very low variance = all progress identically (bot)
    if (variance < 25) {
      signals.push({
        type: "UNIFORM_PROGRESSION",
        severity: "high",
        confidence: 0.85,
        description: "All bonds progress identically",
        evidence: { variance, affinities },
      });
      fraudScore += 0.5;
    }
  }

  // Signal: User released and re-established bonds quickly (churning)
  const legacyBonds = await prisma.bondLegacy.findMany({
    where: {
      userId,
      endDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  });

  if (legacyBonds.length > 3) {
    signals.push({
      type: "BOND_CHURNING",
      severity: "medium",
      confidence: 0.7,
      description: `${legacyBonds.length} bonds released in last month`,
      evidence: { count: legacyBonds.length },
    });
    fraudScore += 0.3;
  }

  fraudScore = Math.min(fraudScore, 1);

  let recommendedAction: FraudAnalysisResult["recommendedAction"] = "allow";
  if (fraudScore >= 0.7) {
    recommendedAction = "block";
  } else if (fraudScore >= 0.5) {
    recommendedAction = "manual_review";
  } else if (fraudScore >= 0.3) {
    recommendedAction = "flag";
  }

  return {
    fraudulent: fraudScore >= 0.5,
    fraudScore,
    signals,
    recommendedAction,
  };
}

/**
 * Auto-block users with critical fraud score
 */
export async function autoBlockFraudulentUser(
  userId: string,
  reason: string,
  evidence: any
) {
  console.log(`[FraudDetection] Auto-blocking user ${userId}: ${reason}`);

  // Update user metadata
  await prisma.user.update({
    where: { id: userId },
    data: {
      metadata: {
        blocked: true,
        blockedAt: new Date().toISOString(),
        blockReason: reason,
        blockEvidence: evidence,
      } as any,
    },
  });

  // Create moderation log
  await prisma.moderationAction.create({
    data: {
      id: nanoid(),
      moderatorId: "fraud_detection_system",
      targetType: "user",
      targetId: userId,
      action: "block",
      reason,
      details: JSON.stringify(evidence),
    },
  });

  // Release all active bonds
  const activeBonds = await prisma.symbolicBond.findMany({
    where: { userId, status: "active" },
  });

  for (const bond of activeBonds) {
    await prisma.symbolicBond.update({
      where: { id: bond.id },
      data: { status: "released" },
    });

    // Create legacy
    await prisma.bondLegacy.create({
      data: {
        id: nanoid(),
        userId,
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
        releaseReason: "fraud_detected",
        legacyBadge: "Removed (Fraud)",
      },
    });
  }

  return { blocked: true, bondsReleased: activeBonds.length };
}

export default {
  analyzeBondEstablishmentForFraud,
  detectAffinityAnomaly,
  analyzeUserHistoryForFraud,
  autoBlockFraudulentUser,
};
