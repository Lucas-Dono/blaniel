/**
 * KPI Tracker Service
 *
 * Centralized service for tracking KPIs according to PHASE 6 of the coordination plan.
 * Includes metrics for:
 * - Compliance & Safety
 * - User Experience
 * - Engagement
 * - Monetization
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

// ============================================================================
// TYPES AND ENUMS
// ============================================================================

export enum EventType {
  // Landing Page
  LANDING_PAGE_VIEW = "landing.page_view",
  LANDING_SCROLL_DEPTH = "landing.scroll_depth",
  LANDING_CTA_PRIMARY = "landing.cta_primary",
  LANDING_CTA_SECONDARY = "landing.cta_secondary",
  LANDING_DEMO_START = "landing.demo_start",
  LANDING_DEMO_MESSAGE = "landing.demo_message",
  LANDING_DEMO_LIMIT_REACHED = "landing.demo_limit_reached",
  LANDING_DEMO_SIGNUP = "landing.demo_signup",
  LANDING_FEATURE_CLICK = "landing.feature_click",
  LANDING_PLAN_VIEW = "landing.plan_view",
  LANDING_PLAN_SELECT = "landing.plan_select",

  // Compliance & Safety
  AGE_VERIFICATION_COMPLETED = "age_verification_completed",
  AGE_VERIFICATION_FAILED = "age_verification_failed",
  NSFW_CONSENT_ACCEPTED = "nsfw_consent_accepted",
  NSFW_CONSENT_DECLINED = "nsfw_consent_declined",
  CONTENT_MODERATED = "content_moderated",
  CONTENT_FALSE_POSITIVE = "content_false_positive",
  PII_DETECTED = "pii_detected",
  PII_REDACTED = "pii_redacted",

  // User Experience
  SIGNUP_COMPLETED = "signup_completed",
  FIRST_AGENT_CREATED = "first_agent_created",
  FIRST_MESSAGE_SENT = "first_message_sent",
  PAGE_VIEW = "page_view",
  MOBILE_SESSION = "mobile_session",
  APP_OPENED = "app_opened",

  // Engagement
  SESSION_STARTED = "session_started",
  SESSION_ENDED = "session_ended",
  MESSAGE_SENT = "message_sent",
  COMMAND_PALETTE_OPENED = "command_palette_opened",
  FEATURE_DISCOVERED = "feature_discovered",

  // Monetization
  SUBSCRIPTION_STARTED = "subscription_started",
  SUBSCRIPTION_CANCELLED = "subscription_cancelled",
  PAYMENT_SUCCEEDED = "payment_succeeded",
  PAYMENT_FAILED = "payment_failed",
  UPGRADE_MODAL_VIEWED = "upgrade_modal_viewed",
  UPGRADE_MODAL_CLICKED = "upgrade_modal_clicked",
}

export interface EventMetadata {
  userId?: string;
  agentId?: string;
  sessionId?: string;
  plan?: string;
  previousPlan?: string;
  amount?: number;
  reason?: string;
  moderationType?: string;
  piiType?: string;
  platform?: "web" | "mobile";
  feature?: string;
  duration?: number; // in seconds
  [key: string]: any;
}

// ============================================================================
// EVENT TRACKING
// ============================================================================

/**
 * Records an event in the database for analytics
 */
export async function trackEvent(
  eventType: EventType,
  metadata: EventMetadata = {}
): Promise<void> {
  try {
    // Extract userId and sessionId from metadata to save them in separate columns
    const { userId, sessionId, ...restMetadata } = metadata;

    // If sessionId exists, ensure the UserSession exists
    if (sessionId) {
      await prisma.userSession.upsert({
        where: { sessionId },
        update: {
          lastActivityAt: new Date(),
        },
        create: {
          sessionId,
          userId: userId || null,
          deviceType: metadata.deviceType as string | undefined,
          browser: metadata.browser as string | undefined,
          os: metadata.os as string | undefined,
          userAgent: metadata.userAgent as string | undefined,
          referrer: metadata.referrer as string | undefined,
          utmSource: metadata.utmSource as string | undefined,
          utmMedium: metadata.utmMedium as string | undefined,
          utmCampaign: metadata.utmCampaign as string | undefined,
          startedAt: new Date(),
          lastActivityAt: new Date(),
        },
      });
    }

    await prisma.analyticsEvent.create({
      data: {
        id: nanoid(),
        eventType,
        metadata: restMetadata as any,
        timestamp: new Date(),
        userId: userId || null,
        sessionId: sessionId || null,
      },
    });
  } catch (error) {
    console.error("[KPI Tracker] Error tracking event:", error);
    console.error("[KPI Tracker] Event details:", { eventType, userId: metadata.userId, sessionId: metadata.sessionId });
    // No lanzar error para no romper el flujo principal
  }
}

