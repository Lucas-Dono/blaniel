/**
 * Rate Limiting system to protect sensitive endpoints
 *
 * Features:
 * - Uses Upstash Redis if configured (recommended for production)
 * - Fallback to memory if Redis not available (development)
 * - Sliding window algorithm
 * - Per-endpoint configuration
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiter with Upstash Redis (production)
 * If UPSTASH_REDIS_REST_URL is not configured, returns null
 */
function createUpstashRateLimiter(requests: number, window: string) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, window as any),
      analytics: true,
      prefix: "ratelimit",
    });
  } catch (error) {
    console.warn("[RATE_LIMIT] Failed to initialize Upstash Redis:", error);
    return null;
  }
}

/**
 * Rate limiter in memory (fallback for development)
 * Does not persist between server restarts
 */
class InMemoryRateLimiter {
  private store: Map<string, { count: number; resetAt: number }> = new Map();
  private requests: number;
  private windowMs: number;

  constructor(requests: number, windowMs: number) {
    this.requests = requests;
    this.windowMs = windowMs;

    // Clean old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetAt < now) {
        this.store.delete(key);
      }
    }
  }

  async limit(identifier: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || entry.resetAt < now) {
      // New window
      this.store.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs,
      });

      return {
        success: true,
        limit: this.requests,
        remaining: this.requests - 1,
        reset: now + this.windowMs,
      };
    }

    // Within existing window
    if (entry.count >= this.requests) {
      return {
        success: false,
        limit: this.requests,
        remaining: 0,
        reset: entry.resetAt,
      };
    }

    entry.count++;
    return {
      success: true,
      limit: this.requests,
      remaining: this.requests - entry.count,
      reset: entry.resetAt,
    };
  }
}

/**
 * Configuraciones de rate limit por endpoint
 */
const RATE_LIMIT_CONFIGS = {
  // Login: 5 intentos por minuto por IP
  login: { requests: 5, window: "1m", windowMs: 60 * 1000 },

  // Registro: 3 cuentas por hora por IP
  register: { requests: 3, window: "1 h", windowMs: 60 * 60 * 1000 },

  // Password reset: 3 intentos por hora por IP
  forgotPassword: { requests: 3, window: "1 h", windowMs: 60 * 60 * 1000 },

  // Email verification: 5 attempts per hour
  verifyEmail: { requests: 5, window: "1 h", windowMs: 60 * 60 * 1000 },

  // API general: 60 requests por minuto
  api: { requests: 60, window: "1 m", windowMs: 60 * 1000 },
} as const;

type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS;

/**
 * Cache de rate limiters (Upstash o in-memory)
 */
const rateLimiters = new Map<RateLimitType, Ratelimit | InMemoryRateLimiter>();

/**
 * Obtener o crear rate limiter para un tipo específico
 */
function getRateLimiter(type: RateLimitType) {
  if (rateLimiters.has(type)) {
    return rateLimiters.get(type)!;
  }

  const config = RATE_LIMIT_CONFIGS[type];

  // Intentar crear con Upstash primero
  const upstashLimiter = createUpstashRateLimiter(config.requests, config.window);

  if (upstashLimiter) {
    console.log(`[RATE_LIMIT] Using Upstash Redis for ${type}`);
    rateLimiters.set(type, upstashLimiter);
    return upstashLimiter;
  }

  // Fallback a in-memory
  console.log(`[RATE_LIMIT] Using in-memory fallback for ${type} (configure Upstash for production)`);
  const memoryLimiter = new InMemoryRateLimiter(config.requests, config.windowMs);
  rateLimiters.set(type, memoryLimiter);
  return memoryLimiter;
}

/**
 * Aplicar rate limiting a una request
 *
 * @param type - Tipo de rate limit a aplicar
 * @param identifier - Identificador único (generalmente IP)
 * @returns { success: boolean, ... } - success es true si se permite la request
 *
 * @example
 * const result = await rateLimit('login', request.ip);
 * if (!result.success) {
 *   return new Response('Too many requests', { status: 429 });
 * }
 */
export async function rateLimit(type: RateLimitType, identifier: string) {
  const limiter = getRateLimiter(type);
  return await limiter.limit(identifier);
}

/**
 * Obtener IP del request (maneja proxies y cloudflare)
 */
export function getClientIp(request: Request): string {
  // Cloudflare
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;

  // Standard proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  // Fallback para desarrollo local
  return 'dev-ip';
}

/**
 * Middleware helper para aplicar rate limiting a un handler
 */
export function withRateLimit(
  type: RateLimitType,
  handler: (request: Request, ...args: any[]) => Promise<Response>
) {
  return async (request: Request, ...args: any[]) => {
    const ip = getClientIp(request);
    const result = await rateLimit(type, ip);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((result.reset - Date.now()) / 1000)} seconds.`,
          retryAfter: result.reset,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((result.reset - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': String(result.reset),
          },
        }
      );
    }

    // Agregar headers de rate limit a la respuesta
    const response = await handler(request, ...args);

    // Clone la response para poder modificar headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-RateLimit-Limit', String(result.limit));
    newResponse.headers.set('X-RateLimit-Remaining', String(result.remaining));
    newResponse.headers.set('X-RateLimit-Reset', String(result.reset));

    return newResponse;
  };
}
