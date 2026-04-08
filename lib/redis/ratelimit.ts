import { NextRequest, NextResponse } from "next/server";
import { getRateLimiter, getRateLimiterLegacy, isRedisConfigured, redis, CACHE_TTL, getCacheKey } from "./config";
import { auth } from "@/lib/auth";
import { getTierLimits, buildRateLimitError, type UserTier } from "@/lib/usage/tier-limits";
import { prisma } from "@/lib/prisma";

// In-memory fallback for when Redis not configured
const inMemoryLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * Redis fallback monitoring
 * Logs when system falls back to in-memory to alert of issues
 */
const fallbackMetrics = {
  count: 0,
  lastFallback: null as Date | null,
  errors: [] as string[],
};

function logRedisFallback(context: string, error?: any) {
  fallbackMetrics.count++;
  fallbackMetrics.lastFallback = new Date();

  if (error) {
    const errorMsg = `[${context}] ${error.message || error}`;
    fallbackMetrics.errors.push(errorMsg);

    // Keep only last 50 errors
    if (fallbackMetrics.errors.length > 50) {
      fallbackMetrics.errors.shift();
    }
  }

  // Critical log to alert ops/monitoring
  console.error(`🔴 REDIS FALLBACK [${context}]: System using in-memory rate limiting. Total fallbacks: ${fallbackMetrics.count}`, error || '');

  // If many fallbacks, alert more strongly
  if (fallbackMetrics.count % 100 === 0) {
    console.error(`⚠️⚠️⚠️ ALERT: ${fallbackMetrics.count} Redis fallbacks detected. Check connection urgently.`);
  }
}

/**
 * Get fallback metrics (useful for monitoring dashboards)
 */
export function getRedisFallbackMetrics() {
  return {
    ...fallbackMetrics,
    isHealthy: !isRedisConfigured() || fallbackMetrics.count < 10,
  };
}

function inMemoryRateLimit(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = inMemoryLimits.get(identifier);

  if (!record || record.resetAt < now) {
    // New window
    inMemoryLimits.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (record.count >= limit) {
    return false; // Límite alcanzado
  }

  record.count++;
  return true;
}

// Verificar rate limit
export async function checkRateLimit(
  identifier: string,
  plan: string = "free"
): Promise<{ success: boolean; limit?: number; remaining?: number; reset?: number }> {
  // Si Redis no está configurado, usar in-memory fallback
  if (!isRedisConfigured()) {
    const limits = {
      free: { max: 10, window: 60000 }, // 10 req/min
      plus: { max: 100, window: 60000 }, // 100 req/min
      ultra: { max: 1000, window: 60000 }, // 1000 req/min
    };

    const planLimit = limits[plan as keyof typeof limits] || limits.free;
    const success = inMemoryRateLimit(identifier, planLimit.max, planLimit.window);

    return {
      success,
      limit: planLimit.max,
      remaining: success ? planLimit.max - 1 : 0,
    };
  }

  // Usar Redis
  try {
    const limiter = getRateLimiterLegacy(plan);
    if (!limiter) {
      // Fallback to in-memory when Redis is not available
      logRedisFallback("checkRateLimit", new Error("Redis not configured"));
      const limits = {
        free: { max: 10, window: 60000 },
        plus: { max: 100, window: 60000 },
        ultra: { max: 1000, window: 60000 },
      };
      const planLimit = limits[plan as keyof typeof limits] || limits.free;
      const success = inMemoryRateLimit(identifier, planLimit.max, planLimit.window);
      return {
        success,
        limit: planLimit.max,
        remaining: success ? planLimit.max - 1 : 0,
      };
    }
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error("Rate limit error (Redis failed):", error);

    // Registrar fallback para monitoreo
    logRedisFallback('checkRateLimit', error);

    // SECURITY FIX #7: En caso de error de Redis, usar fallback in-memory
    // NUNCA fail-open (permitir todo) - usar rate limiting en memoria

    const limits = {
      free: { max: 10, window: 60000 }, // 10 req/min
      plus: { max: 100, window: 60000 }, // 100 req/min
      ultra: { max: 1000, window: 60000 }, // 1000 req/min
    };

    const planLimit = limits[plan as keyof typeof limits] || limits.free;
    const success = inMemoryRateLimit(identifier, planLimit.max, planLimit.window);

    return {
      success,
      limit: planLimit.max,
      remaining: success ? planLimit.max - 1 : 0,
    };
  }
}

// Middleware helper para proteger rutas
export async function withRateLimit(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const user = session?.user;

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get plan del usuario
    const plan = await getCachedUserPlan(user.id);

    // Check rate limit
    const { success, limit, remaining, reset } = await checkRateLimit(
      user.id,
      plan
    );

    if (!success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          limit,
          remaining: 0,
          reset,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit?.toString() || "0",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": reset?.toString() || "0",
          },
        }
      );
    }

    // Ejecutar handler
    const response = await handler();

    // Agregar headers de rate limit
    if (limit) {
      response.headers.set("X-RateLimit-Limit", limit.toString());
      response.headers.set("X-RateLimit-Remaining", remaining?.toString() || "0");
      if (reset) {
        response.headers.set("X-RateLimit-Reset", reset.toString());
      }
    }

    return response;
  } catch (error) {
    console.error("Rate limit middleware error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Verificar rate limit por API key
export async function checkApiKeyRateLimit(
  apiKey: string
): Promise<{ success: boolean; limit?: number; remaining?: number }> {
  return await checkRateLimit(`api:${apiKey}`, "api");
}

// Limpiar in-memory cache periódicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of inMemoryLimits.entries()) {
    if (record.resetAt < now) {
      inMemoryLimits.delete(key);
    }
  }
}, 60000); // Cada minuto

