import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { NextRequest } from "next/server";

const handlers = toNextJsHandler(auth);

/**
 * Aplicar rate limiting basado en el endpoint de auth
 */
async function applyRateLimiting(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.pathname;
  const ip = getClientIp(request);

  // Mapeo de paths a tipos de rate limit
  const rateLimitMap: Record<string, 'login' | 'register' | 'forgotPassword' | 'verifyEmail'> = {
    '/sign-in/email': 'login',
    '/sign-up/email': 'register',
    '/forgot-password': 'forgotPassword',
    '/verify-email': 'verifyEmail',
    '/resend-verification': 'verifyEmail',
  };

  // Search si el path actual necesita rate limiting
  for (const [pathPattern, limitType] of Object.entries(rateLimitMap)) {
    if (path.includes(pathPattern)) {
      const result = await rateLimit(limitType, ip);

      if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
        return new Response(
          JSON.stringify({
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            retryAfter: result.reset,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(result.limit),
              'X-RateLimit-Remaining': String(result.remaining),
              'X-RateLimit-Reset': String(result.reset),
            },
          }
        );
      }

      // Rate limit passed, continue but add headers to response later
      return { result };
    }
  }

  return null;
}

/**
 * GET handler con rate limiting
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimiting(request);
  if (rateLimitResult instanceof Response) {
    return rateLimitResult;
  }

  const response = await handlers.GET(request);

  // Agregar headers de rate limit si aplica
  if (rateLimitResult?.result) {
    response.headers.set('X-RateLimit-Limit', String(rateLimitResult.result.limit));
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.result.remaining));
    response.headers.set('X-RateLimit-Reset', String(rateLimitResult.result.reset));
  }

  return response;
}

/**
 * POST handler con rate limiting
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimiting(request);
  if (rateLimitResult instanceof Response) {
    return rateLimitResult;
  }

  const response = await handlers.POST(request);

  // Agregar headers de rate limit si aplica
  if (rateLimitResult?.result) {
    response.headers.set('X-RateLimit-Limit', String(rateLimitResult.result.limit));
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.result.remaining));
    response.headers.set('X-RateLimit-Reset', String(rateLimitResult.result.reset));
  }

  return response;
}

// Force Node.js runtime because auth uses Prisma
export const runtime = 'nodejs';
