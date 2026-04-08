import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getTokenUsageStats } from "@/lib/usage/token-limits";

/**
 * GET /api/user/token-usage
 * Returns current token usage statistics for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userPlan = user.plan || "free";

    // Get token usage stats
    const stats = await getTokenUsageStats(userId, userPlan);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("[Token Usage API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch token usage",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
