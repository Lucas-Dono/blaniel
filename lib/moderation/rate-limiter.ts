/**
 * Moderation-specific Rate Limiting
 *
 * Limita acciones de usuarios para prevenir abuso:
 * - Mensajes por minuto/hora
 * - Posts en comunidad
 * - Comentarios
 * - Acciones repetidas
 */

import { redis, isRedisConfigured } from '@/lib/redis/config';

// In-memory fallback when Redis not available
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt?: number;
  retryAfter?: number;
  reason?: string;
}

// ============================================
// RATE LIMIT CONFIGURATION
// ============================================

const RATE_LIMITS = {
  // Mensajes en chat
  messages: {
    perMinute: 10,
    perHour: 100,
    windowMinute: 60, // segundos
    windowHour: 3600, // segundos
  },
  // Posts en comunidad
  posts: {
    perHour: 5,
    perDay: 20,
    windowHour: 3600,
    windowDay: 86400,
  },
  // Comentarios
  comments: {
    perMinute: 20,
    perHour: 100,
    windowMinute: 60,
    windowHour: 3600,
  },
  // Reports/Flags
  reports: {
    perHour: 10,
    perDay: 50,
    windowHour: 3600,
    windowDay: 86400,
  },
  // Acciones generales (likes, follows, etc)
  actions: {
    perMinute: 30,
    perHour: 500,
    windowMinute: 60,
    windowHour: 3600,
  },
} as const;

// ============================================
// IN-MEMORY RATE LIMITER (FALLBACK)
// ============================================

function inMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const record = inMemoryStore.get(key);

  if (!record || record.resetAt < now) {
    // Nueva ventana
    const resetAt = now + windowSeconds * 1000;
    inMemoryStore.set(key, { count: 1, resetAt });

    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      resetAt,
    };
  }

  if (record.count >= limit) {
    // Límite alcanzado
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetAt: record.resetAt,
      retryAfter,
      reason: `Límite de ${limit} alcanzado. Espera ${retryAfter} segundos.`,
    };
  }

  // Incrementar contador
  record.count++;

  return {
    allowed: true,
    remaining: limit - record.count,
    limit,
    resetAt: record.resetAt,
  };
}

// Limpiar memoria cada minuto
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of inMemoryStore.entries()) {
    if (record.resetAt < now) {
      inMemoryStore.delete(key);
    }
  }
}, 60000);

// ============================================
// REDIS RATE LIMITER
// ============================================

