import { NextRequest, NextResponse } from "next/server";
import { resolveOverdueEvents } from "@/lib/events/event-resolver";

/**
 * POST /api/v1/cron/resolve-events
 *
 * Cron job endpoint to auto-resolve scheduled events
 *
 * Should be called every hour by a cron service (e.g., Vercel Cron)
 *
 * Authorization: Requires CRON_SECRET environment variable
 */
export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn("CRON_SECRET not configured, skipping authorization check");
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    console.log("[CRON] Starting event resolution...");

    const { resolved, errors } = await resolveOverdueEvents();

    console.log(`[CRON] Event resolution complete: ${resolved} resolved, ${errors} errors`);

    return NextResponse.json({
      success: true,
      resolved,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Event resolution failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Allow GET for health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "resolve-events cron job",
    configured: !!process.env.CRON_SECRET,
  });
}
