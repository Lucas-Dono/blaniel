/**
 * ANTI-GAMING DETECTION SYSTEM
 *
 * Detects suspicious patterns attempting to "game" the system:
 * - Message spam without real content
 * - Detected copy-paste
 * - Bot patterns (perfect timing, identical messages)
 * - Multiple account farming
 * - Non-human behavior
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
// @ts-expect-error - string-similarity doesn't have type definitions
import stringSimilarity from "string-similarity";

// Thresholds for detection
const THRESHOLDS = {
  MESSAGE_SIMILARITY: 0.85, // If >85% similar to previous messages = suspicious
  MIN_MESSAGE_LENGTH: 10, // Very short messages are spam
  MAX_MESSAGES_PER_MINUTE: 10, // Humans don't write that fast consistently
  MIN_TIME_BETWEEN_MESSAGES: 2000, // 2 seconds minimum between messages
  SUSPICIOUS_SCORE_THRESHOLD: 0.7, // Score >0.7 = flag for review
  BOT_PATTERN_SCORE: 0.8, // Score >0.8 = very likely bot
};

export interface SuspiciousActivity {
  userId: string;
  agentId: string;
  type: string;
  score: number; // 0-1, where 1 = very suspicious
  evidence: string[];
  timestamp: Date;
}

/**
 * Analyzes if a message is suspicious
 */
export async function analyzeMessageForGaming(
  userId: string,
  agentId: string,
  message: string,
  metadata?: any
): Promise<{ suspicious: boolean; score: number; reasons: string[] }> {
  const reasons: string[] = [];
  let score = 0;

  // 1. Check message length
  if (message.length < THRESHOLDS.MIN_MESSAGE_LENGTH) {
    reasons.push("Message too short");
    score += 0.2;
  }

  // 2. Get user's recent messages with this agent
  const recentMessages = await prisma.message.findMany({
    where: {
      userId,
      agentId,
      role: "user",
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      content: true,
      createdAt: true,
    },
  });

  // 3. Check similarity with recent messages (copy-paste detection)
  if (recentMessages.length > 0) {
    const similarities = recentMessages.map((msg) =>
      stringSimilarity.compareTwoStrings(message, msg.content)
    );

    const highestSimilarity = Math.max(...similarities);
    const similarCount = similarities.filter(
      (s) => s > THRESHOLDS.MESSAGE_SIMILARITY
    ).length;

    if (highestSimilarity > THRESHOLDS.MESSAGE_SIMILARITY) {
      reasons.push(
        `Message very similar to previous (${(highestSimilarity * 100).toFixed(1)}%)`
      );
      score += 0.3;
    }

    if (similarCount >= 3) {
      reasons.push(`Multiple nearly identical messages (${similarCount})`);
      score += 0.2;
    }
  }

  // 4. Check message timing (bot pattern detection)
  if (recentMessages.length >= 5) {
    const timeDiffs = [];
    for (let i = 0; i < recentMessages.length - 1; i++) {
      const diff =
        recentMessages[i].createdAt.getTime() -
        recentMessages[i + 1].createdAt.getTime();
      timeDiffs.push(diff);
    }

    // Calculate time variance
    const avgDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
    const variance =
      timeDiffs.reduce((sum, diff) => sum + Math.pow(diff - avgDiff, 2), 0) /
      timeDiffs.length;
    const stdDev = Math.sqrt(variance);

    // Very consistent timing = probably bot
    if (stdDev < 500 && avgDiff < 5000) {
      // Less than 0.5s variation and average <5s
      reasons.push(
        `Robotic timing pattern (σ=${(stdDev / 1000).toFixed(2)}s)`
      );
      score += 0.4;
    }

    // Messages too fast
    const fastMessages = timeDiffs.filter(
      (d) => d < THRESHOLDS.MIN_TIME_BETWEEN_MESSAGES
    ).length;
    if (fastMessages > 3) {
      reasons.push(`Messages too fast (${fastMessages} <2s)`);
      score += 0.3;
    }
  }

  // 5. Check message rate (spike detection)
  const messagesLastMinute = recentMessages.filter(
    (msg) => msg.createdAt.getTime() > Date.now() - 60 * 1000
  ).length;

  if (messagesLastMinute > THRESHOLDS.MAX_MESSAGES_PER_MINUTE) {
    reasons.push(
      `Too many messages in 1 minute (${messagesLastMinute}/${THRESHOLDS.MAX_MESSAGES_PER_MINUTE})`
    );
    score += 0.3;
  }

  // 6. Detect predictable text patterns
  const predictablePatterns = [
    /^(hi|hello|hey)\s*$/i,
    /^\.+$/,
    /^(.)\1{10,}$/, // Repeated characters (aaaaaaaaaa)
    /^(test|testing|test123)$/i,
  ];

  for (const pattern of predictablePatterns) {
    if (pattern.test(message)) {
      reasons.push("Predictable text pattern detected");
      score += 0.2;
      break;
    }
  }

  // 7. Check if message has real emotional content
  const emotionalWords = [
    "love",
    "hate",
    "happy",
    "sad",
    "angry",
    "excited",
    "worried",
    "grateful",
    "afraid",
    "curious",
    // Spanish
    "amor",
    "odio",
    "feliz",
    "triste",
    "enojado",
    "emocionado",
    "preocupado",
    "agradecido",
    "miedo",
    "curioso",
  ];

  const hasEmotionalContent = emotionalWords.some((word) =>
    message.toLowerCase().includes(word)
  );

  // Long messages without real emotion are suspicious
  if (message.length > 50 && !hasEmotionalContent && score > 0) {
    score += 0.1;
  }

  // Normalize score to 0-1
  score = Math.min(score, 1);

  return {
    suspicious: score >= THRESHOLDS.SUSPICIOUS_SCORE_THRESHOLD,
    score,
    reasons,
  };
}

