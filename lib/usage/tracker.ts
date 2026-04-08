import { prisma } from "@/lib/prisma";
import {PLANS} from "@/lib/mercadopago/config";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";

export type ResourceType = "message" | "agent" | "world" | "api_call" | "tokens" | "prompt_enhancement";

// Trackear uso de un recurso
export async function trackUsage(
  userId: string,
  resourceType: ResourceType,
  quantity: number = 1,
  resourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.usage.create({
    data: {
      id: nanoid(),
      userId,
      resourceType,
      resourceId,
      quantity,
      metadata: (metadata as Prisma.InputJsonValue) || undefined,
    },
  });
}

// Get current month usage
export async function getCurrentMonthUsage(
  userId: string,
  resourceType?: ResourceType
): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const whereClause: { userId: string; resourceType?: string; createdAt: { gte: Date } } = {
    userId,
    createdAt: { gte: startOfMonth },
  };

  if (resourceType) {
    whereClause.resourceType = resourceType;
  }

  const usage = await prisma.usage.aggregate({
    where: whereClause,
    _sum: {
      quantity: true,
    },
  });

  return usage._sum.quantity || 0;
}

// Get current day usage (for daily limits)
export async function getCurrentDayUsage(
  userId: string,
  resourceType?: ResourceType
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const whereClause: { userId: string; resourceType?: string; createdAt: { gte: Date } } = {
    userId,
    createdAt: { gte: startOfDay },
  };

  if (resourceType) {
    whereClause.resourceType = resourceType;
  }

  const usage = await prisma.usage.aggregate({
    where: whereClause,
    _sum: {
      quantity: true,
    },
  });

  return usage._sum.quantity || 0;
}

// Get conteo actual de recursos
export async function getCurrentResourceCount(
  userId: string,
  resourceType: "agent" | "world"
): Promise<number> {
  if (resourceType === "agent") {
    return await prisma.agent.count({ where: { userId } });
  } else if (resourceType === "world") {
    return await prisma.group.count({ where: { creatorId: userId } });
  }
  return 0;
}

// Check si el usuario puede usar un recurso
export async function canUseResource(
  userId: string,
  resourceType: ResourceType,
  quantity: number = 1
): Promise<{ allowed: boolean; reason?: string; current?: number; limit?: number }> {
  // Get user plan
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  if (!user) {
    return { allowed: false, reason: "User not found" };
  }

  const planId = user.plan as keyof typeof PLANS;
  const plan = PLANS[planId];

  if (!plan) {
    return { allowed: false, reason: "Invalid plan" };
  }

  // Verify limits based on resource type
  if (resourceType === "message") {
    const limit = plan.limits.messages;
    if (limit === -1) return { allowed: true }; // unlimited

    const current = await getCurrentMonthUsage(userId, "message");
    if (current + quantity > limit) {
      return {
        allowed: false,
        reason: `Monthly message limit reached (${limit})`,
        current,
        limit,
      };
    }
    return { allowed: true, current, limit };
  }

  if (resourceType === "agent") {
    const limit = plan.limits.agents;
    if (limit === -1) return { allowed: true }; // unlimited

    const current = await getCurrentResourceCount(userId, "agent");
    if (current + quantity > limit) {
      return {
        allowed: false,
        reason: `Agent limit reached (${limit})`,
        current,
        limit,
      };
    }
    return { allowed: true, current, limit };
  }

  if (resourceType === "world") {
    const limit = plan.limits.worlds;
    if (limit === -1) return { allowed: true }; // unlimited

    const current = await getCurrentResourceCount(userId, "world");
    if (current + quantity > limit) {
      return {
        allowed: false,
        reason: `World limit reached (${limit})`,
        current,
        limit,
      };
    }
    return { allowed: true, current, limit };
  }

  if (resourceType === "tokens") {
    const limit = plan.limits.tokensPerMessage;
    if (quantity > limit) {
      return {
        allowed: false,
        reason: `Token limit per message exceeded (${limit})`,
        current: quantity,
        limit,
      };
    }
    return { allowed: true };
  }

  if (resourceType === "prompt_enhancement") {
    // Daily limits by tier
    const dailyLimits: Record<string, number> = {
      FREE: 2,
      PLUS: 10,
      ULTRA: 30,
    };

    const limit = dailyLimits[planId] || 2;
    const current = await getCurrentDayUsage(userId, "prompt_enhancement");

    if (current + quantity > limit) {
      return {
        allowed: false,
        reason: `Daily prompt enhancement limit reached (${limit})`,
        current,
        limit,
      };
    }
    return { allowed: true, current, limit };
  }

  // Default: allow
  return { allowed: true };
}

// Get usage statistics
export async function getUsageStats(userId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Get user plan
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  if (!user) return null;

  const planId = user.plan as keyof typeof PLANS;
  const plan = PLANS[planId];

  // Get usage for the month
  const [messagesUsed, agentsCount, worldsCount, tokensUsed] = await Promise.all([
    getCurrentMonthUsage(userId, "message"),
    getCurrentResourceCount(userId, "agent"),
    getCurrentResourceCount(userId, "world"),
    prisma.usage.aggregate({
      where: {
        userId,
        resourceType: "tokens",
        createdAt: { gte: startOfMonth },
      },
      _sum: { quantity: true },
    }),
  ]);

  return {
    plan: planId,
    messages: {
      used: messagesUsed,
      limit: plan.limits.messages,
      percentage: plan.limits.messages === -1 ? 0 : (messagesUsed / plan.limits.messages) * 100,
    },
    agents: {
      used: agentsCount,
      limit: plan.limits.agents,
      percentage: plan.limits.agents === -1 ? 0 : (agentsCount / plan.limits.agents) * 100,
    },
    worlds: {
      used: worldsCount,
      limit: plan.limits.worlds,
      percentage: plan.limits.worlds === -1 ? 0 : (worldsCount / plan.limits.worlds) * 100,
    },
    tokens: {
      used: tokensUsed._sum.quantity || 0,
      perMessage: plan.limits.tokensPerMessage,
    },
  };
}

// Resetear uso mensual (para testing o admin)
export async function resetMonthlyUsage(userId: string): Promise<void> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  await prisma.usage.deleteMany({
    where: {
      userId,
      createdAt: { gte: startOfMonth },
    },
  });
}

// Check if the user is close to the limit (>80%)
export async function isNearLimit(
  userId: string,
  resourceType: "message" | "agent" | "world"
): Promise<boolean> {
  const stats = await getUsageStats(userId);
  if (!stats) return false;

  // Map singular to plural
  const pluralMap = { message: "messages", agent: "agents", world: "worlds" } as const;
  const resourceKey = pluralMap[resourceType];
  const resource = stats[resourceKey];
  if (resource.limit === -1) return false; // unlimited

  return resource.percentage >= 80;
}
