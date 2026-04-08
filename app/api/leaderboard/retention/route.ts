import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logging/logger";
import { getAuthenticatedUser } from "@/lib/auth-server";
import {
  getRetentionLeaderboard,
  getUserLeaderboardPosition,
} from "@/lib/gamification/retention-leaderboard";

/**
 * GET /api/leaderboard/retention
 * Obtener leaderboard de retention
 *
 * Query params:
 * - type: "global" | "weekly" | "monthly" (default: "global")
 * - limit: number (default: 50, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const searchParams = request.nextUrl.searchParams;

    const type = (searchParams.get("type") || "global") as "global" | "weekly" | "monthly";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // Get leaderboard
    const leaderboard = await getRetentionLeaderboard({
      type,
      limit,
      userId: user?.id,
    });

    // Si el usuario está autenticado, incluir su posición
    let userPosition = null;
    if (user?.id) {
      userPosition = await getUserLeaderboardPosition(user.id);
    }

    return NextResponse.json({
      type,
      leaderboard,
      userPosition,
      total: leaderboard.length,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching retention leaderboard");
    return NextResponse.json(
      { error: "Error al obtener leaderboard" },
      { status: 500 }
    );
  }
}