/**
 * Calculates "genuineness score" of a user (0-1, where 1 = very genuine)
 */
export async function calculateGenuinenessScore(
  userId: string,
  agentId: string
): Promise<number> {
  // Get last 50 messages
  const messages = await prisma.message.findMany({
    where: {
      userId,
      agentId,
      role: "user",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      content: true,
      createdAt: true,
    },
  });

  if (messages.length < 10) {
    return 0.5; // Not enough data
  }

  let genuinenessScore = 1.0;

  // Factor 1: Message variety (avoid copy-paste)
  const uniqueMessages = new Set(messages.map((m) => m.content.toLowerCase()));
  const varietyRatio = uniqueMessages.size / messages.length;
  genuinenessScore *= 0.3 + varietyRatio * 0.7; // Penalize low variety

  // Factor 2: Average length (very short messages consistently = spam)
  const avgLength =
    messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length;
  if (avgLength < 20) {
    genuinenessScore *= 0.7;
  } else if (avgLength > 100) {
    genuinenessScore *= 1.1; // Bonus for more developed messages
  }

  // Factor 3: Timing variance (humans are inconsistent)
  if (messages.length >= 10) {
    const timeDiffs = [];
    for (let i = 0; i < messages.length - 1; i++) {
      const diff =
        messages[i].createdAt.getTime() - messages[i + 1].createdAt.getTime();
      timeDiffs.push(diff);
    }

    const avgDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
    const variance =
      timeDiffs.reduce((sum, diff) => sum + Math.pow(diff - avgDiff, 2), 0) /
      timeDiffs.length;
    const stdDev = Math.sqrt(variance);

    // High variance = more human
    if (stdDev > 10000) {
      // >10s variation
      genuinenessScore *= 1.1;
    } else if (stdDev < 1000) {
      // <1s variation = robotic
      genuinenessScore *= 0.6;
    }
  }

  // Factor 4: Presence of emotions and questions
  const emotionalMessages = messages.filter((m) =>
    /\b(feel|felt|think|believe|love|hate|happy|sad|worry|afraid|excited)\b/i.test(
      m.content
    )
  ).length;

  const questionsCount = messages.filter((m) => m.content.includes("?")).length;

  genuinenessScore *= 0.8 + (emotionalMessages / messages.length) * 0.2;
  genuinenessScore *= 0.9 + (questionsCount / messages.length) * 0.1;

  return Math.min(Math.max(genuinenessScore, 0), 1);
}

