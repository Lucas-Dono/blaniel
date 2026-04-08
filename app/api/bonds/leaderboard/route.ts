import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BondTier } from "@prisma/client";

/**
 * GET /api/bonds/leaderboard
 * Get global leaderboard of bonds ordered by rarity score
 *
 * Query params:
 * - tier: Filter by specific tier (optional)
 * - limit: Number of results (default: 50, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tierParam = searchParams.get("tier");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // Build where clause
    const where: any = {
      status: "active",
    };

    if (tierParam && tierParam !== "all") {
      where.tier = tierParam as BondTier;
    }

    // Fetch top bonds ordered by rarity score
    const bonds = await prisma.symbolicBond.findMany({
      where,
      orderBy: [
        { rarityScore: "desc" },
        { affinityLevel: "desc" },
        { createdAt: "asc" }, // Older bonds win ties
      ],
      take: limit,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        Agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Calculate duration for each bond
    const leaderboard = bonds.map((bond, index) => {
      const durationMs = Date.now() - bond.createdAt.getTime();
      const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

      return {
        userId: bond.User.id,
        userName: bond.User.name || "Usuario Anónimo",
        userImage: bond.User.image,
        agentId: bond.Agent.id,
        agentName: bond.Agent.name,
        agentAvatar: bond.Agent.avatar,
        tier: bond.tier,
        rarityScore: bond.rarityScore,
        rarityTier: bond.rarityTier,
        globalRank: index + 1,
        durationDays,
        affinityLevel: bond.affinityLevel,
      };
    });

    return NextResponse.json({
      leaderboard,
      count: leaderboard.length,
      filter: tierParam || "all",
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Error al obtener leaderboard" },
      { status: 500 }
    );
  }
}