// ============================================================================
// WORLD-SPECIFIC RATE LIMITING
// ============================================================================

interface WorldRateLimitResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  limit?: number;
  resetAt?: number;
  retryAfter?: number;
}

/**
 * Obtiene límites de mensajes en mundos por tier
 */
function getWorldMessageLimits(plan: string): {
  messagesPerDay: number;
  maxAgents: number;
  cooldownMs: number;
  maxIdenticalMessages: number;
  floodThreshold: number;
} {
  const limits = {
    free: {
      messagesPerDay: 50,
      maxAgents: 3,
      cooldownMs: 5000, // 5 segundos
      maxIdenticalMessages: 10,
      floodThreshold: 20,
    },
    plus: {
      messagesPerDay: 500,
      maxAgents: 10,
      cooldownMs: 2000, // 2 segundos
      maxIdenticalMessages: 10,
      floodThreshold: 20,
    },
    ultra: {
      messagesPerDay: -1, // Ilimitado
      maxAgents: 50,
      cooldownMs: 0, // Sin cooldown
      maxIdenticalMessages: 10,
      floodThreshold: 20,
    },
  };

  return limits[plan as keyof typeof limits] || limits.free;
}

/**
 * Verifica límites de mensajes diarios en mundos
 */
export async function checkWorldMessageLimit(
  userId: string,
  plan: string = "free"
): Promise<WorldRateLimitResult> {
  const limits = getWorldMessageLimits(plan);

  // Planes ultra tienen mensajes ilimitados
  if (limits.messagesPerDay === -1) {
    return { allowed: true };
  }

  const today = new Date().toISOString().split("T")[0];
  const identifier = `world:messages:${userId}:${today}`;

  if (!isRedisConfigured()) {
    // Usar in-memory fallback
    const success = inMemoryRateLimit(identifier, limits.messagesPerDay, 24 * 60 * 60 * 1000);
    const record = inMemoryLimits.get(identifier);
    const remaining = record ? limits.messagesPerDay - record.count : limits.messagesPerDay;

    return {
      allowed: success,
      reason: success
        ? undefined
        : `Límite diario de mensajes en mundos alcanzado (${limits.messagesPerDay}/día). ${plan === "free" ? "Actualiza a Plus para 500 mensajes/día o Ultra para mensajes ilimitados." : "Vuelve mañana o actualiza tu plan."}`,
      remaining: Math.max(0, remaining),
      limit: limits.messagesPerDay,
      resetAt: record?.resetAt,
    };
  }

  try {
    const limiter = getRateLimiterLegacy(plan);
    if (!limiter) {
      // Fallback when Redis is not available
      logRedisFallback("checkMessageRateLimit", new Error("Redis not configured"));
      const success = inMemoryRateLimit(identifier, limits.messagesPerDay, 24 * 60 * 60 * 1000);
      const record = inMemoryLimits.get(identifier);
      const remaining = record ? limits.messagesPerDay - record.count : limits.messagesPerDay;
      return {
        allowed: success,
        reason: success ? undefined : `Límite diario alcanzado`,
        remaining: Math.max(0, remaining),
        limit: limits.messagesPerDay,
        resetAt: record?.resetAt,
      };
    }
    const result = await limiter.limit(identifier);

    return {
      allowed: result.success,
      reason: result.success
        ? undefined
        : `Límite diario de mensajes en mundos alcanzado (${limits.messagesPerDay}/día). ${plan === "free" ? "Actualiza a Plus para 500 mensajes/día o Ultra para mensajes ilimitados." : "Vuelve mañana o actualiza tu plan."}`,
      remaining: result.remaining,
      limit: result.limit,
      resetAt: result.reset,
    };
  } catch (error) {
    console.error("World message limit error (Redis failed):", error);
    logRedisFallback('checkWorldMessageLimit', error);
    // Fallback to in-memory
    const success = inMemoryRateLimit(identifier, limits.messagesPerDay, 24 * 60 * 60 * 1000);
    const record = inMemoryLimits.get(identifier);
    const remaining = record ? limits.messagesPerDay - record.count : limits.messagesPerDay;

    return {
      allowed: success,
      remaining: Math.max(0, remaining),
      limit: limits.messagesPerDay,
    };
  }
}

