/**
 * HEALTH CHECK ENDPOINT
 * 
 * Critical endpoint for deployment and monitoring.
 * Load balancers and orchestrators use it to verify if the instance is alive.
 * 
 * Verifies:
 * - Database connectivity (Prisma)
 * - Redis availability (Upstash)
 * - AI Services (Gemini - basic ping only)
 * - Storage (R2 - config check only)
 * 
 * Returns:
 * - 200 OK if everything is working
 * - 503 Service Unavailable if any critical service fails
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    ai: CheckResult;
    storage: CheckResult;
  };
  uptime?: number;
}

interface CheckResult {
  status: "ok" | "warning" | "error";
  message?: string;
  latency?: number; // ms
}

/**
 * GET /api/health
 * Public endpoint - no authentication required
 */
export async function GET() {
  const _startTime = Date.now();

  const checks: HealthCheck["checks"] = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    ai: await checkAIServices(),
    storage: await checkStorage(),
  };

  // Determinar estado general
  const hasError = Object.values(checks).some((check) => check.status === "error");
  const hasWarning = Object.values(checks).some((check) => check.status === "warning");

  let overallStatus: HealthCheck["status"];
  if (hasError) {
    overallStatus = "unhealthy";
  } else if (hasWarning) {
    overallStatus = "degraded";
  } else {
    overallStatus = "healthy";
  }

  const healthCheck: HealthCheck = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
    uptime: process.uptime(),
  };

  // Logging para monitoring
  if (overallStatus !== "healthy") {
    console.error("[HEALTH CHECK] System is " + overallStatus, {
      checks,
    });
  }

  // Retornar 503 si unhealthy (load balancers lo detectan)
  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  return NextResponse.json(healthCheck, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

/**
 * Check Database (Prisma + PostgreSQL)
 */
async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();

  try {
    // Simple query para verificar conectividad
    await prisma.$queryRaw`SELECT 1`;

    const latency = Date.now() - start;

    // Warning si latency > 1 segundo
    if (latency > 1000) {
      return {
        status: "warning",
        message: `Database slow (${latency}ms)`,
        latency,
      };
    }

    return {
      status: "ok",
      latency,
    };
  } catch (error) {
    console.error("[HEALTH] Database check failed:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Database connection failed",
      latency: Date.now() - start,
    };
  }
}

/**
 * Check Redis (Upstash / Local)
 */
async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();

  try {
    // Redis puede no estar configurado (in-memory fallback)
    if (!redis) {
      return {
        status: "warning",
        message: "Redis not configured (using in-memory fallback)",
      };
    }

    // Ping Redis
    const pong = await redis.ping();

    const latency = Date.now() - start;

    if (pong !== "PONG") {
      return {
        status: "error",
        message: "Redis ping failed",
        latency,
      };
    }

    // Warning si latency > 500ms
    if (latency > 500) {
      return {
        status: "warning",
        message: `Redis slow (${latency}ms)`,
        latency,
      };
    }

    return {
      status: "ok",
      latency,
    };
  } catch (error) {
    console.error("[HEALTH] Redis check failed:", error);

    // Redis failure is NOT critical (fallback available)
    return {
      status: "warning",
      message: "Redis unavailable (fallback active)",
    };
  }
}

/**
 * Check AI Services (Gemini)
 * Only verifies that API keys are configured.
 * We do not make real (expensive) calls.
 */
async function checkAIServices(): Promise<CheckResult> {
  try {
    // Check que Gemini API key existe
    const geminiKey = process.env.GOOGLE_AI_API_KEY;

    if (!geminiKey) {
      return {
        status: "error",
        message: "Gemini API key not configured",
      };
    }

    // Venice es opcional (NSFW)
    const veniceKey = process.env.VENICE_API_KEY;

    if (!veniceKey) {
      return {
        status: "warning",
        message: "Venice API key not configured (NSFW disabled)",
      };
    }

    return {
      status: "ok",
    };
  } catch (error) {
    console.error("[HEALTH] AI services check failed:", error);
    return {
      status: "error",
      message: "AI services configuration error",
    };
  }
}

/**
 * Check Storage (Cloudflare R2)
 * Only verifies that credentials are configured.
 * We do not make real (expensive) calls.
 */
async function checkStorage(): Promise<CheckResult> {
  try {
    const s3Endpoint = process.env.S3_ENDPOINT;
    const s3AccessKey = process.env.S3_ACCESS_KEY_ID;
    const s3SecretKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!s3Endpoint || !s3AccessKey || !s3SecretKey) {
      return {
        status: "warning",
        message: "R2 storage not fully configured (features may be limited)",
      };
    }

    return {
      status: "ok",
    };
  } catch (error) {
    console.error("[HEALTH] Storage check failed:", error);
    return {
      status: "warning",
      message: "Storage configuration error",
    };
  }
}