/**
 * Registra múltiples eventos en batch (más eficiente)
 */
export async function trackEventsBatch(
  events: Array<{ eventType: EventType; metadata: EventMetadata }>
): Promise<void> {
  try {
    await prisma.analyticsEvent.createMany({
      data: events.map((e) => ({
        id: nanoid(),
        eventType: e.eventType,
        metadata: e.metadata as any,
        timestamp: new Date(),
      })),
    });
  } catch (error) {
    console.error("[KPI Tracker] Error tracking events batch:", error);
  }
}

// ============================================================================
// COMPLIANCE & SAFETY METRICS
// ============================================================================

export async function getComplianceMetrics(
  startDate: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  endDate: Date = new Date()
) {
  // Age verification rate
  const [totalSignups, ageVerifications, ageVerificationsFailed] = await Promise.all([
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.SIGNUP_COMPLETED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.AGE_VERIFICATION_COMPLETED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.AGE_VERIFICATION_FAILED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  const ageVerificationRate = totalSignups > 0 ? (ageVerifications / totalSignups) * 100 : 0;

  // NSFW consent rate (for adults only)
  const [nsfwConsentsAccepted, nsfwConsentsDeclined] = await Promise.all([
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.NSFW_CONSENT_ACCEPTED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.NSFW_CONSENT_DECLINED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  const totalNsfwPrompts = nsfwConsentsAccepted + nsfwConsentsDeclined;
  const nsfwConsentRate = totalNsfwPrompts > 0 ? (nsfwConsentsAccepted / totalNsfwPrompts) * 100 : 0;

  // Content moderation stats
  const [contentModerated, contentFalsePositives] = await Promise.all([
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.CONTENT_MODERATED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.CONTENT_FALSE_POSITIVE,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  const falsePositiveRate = contentModerated > 0 ? (contentFalsePositives / contentModerated) * 100 : 0;

  // PII detection stats
  const [piiDetected, piiRedacted] = await Promise.all([
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.PII_DETECTED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.PII_REDACTED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  const piiRedactionRate = piiDetected > 0 ? (piiRedacted / piiDetected) * 100 : 0;

  return {
    ageVerification: {
      total: totalSignups,
      completed: ageVerifications,
      failed: ageVerificationsFailed,
      rate: Math.round(ageVerificationRate * 100) / 100,
      target: 100,
      status: ageVerificationRate >= 99 ? "good" : ageVerificationRate >= 95 ? "warning" : "critical",
    },
    nsfwConsent: {
      total: totalNsfwPrompts,
      accepted: nsfwConsentsAccepted,
      declined: nsfwConsentsDeclined,
      rate: Math.round(nsfwConsentRate * 100) / 100,
      target: 100,
      status: nsfwConsentRate >= 99 ? "good" : nsfwConsentRate >= 95 ? "warning" : "critical",
    },
    moderation: {
      total: contentModerated,
      falsePositives: contentFalsePositives,
      falsePositiveRate: Math.round(falsePositiveRate * 100) / 100,
      target: 0.1,
      status: falsePositiveRate <= 0.1 ? "good" : falsePositiveRate <= 0.5 ? "warning" : "critical",
    },
    piiProtection: {
      detected: piiDetected,
      redacted: piiRedacted,
      rate: Math.round(piiRedactionRate * 100) / 100,
      target: 100,
      status: piiRedactionRate >= 99 ? "good" : piiRedactionRate >= 95 ? "warning" : "critical",
    },
  };
}

// ============================================================================
// USER EXPERIENCE METRICS
// ============================================================================

export async function getUserExperienceMetrics(
  startDate: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate: Date = new Date()
) {
  // Time to first agent (signup → first agent created)
  const signupToAgentTimes = await prisma.$queryRaw<
    Array<{ userId: string; timeToFirstAgent: number }>
  >`
    SELECT
      s.metadata->>'userId' as "userId",
      EXTRACT(EPOCH FROM (a.timestamp - s.timestamp)) as "timeToFirstAgent"
    FROM "AnalyticsEvent" s
    JOIN "AnalyticsEvent" a
      ON s.metadata->>'userId' = a.metadata->>'userId'
      AND a."eventType" = ${EventType.FIRST_AGENT_CREATED}
    WHERE s."eventType" = ${EventType.SIGNUP_COMPLETED}
      AND s.timestamp >= ${startDate}
      AND s.timestamp <= ${endDate}
      AND a.timestamp >= ${startDate}
      AND a.timestamp <= ${endDate}
    ORDER BY "timeToFirstAgent" DESC
  `;

  const avgTimeToFirstAgent = signupToAgentTimes.length > 0
    ? signupToAgentTimes.reduce((sum, t) => sum + Number(t.timeToFirstAgent), 0) / signupToAgentTimes.length / 60
    : 0; // en minutos

  // Signup → First message conversion rate
  const [totalSignups, firstMessages] = await Promise.all([
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.SIGNUP_COMPLETED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.FIRST_MESSAGE_SENT,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  const signupToMessageRate = totalSignups > 0 ? (firstMessages / totalSignups) * 100 : 0;

  // Mobile bounce rate (sessions < 30 seconds)
  const mobileSessions = await prisma.analyticsEvent.findMany({
    where: {
      eventType: EventType.MOBILE_SESSION,
      timestamp: { gte: startDate, lte: endDate },
    },
    select: {
      metadata: true,
    },
  });

  const totalMobileSessions = mobileSessions.length;
  const bouncedSessions = mobileSessions.filter((s: any) => {
    const duration = (s.metadata as any)?.duration || 0;
    return duration < 30;
  }).length;

  const mobileBounceRate = totalMobileSessions > 0 ? (bouncedSessions / totalMobileSessions) * 100 : 0;

  // D7 retention (users who return 7 days after signup)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const cohortSignups = await prisma.analyticsEvent.findMany({
    where: {
      eventType: EventType.SIGNUP_COMPLETED,
      timestamp: { gte: fourteenDaysAgo, lte: sevenDaysAgo },
    },
    select: {
      metadata: true,
    },
  });

  const cohortUserIds = cohortSignups.map((s: any) => (s.metadata as any)?.userId).filter(Boolean);

  const returnedUsers = await prisma.analyticsEvent.count({
    where: {
      eventType: EventType.SESSION_STARTED,
      timestamp: { gte: sevenDaysAgo },
      userId: { in: cohortUserIds },
    },
  });

  const d7Retention = cohortUserIds.length > 0 ? (returnedUsers / cohortUserIds.length) * 100 : 0;

  return {
    timeToFirstAgent: {
      current: Math.round(avgTimeToFirstAgent * 100) / 100,
      baseline: 8,
      target: 3,
      unit: "minutes",
      status: avgTimeToFirstAgent <= 3 ? "good" : avgTimeToFirstAgent <= 5 ? "warning" : "critical",
    },
    signupToMessage: {
      current: Math.round(signupToMessageRate * 100) / 100,
      baseline: 40,
      target: 65,
      unit: "%",
      status: signupToMessageRate >= 65 ? "good" : signupToMessageRate >= 50 ? "warning" : "critical",
    },
    mobileBounce: {
      current: Math.round(mobileBounceRate * 100) / 100,
      baseline: 65,
      target: 40,
      unit: "%",
      status: mobileBounceRate <= 40 ? "good" : mobileBounceRate <= 50 ? "warning" : "critical",
    },
    d7Retention: {
      current: Math.round(d7Retention * 100) / 100,
      baseline: 25,
      target: 35,
      unit: "%",
      status: d7Retention >= 35 ? "good" : d7Retention >= 30 ? "warning" : "critical",
    },
  };
}

// ============================================================================
// ENGAGEMENT METRICS
// ============================================================================

export async function getEngagementMetrics(
  startDate: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate: Date = new Date()
) {
  // Avg messages per session
  const sessions = await prisma.analyticsEvent.findMany({
    where: {
      eventType: EventType.SESSION_STARTED,
      timestamp: { gte: startDate, lte: endDate },
    },
    select: {
      metadata: true,
    },
  });

  const sessionIds = sessions.map((s: any) => (s.metadata as any)?.sessionId).filter(Boolean);

  const messagesPerSession = await Promise.all(
    sessionIds.map(async (sessionId) => {
      const count = await prisma.analyticsEvent.count({
        where: {
          eventType: EventType.MESSAGE_SENT,
          metadata: {
            path: ["sessionId"],
            equals: sessionId,
          },
        },
      });
      return count;
    })
  );

  const avgMessagesPerSession = messagesPerSession.length > 0
    ? messagesPerSession.reduce((sum, count) => sum + count, 0) / messagesPerSession.length
    : 0;

  // Sessions per week (per active user)
  const activeUsers = await prisma.analyticsEvent.findMany({
    where: {
      eventType: EventType.SESSION_STARTED,
      timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), lte: endDate },
    },
    select: {
      metadata: true,
    },
  });

  const userSessionCounts = activeUsers.reduce((acc: Record<string, number>, event: any) => {
    const userId = (event.metadata as any)?.userId;
    if (userId) {
      acc[userId] = (acc[userId] || 0) + 1;
    }
    return acc;
  }, {});

  const avgSessionsPerWeek = Object.keys(userSessionCounts).length > 0
    ? Object.values(userSessionCounts).reduce((sum, count) => sum + count, 0) / Object.keys(userSessionCounts).length
    : 0;

  // Feature discovery (command palette)
  const [totalSessions, commandPaletteOpened] = await Promise.all([
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.SESSION_STARTED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.COMMAND_PALETTE_OPENED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  const commandPaletteDiscoveryRate = totalSessions > 0 ? (commandPaletteOpened / totalSessions) * 100 : 0;

  return {
    avgMessagesPerSession: {
      current: Math.round(avgMessagesPerSession * 100) / 100,
      baseline: 12,
      target: 18,
      status: avgMessagesPerSession >= 18 ? "good" : avgMessagesPerSession >= 15 ? "warning" : "critical",
    },
    sessionsPerWeek: {
      current: Math.round(avgSessionsPerWeek * 100) / 100,
      baseline: 3,
      target: 5,
      status: avgSessionsPerWeek >= 5 ? "good" : avgSessionsPerWeek >= 4 ? "warning" : "critical",
    },
    commandPaletteDiscovery: {
      current: Math.round(commandPaletteDiscoveryRate * 100) / 100,
      baseline: 0,
      target: 15,
      unit: "%",
      status: commandPaletteDiscoveryRate >= 15 ? "good" : commandPaletteDiscoveryRate >= 10 ? "warning" : "critical",
    },
  };
}

// ============================================================================
// MONETIZATION METRICS
// ============================================================================

export async function getMonetizationMetrics(
  startDate: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate: Date = new Date()
) {
  // Free → Plus conversion rate
  const [freeUsers, conversions] = await Promise.all([
    prisma.user.count({
      where: {
        plan: "free",
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.SUBSCRIPTION_STARTED,
        timestamp: { gte: startDate, lte: endDate },
        metadata: {
          path: ["previousPlan"],
          equals: "free",
        },
      },
    }),
  ]);

  const conversionRate = freeUsers > 0 ? (conversions / freeUsers) * 100 : 0;

  // MRR (Monthly Recurring Revenue)
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: "active",
    },
    select: {
      currentPeriodEnd: true,
      metadata: true,
    },
  });

  const mrr = activeSubscriptions.reduce((total, sub: any) => {
    const amount = (sub.metadata as any)?.amount || 0;
    return total + amount;
  }, 0);

  // Churn rate (cancelled subscriptions this month)
  const [totalSubscriptions, cancelledSubscriptions] = await Promise.all([
    prisma.subscription.count({
      where: {
        status: { in: ["active", "cancelled"] },
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.SUBSCRIPTION_CANCELLED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  const churnRate = totalSubscriptions > 0 ? (cancelledSubscriptions / totalSubscriptions) * 100 : 0;

  // Upgrade modal conversion
  const [upgradeModalViews, upgradeModalClicks] = await Promise.all([
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.UPGRADE_MODAL_VIEWED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: EventType.UPGRADE_MODAL_CLICKED,
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  const upgradeModalCtr = upgradeModalViews > 0 ? (upgradeModalClicks / upgradeModalViews) * 100 : 0;

  return {
    conversion: {
      current: Math.round(conversionRate * 100) / 100,
      targetMin: 6,
      targetMax: 12,
      unit: "%",
      status: conversionRate >= 6 ? "good" : conversionRate >= 4 ? "warning" : "critical",
    },
    mrr: {
      current: Math.round(mrr),
      targetMin: 18000,
      targetMax: 48000,
      unit: "$",
      status: mrr >= 18000 ? "good" : mrr >= 10000 ? "warning" : "critical",
    },
    churn: {
      current: Math.round(churnRate * 100) / 100,
      target: 5,
      unit: "%",
      status: churnRate <= 5 ? "good" : churnRate <= 7 ? "warning" : "critical",
    },
    upgradeModalCtr: {
      current: Math.round(upgradeModalCtr * 100) / 100,
      unit: "%",
      status: upgradeModalCtr >= 10 ? "good" : upgradeModalCtr >= 5 ? "warning" : "critical",
    },
  };
}

// ============================================================================
// DASHBOARD SUMMARY
// ============================================================================

export async function getAllKPIs(
  startDate: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate: Date = new Date()
) {
  const [compliance, userExperience, engagement, monetization] = await Promise.all([
    getComplianceMetrics(startDate, endDate),
    getUserExperienceMetrics(startDate, endDate),
    getEngagementMetrics(startDate, endDate),
    getMonetizationMetrics(startDate, endDate),
  ]);

  return {
    compliance,
    userExperience,
    engagement,
    monetization,
    generatedAt: new Date().toISOString(),
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  };
}

// ============================================================================
// ALERTS (for automatic notifications)
// ============================================================================

export async function checkAlerts() {
  const kpis = await getAllKPIs();
  const alerts: Array<{ level: "critical" | "warning"; category: string; metric: string; message: string }> = [];

  // Check compliance alerts
  if (kpis.compliance.ageVerification.status === "critical") {
    alerts.push({
      level: "critical",
      category: "Compliance",
      metric: "Age Verification Rate",
      message: `Age verification rate is ${kpis.compliance.ageVerification.rate}% (target: 100%)`,
    });
  }

  if (kpis.compliance.moderation.status === "critical") {
    alerts.push({
      level: "critical",
      category: "Safety",
      metric: "False Positive Rate",
      message: `Moderation false positive rate is ${kpis.compliance.moderation.falsePositiveRate}% (target: <0.1%)`,
    });
  }

  // Check UX alerts
  if (kpis.userExperience.signupToMessage.status === "critical") {
    alerts.push({
      level: "critical",
      category: "User Experience",
      metric: "Signup to Message Conversion",
      message: `Only ${kpis.userExperience.signupToMessage.current}% of users send their first message (target: 65%)`,
    });
  }

  // Check monetization alerts
  if (kpis.monetization.churn.status === "critical") {
    alerts.push({
      level: "critical",
      category: "Monetization",
      metric: "Churn Rate",
      message: `Churn rate is ${kpis.monetization.churn.current}% (target: <5%)`,
    });
  }

  return alerts;
}