/**
 * Verifica cooldown entre mensajes en un mundo específico
 */
export async function checkWorldCooldown(
  worldId: string,
  userId: string,
  plan: string = "free"
): Promise<WorldRateLimitResult> {
  const limits = getWorldMessageLimits(plan);

  // Sin cooldown para ultra
  if (limits.cooldownMs === 0) {
    return { allowed: true };
  }

  const identifier = `world:cooldown:${worldId}:${userId}`;
  const now = Date.now();

  if (!isRedisConfigured()) {
    // In-memory cooldown check
    const record = inMemoryLimits.get(identifier);

    if (record && record.resetAt > now) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return {
        allowed: false,
        reason: `Por favor espera ${retryAfter} segundos antes de enviar otro mensaje. ${plan === "free" ? "Usuarios Plus esperan 2 segundos, Ultra sin cooldown." : ""}`,
        retryAfter,
      };
    }

    // Set cooldown
    inMemoryLimits.set(identifier, {
      count: 1,
      resetAt: now + limits.cooldownMs,
    });

    return { allowed: true };
  }

  try {
    const limiter = getRateLimiterLegacy(plan);
    if (!limiter) {
      // Fallback when Redis is not available
      logRedisFallback("checkMessageCooldown", new Error("Redis not configured"));
      return { allowed: true };
    }
    const result = await limiter.limit(identifier);

    if (!result.success && result.reset) {
      const retryAfter = Math.ceil((result.reset - Date.now() / 1000));
      return {
        allowed: false,
        reason: `Por favor espera ${retryAfter} segundos antes de enviar otro mensaje. ${plan === "free" ? "Usuarios Plus esperan 2 segundos, Ultra sin cooldown." : ""}`,
        retryAfter,
      };
    }

    return { allowed: result.success };
  } catch (error) {
    console.error("World cooldown error (Redis failed):", error);
    logRedisFallback('checkWorldCooldown', error);
    // Fallback
    const record = inMemoryLimits.get(identifier);

    if (record && record.resetAt > now) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return {
        allowed: false,
        reason: `Por favor espera ${retryAfter} segundos antes de enviar otro mensaje.`,
        retryAfter,
      };
    }

    inMemoryLimits.set(identifier, {
      count: 1,
      resetAt: now + limits.cooldownMs,
    });

    return { allowed: true };
  }
}

/**
 * Verifica protección anti-spam (mensajes idénticos)
 */
export async function checkSpamProtection(
  worldId: string,
  userId: string,
  messageContent: string
): Promise<WorldRateLimitResult> {
  // Hash del mensaje para identificar duplicados
  const messageHash = Buffer.from(messageContent.toLowerCase().trim())
    .toString("base64")
    .substring(0, 32);

  const identifier = `world:spam:${worldId}:${userId}:${messageHash}`;
  const maxIdentical = 10; // Máximo 10 mensajes idénticos en 1 hora

  if (!isRedisConfigured()) {
    const success = inMemoryRateLimit(identifier, maxIdentical, 60 * 60 * 1000); // 1 hora

    return {
      allowed: success,
      reason: success
        ? undefined
        : "Has enviado este mensaje demasiadas veces. Por favor envía algo diferente.",
    };
  }

  try {
    const limiter = getRateLimiterLegacy("free"); // Usar límites free para spam
    if (!limiter) {
      // Fallback when Redis is not available
      logRedisFallback("checkIdenticalMessageSpam", new Error("Redis not configured"));
      const success = inMemoryRateLimit(identifier, maxIdentical, 60 * 60 * 1000); // 1 hora
      return {
        allowed: success,
        reason: success ? undefined : "Has enviado este mensaje demasiadas veces. Por favor envía algo diferente.",
      };
    }
    const result = await limiter.limit(identifier);

    return {
      allowed: result.success,
      reason: result.success
        ? undefined
        : "Has enviado este mensaje demasiadas veces. Por favor envía algo diferente.",
    };
  } catch (error) {
    console.error("Spam protection error (Redis failed):", error);
    logRedisFallback('checkSpamProtection', error);
    const success = inMemoryRateLimit(identifier, maxIdentical, 60 * 60 * 1000);

    return {
      allowed: success,
      reason: success
        ? undefined
        : "Has enviado este mensaje demasiadas veces. Por favor envía algo diferente.",
    };
  }
}

