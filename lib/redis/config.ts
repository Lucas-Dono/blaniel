import { Redis as UpstashRedis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis as IORedis } from "ioredis";
import { getTierLimits, type UserTier } from "@/lib/usage/tier-limits";

// Check if Upstash Redis is configured
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const isUpstashConfigured = !!(UPSTASH_URL && UPSTASH_TOKEN && UPSTASH_URL !== "" && UPSTASH_TOKEN !== "");

// Check if local Redis should be used
const USE_LOCAL_REDIS = process.env.USE_LOCAL_REDIS !== "false"; // Default to true
const LOCAL_REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create Redis client adapter for ioredis to work with @upstash/ratelimit
class IORedisAdapter {
  private client: IORedis;

  constructor(url: string) {
    this.client = new IORedis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 50, 2000);
      },
      lazyConnect: true,
    });

    // Test connection
    this.client.connect().catch((err) => {
      console.error("❌ Failed to connect to local Redis:", err.message);
    });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(
    key: string,
    value: string,
    options?: { ex?: number; px?: number; exat?: number; pxat?: number }
  ): Promise<"OK" | null> {
    const args: any[] = [key, value];
    if (options?.ex) {
      args.push("EX", options.ex);
    }
    if (options?.px) {
      args.push("PX", options.px);
    }
    if (options?.exat) {
      args.push("EXAT", options.exat);
    }
    if (options?.pxat) {
      args.push("PXAT", options.pxat);
    }
    return this.client.set(...(args as [string, string, ...any[]]));
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async eval<T = unknown>(
    script: string,
    keys: string[],
    args: (string | number)[]
  ): Promise<T> {
    return this.client.eval(script, keys.length, ...keys, ...args) as Promise<T>;
  }

  async evalsha<T = unknown>(
    sha: string,
    keys: string[],
    args: (string | number)[]
  ): Promise<T> {
    return this.client.evalsha(sha, keys.length, ...keys, ...args) as Promise<T>;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  async zincrby(key: string, increment: number, member: string): Promise<string> {
    return this.client.zincrby(key, increment, member);
  }

  async zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]> {
    if (withScores) {
      return this.client.zrange(key, start, stop, 'WITHSCORES');
    }
    return this.client.zrange(key, start, stop);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.client.zadd(key, score, member);
  }

  async zrem(key: string, member: string): Promise<number> {
    return this.client.zrem(key, member);
  }

  async zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  async zremrangebyscore(key: string, min: string | number, max: string | number): Promise<number> {
    return this.client.zremrangebyscore(key, min, max);
  }

  multi() {
    const pipeline = this.client.multi();
    return {
      eval: (script: string, keys: string[], args: (string | number)[]) => {
        pipeline.eval(script, keys.length, ...keys, ...args);
        return this;
      },
      zremrangebyscore: (key: string, min: string | number, max: string | number) => {
        pipeline.zremrangebyscore(key, min, max);
        return this;
      },
      zadd: (key: string, score: number, member: string) => {
        pipeline.zadd(key, score, member);
        return this;
      },
      expire: (key: string, seconds: number) => {
        pipeline.expire(key, seconds);
        return this;
      },
      zcard: (key: string) => {
        pipeline.zcard(key);
        return this;
      },
      exec: async () => {
        return pipeline.exec();
      },
    };
  }
}

// Inicializar Redis client
let redisClient: any = null;
let redisType: "upstash" | "local" | "none" = "none";

if (isUpstashConfigured) {
  console.log("🔵 [Redis] Using Upstash Redis (cloud)");
  redisClient = new UpstashRedis({
    url: UPSTASH_URL!,
    token: UPSTASH_TOKEN!,
  });
  redisType = "upstash";
} else if (USE_LOCAL_REDIS) {
  // Try local Redis
  try {
    console.log("🟢 [Redis] Attempting to connect to local Redis:", LOCAL_REDIS_URL);
    redisClient = new IORedisAdapter(LOCAL_REDIS_URL);
    redisType = "local";
  } catch (error) {
    console.warn("⚠️ [Redis] Could not connect to local Redis, using in-memory fallback:", error);
    redisClient = null;
    redisType = "none";
  }
} else {
  console.log("🟡 [Redis] No Redis configured, using in-memory fallback");
}

