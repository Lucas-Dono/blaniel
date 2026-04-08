import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from "nanoid";
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { ReputationService } from '@/lib/services/reputation.service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/daily-checkin - Daily check-in for streak and rewards
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userId = session.user.id;

    // Update streak
    const streak = await ReputationService.updateDailyStreak(userId);

    // Award points based on streak
    let points = 10; // Base daily reward
    let badgeAwarded = null;

    if (streak === 7) {
      points = 50;
      badgeAwarded = 'streak_7';
    } else if (streak === 30) {
      points = 200;
      badgeAwarded = 'streak_30';
    } else if (streak === 100) {
      points = 500;
      badgeAwarded = 'streak_100';
    }

    await ReputationService.addPoints(userId, points, 'daily_checkin');

    // Check if badge needs to be awarded
    if (badgeAwarded) {
      const existingBadge = await prisma.userBadge.findFirst({
        where: { userId, badgeName: badgeAwarded },
      });

      if (!existingBadge) {
        const badgeNames: Record<string, { name: string; description: string; type: string; level: string }> = {
          streak_7: { name: '7 Day Streak', description: 'Activo 7 días seguidos', type: 'social', level: 'bronze' },
          streak_30: { name: '30 Day Streak', description: 'Activo 30 días seguidos', type: 'social', level: 'silver' },
          streak_100: { name: '100 Day Streak', description: 'Activo 100 días seguidos', type: 'social', level: 'diamond' },
        };

        const badge = badgeNames[badgeAwarded];

        // Get user reputation
        const reputation = await prisma.userReputation.findUnique({
          where: { userId },
        });

        if (reputation) {
          await prisma.userBadge.create({
            data: {
              id: nanoid(),
              userId,
              reputationId: reputation.id,
              badgeName: badge.name,
              badgeType: badge.type,
              badgeLevel: badge.level,
              description: badge.description,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      streak,
      points,
      badgeAwarded,
    });
  } catch (error: any) {
    console.error('Error in daily check-in:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * GET /api/daily-checkin - Get check-in status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const reputation = await ReputationService.getUserReputation(session.user.id);
    const now = new Date();
    const lastActive = reputation.lastActiveDate;

    let canCheckIn = true;
    if (lastActive) {
      const daysSinceLastActive = Math.floor(
        (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
      );
      canCheckIn = daysSinceLastActive >= 1;
    }

    return NextResponse.json({
      canCheckIn,
      currentStreak: reputation.currentStreak,
      longestStreak: reputation.longestStreak,
      lastActiveDate: reputation.lastActiveDate,
    });
  } catch (error: any) {
    console.error('Error getting check-in status:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
