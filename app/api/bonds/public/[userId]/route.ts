import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ userId: string }>;
};

/**
 * GET /api/bonds/public/[userId]
 * Get public bonds of a user to display on their profile
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { userId } = await params;

    // Get user's privacy settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        metadata: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const metadata = (user.metadata as any) || {};
    const privacy = metadata.bondsPrivacy || {
      showActiveBonds: true,
      showRankings: true,
    };

    // If user has hidden bonds, return minimal data
    if (!privacy.showActiveBonds) {
      return NextResponse.json({
        activeBonds: [],
        topBonds: [],
        stats: {
          totalActive: 0,
          highestRarity: "N/A",
          bestRank: null,
          totalDays: 0,
        },
        privacy,
      });
    }

    // Get active bonds
    const activeBonds = await prisma.symbolicBond.findMany({
      where: {
        userId,
        status: "active",
      },
      include: {
        Agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        rarityScore: "desc",
      },
    });

    // Get top 3 by rarity
    const _topBonds = activeBonds.slice(0, 3);

    // Calculate stats
    const totalActive = activeBonds.length;
    const highestRarity =
      activeBonds.length > 0 ? activeBonds[0].rarityTier : "N/A";

    const bestRank = privacy.showRankings
      ? activeBonds.reduce((best, bond) => {
          if (!bond.globalRank) return best;
          return best === null || bond.globalRank < best
            ? bond.globalRank
            : best;
        }, null as number | null)
      : null;

    const totalDays = activeBonds.reduce(
      (sum, bond) => sum + bond.durationDays,
      0
    );

    // Map bonds for public display
    const publicBonds = activeBonds.map((bond) => ({
      id: bond.id,
      tier: bond.tier,
      rarityTier: bond.rarityTier,
      rarityScore: bond.rarityScore,
      globalRank: privacy.showRankings ? bond.globalRank : null,
      durationDays: bond.durationDays,
      affinityLevel: bond.affinityLevel,
      agent: {
        id: bond.Agent.id,
        name: bond.Agent.name,
        avatar: bond.Agent.avatar,
      },
    }));

    return NextResponse.json({
      activeBonds: publicBonds,
      topBonds: publicBonds.slice(0, 3),
      stats: {
        totalActive,
        highestRarity,
        bestRank,
        totalDays,
      },
      privacy,
    });
  } catch (error: any) {
    console.error("[API] Error fetching public bonds:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
