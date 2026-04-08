import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getConversionFunnel } from "@/lib/services/bond-analytics.service";

/**
 * GET /api/admin/bonds-analytics/funnel
 * Get the conversion funnel of the bonds system
 * Only accessible for admins
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get conversion funnel
    const funnel = await getConversionFunnel();

    return NextResponse.json(funnel);
  } catch (error: any) {
    console.error("[API] Error fetching conversion funnel:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