/**
 * Verifica protección anti-flooding (demasiados mensajes en poco tiempo)
 */
export async function checkFloodProtection(
  worldId: string,
  userId: string,
  plan: string = "free"
): Promise<WorldRateLimitResult> {
  const limits = getWorldMessageLimits(plan);
  const identifier = `world:flood:${worldId}:${userId}`;
  const maxMessages = limits.floodThreshold; // 20 mensajes en 1 minuto

  if (!isRedisConfigured()) {
    const success = inMemoryRateLimit(identifier, maxMessages, 60 * 1000); // 1 minuto

    return {
      allowed: success,
      reason: success
        ? undefined
        : "Estás enviando mensajes demasiado rápido. Por favor espera un momento.",
    };
  }

  try {
    const limiter = getRateLimiter("free"); // Usar límites free para flood
    if (!limiter) {
      throw new Error("Rate limiter not available");
    }
    const result = await limiter.limit(identifier);

    return {
      allowed: result.success,
      reason: result.success
        ? undefined
        : "Estás enviando mensajes demasiado rápido. Por favor espera un momento.",
    };
  } catch (error) {
    console.error("Flood protection error (Redis failed):", error);
    logRedisFallback('checkFloodProtection', error);
    const success = inMemoryRateLimit(identifier, maxMessages, 60 * 1000);

    return {
      allowed: success,
      reason: success
        ? undefined
        : "Estás enviando mensajes demasiado rápido. Por favor espera un momento.",
    };
  }
}

/**
 * Verifica límite de agentes por mundo según tier
 */
export function checkWorldAgentLimit(
  currentAgentCount: number,
  plan: string = "free"
): WorldRateLimitResult {
  const limits = getWorldMessageLimits(plan);

  if (limits.maxAgents === -1) {
    return { allowed: true };
  }

  const allowed = currentAgentCount < limits.maxAgents;

  return {
    allowed,
    reason: allowed
      ? undefined
      : `Has alcanzado el límite de ${limits.maxAgents} agentes por mundo. ${plan === "free" ? "Actualiza a Plus para 10 agentes o Ultra para 50 agentes." : plan === "plus" ? "Actualiza a Ultra para 50 agentes por mundo." : ""}`,
    limit: limits.maxAgents,
    remaining: Math.max(0, limits.maxAgents - currentAgentCount),
  };
}

/**
 * Obtiene información de límites de mundo para un plan
 */
export function getWorldLimitsInfo(plan: string = "free") {
  return getWorldMessageLimits(plan);
}

/**
 * Verifica todos los límites de mundo en una sola llamada
 */
export async function checkAllWorldLimits(
  worldId: string,
  userId: string,
  messageContent: string,
  currentAgentCount: number,
  plan: string = "free"
): Promise<{
  allowed: boolean;
  violations: string[];
  limits: ReturnType<typeof getWorldMessageLimits>;
}> {
  const checks = await Promise.all([
    checkWorldMessageLimit(userId, plan),
    checkWorldCooldown(worldId, userId, plan),
    checkSpamProtection(worldId, userId, messageContent),
    checkFloodProtection(worldId, userId, plan),
  ]);

  const violations: string[] = [];
  for (const check of checks) {
    if (!check.allowed && check.reason) {
      violations.push(check.reason);
    }
  }

  // Verificar límite de agentes (no async)
  const agentCheck = checkWorldAgentLimit(currentAgentCount, plan);
  if (!agentCheck.allowed && agentCheck.reason) {
    violations.push(agentCheck.reason);
  }

  return {
    allowed: violations.length === 0,
    violations,
    limits: getWorldMessageLimits(plan),
  };
}

// ============================================================================
// TIER-BASED RATE LIMITING (NEW)
// ============================================================================

/**
 * Get cached user plan from Redis (or fetch from DB)
 * Performance optimization to avoid DB query on every request
 */
export async function getCachedUserPlan(userId: string): Promise<string> {
  if (!isRedisConfigured()) {
    // Fallback to DB if Redis not available
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    return user?.plan || "free";
  }

  try {
    const cacheKey = getCacheKey("user-plan", userId);
    const cached = await redis.get(cacheKey);

    if (cached) {
      return cached as string;
    }

    // Cache miss - fetch from DB and cache
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const plan = user?.plan || "free";

    // Cache for 5 minutes
    await redis.set(cacheKey, plan, { ex: CACHE_TTL.user });

    return plan;
  } catch (error) {
    console.error("Error fetching cached user plan:", error);
    // Fallback to DB
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    return user?.plan || "free";
  }
}

