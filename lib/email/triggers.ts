/**
 * Email Sequence Triggers
 *
 * Helper functions to trigger email sequences based on user events
 */

import { prisma } from '@/lib/prisma';
import { triggerSequence } from './sequences/sequence.service';
import type { TriggerEvent } from './types';

/**
 * Trigger welcome sequence on user signup
 */
export async function triggerWelcomeSequence(userId: string) {
  await triggerSequence({
    event: 'signup',
    userId,
    metadata: {
      triggeredAt: new Date(),
      source: 'signup',
    },
  });
}

/**
 * Check and trigger reactivation sequences for inactive users
 * Called by cron job daily
 */
export async function checkInactiveUsers() {
  const now = new Date();
  const thresholds = [
    { days: 7, event: 'inactive_7d' as TriggerEvent },
    { days: 14, event: 'inactive_14d' as TriggerEvent },
    { days: 21, event: 'inactive_21d' as TriggerEvent },
    { days: 30, event: 'inactive_30d' as TriggerEvent },
  ];

  for (const { days, event } of thresholds) {
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Find users who haven't been active since cutoff
    const inactiveUsers = await prisma.user.findMany({
      where: {
        updatedAt: {
          lte: cutoffDate,
        },
        // TODO: Re-enable when emailsSent model is added to schema
        // Don't send to users who already got this email
        // emailsSent: {
        //   none: {
        //     sequence: {
        //       triggerEvent: event,
        //     },
        //     sentAt: {
        //       gte: cutoffDate,
        //     },
        //   },
        // },
      },
      select: {
        id: true,
        email: true,
      },
      take: 100, // Process 100 at a time
    });

    for (const user of inactiveUsers) {
      await triggerSequence({
        event,
        userId: user.id,
        metadata: {
          daysInactive: days,
          triggeredAt: now,
        },
      });
    }

    console.log(`✅ Triggered ${event} for ${inactiveUsers.length} users`);
  }
}

/**
 * Trigger upgrade nudge when user reaches message limit
 */
export async function triggerUpgradeNudge(userId: string, reason: 'limit_90' | 'limit_100') {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
    },
  });

  if (!user || user.plan !== 'free') return;

  // Get current usage (simplified - would need to implement proper usage tracking)
  const messagesUsed = 90; // TODO: Implement proper usage tracking
  const messagesLimit = 100; // Free tier limit

  await triggerSequence({
    event: reason === 'limit_90' ? 'limit_reached_90' : 'limit_reached_100',
    userId,
    metadata: {
      messagesUsed,
      messagesLimit,
      triggeredAt: new Date(),
    },
  });
}

/**
 * Trigger trial ending sequence
 */
export async function triggerTrialEndingSequence(userId: string, daysUntilEnd: 3 | 1 | -1) {
  const events: Record<number, TriggerEvent> = {
    3: 'trial_ending_3d',
    1: 'trial_ending_1d',
    '-1': 'trial_ended',
  };

  const event = events[daysUntilEnd];
  if (!event) return;

  await triggerSequence({
    event,
    userId,
    metadata: {
      daysUntilEnd,
      triggeredAt: new Date(),
    },
  });
}

/**
 * Check trial subscriptions and trigger ending sequences
 * Called by cron job daily
 */
export async function checkTrialSubscriptions() {
  const now = new Date();

  // Check for trials ending in 3 days
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const trialsEnding3Days = await prisma.subscription.findMany({
    where: {
      status: 'trialing',
      trialEnd: {
        gte: now,
        lte: threeDaysFromNow,
      },
    },
    select: {
      userId: true,
    },
  });

  for (const sub of trialsEnding3Days) {
    await triggerTrialEndingSequence(sub.userId, 3);
  }

  // Check for trials ending tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const trialsEnding1Day = await prisma.subscription.findMany({
    where: {
      status: 'trialing',
      trialEnd: {
        gte: now,
        lte: tomorrow,
      },
    },
    select: {
      userId: true,
    },
  });

  for (const sub of trialsEnding1Day) {
    await triggerTrialEndingSequence(sub.userId, 1);
  }

  // Check for trials that ended yesterday (downgraded)
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const trialsEnded = await prisma.subscription.findMany({
    where: {
      status: 'active',
      trialEnd: {
        gte: yesterday,
        lte: now,
      },
      // User is now on free plan
      User: {
        plan: 'free',
      },
    },
    include: {
      User: {
        select: {
          id: true,
        },
      },
    },
  });

  for (const sub of trialsEnded) {
    await triggerTrialEndingSequence(sub.User.id, -1);
  }

  console.log(
    `✅ Trial checks: ${trialsEnding3Days.length} (3d), ${trialsEnding1Day.length} (1d), ${trialsEnded.length} (ended)`
  );
}

/**
 * Trigger feature announcement email to all active users
 */
export async function triggerFeatureAnnouncement(
  featureName: string,
  targetPlans: ('free' | 'plus' | 'ultra')[] = []
) {
  const users = await prisma.user.findMany({
    where: targetPlans.length > 0
      ? {
          plan: {
            in: targetPlans,
          },
        }
      : {},
    select: {
      id: true,
    },
    take: 1000, // Process 1000 at a time
  });

  for (const user of users) {
    await triggerSequence({
      event: 'first_conversation', // Use generic event, customize in sequence
      userId: user.id,
      metadata: {
        featureName,
        triggeredAt: new Date(),
      },
    });
  }

  console.log(`✅ Triggered feature announcement for ${users.length} users`);
}

/**
 * Auto-trigger email on message send (for limit checks)
 */
export async function checkMessageLimits(userId: string, messageCount: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  if (!user || user.plan !== 'free') return;

  const limit = 100;
  const percentage = (messageCount / limit) * 100;

  // Trigger at 90%
  if (percentage >= 90 && percentage < 100) {
    await triggerUpgradeNudge(userId, 'limit_90');
  }

  // Trigger at 100%
  if (percentage >= 100) {
    await triggerUpgradeNudge(userId, 'limit_100');
  }
}
