import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { getTopUsersByEngagement } from "@/lib/services/bond-analytics.service";

/**
 * GET /api/admin/bonds-analytics/top-users
 * Obtener top usuarios por engagement con bonds
 * Solo accesible para admins
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get limit parameter (default 10)
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // Get top users
    const topUsers = await getTopUsersByEngagement(limit);

    // Enrich with user data (name, email)
    const enrichedUsers = await Promise.all(
      topUsers.map(async (userStats) => {
        const userData = await prisma.user.findUnique({
          where: { id: userStats.userId },
          select: { name: true, email: true },
        });

        return {
          ...userStats,
          userName: userData?.name,
          userEmail: userData?.email,
        };
      })
    );

    return NextResponse.json(enrichedUsers);
  } catch (error: any) {
    console.error("[API] Error fetching top users:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