/**
 * Detects farming of multiple accounts (same person, multiple users)
 */
export async function detectMultiAccounting(
  userId: string
): Promise<{ suspicious: boolean; relatedAccounts: string[]; confidence: number }> {
  // Get user's fingerprint data (if exists)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { metadata: true, createdAt: true },
  });

  if (!user?.metadata) {
    return { suspicious: false, relatedAccounts: [], confidence: 0 };
  }

  const metadata = user.metadata as any;
  const fingerprint = metadata.fingerprint;

  if (!fingerprint) {
    return { suspicious: false, relatedAccounts: [], confidence: 0 };
  }

  // Search for other users with similar fingerprints
  // This would require implementing client-side fingerprinting
  // For now, placeholder

  // In production, you would search by:
  // - Shared IP addresses
  // - Similar device fingerprints
  // - Identical usage patterns
  // - Identical browser/OS

  return { suspicious: false, relatedAccounts: [], confidence: 0 };
}

/**
 * Flag user for manual review
 */
export async function flagUserForReview(
  userId: string,
  reason: string,
  evidence: any
) {
  // Create entry in moderation table
  console.log(`[AntiGaming] Flagging user ${userId} for review: ${reason}`);

  // In production, create entry in ModerationAction
  await prisma.moderationAction.create({
    data: {
      id: nanoid(),
      moderatorId: "system", // Automated system
      targetType: "user",
      targetId: userId,
      action: "flag_suspicious",
      reason,
      details: JSON.stringify(evidence),
    },
  });
}

/**
 * Progressive penalty for suspicious behavior
 */
export async function applyGamingPenalty(
  userId: string,
  severity: "low" | "medium" | "high"
) {
  const penalties = {
    low: {
      cooldownHours: 1,
      affinityPenalty: 0.95, // -5% in next calculation
      message: "Suspicious behavior detected. 1 hour cooldown.",
    },
    medium: {
      cooldownHours: 24,
      affinityPenalty: 0.8, // -20%
      message: "Gaming pattern detected. 24 hour cooldown.",
    },
    high: {
      cooldownHours: 168, // 7 days
      affinityPenalty: 0.5, // -50%
      message:
        "Bot behavior detected. Account under review for 7 days.",
    },
  };

  const penalty = penalties[severity];

  // Update user metadata with penalty
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { metadata: true },
  });

  const metadata = (user?.metadata as any) || {};
  metadata.gamingPenalty = {
    appliedAt: new Date().toISOString(),
    severity,
    expiresAt: new Date(
      Date.now() + penalty.cooldownHours * 60 * 60 * 1000
    ).toISOString(),
    affinityMultiplier: penalty.affinityPenalty,
  };

  await prisma.user.update({
    where: { id: userId },
    data: { metadata },
  });

  console.log(`[AntiGaming] Applied ${severity} penalty to user ${userId}`);

  return penalty;
}

/**
 * Check if user has active penalty
 */
export async function checkActivePenalty(userId: string): Promise<{
  hasPenalty: boolean;
  severity?: string;
  expiresAt?: string;
  affinityMultiplier?: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { metadata: true },
  });

  const metadata = (user?.metadata as any) || {};
  const penalty = metadata.gamingPenalty;

  if (!penalty) {
    return { hasPenalty: false };
  }

  const expiresAt = new Date(penalty.expiresAt);
  if (expiresAt < new Date()) {
    // Penalty expired
    return { hasPenalty: false };
  }

  return {
    hasPenalty: true,
    severity: penalty.severity,
    expiresAt: penalty.expiresAt,
    affinityMultiplier: penalty.affinityMultiplier,
  };
}

export default {
  analyzeMessageForGaming,
  calculateGenuinenessScore,
  detectMultiAccounting,
  flagUserForReview,
  applyGamingPenalty,
  checkActivePenalty,
};
