import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/bonds/global-stats
 * Get global statistics about all bonds in the system
 */
export async function GET(_request: NextRequest) {
  try {
    // Get all active bonds
    const activeBonds = await prisma.symbolicBond.findMany({
      where: { status: "active" },
      select: {
        rarityScore: true,
        tier: true,
        userId: true,
      },
    });

    // Calculate stats
    const totalActiveBonds = activeBonds.length;
    const uniqueUsers = new Set(activeBonds.map((b) => b.userId)).size;

    const averageRarityScore =
      totalActiveBonds > 0
        ? activeBonds.reduce((sum, b) => sum + b.rarityScore, 0) / totalActiveBonds
        : 0;

    // Find most popular tier
    const tierCounts: Record<string, number> = {};
    activeBonds.forEach((bond) => {
      tierCounts[bond.tier] = (tierCounts[bond.tier] || 0) + 1;
    });

    const mostPopularTier =
      Object.entries(tierCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "ACQUAINTANCE";

    return NextResponse.json({
      totalActiveBonds,
      totalUsers: uniqueUsers,
      averageRarityScore: Number(averageRarityScore.toFixed(2)),
      mostPopularTier,
    });
  } catch (error) {
    console.error("Error fetching global stats:", error);
    return NextResponse.json(
      { error: "Error al obtener estadísticas globales" },
      { status: 500 }
    );
  }
}
