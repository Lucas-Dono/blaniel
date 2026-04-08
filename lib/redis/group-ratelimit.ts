import { redis, getRateLimiter } from "./config";
import { getTierLimits, isUnlimited } from "@/lib/usage/tier-limits";

/**
 * Check if user can send messages in groups based on daily limit
 */
export async function checkGroupMessageLimit(
  userId: string,
  plan: string = "free"
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const limits = getTierLimits(plan);
  const groupMessagesLimit = limits.resources.groupMessagesPerDay;

  // Unlimited for Ultra tier
  if (isUnlimited(groupMessagesLimit)) {
    return { allowed: true };
  }

  const today = new Date().toISOString().split("T")[0];
  const identifier = `group:messages:${userId}:${today}`;

  try {
    const limiter = getRateLimiter(plan, "perDay");
    if (!limiter) {
      // Fallback when Redis is not available
      return { allowed: true };
    }
    const result = await limiter.limit(identifier);

    return {
      allowed: result.success,
      reason: result.success
        ? undefined
        : `Límite diario alcanzado (${groupMessagesLimit} mensajes/día en grupos)`,
      remaining: result.remaining,
    };
  } catch (error) {
    console.error("Group message limit error:", error);
    // Fail open in case of Redis error
    return { allowed: true };
  }
}

/**
 * Check cooldown between messages in a specific group
 */
export async function checkGroupCooldown(
  groupId: string,
  userId: string,
  plan: string = "free"
): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
  const limits = getTierLimits(plan);
  const cooldownMs = limits.resources.groupCooldownMs;

  const identifier = `group:cooldown:${groupId}:${userId}`;

  try {
    const lastMessageTime = await redis.get(identifier);

    if (lastMessageTime) {
      const elapsed = Date.now() - parseInt(lastMessageTime);

      if (elapsed < cooldownMs) {
        const retryAfter = Math.ceil((cooldownMs - elapsed) / 1000);
        return {
          allowed: false,
          reason: `Espera ${retryAfter}s antes de enviar otro mensaje`,
          retryAfter,
        };
      }
    }

    // Set the cooldown
    await redis.set(identifier, Date.now().toString(), {
      ex: Math.ceil(cooldownMs / 1000) + 1,
    });

    return { allowed: true };
  } catch (error) {
    console.error("Group cooldown error:", error);
    // Fail open in case of Redis error
    return { allowed: true };
  }
}

/**
 * Check if user can add an AI to a group based on tier limits
 */
export async function checkAddAIToGroupLimit(
  groupId: string,
  plan: string = "free"
): Promise<{ allowed: boolean; reason?: string; current?: number; limit?: number }> {
  const limits = getTierLimits(plan);
  const maxAIsPerGroup = limits.resources.maxAIsPerGroup;

  try {
    // Import prisma dynamically to avoid circular dependencies
    const { prisma } = await import("@/lib/prisma");

    // Count current AIs in the group
    const currentAICount = await prisma.groupMember.count({
      where: {
        groupId,
        memberType: "agent",
        isActive: true,
      },
    });

    if (currentAICount >= maxAIsPerGroup) {
      return {
        allowed: false,
        reason: `Límite de IAs alcanzado (${currentAICount}/${maxAIsPerGroup} para tu plan)`,
        current: currentAICount,
        limit: maxAIsPerGroup,
      };
    }

    return { allowed: true, current: currentAICount, limit: maxAIsPerGroup };
  } catch (error) {
    console.error("Check AI limit error:", error);
    // Fail open in case of error
    return { allowed: true };
  }
}

/**
 * Check if user can add a user to a group based on tier limits
 */
export async function checkAddUserToGroupLimit(
  groupId: string,
  plan: string = "free"
): Promise<{ allowed: boolean; reason?: string; current?: number; limit?: number }> {
  const limits = getTierLimits(plan);
  const maxUsersPerGroup = limits.resources.maxUsersPerGroup;

  try {
    // Import prisma dynamically to avoid circular dependencies
    const { prisma } = await import("@/lib/prisma");

    // Count current users in the group
    const currentUserCount = await prisma.groupMember.count({
      where: {
        groupId,
        memberType: "user",
        isActive: true,
      },
    });

    if (currentUserCount >= maxUsersPerGroup) {
      return {
        allowed: false,
        reason: `Límite de usuarios alcanzado (${currentUserCount}/${maxUsersPerGroup} para tu plan)`,
        current: currentUserCount,
        limit: maxUsersPerGroup,
      };
    }

    return { allowed: true, current: currentUserCount, limit: maxUsersPerGroup };
  } catch (error) {
    console.error("Check user limit error:", error);
    // Fail open in case of error
    return { allowed: true };
  }
}

/**
 * Comprehensive check for all group-related limits
 */
export async function checkAllGroupLimits(
  groupId: string,
  userId: string,
  messageContent: string,
  plan: string
): Promise<{ allowed: boolean; violations: string[] }> {
  const checks = await Promise.all([
    checkGroupMessageLimit(userId, plan),
    checkGroupCooldown(groupId, userId, plan),
  ]);

  const violations = checks
    .filter((c) => !c.allowed)
    .map((c) => c.reason!)
    .filter(Boolean);

  return {
    allowed: violations.length === 0,
    violations,
  };
}

/**
 * Increment group message count for analytics
 */
export async function incrementGroupMessageCount(
  userId: string,
  groupId: string
): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const identifier = `group:count:${userId}:${today}`;

    await redis.incr(identifier);
    await redis.expire(identifier, 60 * 60 * 48); // 48 hours TTL
  } catch (error) {
    console.error("Error incrementing group message count:", error);
    // Non-critical, don't throw
  }
}

/**
 * Get user's group message count for today
 */
export async function getGroupMessageCount(
  userId: string
): Promise<number> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const identifier = `group:count:${userId}:${today}`;

    const count = await redis.get(identifier);
    return count ? parseInt(count) : 0;
  } catch (error) {
    console.error("Error getting group message count:", error);
    return 0;
  }
}
