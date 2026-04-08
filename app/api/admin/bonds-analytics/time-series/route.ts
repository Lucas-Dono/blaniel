import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getTimeSeriesData } from "@/lib/services/bond-analytics.service";

/**
 * GET /api/admin/bonds-analytics/time-series
 * Get time series data from the bonds system
 * Only accessible to admins
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get days parameter (default 30)
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    // Get time series data
    const data = await getTimeSeriesData(days);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API] Error fetching time series data:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
