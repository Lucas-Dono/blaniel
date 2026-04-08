import { NextRequest, NextResponse } from "next/server";
import log from "@/lib/logging/logger";
import { updateRetentionLeaderboard } from "@/lib/gamification/retention-leaderboard";

/**
 * GET /api/cron/update-retention-leaderboard
 * Cron job que actualiza el leaderboard de retention
 *
 * Query params:
 * - secret: Secret key para autenticar la llamada (debe coincidir con CRON_SECRET env var)
 *
 * Este endpoint debe ser llamado por un cron job externo (ej: cron-job.org, GitHub Actions, etc.)
 * Recomendado: ejecutar 1 vez al día
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication del cron
    const searchParams = request.nextUrl.searchParams;
    const secret = searchParams.get("secret");

    if (secret !== process.env.CRON_SECRET) {
      log.warn("Unauthorized cron job attempt");
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    log.info("Starting retention leaderboard update");

    const result = await updateRetentionLeaderboard();

    log.info(
      {
        updated: result.updated,
        periodStart: result.period.start,
        periodEnd: result.period.end,
      },
      "Retention leaderboard update completed"
    );

    return NextResponse.json({
      success: true,
      updated: result.updated,
      period: {
        start: result.period.start.toISOString(),
        end: result.period.end.toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ error }, "Error in update retention leaderboard cron job");
    return NextResponse.json(
      { error: "Error al actualizar leaderboard" },
      { status: 500 }
    );
  }
}