async function redisRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (!isRedisConfigured()) {
    return inMemoryRateLimit(key, limit, windowSeconds);
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    // Usar sorted set para tracking de requests
    const pipeline = redis.multi();

    // Limpiar requests viejos
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Agregar request actual
    pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` });

    // Contar requests en ventana
    pipeline.zcard(key);

    // Setear expiración
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();

    // @ts-ignore
    const count = results[2] as number;

    if (count > limit) {
      const resetAt = (now + windowSeconds) * 1000;
      const retryAfter = windowSeconds;

      return {
        allowed: false,
        remaining: 0,
        limit,
        resetAt,
        retryAfter,
        reason: `Límite de ${limit} alcanzado. Espera ${retryAfter} segundos.`,
      };
    }

    const resetAt = (now + windowSeconds) * 1000;

    return {
      allowed: true,
      remaining: limit - count,
      limit,
      resetAt,
    };
  } catch (error) {
    console.error('Redis rate limit error:', error);
    // Fallback a in-memory
    return inMemoryRateLimit(key, limit, windowSeconds);
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Check message rate limit
 */
export async function checkMessageRate(userId: string): Promise<RateLimitResult> {
  // Check per-minute limit (más estricto)
  const minuteKey = `moderation:msg:min:${userId}`;
  const minuteResult = await redisRateLimit(
    minuteKey,
    RATE_LIMITS.messages.perMinute,
    RATE_LIMITS.messages.windowMinute
  );

  if (!minuteResult.allowed) {
    return minuteResult;
  }

  // Check per-hour limit
  const hourKey = `moderation:msg:hour:${userId}`;
  const hourResult = await redisRateLimit(
    hourKey,
    RATE_LIMITS.messages.perHour,
    RATE_LIMITS.messages.windowHour
  );

  return hourResult;
}

/**
 * Check post creation rate limit
 */
export async function checkPostCreation(userId: string): Promise<RateLimitResult> {
  // Check per-hour limit
  const hourKey = `moderation:post:hour:${userId}`;
  const hourResult = await redisRateLimit(
    hourKey,
    RATE_LIMITS.posts.perHour,
    RATE_LIMITS.posts.windowHour
  );

  if (!hourResult.allowed) {
    return hourResult;
  }

  // Check per-day limit
  const dayKey = `moderation:post:day:${userId}`;
  const dayResult = await redisRateLimit(
    dayKey,
    RATE_LIMITS.posts.perDay,
    RATE_LIMITS.posts.windowDay
  );

  return dayResult;
}

/**
 * Check comment creation rate limit
 */
export async function checkCommentCreation(userId: string): Promise<RateLimitResult> {
  // Check per-minute limit
  const minuteKey = `moderation:comment:min:${userId}`;
  const minuteResult = await redisRateLimit(
    minuteKey,
    RATE_LIMITS.comments.perMinute,
    RATE_LIMITS.comments.windowMinute
  );

  if (!minuteResult.allowed) {
    return minuteResult;
  }

  // Check per-hour limit
  const hourKey = `moderation:comment:hour:${userId}`;
  const hourResult = await redisRateLimit(
    hourKey,
    RATE_LIMITS.comments.perHour,
    RATE_LIMITS.comments.windowHour
  );

  return hourResult;
}

/**
 * Check report/flag rate limit
 */
export async function checkReportRate(userId: string): Promise<RateLimitResult> {
  // Check per-hour limit
  const hourKey = `moderation:report:hour:${userId}`;
  const hourResult = await redisRateLimit(
    hourKey,
    RATE_LIMITS.reports.perHour,
    RATE_LIMITS.reports.windowHour
  );

  if (!hourResult.allowed) {
    return hourResult;
  }

  // Check per-day limit
  const dayKey = `moderation:report:day:${userId}`;
  const dayResult = await redisRateLimit(
    dayKey,
    RATE_LIMITS.reports.perDay,
    RATE_LIMITS.reports.windowDay
  );

  return dayResult;
}

/**
 * Check general action rate limit (likes, follows, etc)
 */
export async function checkActionRate(userId: string, action: string): Promise<RateLimitResult> {
  // Check per-minute limit
  const minuteKey = `moderation:action:${action}:min:${userId}`;
  const minuteResult = await redisRateLimit(
    minuteKey,
    RATE_LIMITS.actions.perMinute,
    RATE_LIMITS.actions.windowMinute
  );

  if (!minuteResult.allowed) {
    return minuteResult;
  }

  // Check per-hour limit
  const hourKey = `moderation:action:${action}:hour:${userId}`;
  const hourResult = await redisRateLimit(
    hourKey,
    RATE_LIMITS.actions.perHour,
    RATE_LIMITS.actions.windowHour
  );

  return hourResult;
}

/**
 * Check if user is temporarily banned from an action
 */
export async function checkUserBan(userId: string, action?: string): Promise<{
  banned: boolean;
  reason?: string;
  expiresAt?: number;
}> {
  const key = action
    ? `moderation:ban:${action}:${userId}`
    : `moderation:ban:global:${userId}`;

  if (!isRedisConfigured()) {
    return { banned: false };
  }

  try {
    const banData = await redis.get(key) as { reason: string; expiresAt: number } | null;

    if (!banData) {
      return { banned: false };
    }

    const now = Date.now();
    if (banData.expiresAt && banData.expiresAt < now) {
      // Ban expirado, limpiar
      await redis.del(key);
      return { banned: false };
    }

    return {
      banned: true,
      reason: banData.reason,
      expiresAt: banData.expiresAt,
    };
  } catch (error) {
    console.error('Error checking user ban:', error);
    return { banned: false };
  }
}

/**
 * Temporarily ban a user from an action
 */
export async function banUser(
  userId: string,
  durationSeconds: number,
  reason: string,
  action?: string
): Promise<void> {
  const key = action
    ? `moderation:ban:${action}:${userId}`
    : `moderation:ban:global:${userId}`;

  const expiresAt = Date.now() + durationSeconds * 1000;

  if (!isRedisConfigured()) {
    console.warn('Redis not configured, ban not persisted');
    return;
  }

  try {
    await redis.set(
      key,
      { reason, expiresAt },
      { ex: durationSeconds }
    );
  } catch (error) {
    console.error('Error banning user:', error);
  }
}

/**
 * Remove user ban
 */
export async function unbanUser(userId: string, action?: string): Promise<void> {
  const key = action
    ? `moderation:ban:${action}:${userId}`
    : `moderation:ban:global:${userId}`;

  if (!isRedisConfigured()) {
    return;
  }

  try {
    await redis.del(key);
  } catch (error) {
    console.error('Error unbanning user:', error);
  }
}

/**
 * Get rate limit info for a user
 */
export async function getRateLimitInfo(userId: string) {
  return {
    messages: await checkMessageRate(userId),
    posts: await checkPostCreation(userId),
    comments: await checkCommentCreation(userId),
    reports: await checkReportRate(userId),
  };
}

/**
 * Reset rate limits for a user (admin only)
 */
export async function resetRateLimits(userId: string): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    const keys = await redis.keys(`moderation:*:${userId}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Error resetting rate limits:', error);
  }
}
