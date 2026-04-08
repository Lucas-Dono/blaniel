/**
 * KPI Calculation System
 * Functions to add and calculate analytics metrics
 */

import { prisma } from '@/lib/prisma';
import {subDays} from 'date-fns';

export interface TimeRange {
  start: Date;
  end: Date;
  days: number;
}

export function getTimeRange(days: number): TimeRange {
  const end = new Date();
  const start = subDays(end, days);
  return { start, end, days };
}

// ============================================================================
// LANDING PAGE KPIs
// ============================================================================

export async function calculateLandingKPIs(timeRange: TimeRange) {
  const { start, end } = timeRange;

  // Landing page events
  const landingEvents = await prisma.analyticsEvent.findMany({
    where: {
      timestamp: { gte: start, lte: end },
      eventType: { startsWith: 'landing.' }
    },
    select: {
      eventType: true,
      userId: true,
      sessionId: true,
      metadata: true,
      timestamp: true
    }
  });

  // Group by eventType
  const eventCounts = landingEvents.reduce((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Unique Sessions
  const uniqueSessions = new Set(landingEvents.map(e => e.sessionId).filter(Boolean));
  const uniqueVisitors = uniqueSessions.size;

  // Page views
  const totalViews = eventCounts['landing.page_view'] || 0;

  // Demo analytics
  const demoStarts = eventCounts['landing.demo_start'] || 0;
  const demoMessages = eventCounts['landing.demo_message'] || 0;
  const demoLimitReached = eventCounts['landing.demo_limit_reached'] || 0;
  const demoSignups = eventCounts['landing.demo_signup'] || 0;

  // CTA clicks
  const ctaPrimaryClicks = eventCounts['landing.cta_primary'] || 0;
  const ctaSecondaryClicks = eventCounts['landing.cta_secondary'] || 0;

  // Feature clicks
  const featureClicks = eventCounts['landing.feature_click'] || 0;

  // Plan views/selects
  const planViews = eventCounts['landing.plan_view'] || 0;
  const planSelects = eventCounts['landing.plan_select'] || 0;

  // Calculate rates
  const demoStartRate = totalViews > 0 ? demoStarts / totalViews : 0;
  const demoCompletionRate = demoStarts > 0 ? demoLimitReached / demoStarts : 0;
  const demoConversionRate = demoStarts > 0 ? demoSignups / demoStarts : 0;

  // Avg messages per demo session
  const avgDemoMessages = demoStarts > 0 ? demoMessages / demoStarts : 0;

  // Traffic sources (from sessions)
  const sessions = await prisma.userSession.findMany({
    where: {
      startedAt: { gte: start, lte: end }
    },
    select: {
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      deviceType: true,
      convertedAt: true
    }
  });

  // Group by source
  const sourceStats = sessions.reduce((acc, session) => {
    const source = session.utmSource || 'direct';
    if (!acc[source]) {
      acc[source] = { visits: 0, signups: 0 };
    }
    acc[source].visits++;
    if (session.convertedAt) {
      acc[source].signups++;
    }
    return acc;
  }, {} as Record<string, { visits: number; signups: number }>);

  const trafficSources = Object.entries(sourceStats).map(([source, stats]) => ({
    source,
    visits: stats.visits,
    signups: stats.signups,
    conversionRate: stats.visits > 0 ? stats.signups / stats.visits : 0
  })).sort((a, b) => b.visits - a.visits);

  // Device distribution
  const deviceStats = sessions.reduce((acc, session) => {
    const device = session.deviceType || 'unknown';
    if (!acc[device]) {
      acc[device] = { count: 0, signups: 0 };
    }
    acc[device].count++;
    if (session.convertedAt) {
      acc[device].signups++;
    }
    return acc;
  }, {} as Record<string, { count: number; signups: number }>);

  const totalSessions = sessions.length;
  const devices = Object.entries(deviceStats).map(([type, stats]) => ({
    type,
    count: stats.count,
    percentage: totalSessions > 0 ? (stats.count / totalSessions) * 100 : 0,
    signupRate: stats.count > 0 ? stats.signups / stats.count : 0
  }));

  // Calculate avgTimeOnPage and bounceRate from sessions
  const _sessionDurations = sessions
    .filter(s => s.convertedAt) // Only sessions with activity
    .map(_s => {
      // Estimate duration if not available (placeholder)
      return 0; // In a real implementation, we would calculate from events
    });

  const avgTimeOnPage = sessions.length > 0
    ? sessions.reduce((sum, _s) => {
        // Placeholder: calculate from difference between first and last event
        return sum + 0;
      }, 0) / sessions.length
    : 0;

  // Bounce rate: sesiones con solo 1 evento / total sesiones
  const bouncedSessions = sessions.filter(s => !s.convertedAt).length;
  const bounceRate = sessions.length > 0 ? bouncedSessions / sessions.length : 0;

  // Time series (last 30 days)
  const timeSeries = await getDailyTimeSeries(start, end, 'landing');

  return {
    overview: {
      totalViews,
      uniqueVisitors,
      avgTimeOnPage,
      bounceRate
    },
    demo: {
      starts: demoStarts,
      startRate: demoStartRate,
      avgMessages: avgDemoMessages,
      completionRate: demoCompletionRate,
      signupAfterDemo: demoSignups,
      conversionRate: demoConversionRate
    },
    ctas: {
      primary: { clicks: ctaPrimaryClicks, rate: totalViews > 0 ? ctaPrimaryClicks / totalViews : 0 },
      secondary: { clicks: ctaSecondaryClicks, rate: totalViews > 0 ? ctaSecondaryClicks / totalViews : 0 }
    },
    features: {
      clicks: featureClicks,
      clickRate: totalViews > 0 ? featureClicks / totalViews : 0
    },
    plans: {
      views: planViews,
      selects: planSelects,
      selectRate: planViews > 0 ? planSelects / planViews : 0
    },
    traffic: {
      sources: trafficSources,
      devices
    },
    timeSeries
  };
}

// ============================================================================
// CONVERSION FUNNEL KPIs
// ============================================================================

export async function calculateFunnelKPIs(timeRange: TimeRange) {
  const { start, end } = timeRange;

  // Contar eventos clave del funnel
  const [
    landingViews,
    demoStarts,
    demoCompletes,
    signups,
    firstAgents,
    firstMessages,
    paidUpgrades
  ] = await Promise.all([
    prisma.analyticsEvent.count({
      where: { eventType: 'landing.page_view', timestamp: { gte: start, lte: end } }
    }),
    prisma.analyticsEvent.count({
      where: { eventType: 'landing.demo_start', timestamp: { gte: start, lte: end } }
    }),
    prisma.analyticsEvent.count({
      where: { eventType: 'landing.demo_limit_reached', timestamp: { gte: start, lte: end } }
    }),
    prisma.user.count({
      where: { createdAt: { gte: start, lte: end } }
    }),
    prisma.analyticsEvent.count({
      where: { eventType: 'conversion.first_agent', timestamp: { gte: start, lte: end } }
    }),
    prisma.analyticsEvent.count({
      where: { eventType: 'conversion.first_message', timestamp: { gte: start, lte: end } }
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: { in: ['conversion.free_to_plus', 'conversion.free_to_ultra', 'conversion.plus_to_ultra'] },
        timestamp: { gte: start, lte: end }
      }
    })
  ]);

  // Construir funnel
  const funnel = [
    { stage: 'landing_view', count: landingViews, rate: 100 },
    { stage: 'demo_start', count: demoStarts, rate: landingViews > 0 ? (demoStarts / landingViews) * 100 : 0 },
    { stage: 'demo_complete', count: demoCompletes, rate: landingViews > 0 ? (demoCompletes / landingViews) * 100 : 0 },
    { stage: 'signup', count: signups, rate: landingViews > 0 ? (signups / landingViews) * 100 : 0 },
    { stage: 'first_agent', count: firstAgents, rate: landingViews > 0 ? (firstAgents / landingViews) * 100 : 0 },
    { stage: 'first_message', count: firstMessages, rate: landingViews > 0 ? (firstMessages / landingViews) * 100 : 0 },
    { stage: 'paid_upgrade', count: paidUpgrades, rate: landingViews > 0 ? (paidUpgrades / landingViews) * 100 : 0 }
  ];

  // Calcular drop-offs
  const dropoff = [
    {
      from: 'landing_view',
      to: 'demo_start',
      loss: landingViews - demoStarts,
      rate: landingViews > 0 ? ((landingViews - demoStarts) / landingViews) * 100 : 0
    },
    {
      from: 'demo_start',
      to: 'signup',
      loss: demoStarts - signups,
      rate: demoStarts > 0 ? ((demoStarts - signups) / demoStarts) * 100 : 0
    },
    {
      from: 'signup',
      to: 'paid_upgrade',
      loss: signups - paidUpgrades,
      rate: signups > 0 ? ((signups - paidUpgrades) / signups) * 100 : 0
    }
  ];

  // Time series
  const timeSeries = await getDailyTimeSeries(start, end, 'funnel');

  return {
    funnel,
    dropoff,
    timeSeries
  };
}

// ============================================================================
// MONETIZATION KPIs
// ============================================================================

export async function calculateMonetizationKPIs(timeRange: TimeRange) {
  const { start, end } = timeRange;

  // Plan distribution (all users)
  const planDistribution = await prisma.user.groupBy({
    by: ['plan'],
    _count: true
  });

  const totalUsers = planDistribution.reduce((sum, p) => sum + p._count, 0);

  const overview = {
    totalUsers,
    freeUsers: planDistribution.find(p => p.plan === 'free')?._count || 0,
    plusUsers: planDistribution.find(p => p.plan === 'plus')?._count || 0,
    ultraUsers: planDistribution.find(p => p.plan === 'ultra')?._count || 0
  };

  // Conversiones en el periodo (eventos de upgrade)
  const conversionEvents = await prisma.analyticsEvent.findMany({
    where: {
      eventType: { in: ['conversion.free_to_plus', 'conversion.free_to_ultra', 'conversion.plus_to_ultra'] },
      timestamp: { gte: start, lte: end }
    },
    select: {
      eventType: true,
      metadata: true,
      userId: true,
      timestamp: true
    }
  });

  // Contar conversiones por tipo
  const freeToPlus = conversionEvents.filter(e =>
    e.metadata && typeof e.metadata === 'object' &&
    'oldPlan' in e.metadata && 'newPlan' in e.metadata &&
    e.metadata.oldPlan === 'free' && e.metadata.newPlan === 'plus'
  ).length;

  const freeToUltra = conversionEvents.filter(e =>
    e.metadata && typeof e.metadata === 'object' &&
    'oldPlan' in e.metadata && 'newPlan' in e.metadata &&
    e.metadata.oldPlan === 'free' && e.metadata.newPlan === 'ultra'
  ).length;

  const plusToUltra = conversionEvents.filter(e =>
    e.metadata && typeof e.metadata === 'object' &&
    'oldPlan' in e.metadata && 'newPlan' in e.metadata &&
    e.metadata.oldPlan === 'plus' && e.metadata.newPlan === 'ultra'
  ).length;

  // Calcular tiempo promedio hasta upgrade (para usuarios que upgradearon en el periodo)
  const upgradeTimesPromises = conversionEvents.map(async (event) => {
    if (!event.userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: event.userId },
      select: { createdAt: true }
    });

    if (!user) return null;

    const daysDiff = Math.floor(
      (event.timestamp.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysDiff;
  });

  const upgradeTimes = (await Promise.all(upgradeTimesPromises)).filter((t): t is number => t !== null);
  const avgTimeToConvert = upgradeTimes.length > 0
    ? upgradeTimes.reduce((sum, t) => sum + t, 0) / upgradeTimes.length
    : 0;

  // Calcular MRR desde Subscriptions activas
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active'
    },
    select: {
      amountPaid: true,
      interval: true
    }
  });

  // Convertir todas las subscripciones a MRR (Monthly Recurring Revenue)
  const mrr = activeSubscriptions.reduce((sum, sub) => {
    const monthlyAmount = sub.interval === 'year'
      ? sub.amountPaid / 12
      : sub.amountPaid;
    return sum + monthlyAmount;
  }, 0);

  const arr = mrr * 12; // Annual Recurring Revenue

  // Calcular churn rate (cancelaciones en el periodo / total al inicio del periodo)
  const canceledInPeriod = await prisma.subscription.count({
    where: {
      status: 'canceled',
      updatedAt: { gte: start, lte: end }
    }
  });

  const activeAtStart = await prisma.subscription.count({
    where: {
      createdAt: { lt: start },
      OR: [
        { status: 'active' },
        { status: 'canceled', updatedAt: { gte: start } }
      ]
    }
  });

  const churnRate = activeAtStart > 0 ? (canceledInPeriod / activeAtStart) * 100 : 0;

  const conversions = {
    freeToPlus: {
      count: freeToPlus,
      rate: overview.freeUsers > 0 ? freeToPlus / overview.freeUsers : 0,
      avgTimeToConvert
    },
    freeToUltra: {
      count: freeToUltra,
      rate: overview.freeUsers > 0 ? freeToUltra / overview.freeUsers : 0,
      avgTimeToConvert
    },
    plusToUltra: {
      count: plusToUltra,
      rate: overview.plusUsers > 0 ? plusToUltra / overview.plusUsers : 0,
      avgTimeToConvert
    }
  };

  // Conversion triggers (which event preceded the upgrade)
  const triggers = [
    { trigger: 'bond_limit_reached', conversions: 0, rate: 0 },
    { trigger: 'generation_tier_limit', conversions: 0, rate: 0 },
    { trigger: 'feature_discovery', conversions: 0, rate: 0 }
  ];

  // Time series
  const timeSeries = await getDailyTimeSeries(start, end, 'monetization');

  return {
    overview,
    conversions,
    revenue: {
      mrr,
      arr,
      churnRate,
      avgLTV: {
        free: 0,
        plus: 89.50, // Placeholder
        ultra: 234.80 // Placeholder
      }
    },
    triggers,
    timeSeries
  };
}

