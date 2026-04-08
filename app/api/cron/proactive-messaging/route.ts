/**
 * Cron Job: Proactive Messaging
 *
 * Este endpoint procesa y envía mensajes proactivos de la IA a usuarios
 * basándose en triggers inteligentes (inactividad, follow-ups, check-ins emocionales, etc.)
 *
 * Configuración en Cloud Server:
 * - Agregar a crontab (cada hora):
 *   0 * * * * curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/proactive-messaging
 *
 * Para ejecutar manualmente:
 * curl -X POST http://localhost:3000/api/cron/proactive-messaging \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */

import { NextRequest, NextResponse } from "next/server";
import { processAllAgents } from "@/lib/proactive/proactive-service";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos max para cloud server

// SECURITY: Verify that the request comes from an authorized cron
function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Si no hay secret configurado, solo permitir en desarrollo
  if (!cronSecret) {
    console.warn("[PROACTIVE-CRON] No CRON_SECRET configured, only allowing development mode");
    return process.env.NODE_ENV === "development";
  }

  // Check que el header coincide con el secret
  const isValid = authHeader === `Bearer ${cronSecret}`;

  if (!isValid) {
    console.warn("[PROACTIVE-CRON] Invalid authorization header");
  }

  return isValid;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("[PROACTIVE-CRON] ========================================");
    console.log("[PROACTIVE-CRON] Proactive messaging job started");
    console.log("[PROACTIVE-CRON] Timestamp:", new Date().toISOString());

    // Check authentication
    if (!verifyCronAuth(req)) {
      console.warn("[PROACTIVE-CRON] Unauthorized cron request");
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Invalid or missing CRON_SECRET"
        },
        { status: 401 }
      );
    }

    console.log("[PROACTIVE-CRON] Authorization verified ✓");

    // Check que el sistema proactivo está habilitado
    const proactiveEnabled = process.env.PROACTIVE_MESSAGING_ENABLED !== "false";

    if (!proactiveEnabled) {
      console.log("[PROACTIVE-CRON] Proactive messaging is disabled via environment variable");
      return NextResponse.json({
        success: true,
        message: "Proactive messaging is disabled",
        processed: 0,
      });
    }

    // Get estadísticas pre-ejecución
    const preStats = await prisma.proactiveMessage.count({
      where: {
        status: "pending",
      },
    });

    console.log(`[PROACTIVE-CRON] Pending messages before processing: ${preStats}`);

    // Process todos los agentes
    console.log("[PROACTIVE-CRON] Processing all agents...");
    const results = await processAllAgents();

    // Calcular estadísticas
    const messagesCreated = results.results.reduce((sum, r) => sum + (r.success ? 1 : 0), 0);
    const errors = results.results.filter(r => !r.success).length;
    const executionTime = Date.now() - startTime;

    console.log("[PROACTIVE-CRON] ========================================");
    console.log(`[PROACTIVE-CRON] Processing complete:`);
    console.log(`[PROACTIVE-CRON]   - Messages created: ${messagesCreated}`);
    console.log(`[PROACTIVE-CRON]   - Errors: ${errors}`);
    console.log(`[PROACTIVE-CRON]   - Total agents checked: ${results.totalProcessed}`);
    console.log(`[PROACTIVE-CRON]   - Execution time: ${executionTime}ms`);
    console.log("[PROACTIVE-CRON] ========================================");

    // Save métricas en la base de datos
    try {
      await prisma.analyticsEvent.create({
        data: {
          id: nanoid(),
          eventType: "proactive_messaging_job",
          metadata: {
            messagesCreated,
            errors,
            totalAgentsChecked: results.totalProcessed,
            executionTimeMs: executionTime,
            timestamp: new Date().toISOString(),
            results: results.results.slice(0, 100), // Limitar a 100 para no exceder el límite de JSON
          },
          timestamp: new Date(),
        },
      });
    } catch (dbError) {
      console.warn("[PROACTIVE-CRON] Failed to log job execution to database:", dbError);
    }

    // Send alertas si hay muchos errores
    if (errors > 10) {
      console.error(`[PROACTIVE-CRON] ⚠️  HIGH ERROR RATE: ${errors} errors detected`);
      // TODO: Enviar alerta a administradores
    }

    // Si se crearon mensajes, mostrar algunos ejemplos
    if (messagesCreated > 0) {
      const recentMessages = await prisma.proactiveMessage.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          agentId: true,
          userId: true,
          triggerType: true,
          status: true,
          sentAt: true,
        },
      });

      console.log("[PROACTIVE-CRON] Sample of recent messages created:");
      recentMessages.forEach((msg, idx) => {
        console.log(`[PROACTIVE-CRON]   ${idx + 1}. Agent: ${msg.agentId}, User: ${msg.userId}, Trigger: ${msg.triggerType}, Status: ${msg.status}`);
      });
    }

    return NextResponse.json({
      success: true,
      message: "Proactive messaging job completed successfully",
      stats: {
        messagesCreated,
        errors,
        totalAgentsChecked: results.totalProcessed,
        executionTimeMs: executionTime,
        pendingBefore: preStats,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error("[PROACTIVE-CRON] ❌ Critical error in proactive messaging job:", error);
    console.error("[PROACTIVE-CRON] Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      executionTime,
    });

    // Intentar registrar el error en la base de datos
    try {
      await prisma.analyticsEvent.create({
        data: {
          id: nanoid(),
          eventType: "proactive_messaging_job_error",
          metadata: {
            error: error instanceof Error ? error.message : "Unknown error",
            executionTimeMs: executionTime,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date(),
        },
      });
    } catch (dbError) {
      console.error("[PROACTIVE-CRON] Failed to log error to database:", dbError);
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
        executionTimeMs: executionTime,
      },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing in the browser (development only)
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      {
        error: "GET method only available in development",
        message: "Use POST method with proper authorization header in production"
      },
      { status: 403 }
    );
  }

  console.log("[PROACTIVE-CRON] Development mode: allowing GET request");
  return POST(req);
}
