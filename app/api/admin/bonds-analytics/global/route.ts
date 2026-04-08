import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getGlobalBondStats } from "@/lib/services/bond-analytics.service";

/**
 * GET /api/admin/bonds-analytics/global
 * Get global statistics of the bond system
 * Only accessible for admins
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get global stats
    const stats = await getGlobalBondStats();

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("[API] Error fetching global bond stats:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
