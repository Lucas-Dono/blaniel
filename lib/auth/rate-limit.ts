import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Only create rate limiter if environment variables are configured
let redis: Redis | null = null;
let loginRatelimit: Ratelimit | null = null;
let registerRatelimit: Ratelimit | null = null;
let aiGenerationRatelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  // Rate limit for login: 5 attempts per 15 minutes per IP
  loginRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15m"),
    analytics: true,
    prefix: "ratelimit:login",
  });

  // Rate limit for registration: 3 registrations per hour per IP
  registerRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    analytics: true,
    prefix: "ratelimit:register",
  });

  // Rate limit for AI generation: 20 requests per minute per user
  aiGenerationRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    analytics: true,
    prefix: "ratelimit:ai-generation",
  });
}

export async function checkLoginRateLimit(identifier: string): Promise<{
  success: boolean;
  remaining: number;
  reset: number;
}> {
  // If no rate limiter configured, always allow
  if (!loginRatelimit) {
    return { success: true, remaining: 999, reset: 0 };
  }

  const result = await loginRatelimit.limit(identifier);

  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

export async function checkRegisterRateLimit(identifier: string): Promise<{
  success: boolean;
  remaining: number;
  reset: number;
}> {
  // If no rate limiter configured, always allow
  if (!registerRatelimit) {
    return { success: true, remaining: 999, reset: 0 };
  }

  const result = await registerRatelimit.limit(identifier);

  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Check AI generation rate limit (20 requests per minute per user)
 * Used for Smart Start and character creation AI endpoints
 */
export async function checkAIGenerationRateLimit(userId: string): Promise<{
  success: boolean;
  remaining: number;
  reset: number;
}> {
  // If no rate limiter configured, always allow
  if (!aiGenerationRatelimit) {
    return { success: true, remaining: 999, reset: 0 };
  }

  const result = await aiGenerationRatelimit.limit(userId);

  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

// Utilidad para obtener IP del request
export function getClientIp(request: Request): string {
  // Intentar obtener IP de headers comunes
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  if (cfConnectingIp) return cfConnectingIp;
  if (realIp) return realIp;
  if (forwarded) return forwarded.split(",")[0].trim();

  return "unknown";
}