// ============================================================================
// USER-SPECIFIC KPIs
// ============================================================================

export async function calculateUserKPIs(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      Agent: {
        select: {
          id: true,
          name: true,
          generationTier: true,
          createdAt: true
        }
      },
      UserSession: {
        orderBy: { startedAt: 'asc' },
        take: 1,
        select: {
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          startedAt: true
        }
      }
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Buscar UserAnalyticsSummary si existe
  const summary = await prisma.userAnalyticsSummary.findUnique({
    where: { userId }
  });

  // Mensajes por agente
  const messagesByAgent = await prisma.message.groupBy({
    by: ['agentId'],
    where: { userId },
    _count: true,
    orderBy: { _count: { agentId: 'desc' } }
  });

  const favoriteAgentId = messagesByAgent[0]?.agentId;
  const favoriteAgent = user.Agent.find((a: { id: string }) => a.id === favoriteAgentId);

  // Bonds
  const bonds = await prisma.symbolicBond.findMany({
    where: { userId },
    include: {
      Agent: {
        select: { id: true, name: true }
      }
    }
  });

  // Relations (stages)
  const relations = await prisma.relation.findMany({
    where: {
      targetId: userId,
      targetType: "user"
    },
    select: {
      stage: true,
      trust: true,
      affinity: true,
      respect: true
    }
  });

  const avgTrust = relations.length > 0
    ? relations.reduce((sum, r) => sum + r.trust, 0) / relations.length
    : 0;
  const avgAffinity = relations.length > 0
    ? relations.reduce((sum, r) => sum + r.affinity, 0) / relations.length
    : 0;
  const avgRespect = relations.length > 0
    ? relations.reduce((sum, r) => sum + r.respect, 0) / relations.length
    : 0;

  const stageDistribution = relations.reduce((acc, r) => {
    acc[r.stage] = (acc[r.stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Journey timestamps
  const firstSession = user.UserSession[0];
  const firstAgent = user.Agent.sort((a: { createdAt: Date }, b: { createdAt: Date }) =>
    a.createdAt.getTime() - b.createdAt.getTime()
  )[0];

  const firstMessage = await prisma.message.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  });

  const firstPaid = await prisma.subscription.findFirst({
    where: { userId, status: 'active' },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  });

  const daysSinceSignup = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    profile: {
      userId: user.id,
      email: user.email,
      plan: user.plan,
      signupDate: user.createdAt,
      daysSinceSignup,
      acquisition: {
        source: firstSession?.utmSource || null,
        medium: firstSession?.utmMedium || null,
        campaign: firstSession?.utmCampaign || null
      }
    },
    journey: {
      signupToFirstAgent: firstAgent
        ? Math.floor((firstAgent.createdAt.getTime() - user.createdAt.getTime()) / (1000 * 60))
        : null,
      signupToFirstMessage: firstMessage
        ? Math.floor((firstMessage.createdAt.getTime() - user.createdAt.getTime()) / (1000 * 60))
        : null,
      signupToFirstPaid: firstPaid
        ? Math.floor((firstPaid.createdAt.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : null
    },
    engagement: {
      totalSessions: summary?.totalSessions || 0,
      totalMessages: summary?.totalMessages || messagesByAgent.reduce((sum, m) => sum + m._count, 0),
      avgMessagesPerSession: summary?.avgMessagesPerSession || 0,
      currentStreak: summary?.currentStreak || 0,
      longestStreak: summary?.longestStreak || 0,
      lastActive: summary?.lastActiveAt || user.updatedAt
    },
    agents: {
      total: user.Agent.length,
      favorite: favoriteAgent ? {
        id: favoriteAgent.id,
        name: favoriteAgent.name,
        messages: messagesByAgent[0]?._count || 0,
        percentage: messagesByAgent.length > 0
          ? (messagesByAgent[0]._count / messagesByAgent.reduce((sum, m) => sum + m._count, 0)) * 100
          : 0
      } : null,
      all: messagesByAgent.map(m => {
        const agent = user.Agent.find((a: { id: string }) => a.id === m.agentId);
        return {
          id: m.agentId,
          name: agent?.name || 'Unknown',
          tier: agent?.generationTier || 'free',
          messages: m._count
        };
      })
    },
    bonds: {
      total: bonds.length,
      highest: bonds.length > 0
        ? bonds.reduce((max, b) => b.affinityLevel > (max?.affinityLevel || 0) ? b : max).rarityTier
        : null,
      avgAffinity: bonds.length > 0
        ? bonds.reduce((sum, b) => sum + b.affinityLevel, 0) / bonds.length
        : 0,
      details: bonds.map(b => ({
        agentId: b.agentId,
        agentName: b.Agent.name,
        tier: b.rarityTier,
        affinity: b.affinityLevel,
        status: b.status
      }))
    },
    relations: {
      stages: stageDistribution,
      avgTrust,
      avgAffinity,
      avgRespect
    },
    monetization: {
      plan: user.plan,
      ltv: summary?.lifetimeValue || 0,
      firstPaidDate: summary?.firstPaidAt || null
    },
    flags: {
      isChurnRisk: summary?.lastActiveAt
        ? (Date.now() - summary.lastActiveAt.getTime()) > (7 * 24 * 60 * 60 * 1000)
        : false,
      isPowerUser: summary?.totalMessages ? summary.totalMessages > 100 : false,
      isHighValue: summary?.lifetimeValue ? summary.lifetimeValue > 50 : false
    }
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getDailyTimeSeries(
  _start: Date,
  _end: Date,
  _type: 'landing' | 'funnel' | 'monetization'
): Promise<any[]> {
  // TODO: Implementar series temporales desde DailyKPI cuando existan
  // For now returns empty array
  return [];
}