/**
 * Invalidate cached user plan (call when plan changes)
 */
export async function invalidateUserPlanCache(userId: string): Promise<void> {
  if (!isRedisConfigured()) return;

  try {
    const cacheKey = getCacheKey("user-plan", userId);
    await redis.del(cacheKey);
  } catch (error) {
    console.error("Error invalidating user plan cache:", error);
  }
}

/**
 * Check comprehensive tier-based rate limits (all windows)
 */
export async function checkTierRateLimit(
  userId: string,
  plan?: string
): Promise<{
  success: boolean;
  tier: UserTier;
  limit: number;
  remaining: number;
  reset?: number;
  violatedWindow?: "minute" | "hour" | "day";
  error?: ReturnType<typeof buildRateLimitError>;
}> {
  // Get user plan (cached)
  const userPlan = plan || await getCachedUserPlan(userId);
  const tierLimits = getTierLimits(userPlan);
  const tier = userPlan as UserTier;

  // Check per-minute limit (always enforced)
  const minuteCheck = await checkRateLimit(userId, userPlan);
  if (!minuteCheck.success) {
    return {
      success: false,
      tier,
      limit: minuteCheck.limit || 0,
      remaining: 0,
      reset: minuteCheck.reset,
      violatedWindow: "minute",
      error: buildRateLimitError(tier, minuteCheck.limit || 0, 0, minuteCheck.reset),
    };
  }

  // Check per-hour limit (if not unlimited)
  if (tierLimits.apiRequests.perHour !== -1) {
    const hourLimiter = getRateLimiter(userPlan, "perHour");
    if (hourLimiter) {
      const hourResult = await hourLimiter.limit(userId);
      if (!hourResult.success) {
        return {
          success: false,
          tier,
          limit: hourResult.limit,
          remaining: hourResult.remaining,
          reset: hourResult.reset,
          violatedWindow: "hour",
          error: buildRateLimitError(tier, hourResult.limit, hourResult.remaining, hourResult.reset),
        };
      }
    }
  }

  // Check per-day limit (if not unlimited)
  if (tierLimits.apiRequests.perDay !== -1) {
    const dayLimiter = getRateLimiter(userPlan, "perDay");
    if (dayLimiter) {
      const dayResult = await dayLimiter.limit(userId);
      if (!dayResult.success) {
        return {
          success: false,
          tier,
          limit: dayResult.limit,
          remaining: dayResult.remaining,
          reset: dayResult.reset,
          violatedWindow: "day",
          error: buildRateLimitError(tier, dayResult.limit, dayResult.remaining, dayResult.reset),
        };
      }
    }
  }

  // All checks passed
  return {
    success: true,
    tier,
    limit: minuteCheck.limit || 0,
    remaining: minuteCheck.remaining || 0,
    reset: minuteCheck.reset,
  };
}

/**
 * Middleware helper for tier-based rate limiting
 * Use this in API routes to enforce comprehensive tier limits
 */
