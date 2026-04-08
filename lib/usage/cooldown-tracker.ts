/**
 * COOLDOWN TRACKING SYSTEM
 * 
 * Anti-bot system that prevents spam through configurable cooldowns.
 * Uses Redis for efficient and fast tracking.
 * 
 * Cooldowns per plan:
 * - Free: 5 seconds messages, 10 seconds images
 * - Plus: 2 seconds messages, 3 seconds images/voice
 * - Ultra: 1 second messages, 5 seconds images/voice
 */

import { redis, isRedisConfigured } from "@/lib/redis/config";
import { getTierLimits } from "./tier-limits";

// In-memory fallback when Redis is not configured
const memoryCache = new Map<string, number>();

export type CooldownAction = "message" | "voice" | "image" | "world_message";

export interface CooldownCheck {
  allowed: boolean;
  waitMs: number;
  message?: string;
}

/** Checks if the user can perform an action based on cooldown */
export async function checkCooldown(
  userId: string,
  action: CooldownAction,
  userPlan: string = "free"
): Promise<CooldownCheck> {
  try {
    // Get configured cooldown for the plan
    const tierLimits = getTierLimits(userPlan);
    const cooldownMs = getCooldownForAction(action, tierLimits.cooldowns);

    // Si el cooldown es 0, permitir siempre (ej: Ultra sin cooldown en algunos casos)
    if (cooldownMs === 0) {
      return { allowed: true, waitMs: 0 };
    }

    const key = buildCooldownKey(userId, action);
    let lastActionStr: string | number | null = null;

    // Use Redis if configured, otherwise use memory
    if (isRedisConfigured()) {
      try {
        lastActionStr = await redis.get(key);
      } catch (error) {
        console.warn("[CooldownTracker] Redis get failed, falling back to memory:", error);
        lastActionStr = memoryCache.get(key) || null;
      }
    } else {
      // Fallback a memoria
      lastActionStr = memoryCache.get(key) || null;
    }

    if (!lastActionStr) {
      // First time or cooldown already expired
      return { allowed: true, waitMs: 0 };
    }

    // Calcular tiempo transcurrido
    const lastAction = typeof lastActionStr === 'string' ? parseInt(lastActionStr) : lastActionStr;
    const elapsed = Date.now() - lastAction;

    if (elapsed < cooldownMs) {
      // Still in cooldown
      const waitMs = cooldownMs - elapsed;
      return {
        allowed: false,
        waitMs,
        message: buildCooldownMessage(action, waitMs),
      };
    }

    // Cooldown completado
    return { allowed: true, waitMs: 0 };
  } catch (error) {
    console.error("[CooldownTracker] Error checking cooldown:", error);
    // En caso de error, permitir (fail open)
    return { allowed: true, waitMs: 0 };
  }
}

/** Registers an action and sets the cooldown */
export async function trackCooldown(
  userId: string,
  action: CooldownAction,
  userPlan: string = "free"
): Promise<void> {
  try {
    const tierLimits = getTierLimits(userPlan);
    const cooldownMs = getCooldownForAction(action, tierLimits.cooldowns);

    if (cooldownMs === 0) {
      return; // No trackear si no hay cooldown
    }

    const key = buildCooldownKey(userId, action);
    const timestamp = Date.now();
    const expireSeconds = Math.ceil(cooldownMs / 1000) + 1; // +1 segundo de margen

    // Use Redis if configured, otherwise use memory
    if (isRedisConfigured()) {
      try {
        await redis.set(key, timestamp.toString(), "EX", expireSeconds);
      } catch (error) {
        console.warn("[CooldownTracker] Redis set failed, falling back to memory:", error);
        memoryCache.set(key, timestamp);
        // Memory auto-cleanup after cooldown
        setTimeout(() => memoryCache.delete(key), cooldownMs);
      }
    } else {
      // Fallback a memoria
      memoryCache.set(key, timestamp);
      // Memory auto-cleanup after cooldown
      setTimeout(() => memoryCache.delete(key), cooldownMs);
    }
  } catch (error) {
    console.error("[CooldownTracker] Error tracking cooldown:", error);
    // No lanzar error, solo loguear
  }
}

