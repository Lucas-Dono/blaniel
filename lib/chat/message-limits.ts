import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import type { MessageLimitStatus, UserTier } from "./types";
import { TIER_LIMITS, getLimitReachedMessage } from "./tier-limits";

/**
 * Message Limits System by Tier
 *
 * Tracks how many messages the user has sent today and per session
 * - FREE: 50/day, 20/session
 * - PLUS: 150/day, 60/session
 * - ULTRA: UNLIMITED
 */

/**
 * Checks if the user can send more messages
 */
export async function checkMessageLimit(
  userId: string,
  agentId: string,
  tier: UserTier
): Promise<MessageLimitStatus> {
  const limits = TIER_LIMITS[tier];

  // ULTRA: Always allowed
  if (limits.messagesPerDay === null && limits.messagesPerSession === null) {
    return {
      allowed: true,
      messagesUsed: 0,
      messagesLimit: null,
      resetsAt: null,
      energyRemaining: 100,
    };
  }

  // Get current tracking
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let tracking = await prisma.messageTracking.findFirst({
    where: {
      userId,
      agentId,
      date: {
        gte: today,
      },
    },
  });

  if (!tracking) {
    // Create tracking for today
    tracking = await prisma.messageTracking.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        userId,
        agentId,
        date: today,
        dailyCount: 0,
        sessionCount: 0,
        sessionStartedAt: new Date(),
      },
    });
  }

  // Check daily limit
  if (limits.messagesPerDay !== null && tracking.dailyCount >= limits.messagesPerDay) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      allowed: false,
      messagesUsed: tracking.dailyCount,
      messagesLimit: limits.messagesPerDay,
      resetsAt: tomorrow,
      energyRemaining: 0,
      reason: getLimitReachedMessage(tier, "daily"),
    };
  }

  // Check session limit
  if (limits.messagesPerSession !== null && tracking.sessionCount >= limits.messagesPerSession) {
    // Check if session reset time has passed
    const hoursSinceSessionStart =
      (Date.now() - tracking.sessionStartedAt.getTime()) / (1000 * 60 * 60);

    if (limits.resetHours && hoursSinceSessionStart >= limits.resetHours) {
      // Session reset
      await prisma.messageTracking.update({
        where: { id: tracking.id },
        data: {
          sessionCount: 0,
          sessionStartedAt: new Date(),
        },
      });

      tracking.sessionCount = 0;
    } else {
      const resetsAt = new Date(
        tracking.sessionStartedAt.getTime() + (limits.resetHours || 12) * 60 * 60 * 1000
      );

      return {
        allowed: false,
        messagesUsed: tracking.sessionCount,
        messagesLimit: limits.messagesPerSession,
        resetsAt,
        energyRemaining: 0,
        reason: getLimitReachedMessage(tier, "session"),
      };
    }
  }

  // Allowed
  return {
    allowed: true,
    messagesUsed: tracking.dailyCount,
    messagesLimit: limits.messagesPerDay,
    resetsAt: null,
    energyRemaining: 100, // Will be calculated later
  };
}

/**
 * Increments message counter after sending one
 */
export async function incrementMessageCount(userId: string, agentId: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.messageTracking.updateMany({
    where: {
      userId,
      agentId,
      date: {
        gte: today,
      },
    },
    data: {
      dailyCount: {
        increment: 1,
      },
      sessionCount: {
        increment: 1,
      },
    },
  });
}

/**
 * Manual session reset (for testing or admin)
 */
export async function resetSession(userId: string, agentId: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.messageTracking.updateMany({
    where: {
      userId,
      agentId,
      date: {
        gte: today,
      },
    },
    data: {
      sessionCount: 0,
      sessionStartedAt: new Date(),
    },
  });
}

/**
 * Gets usage statistics to show the user
 */
export async function getUsageStats(
  userId: string,
  agentId: string,
  tier: UserTier
): Promise<{
  dailyUsed: number;
  dailyLimit: number | null;
  sessionUsed: number;
  sessionLimit: number | null;
  percentageUsed: number;
}> {
  const limits = TIER_LIMITS[tier];

  // Ultra: Empty stats
  if (limits.messagesPerDay === null) {
    return {
      dailyUsed: 0,
      dailyLimit: null,
      sessionUsed: 0,
      sessionLimit: null,
      percentageUsed: 0,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tracking = await prisma.messageTracking.findFirst({
    where: {
      userId,
      agentId,
      date: {
        gte: today,
      },
    },
  });

  const dailyUsed = tracking?.dailyCount || 0;
  const sessionUsed = tracking?.sessionCount || 0;

  return {
    dailyUsed,
    dailyLimit: limits.messagesPerDay,
    sessionUsed,
    sessionLimit: limits.messagesPerSession,
    percentageUsed: limits.messagesPerDay ? (dailyUsed / limits.messagesPerDay) * 100 : 0,
  };
}
