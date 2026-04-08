/**
 * RATE LIMITER SPECIFIC FOR SYMBOLIC BONDS
 *
 * Strict limits to prevent abuse:
 * - Establish bond: 1 attempt/day per user
 * - Update metrics: 100/hour per bond
 * - View leaderboards: 60/hour per user
 * - Claim slot: 3/day per user
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Configure Redis for Upstash (or use local)
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? Redis.fromEnv()
  : new Redis({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      token: process.env.REDIS_TOKEN || "",
    });

// Define specific rate limiters
export const bondRateLimiters = {
  // Establish new bond: very strict
  establishBond: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, "1 d"), // 1 per day
    analytics: true,
    prefix: "@upstash/ratelimit:bonds:establish",
  }),

  // Attempt to claim slot from queue
  claimSlot: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 d"), // 3 per day
    analytics: true,
    prefix: "@upstash/ratelimit:bonds:claim",
  }),

  // View own bonds: generous
  viewOwnBonds: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(300, "1 h"), // 300 per hour
    analytics: true,
    prefix: "@upstash/ratelimit:bonds:view",
  }),

  // View leaderboards
  viewLeaderboard: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 h"), // 60 per hour
    analytics: true,
    prefix: "@upstash/ratelimit:bonds:leaderboard",
  }),

  // Update bond metrics
  updateMetrics: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 h"), // 100 per hour
    analytics: true,
    prefix: "@upstash/ratelimit:bonds:update",
  }),

  // Release bond voluntarily
  releaseBond: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 d"), // 5 per day (prevent spam)
    analytics: true,
    prefix: "@upstash/ratelimit:bonds:release",
  }),

  // Configure agent bond (admin)
  configureBond: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 h"), // 20 per hour
    analytics: true,
    prefix: "@upstash/ratelimit:bonds:config",
  }),
};

// Rate limiter by IP (to prevent bots without account)
export const ipRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 h"),
  analytics: true,
  prefix: "@upstash/ratelimit:bonds:ip",
});

/**
 * Helper to apply rate limit
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Middleware helper para Next.js API routes
 */
export async function withRateLimit(
  limiter: Ratelimit,
  identifier: string,
  onSuccess: () => Promise<Response>,
  onRateLimited?: () => Promise<Response>
): Promise<Response> {
  const result = await limiter.limit(identifier);

  if (!result.success) {
    if (onRateLimited) {
      return onRateLimited();
    }

    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        limit: result.limit,
        remaining: result.remaining,
        reset: new Date(result.reset).toISOString(),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": result.limit.toString(),
          "X-RateLimit-Remaining": result.remaining.toString(),
          "X-RateLimit-Reset": result.reset.toString(),
        },
      }
    );
  }

  return onSuccess();
}

/**
 * Rate limit por acción específica con contador custom
 */
export async function checkCustomRateLimit(
  userId: string,
  action: string,
  limit: number,
  window: string // "1 h", "1 d", etc
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const key = `ratelimit:custom:${action}:${userId}`;
  const windowSeconds = parseTimeWindow(window);

  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }

  return {
    allowed: current <= limit,
    current,
    limit,
  };
}

function parseTimeWindow(window: string): number {
  const match = window.match(/^(\d+)\s*([smhd])$/);
  if (!match) throw new Error(`Invalid window format: ${window}`);

  const [, amount, unit] = match;
  const seconds = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  }[unit] ?? 1;

  return parseInt(amount) * seconds;
}

export default bondRateLimiters;