/** Resets a user's cooldown (useful for testing or admin override) */
export async function resetCooldown(
  userId: string,
  action?: CooldownAction
): Promise<void> {
  try {
    if (isRedisConfigured()) {
      if (action) {
        // Reset specific action
        const key = buildCooldownKey(userId, action);
        await redis.del(key);
      } else {
        // Reset all of the user's cooldowns
        const pattern = `cooldown:${userId}:*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
    }

    // Also clear from in-memory cache
    if (action) {
      const key = buildCooldownKey(userId, action);
      memoryCache.delete(key);
    } else {
      // Clear all user keys from memory
      const prefix = `cooldown:${userId}:`;
      for (const key of memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          memoryCache.delete(key);
        }
      }
    }
  } catch (error) {
    console.error("[CooldownTracker] Error resetting cooldown:", error);
  }
}

/** Gets the status of all cooldowns for a user */
export async function getUserCooldowns(
  userId: string
): Promise<Record<CooldownAction, { active: boolean; remainingMs: number }>> {
  const actions: CooldownAction[] = ["message", "voice", "image", "world_message"];
  const result: any = {};

  for (const action of actions) {
    const key = buildCooldownKey(userId, action);
    let lastActionStr: string | number | null = null;

    // Use Redis if configured, otherwise use memory
    if (isRedisConfigured()) {
      try {
        lastActionStr = await redis.get(key);
      } catch {
        lastActionStr = memoryCache.get(key) || null;
      }
    } else {
      lastActionStr = memoryCache.get(key) || null;
    }

    if (!lastActionStr) {
      result[action] = { active: false, remainingMs: 0 };
    } else {
      const lastAction = typeof lastActionStr === 'string' ? parseInt(lastActionStr) : lastActionStr;
      const elapsed = Date.now() - lastAction;
      // Assume a 5-second cooldown by default for estimation
      const remainingMs = Math.max(0, 5000 - elapsed);
      result[action] = { active: remainingMs > 0, remainingMs };
    }
  }

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Construye la key de Redis para un cooldown
 */
function buildCooldownKey(userId: string, action: CooldownAction): string {
  return `cooldown:${userId}:${action}`;
}

/** Gets the cooldown in ms for a specific action */
function getCooldownForAction(
  action: CooldownAction,
  cooldowns: {
    messageCooldown: number;
    worldMessageCooldown: number;
    imageAnalysisCooldown?: number;
    voiceMessageCooldown?: number;
  }
): number {
  switch (action) {
    case "message":
      return cooldowns.messageCooldown;
    case "world_message":
      return cooldowns.worldMessageCooldown;
    case "image":
      return cooldowns.imageAnalysisCooldown || 0;
    case "voice":
      return cooldowns.voiceMessageCooldown || 0;
    default:
      return 0;
  }
}

/** Builds a user-friendly error message */
function buildCooldownMessage(action: CooldownAction, waitMs: number): string {
  const waitSeconds = Math.ceil(waitMs / 1000);

  const actionNames = {
    message: "mensaje",
    voice: "mensaje de voz",
    image: "análisis de imagen",
    world_message: "mensaje en el mundo",
  };

  const actionName = actionNames[action] || "acción";

  if (waitSeconds === 1) {
    return `Por favor espera 1 segundo antes de enviar otro ${actionName}.`;
  }

  return `Por favor espera ${waitSeconds} segundos antes de enviar otro ${actionName}.`;
}

/** Checks multiple cooldowns at once (useful for complex actions) */
export async function checkMultipleCooldowns(
  userId: string,
  actions: CooldownAction[],
  userPlan: string = "free"
): Promise<{ allowed: boolean; blockedBy?: CooldownAction; check?: CooldownCheck }> {
  for (const action of actions) {
    const check = await checkCooldown(userId, action, userPlan);
    if (!check.allowed) {
      return {
        allowed: false,
        blockedBy: action,
        check,
      };
    }
  }

  return { allowed: true };
}

/** Tracks multiple cooldowns at once */
export async function trackMultipleCooldowns(
  userId: string,
  actions: CooldownAction[],
  userPlan: string = "free"
): Promise<void> {
  await Promise.all(
    actions.map((action) => trackCooldown(userId, action, userPlan))
  );
}
