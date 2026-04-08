import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logging/logger";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { checkAndAwardBadges } from "@/lib/gamification/badge-system";

/**
 * GET /api/user/badges
 * Obtener badges del usuario actual
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Get badges del usuario
    const badges = await prisma.bondBadge.findMany({
      where: { userId: user.id },
      orderBy: [
        { earnedAt: "desc" },
      ],
    });

    // Get rewards
    const rewards = await prisma.userRewards.findUnique({
      where: { userId: user.id },
    });

    return NextResponse.json({
      badges,
      rewards: rewards || {
        totalPoints: 0,
        availablePoints: 0,
        level: 1,
        xp: 0,
        xpToNext: 100,
        currentStreak: 0,
        longestStreak: 0,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error fetching badges");
    return NextResponse.json(
      { error: "Error al obtener badges" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/badges/check
 * Verificar y otorgar nuevos badges
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const awardedBadges = await checkAndAwardBadges(user.id);

    return NextResponse.json({
      success: true,
      newBadges: awardedBadges,
      count: awardedBadges.length,
    });
  } catch (error) {
    logger.error({ error }, "Error checking badges");
    return NextResponse.json(
      { error: "Error al verificar badges" },
      { status: 500 }
    );
  }
}
