/**
 * CRON JOB: Daily KPIs Aggregation
 * Schedule: Daily at 00:05 UTC
 * 
 * Calculates and stores the previous day's metrics in the DailyKPI table.
 * This job is idempotent - it can be run multiple times without side effects.
 * 
 * Protection: Requires Authorization header with CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { nanoid } from 'nanoid';

// ============================================================================
// SECURITY: Authorization verification
// ============================================================================

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  // In development, allow without token if CRON_SECRET is not configured
  if (process.env.NODE_ENV === 'development' && !process.env.CRON_SECRET) {
    console.warn('[CRON] Warning: CRON_SECRET not configured in development');
    return true;
  }

  return token === process.env.CRON_SECRET;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authorization
    if (!isAuthorized(request)) {
      console.error('[CRON] Unauthorized attempt to access aggregate-daily-kpis');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or missing CRON_SECRET' },
        { status: 401 }
      );
    }

    // Calcular fecha objetivo (ayer)
    const yesterday = startOfDay(subDays(new Date(), 1));
    const dayStart = startOfDay(yesterday);
    const dayEnd = endOfDay(yesterday);

    console.log(`[CRON] Starting daily KPI aggregation for date: ${yesterday.toISOString().split('T')[0]}`);

    // ============================================================================
    // 1. LANDING PAGE METRICS
    // ============================================================================

    const [
      landingViews,
      uniqueSessionsCount,
      demoStarts,
      demoCompletes,
      ctaClicks,
      signups
    ] = await Promise.all([
      // Total page views
      prisma.analyticsEvent.count({
        where: {
          eventType: 'LANDING_PAGE_VIEW',
          timestamp: { gte: dayStart, lte: dayEnd }
        }
      }),
      // Unique visitors (sessions)
      prisma.userSession.count({
        where: {
          startedAt: { gte: dayStart, lte: dayEnd }
        }
      }),
      // Demo starts
      prisma.analyticsEvent.count({
        where: {
          eventType: 'LANDING_DEMO_START',
          timestamp: { gte: dayStart, lte: dayEnd }
        }
      }),
      // Demo completes (3+ messages)
      prisma.analyticsEvent.count({
        where: {
          eventType: 'LANDING_DEMO_LIMIT_REACHED',
          timestamp: { gte: dayStart, lte: dayEnd }
        }
      }),
      // CTA clicks (primary + secondary)
      prisma.analyticsEvent.count({
        where: {
          eventType: { in: ['LANDING_CTA_PRIMARY', 'LANDING_CTA_SECONDARY'] },
          timestamp: { gte: dayStart, lte: dayEnd }
        }
      }),
      // Signups
      prisma.user.count({
        where: {
          createdAt: { gte: dayStart, lte: dayEnd }
        }
      })
    ]);

    console.log(`[CRON] Landing metrics - Views: ${landingViews}, Demos: ${demoStarts}, Signups: ${signups}`);

    // ============================================================================
    // 2. CONVERSION RATES
    // ============================================================================

    const signupRate = landingViews > 0 ? signups / landingViews : 0;
    const demoConversionRate = landingViews > 0 ? demoStarts / landingViews : 0;

    // Activation rate (users que enviaron primer mensaje)
    const firstMessages = await prisma.analyticsEvent.count({
      where: {
        eventType: 'FIRST_MESSAGE_SENT',
        timestamp: { gte: dayStart, lte: dayEnd }
      }
    });
    const activationRate = signups > 0 ? firstMessages / signups : 0;

    // ============================================================================
    // 3. ENGAGEMENT METRICS
    // ============================================================================

    // DAU (Daily Active Users) - usuarios que enviaron al menos 1 mensaje
    const dauUsers = await prisma.message.findMany({
      where: {
        createdAt: { gte: dayStart, lte: dayEnd },
        role: 'user'
      },
      select: { userId: true },
      distinct: ['userId']
    });
    const dau = dauUsers.length;

    // Total messages of the day
    const totalMessages = await prisma.message.count({
      where: {
        createdAt: { gte: dayStart, lte: dayEnd },
        role: 'user'
      }
    });

    const avgMessagesPerUser = dau > 0 ? totalMessages / dau : 0;

    // Total sessions (this should come from a more sophisticated session tracking)
    const totalSessions = uniqueSessionsCount;
    const avgSessionDuration = 0; // TODO: Calcular desde session tracking

    console.log(`[CRON] Engagement metrics - DAU: ${dau}, Messages: ${totalMessages}, Avg/User: ${avgMessagesPerUser.toFixed(2)}`);

    // ============================================================================
    // 4. MONETIZATION METRICS
    // ============================================================================

    // Plan conversions in the day
    const subscriptionEvents = await prisma.analyticsEvent.findMany({
      where: {
        eventType: { startsWith: 'SUBSCRIPTION_' },
        timestamp: { gte: dayStart, lte: dayEnd }
      },
      select: {
        metadata: true
      }
    });

    let freeToPlus = 0;
    let freeToUltra = 0;
    let plusToUltra = 0;

    subscriptionEvents.forEach(event => {
      if (event.metadata && typeof event.metadata === 'object') {
        const meta = event.metadata as any;
        if (meta.oldPlan === 'free' && meta.newPlan === 'plus') freeToPlus++;
        if (meta.oldPlan === 'free' && meta.newPlan === 'ultra') freeToUltra++;
        if (meta.oldPlan === 'plus' && meta.newPlan === 'ultra') plusToUltra++;
      }
    });

    // Calculate rates based on total users per plan (snapshot of the previous day)
    const planDistribution = await prisma.user.groupBy({
      by: ['plan'],
      where: {
        createdAt: { lte: dayStart }
      },
      _count: true
    });

    const freeUsers = planDistribution.find(p => p.plan === 'free')?._count || 0;
    const plusUsers = planDistribution.find(p => p.plan === 'plus')?._count || 0;

    const freeToPlusRate = freeUsers > 0 ? freeToPlus / freeUsers : 0;
    const freeToUltraRate = freeUsers > 0 ? freeToUltra / freeUsers : 0;
    const plusToUltraRate = plusUsers > 0 ? plusToUltra / plusUsers : 0;

    console.log(`[CRON] Monetization metrics - Free→Plus: ${freeToPlus}, Free→Ultra: ${freeToUltra}, Plus→Ultra: ${plusToUltra}`);

    // ============================================================================
    // 5. RETENTION METRICS (calculados desde cohortes)
    // ============================================================================

    // D1 Retention: users who registered 1 day ago and were active today
    const oneDayAgo = subDays(dayStart, 1);
    const oneDayAgoStart = startOfDay(oneDayAgo);
    const oneDayAgoEnd = endOfDay(oneDayAgo);

    const usersSignedUpOneDayAgo = await prisma.user.findMany({
      where: {
        createdAt: { gte: oneDayAgoStart, lte: oneDayAgoEnd }
      },
      select: { id: true }
    });

    const activeUsersFromOneDayAgo = await prisma.message.findMany({
      where: {
        createdAt: { gte: dayStart, lte: dayEnd },
        userId: { in: usersSignedUpOneDayAgo.map(u => u.id) },
        role: 'user'
      },
      select: { userId: true },
      distinct: ['userId']
    });

    const d1Retention = usersSignedUpOneDayAgo.length > 0
      ? activeUsersFromOneDayAgo.length / usersSignedUpOneDayAgo.length
      : 0;

    // D7 Retention: users who registered 7 days ago and were active today
    const sevenDaysAgo = subDays(dayStart, 7);
    const sevenDaysAgoStart = startOfDay(sevenDaysAgo);
    const sevenDaysAgoEnd = endOfDay(sevenDaysAgo);

    const usersSignedUpSevenDaysAgo = await prisma.user.findMany({
      where: {
        createdAt: { gte: sevenDaysAgoStart, lte: sevenDaysAgoEnd }
      },
      select: { id: true }
    });

    const activeUsersFromSevenDaysAgo = await prisma.message.findMany({
      where: {
        createdAt: { gte: dayStart, lte: dayEnd },
        userId: { in: usersSignedUpSevenDaysAgo.map(u => u.id) },
        role: 'user'
      },
      select: { userId: true },
      distinct: ['userId']
    });

    const d7Retention = usersSignedUpSevenDaysAgo.length > 0
      ? activeUsersFromSevenDaysAgo.length / usersSignedUpSevenDaysAgo.length
      : 0;

    // D30 Retention
    const thirtyDaysAgo = subDays(dayStart, 30);
    const thirtyDaysAgoStart = startOfDay(thirtyDaysAgo);
    const thirtyDaysAgoEnd = endOfDay(thirtyDaysAgo);

    const usersSignedUpThirtyDaysAgo = await prisma.user.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgoStart, lte: thirtyDaysAgoEnd }
      },
      select: { id: true }
    });

    const activeUsersFromThirtyDaysAgo = await prisma.message.findMany({
      where: {
        createdAt: { gte: dayStart, lte: dayEnd },
        userId: { in: usersSignedUpThirtyDaysAgo.map(u => u.id) },
        role: 'user'
      },
      select: { userId: true },
      distinct: ['userId']
    });

    const d30Retention = usersSignedUpThirtyDaysAgo.length > 0
      ? activeUsersFromThirtyDaysAgo.length / usersSignedUpThirtyDaysAgo.length
      : 0;

    console.log(`[CRON] Retention metrics - D1: ${(d1Retention * 100).toFixed(2)}%, D7: ${(d7Retention * 100).toFixed(2)}%, D30: ${(d30Retention * 100).toFixed(2)}%`);

    // ============================================================================
    // 6. BONDS METRICS
    // ============================================================================

    // Distribution of bonds by tier (snapshot of the day)
    const bondsDistribution = await prisma.symbolicBond.groupBy({
      by: ['rarityTier'],
      where: {
        status: 'active',
        createdAt: { lte: dayEnd }
      },
      _count: true
    });

    const bondsStats = {
      common: bondsDistribution.find(b => b.rarityTier === 'Common')?._count || 0,
      uncommon: bondsDistribution.find(b => b.rarityTier === 'Uncommon')?._count || 0,
      rare: bondsDistribution.find(b => b.rarityTier === 'Rare')?._count || 0,
      epic: bondsDistribution.find(b => b.rarityTier === 'Epic')?._count || 0,
      legendary: bondsDistribution.find(b => b.rarityTier === 'Legendary')?._count || 0,
      mythic: bondsDistribution.find(b => b.rarityTier === 'Mythic')?._count || 0
    };

    // Avg bond affinity of the day
    const bondsAffinity = await prisma.symbolicBond.aggregate({
      where: {
        status: 'active',
        createdAt: { lte: dayEnd }
      },
      _avg: {
        affinityLevel: true
      }
    });

    const avgBondAffinity = bondsAffinity._avg.affinityLevel || 0;

    console.log(`[CRON] Bonds metrics - Total: ${Object.values(bondsStats).reduce((a, b) => a + b, 0)}, Avg Affinity: ${avgBondAffinity.toFixed(2)}`);

    // ============================================================================
    // 7. UPSERT EN BASE DE DATOS
    // ============================================================================

    const kpiData = {
      date: yesterday,

      // Landing
      landingViews,
      uniqueVisitors: uniqueSessionsCount,
      demoStarts,
      demoCompletes,
      ctaClicks,
      signups,

      // Conversion Rates
      signupRate,
      demoConversionRate,
      activationRate,

      // Engagement
      dau,
      totalMessages,
      avgMessagesPerUser,
      totalSessions,
      avgSessionDuration,

      // Monetization
      freeToPlus,
      freeToPlusRate,
      freeToUltra,
      freeToUltraRate,
      plusToUltra,
      plusToUltraRate,

      // Retention
      d1Retention,
      d7Retention,
      d30Retention,

      // Bonds
      bondsCommon: bondsStats.common,
      bondsUncommon: bondsStats.uncommon,
      bondsRare: bondsStats.rare,
      bondsEpic: bondsStats.epic,
      bondsLegendary: bondsStats.legendary,
      bondsMythic: bondsStats.mythic,
      avgBondAffinity
    };

    const _result = await prisma.dailyKPI.upsert({
      where: { date: yesterday },
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        ...kpiData
      },
      update: kpiData
    });

    const duration = Date.now() - startTime;

    console.log(`[CRON] ✓ Daily KPI aggregation completed successfully in ${duration}ms`);
    console.log(`[CRON] Summary: ${signups} signups, ${dau} DAU, ${totalMessages} messages`);

    return NextResponse.json({
      success: true,
      date: yesterday.toISOString().split('T')[0],
      duration: `${duration}ms`,
      kpis: {
        landing: {
          views: landingViews,
          uniqueVisitors: uniqueSessionsCount,
          demos: demoStarts,
          signups
        },
        engagement: {
          dau,
          totalMessages,
          avgMessagesPerUser: parseFloat(avgMessagesPerUser.toFixed(2))
        },
        monetization: {
          freeToPlus,
          freeToUltra,
          plusToUltra
        },
        retention: {
          d1: parseFloat((d1Retention * 100).toFixed(2)),
          d7: parseFloat((d7Retention * 100).toFixed(2)),
          d30: parseFloat((d30Retention * 100).toFixed(2))
        }
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON] Error in daily KPI aggregation:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// EXPORT ROUTE METADATA
// ============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minuto máximo
