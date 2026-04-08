/**
 * Cron Job: Check Analytics Alerts
 *
 * Este endpoint debe ser llamado periódicamente (cada hora recomendado) por un
 * servicio de cron como Vercel Cron, GitHub Actions, o cron-job.org
 *
 * Para configurar en Vercel:
 * - Agregar a vercel.json:
 *   {
 *     "crons": [{
 *       "path": "/api/cron/check-alerts",
 *       "schedule": "0 * * * *"  // Cada hora
 *     }]
 *   }
 *
 * Para ejecutar manualmente:
 * curl -X POST http://localhost:3000/api/cron/check-alerts \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAlerts } from "@/lib/analytics/kpi-tracker";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SECURITY: Verify that the request comes from an authorized cron
function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Si no hay secret configurado, solo permitir en desarrollo
  if (!cronSecret) {
    return process.env.NODE_ENV === "development";
  }

  // Check que el header coincide con el secret
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(req: NextRequest) {
  try {
    console.log("[CRON] Check alerts job started");

    // Check authentication
    if (!verifyCronAuth(req)) {
      console.warn("[CRON] Unauthorized cron request");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get alertas
    const alerts = await checkAlerts();

    if (alerts.length === 0) {
      console.log("[CRON] No alerts found");
      return NextResponse.json({
        success: true,
        message: "No alerts to process",
        alertsCount: 0,
      });
    }

    console.log(`[CRON] Found ${alerts.length} alert(s)`);

    // TODO: Enviar notificaciones
    // Por ahora, solo logueamos las alertas
    // En el futuro, se pueden enviar por:
    // - Email a los administradores
    // - Slack/Discord webhook
    // - Sistema de notificaciones interno
    for (const alert of alerts) {
      console.log(`[CRON] ALERT [${alert.level}] ${alert.category}: ${alert.message}`);

      // Ejemplo: Enviar email a admins
      // await sendAlertEmail({
      //   to: process.env.ADMIN_EMAIL,
      //   subject: `[${alert.level}] ${alert.category} Alert`,
      //   body: alert.message,
      // });
    }

    // Opcional: Guardar en base de datos para historial
    try {
      await prisma.analyticsEvent.create({
        data: {
          id: nanoid(),
          eventType: "alerts_checked",
          metadata: {
            alertsCount: alerts.length,
            criticalCount: alerts.filter(a => a.level === "critical").length,
            warningCount: alerts.filter(a => a.level === "warning").length,
            alerts: alerts.map(a => ({
              level: a.level,
              category: a.category,
              metric: a.metric,
            })),
          },
          timestamp: new Date(),
        },
      });
    } catch (dbError) {
      console.warn("[CRON] Failed to log alerts check to database:", dbError);
    }

    return NextResponse.json({
      success: true,
      message: "Alerts checked and processed",
      alertsCount: alerts.length,
      alerts: alerts.map(a => ({
        level: a.level,
        category: a.category,
        metric: a.metric,
        message: a.message,
      })),
    });
  } catch (error) {
    console.error("[CRON] Error checking alerts:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing in the browser (development only)
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "GET method only available in development" },
      { status: 403 }
    );
  }

  return POST(req);
}