export async function withTierRateLimit(
  req: NextRequest,
  handler: (user: any) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const user = session?.user;

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check tier-based rate limit
    const plan = await getCachedUserPlan(user.id);
    const rateLimitResult = await checkTierRateLimit(user.id, plan);

    if (!rateLimitResult.success) {
      const error = rateLimitResult.error!;
      return NextResponse.json(error, {
        status: 429,
        headers: {
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.reset?.toString() || "0",
          "X-RateLimit-Window": rateLimitResult.violatedWindow || "unknown",
          "Retry-After": rateLimitResult.reset
            ? Math.ceil(rateLimitResult.reset - Date.now() / 1000).toString()
            : "60",
        },
      });
    }

    // Execute handler
    const response = await handler(user);

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", rateLimitResult.limit.toString());
    response.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
    response.headers.set("X-RateLimit-Tier", rateLimitResult.tier);
    if (rateLimitResult.reset) {
      response.headers.set("X-RateLimit-Reset", rateLimitResult.reset.toString());
    }

    return response;
  } catch (error) {
    console.error("Tier rate limit middleware error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Get tier rate limit info for display
 */
export function getTierRateLimitInfo(tier: UserTier) {
  const limits = getTierLimits(tier);
  return {
    tier,
    displayName: limits.displayName,
    limits: {
      perMinute: limits.apiRequests.perMinute,
      perHour: limits.apiRequests.perHour === -1 ? "Unlimited" : limits.apiRequests.perHour,
      perDay: limits.apiRequests.perDay === -1 ? "Unlimited" : limits.apiRequests.perDay,
    },
    cooldowns: limits.cooldowns,
  };
}

// ============================================================================
// COMMUNITY-SPECIFIC RATE LIMITING
// ============================================================================

/**
 * Obtiene límites de community por tier
 */
function getCommunityLimits(plan: string): {
  postsPerDay: number;
  commentsPerDay: number;
  votesPerDay: number;
  postCooldownMs: number;
  commentCooldownMs: number;
} {
  const limits = {
    free: {
      postsPerDay: 10,
      commentsPerDay: 50,
      votesPerDay: 100,
      postCooldownMs: 60000, // 1 minuto entre posts
      commentCooldownMs: 5000, // 5 segundos entre comentarios
    },
    plus: {
      postsPerDay: 50,
      commentsPerDay: 500,
      votesPerDay: -1, // Ilimitado
      postCooldownMs: 30000, // 30 segundos entre posts
      commentCooldownMs: 2000, // 2 segundos entre comentarios
    },
    ultra: {
      postsPerDay: -1, // Ilimitado
      commentsPerDay: -1, // Ilimitado
      votesPerDay: -1, // Ilimitado
      postCooldownMs: 0, // Sin cooldown
      commentCooldownMs: 0, // Sin cooldown
    },
  };

  return limits[plan as keyof typeof limits] || limits.free;
}

/**
 * Verifica límite de creación de posts
 */
export async function checkPostCreationLimit(
  userId: string,
  plan: string = "free"
): Promise<WorldRateLimitResult> {
  const limits = getCommunityLimits(plan);

  // Planes ultra tienen posts ilimitados
  if (limits.postsPerDay === -1) {
    return { allowed: true };
  }

  const today = new Date().toISOString().split("T")[0];
  const identifier = `community:posts:${userId}:${today}`;

  if (!isRedisConfigured()) {
    const success = inMemoryRateLimit(identifier, limits.postsPerDay, 24 * 60 * 60 * 1000);
    const record = inMemoryLimits.get(identifier);
    const remaining = record ? limits.postsPerDay - record.count : limits.postsPerDay;

    return {
      allowed: success,
      reason: success
        ? undefined
        : `Límite diario de posts alcanzado (${limits.postsPerDay}/día). ${plan === "free" ? "Actualiza a Plus para 50 posts/día o Ultra para posts ilimitados." : "Vuelve mañana o actualiza tu plan."}`,
      remaining: Math.max(0, remaining),
      limit: limits.postsPerDay,
      resetAt: record?.resetAt,
    };
  }

  try {
    const limiter = getRateLimiterLegacy(plan);
    if (!limiter) {
      // Fallback when Redis is not available
      logRedisFallback("checkCommunityPostLimit", new Error("Redis not configured"));
      const success = inMemoryRateLimit(identifier, limits.postsPerDay, 24 * 60 * 60 * 1000);
      const record = inMemoryLimits.get(identifier);
      const remaining = record ? limits.postsPerDay - record.count : limits.postsPerDay;
      return {
        allowed: success,
        reason: success ? undefined : `Límite diario de posts alcanzado`,
        remaining: Math.max(0, remaining),
        limit: limits.postsPerDay,
        resetAt: record?.resetAt,
      };
    }
    const result = await limiter.limit(identifier);

    return {
      allowed: result.success,
      reason: result.success
        ? undefined
        : `Límite diario de posts alcanzado (${limits.postsPerDay}/día). ${plan === "free" ? "Actualiza a Plus para 50 posts/día o Ultra para posts ilimitados." : "Vuelve mañana o actualiza tu plan."}`,
      remaining: result.remaining,
      limit: result.limit,
      resetAt: result.reset,
    };
  } catch (error) {
    console.error("Post creation limit error (Redis failed):", error);
    logRedisFallback('checkPostCreationLimit', error);
    const success = inMemoryRateLimit(identifier, limits.postsPerDay, 24 * 60 * 60 * 1000);
    const record = inMemoryLimits.get(identifier);
    const remaining = record ? limits.postsPerDay - record.count : limits.postsPerDay;

    return {
      allowed: success,
      remaining: Math.max(0, remaining),
      limit: limits.postsPerDay,
    };
  }
}

/**
 * Verifica cooldown entre posts
 */
export async function checkPostCooldown(
  userId: string,
  plan: string = "free"
): Promise<WorldRateLimitResult> {
  const limits = getCommunityLimits(plan);

  // Sin cooldown para ultra
  if (limits.postCooldownMs === 0) {
    return { allowed: true };
  }

  const identifier = `community:post-cooldown:${userId}`;
  const now = Date.now();

  if (!isRedisConfigured()) {
    const record = inMemoryLimits.get(identifier);

    if (record && record.resetAt > now) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return {
        allowed: false,
        reason: `Por favor espera ${retryAfter} segundos antes de crear otro post. ${plan === "free" ? "Usuarios Plus esperan 30 segundos, Ultra sin cooldown." : ""}`,
        retryAfter,
      };
    }

    inMemoryLimits.set(identifier, {
      count: 1,
      resetAt: now + limits.postCooldownMs,
    });

    return { allowed: true };
  }

  try {
    const limiter = getRateLimiterLegacy(plan);
    if (!limiter) {
      // Fallback when Redis is not available
      logRedisFallback("checkCommunityPostCooldown", new Error("Redis not configured"));
      return { allowed: true };
    }
    const result = await limiter.limit(identifier);

    if (!result.success && result.reset) {
      const retryAfter = Math.ceil((result.reset - Date.now() / 1000));
      return {
        allowed: false,
        reason: `Por favor espera ${retryAfter} segundos antes de crear otro post. ${plan === "free" ? "Usuarios Plus esperan 30 segundos, Ultra sin cooldown." : ""}`,
        retryAfter,
      };
    }

    return { allowed: result.success };
  } catch (error) {
    console.error("Post cooldown error (Redis failed):", error);
    logRedisFallback('checkPostCooldown', error);
    const record = inMemoryLimits.get(identifier);

    if (record && record.resetAt > now) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return {
        allowed: false,
        reason: `Por favor espera ${retryAfter} segundos antes de crear otro post.`,
        retryAfter,
      };
    }

    inMemoryLimits.set(identifier, {
      count: 1,
      resetAt: now + limits.postCooldownMs,
    });

    return { allowed: true };
  }
}