export const redis = redisClient;
export const isRedisAvailable = redisType !== "none";

// Rate limiters por plan (usando tier-limits)
const tierLimits = {
  free: getTierLimits("free"),
  plus: getTierLimits("plus"),
  ultra: getTierLimits("ultra"),
};

// Only create rate limiters if Redis is available
export const rateLimiters = redisClient
  ? {
      // Free plan: 10 requests/min, 100/hour, 1000/day
      free: {
        perMinute: new Ratelimit({
          redis: redisClient,
          limiter: Ratelimit.slidingWindow(tierLimits.free.apiRequests.perMinute, "1 m"),
          analytics: true,
          prefix: "@ratelimit/free/minute",
        }),
        perHour: new Ratelimit({
          redis: redisClient,
          limiter: Ratelimit.slidingWindow(tierLimits.free.apiRequests.perHour, "1 h"),
          analytics: true,
          prefix: "@ratelimit/free/hour",
        }),
        perDay: new Ratelimit({
          redis: redisClient,
          limiter: Ratelimit.slidingWindow(tierLimits.free.apiRequests.perDay, "1 d"),
          analytics: true,
          prefix: "@ratelimit/free/day",
        }),
      },

      // Plus plan: 30 requests/min, 500/hour, 5000/day
      plus: {
        perMinute: new Ratelimit({
          redis: redisClient,
          limiter: Ratelimit.slidingWindow(tierLimits.plus.apiRequests.perMinute, "1 m"),
          analytics: true,
          prefix: "@ratelimit/plus/minute",
        }),
        perHour: new Ratelimit({
          redis: redisClient,
          limiter: Ratelimit.slidingWindow(tierLimits.plus.apiRequests.perHour, "1 h"),
          analytics: true,
          prefix: "@ratelimit/plus/hour",
        }),
        perDay: new Ratelimit({
          redis: redisClient,
          limiter: Ratelimit.slidingWindow(tierLimits.plus.apiRequests.perDay, "1 d"),
          analytics: true,
          prefix: "@ratelimit/plus/day",
        }),
      },

      // Ultra plan: 100 requests/min, unlimited hour/day
      ultra: {
        perMinute: new Ratelimit({
          redis: redisClient,
          limiter: Ratelimit.slidingWindow(tierLimits.ultra.apiRequests.perMinute, "1 m"),
          analytics: true,
          prefix: "@ratelimit/ultra/minute",
        }),
        // No hourly/daily limits for ultra (unlimited)
      },

      // API rate limit: Por API key (ultra tier limits)
      api: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(100, "1 m"),
        analytics: true,
        prefix: "@ratelimit/api",
      }),
    }
  : null;

// Cache TTLs
export const CACHE_TTL = {
  user: 60 * 5, // 5 minutos
  agent: 60 * 10, // 10 minutos
  subscription: 60 * 15, // 15 minutos
  usage: 60, // 1 minuto
};

// Keys para cache
export function getCacheKey(type: string, id: string): string {
  return `cache:${type}:${id}`;
}

// Verificar si Redis está configurado
export function isRedisConfigured(): boolean {
  return isRedisAvailable;
}

// Get rate limiter by plan and window
export function getRateLimiter(
  plan: string,
  window: "perMinute" | "perHour" | "perDay" = "perMinute"
): Ratelimit | null {
  if (!rateLimiters) return null;

  const tier = plan.toLowerCase() as UserTier;

  switch (tier) {
    case "free":
      return rateLimiters.free[window];
    case "plus":
      return rateLimiters.plus[window];
    case "ultra":
      // Ultra only has per-minute limit
      return window === "perMinute" ? rateLimiters.ultra.perMinute : null;
    default:
      return rateLimiters.free[window];
  }
}

// Legacy function for backward compatibility
export function getRateLimiterLegacy(plan: string): Ratelimit | null {
  return getRateLimiter(plan, "perMinute");
}
