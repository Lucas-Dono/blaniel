import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getRarityDistribution } from "@/lib/services/bond-analytics.service";

/**
 * GET /api/admin/bonds-analytics/rarity-distribution
 * Get rarity distribution of the bonds system
 * Only accessible for admins
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get rarity distribution
    const distribution = await getRarityDistribution();

    return NextResponse.json(distribution);
  } catch (error: any) {
    console.error("[API] Error fetching rarity distribution:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