/**
 * Verifica límite de creación de comentarios
 */
export async function checkCommentCreationLimit(
  userId: string,
  plan: string = "free"
): Promise<WorldRateLimitResult> {
  const limits = getCommunityLimits(plan);

  if (limits.commentsPerDay === -1) {
    return { allowed: true };
  }

  const today = new Date().toISOString().split("T")[0];
  const identifier = `community:comments:${userId}:${today}`;

  if (!isRedisConfigured()) {
    const success = inMemoryRateLimit(identifier, limits.commentsPerDay, 24 * 60 * 60 * 1000);
    const record = inMemoryLimits.get(identifier);
    const remaining = record ? limits.commentsPerDay - record.count : limits.commentsPerDay;

    return {
      allowed: success,
      reason: success
        ? undefined
        : `Límite diario de comentarios alcanzado (${limits.commentsPerDay}/día). ${plan === "free" ? "Actualiza a Plus para 500 comentarios/día o Ultra para comentarios ilimitados." : "Vuelve mañana o actualiza tu plan."}`,
      remaining: Math.max(0, remaining),
      limit: limits.commentsPerDay,
      resetAt: record?.resetAt,
    };
  }

  try {
    const limiter = getRateLimiterLegacy(plan);
    if (!limiter) {
      // Fallback when Redis is not available
      logRedisFallback("checkCommunityCommentLimit", new Error("Redis not configured"));
      const success = inMemoryRateLimit(identifier, limits.commentsPerDay, 24 * 60 * 60 * 1000);
      const record = inMemoryLimits.get(identifier);
      const remaining = record ? limits.commentsPerDay - record.count : limits.commentsPerDay;
      return {
        allowed: success,
        reason: success ? undefined : `Límite diario de comentarios alcanzado`,
        remaining: Math.max(0, remaining),
        limit: limits.commentsPerDay,
        resetAt: record?.resetAt,
      };
    }
    const result = await limiter.limit(identifier);

    return {
      allowed: result.success,
      reason: result.success
        ? undefined
        : `Límite diario de comentarios alcanzado (${limits.commentsPerDay}/día). ${plan === "free" ? "Actualiza a Plus para 500 comentarios/día o Ultra para comentarios ilimitados." : "Vuelve mañana o actualiza tu plan."}`,
      remaining: result.remaining,
      limit: result.limit,
      resetAt: result.reset,
    };
  } catch (error) {
    console.error("Comment creation limit error (Redis failed):", error);
    logRedisFallback('checkCommentCreationLimit', error);
    const success = inMemoryRateLimit(identifier, limits.commentsPerDay, 24 * 60 * 60 * 1000);
    const record = inMemoryLimits.get(identifier);
    const remaining = record ? limits.commentsPerDay - record.count : limits.commentsPerDay;

    return {
      allowed: success,
      remaining: Math.max(0, remaining),
      limit: limits.commentsPerDay,
    };
  }
}

/**
 * Verifica cooldown entre comentarios
 */
