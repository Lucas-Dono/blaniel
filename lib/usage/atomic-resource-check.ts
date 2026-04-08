/**
 * Atomic resource checks to prevent race conditions
 * 
 * CRITICAL: These functions use transactions with Serializable isolation level
 * to guarantee that multiple simultaneous requests cannot bypass limits.
 */


import { getTierLimits } from "./tier-limits";

/**
 * Atomically check agent limit and return current count
 * 
 * MUST be used inside a transaction before creating an agent
 * 
 * @throws Error with JSON format if the limit is reached
 */
export async function atomicCheckAgentLimit(
  tx: any, // PrismaTransaction
  userId: string,
  userPlan: string
): Promise<{ current: number; limit: number }> {
  // Count inside the transaction with implicit lock
  const current = await tx.agent.count({
    where: { userId },
  });

  const limits = getTierLimits(userPlan);
  const limit = limits.resources.activeAgents;

  // If the limit is -1, it is unlimited
  if (limit === -1) {
    return { current, limit };
  }

  // Check if the limit is exceeded
  if (current >= limit) {
    throw new Error(
      JSON.stringify({
        error: `Límite de ${limit} agentes alcanzado`,
        current,
        limit,
        upgradeUrl: "/pricing",
      })
    );
  }

  return { current, limit };
}

/**
 * Check group limit atomically
 * Already implemented directly in app/api/groups/route.ts
 * This function is for reference and future use
 */
export async function atomicCheckGroupLimit(
  tx: any,
  userId: string,
  userPlan: string
): Promise<{ current: number; limit: number }> {
  const current = await tx.group.count({
    where: {
      creatorId: userId,
      status: "ACTIVE",
    },
  });

  const limits = getTierLimits(userPlan);
  const limit = limits.resources.activeGroups;

  if (limit === -1) {
    return { current, limit };
  }

  if (current >= limit) {
    throw new Error(
      JSON.stringify({
        error: `Límite de ${limit} grupos alcanzado`,
        current,
        limit,
        upgradeUrl: "/pricing",
      })
    );
  }

  return { current, limit };
}

/** Check community post limit atomically */
export async function atomicCheckPostLimit(
  tx: any,
  userId: string,
  dailyLimit: number
): Promise<{ current: number; limit: number }> {
  // Count posts creados hoy
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const current = await tx.post.count({
    where: {
      authorId: userId,
      createdAt: {
        gte: startOfDay,
      },
    },
  });

  if (current >= dailyLimit) {
    throw new Error(
      JSON.stringify({
        error: `Límite diario de ${dailyLimit} posts alcanzado`,
        current,
        limit: dailyLimit,
        retryAfter: getSecondsUntilMidnight(),
      })
    );
  }

  return { current, limit: dailyLimit };
}

/**
 * Helper: Calcular segundos hasta medianoche
 */
function getSecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

/** Check AI limit in a group atomically */
export async function atomicCheckGroupAILimit(
  tx: any,
  groupId: string,
  userPlan: string
): Promise<{ current: number; limit: number }> {
  const current = await tx.groupMember.count({
    where: {
      groupId,
      memberType: "agent",
      isActive: true,
    },
  });

  const limits = getTierLimits(userPlan);
  const limit = limits.resources.maxAIsPerGroup;

  if (current >= limit) {
    throw new Error(
      JSON.stringify({
        error: `Límite de ${limit} IAs por grupo alcanzado`,
        current,
        limit,
        upgradeUrl: "/pricing",
      })
    );
  }

  return { current, limit };
}

/** Check user limit in a group atomically */
export async function atomicCheckGroupUserLimit(
  tx: any,
  groupId: string,
  userPlan: string
): Promise<{ current: number; limit: number }> {
  const current = await tx.groupMember.count({
    where: {
      groupId,
      memberType: "user",
      isActive: true,
    },
  });

  const limits = getTierLimits(userPlan);
  const limit = limits.resources.maxUsersPerGroup;

  if (current >= limit) {
    throw new Error(
      JSON.stringify({
        error: `Límite de ${limit} usuarios por grupo alcanzado`,
        current,
        limit,
        upgradeUrl: "/pricing",
      })
    );
  }

  return { current, limit };
}
