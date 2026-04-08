/**
 * USAGE STATISTICS SERVICE
 * 
 * Gets user usage statistics for billing
 */

import { prisma } from "@/lib/prisma";
import { getUserTier } from "./user-tier";
import { PLANS } from "@/lib/mercadopago/config";
import { getWeeklyUsage, getUserUsageStats as getDailyUsageStats } from "@/lib/usage/daily-limits";
import { getTierLimits, tokensToMessages } from "@/lib/usage/tier-limits";
import { getDailyTokenUsage } from "@/lib/usage/token-limits";

export interface UsageStats {
  agents: {
    current: number;
    limit: number;
  };
  tokens: {
    // Valores reales en tokens (backend)
    tokensUsedToday: number;
    tokenLimitToday: number;
    tokensUsedWeekly: number;
    tokenLimitWeekly: number;
    // Equivalencia aproximada en mensajes (frontend)
    messagesUsedToday: number;    // ~tokensUsedToday / 350
    messageLimitToday: number;    // ~tokenLimitToday / 350
    messagesUsedWeekly: number;   // ~tokensUsedWeekly / 350
    messageLimitWeekly: number;   // ~tokenLimitWeekly / 350
  };
  worlds: {
    current: number;
    limit: number;
  };
  groups: {
    current: number;
    limit: number;
  };
  voiceMessages: {
    current: number;
    limit: number;
    period: "month";
    // ANTI-ABUSE: Include daily limits
    currentDaily?: number;
    dailyLimit?: number;
  };
  imageAnalysis: {
    current: number;
    limit: number;
    period: "month";
    // ANTI-ABUSE: Include daily limits
    currentDaily?: number;
    dailyLimit?: number;
  };
  imageGeneration: {
    current: number;
    limit: number;
    period: "month";
  };
}

/** Gets the user's usage statistics */
export async function getUserUsageStats(userId: string): Promise<UsageStats> {
  try {
    const tier = await getUserTier(userId);
    const planLimits = PLANS[tier].limits;
    const tierLimits = getTierLimits(tier);

    // TOKEN-BASED: Obtener uso diario de tokens
    const dailyTokenUsage = await getDailyTokenUsage(userId);

    // TOKEN-BASED: Obtener uso semanal de tokens
    const weeklyTokenUsage = await getWeeklyUsage(userId, "tokens");

    // For voice and images, we still use the direct counting system
    const dailyStats = await getDailyUsageStats(userId, tier);

    // Count user agents
    const agentsCount = await prisma.agent.count({
      where: {
        userId: userId,
      },
    });

    // Para otros recursos
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Count user groups (replaces worlds)
    const groupsCount = await prisma.group.count({
      where: {
        creatorId: userId,
      },
    });

    // Contar mensajes de voz del mes
    const _voiceMessagesCount = await prisma.message.count({
      where: {
        userId: userId,
        createdAt: {
          gte: monthStart,
        },
        metadata: {
          path: ["voiceUsed"],
          equals: true,
        },
      },
    });

    // Count image analyses of the month
    const _imageAnalysisCount = await prisma.message.count({
      where: {
        userId: userId,
        createdAt: {
          gte: monthStart,
        },
        metadata: {
          path: ["imageAnalyzed"],
          equals: true,
        },
      },
    });

    // Count image generations of the month
    const imageGenerationCount = await prisma.message.count({
      where: {
        agentId: {
          in: await prisma.agent
            .findMany({
              where: { userId: userId },
              select: { id: true },
            })
            .then((agents) => agents.map((a) => a.id)),
        },
        createdAt: {
          gte: monthStart,
        },
        metadata: {
          path: ["imageGenerated"],
          equals: true,
        },
      },
    });

    return {
      agents: {
        current: agentsCount,
        limit: planLimits.agents,
      },
      tokens: {
        // Backend: Valores reales en tokens
        tokensUsedToday: dailyTokenUsage.totalTokens,
        tokenLimitToday: tierLimits.resources.totalTokensPerDay,
        tokensUsedWeekly: weeklyTokenUsage,
        tokenLimitWeekly: tierLimits.resources.totalTokensPerWeek,
        // Frontend: Equivalencia aproximada en mensajes para UI amigable
        messagesUsedToday: tokensToMessages(dailyTokenUsage.totalTokens),
        messageLimitToday: tokensToMessages(tierLimits.resources.totalTokensPerDay),
        messagesUsedWeekly: tokensToMessages(weeklyTokenUsage),
        messageLimitWeekly: tokensToMessages(tierLimits.resources.totalTokensPerWeek),
      },
      worlds: {
        current: 0,
        limit: 0,
      },
      groups: {
        current: groupsCount,
        limit: (planLimits as any).groups || 1,
      },
      voiceMessages: {
        current: dailyStats.thisMonth.voice.used,
        limit: tierLimits.resources.voiceMessagesPerMonth,
        period: "month",
        // ANTI-ABUSE: Add daily limits
        currentDaily: dailyStats.today.voice.used,
        dailyLimit: tierLimits.resources.voiceMessagesPerDay,
      },
      imageAnalysis: {
        current: dailyStats.thisMonth.images.used,
        limit: tierLimits.resources.imageAnalysisPerMonth,
        period: "month",
        // ANTI-ABUSE: Add daily limits
        currentDaily: dailyStats.today.images.used,
        dailyLimit: tierLimits.resources.imageAnalysisPerDay,
      },
      imageGeneration: {
        current: imageGenerationCount,
        limit: planLimits.imageGeneration || 0,
        period: "month",
      },
    };
  } catch (error) {
    console.error("[UsageStats] Error getting usage stats:", error);

    // Return default values on error
    return {
      agents: { current: 0, limit: 3 },
      tokens: {
        tokensUsedToday: 0,
        tokenLimitToday: 0,
        tokensUsedWeekly: 0,
        tokenLimitWeekly: 0,
        messagesUsedToday: 0,
        messageLimitToday: 0,
        messagesUsedWeekly: 0,
        messageLimitWeekly: 0,
      },
      worlds: { current: 0, limit: 0 },
      groups: { current: 0, limit: 1 },
      voiceMessages: { current: 0, limit: 0, period: "month" },
      imageAnalysis: { current: 0, limit: 5, period: "month" },
      imageGeneration: { current: 0, limit: 0, period: "month" },
    };
  }
}

/**
 * Verifica si el usuario puede crear un recurso
 */
export async function canCreateResource(
  userId: string,
  resource: "agent" | "group"
): Promise<{ allowed: boolean; reason?: string }> {
  const stats = await getUserUsageStats(userId);

  switch (resource) {
    case "agent":
      if (stats.agents.limit === -1) return { allowed: true };
      if (stats.agents.current >= stats.agents.limit) {
        return {
          allowed: false,
          reason: `You have reached your limit of ${stats.agents.limit} agents. Upgrade to create more.`,
        };
      }
      return { allowed: true };

    case "group":
      if (stats.groups.limit === -1) return { allowed: true };
      if (stats.groups.current >= stats.groups.limit) {
        return {
          allowed: false,
          reason: `You have reached your limit of ${stats.groups.limit} groups. Upgrade to create more.`,
        };
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
}