export async function checkCommentCooldown(
  userId: string,
  plan: string = "free"
): Promise<WorldRateLimitResult> {
  const limits = getCommunityLimits(plan);

  if (limits.commentCooldownMs === 0) {
    return { allowed: true };
  }

  const identifier = `community:comment-cooldown:${userId}`;
  const now = Date.now();

  if (!isRedisConfigured()) {
    const record = inMemoryLimits.get(identifier);

    if (record && record.resetAt > now) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return {
        allowed: false,
        reason: `Por favor espera ${retryAfter} segundos antes de comentar nuevamente. ${plan === "free" ? "Usuarios Plus esperan 2 segundos, Ultra sin cooldown." : ""}`,
        retryAfter,
      };
    }

    inMemoryLimits.set(identifier, {
      count: 1,
      resetAt: now + limits.commentCooldownMs,
    });

    return { allowed: true };
  }

  try {
    const limiter = getRateLimiterLegacy(plan);
    if (!limiter) {
      // Fallback when Redis is not available
      logRedisFallback("checkCommunityCommentCooldown", new Error("Redis not configured"));
      return { allowed: true };
    }
    const result = await limiter.limit(identifier);

    if (!result.success && result.reset) {
      const retryAfter = Math.ceil((result.reset - Date.now() / 1000));
      return {
        allowed: false,
        reason: `Por favor espera ${retryAfter} segundos antes de comentar nuevamente. ${plan === "free" ? "Usuarios Plus esperan 2 segundos, Ultra sin cooldown." : ""}`,
        retryAfter,
      };
    }

    return { allowed: result.success };
  } catch (error) {
    console.error("Comment cooldown error (Redis failed):", error);
    logRedisFallback('checkCommentCooldown', error);
    const record = inMemoryLimits.get(identifier);

    if (record && record.resetAt > now) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return {
        allowed: false,
        reason: `Por favor espera ${retryAfter} segundos antes de comentar nuevamente.`,
        retryAfter,
      };
    }

    inMemoryLimits.set(identifier, {
      count: 1,
      resetAt: now + limits.commentCooldownMs,
    });

    return { allowed: true };
  }
}

/**
 * Verifica límite de votos (upvote/downvote)
 */
export async function checkVoteLimit(
  userId: string,
  plan: string = "free"
): Promise<WorldRateLimitResult> {
  const limits = getCommunityLimits(plan);

  if (limits.votesPerDay === -1) {
    return { allowed: true };
  }

  const today = new Date().toISOString().split("T")[0];
  const identifier = `community:votes:${userId}:${today}`;

  if (!isRedisConfigured()) {
    const success = inMemoryRateLimit(identifier, limits.votesPerDay, 24 * 60 * 60 * 1000);
    const record = inMemoryLimits.get(identifier);
    const remaining = record ? limits.votesPerDay - record.count : limits.votesPerDay;

    return {
      allowed: success,
      reason: success
        ? undefined
        : `Límite diario de votos alcanzado (${limits.votesPerDay}/día). ${plan === "free" ? "Actualiza a Plus o Ultra para votos ilimitados." : ""}`,
      remaining: Math.max(0, remaining),
      limit: limits.votesPerDay,
      resetAt: record?.resetAt,
    };
  }

  try {
    const limiter = getRateLimiterLegacy(plan);
    if (!limiter) {
      // Fallback to in-memory
      const success = inMemoryRateLimit(identifier, limits.votesPerDay, 24 * 60 * 60 * 1000);
      const record = inMemoryLimits.get(identifier);
      const remaining = record ? limits.votesPerDay - record.count : limits.votesPerDay;

      return {
        allowed: success,
        reason: success
          ? undefined
          : `Límite diario de votos alcanzado (${limits.votesPerDay}/día). ${plan === "free" ? "Actualiza a Plus o Ultra para votos ilimitados." : ""}`,
        remaining: Math.max(0, remaining),
        limit: limits.votesPerDay,
        resetAt: record?.resetAt,
      };
    }

    const result = await limiter.limit(identifier);

    return {
      allowed: result.success,
      reason: result.success
        ? undefined
        : `Límite diario de votos alcanzado (${limits.votesPerDay}/día). ${plan === "free" ? "Actualiza a Plus o Ultra para votos ilimitados." : ""}`,
      remaining: result.remaining,
      limit: result.limit,
      resetAt: result.reset,
    };
  } catch (error) {
    console.error("Vote limit error (Redis failed):", error);
    logRedisFallback('checkVoteLimit', error);
    const success = inMemoryRateLimit(identifier, limits.votesPerDay, 24 * 60 * 60 * 1000);
    const record = inMemoryLimits.get(identifier);
    const remaining = record ? limits.votesPerDay - record.count : limits.votesPerDay;

    return {
      allowed: success,
      remaining: Math.max(0, remaining),
      limit: limits.votesPerDay,
    };
  }
}

/**
 * Obtiene información de límites de community para un plan
 */
export function getCommunityLimitsInfo(plan: string = "free") {
  return getCommunityLimits(plan);
}
