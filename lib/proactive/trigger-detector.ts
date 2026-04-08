/**
 * Proactive Message Trigger Detector
 *
 * Detects situations where the agent should take initiative and send
 * a proactive message to the user.
 *
 * Triggers:
 * 1. Inactivity - User hasn't messaged in X days
 * 2. Event Reminder - Important event coming up soon
 * 3. Emotional Check-in - Last conversation was emotionally difficult
 * 4. Conversation Follow-up - Previous conversation had unresolved topic
 */

import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

import { nanoid } from 'nanoid';

const log = createLogger('TriggerDetector');

export interface ProactiveTrigger {
  type: 'inactivity' | 'event_reminder' | 'emotional_checkin' | 'conversation_followup';
  priority: 'low' | 'medium' | 'high' | 'critical';
  context: any; // Additional context for message generation
  reason: string; // Human-readable reason for debugging
}

/**
 * Check if agent should send a proactive message to user
 * Returns triggers that should be acted upon
 */
export async function detectTriggers(
  agentId: string,
  userId: string
): Promise<ProactiveTrigger[]> {
  const triggers: ProactiveTrigger[] = [];

  // Get agent's proactive config
  let config = await prisma.proactiveConfig.findUnique({
    where: { agentId },
  });

  // Create default config if doesn't exist
  if (!config) {
    config = await prisma.proactiveConfig.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        agentId,
        userId,
      },
    });
  }

  // Skip if proactive messaging is disabled
  if (!config.enabled) {
    log.debug({ agentId, userId }, 'Proactive messaging disabled for agent');
    return [];
  }

  // Check rate limits
  const rateLimitOk = await checkRateLimits(agentId, userId, config);
  if (!rateLimitOk) {
    log.debug({ agentId, userId }, 'Rate limit reached, skipping triggers');
    return [];
  }

  // Check quiet hours
  if (isQuietHours(config)) {
    log.debug({ agentId, userId }, 'Currently in quiet hours, skipping triggers');
    return [];
  }

  // Check each trigger type
  if (config.inactivityEnabled) {
    const inactivityTrigger = await checkInactivity(agentId, userId, config.inactivityDays);
    if (inactivityTrigger) {
      triggers.push(inactivityTrigger);
    }
  }

  if (config.eventRemindersEnabled) {
    const eventTriggers = await checkEventReminders(agentId, userId, config.eventReminderHours);
    triggers.push(...eventTriggers);
  }

  if (config.emotionalCheckInEnabled) {
    const emotionalTrigger = await checkEmotionalCheckIn(agentId, userId);
    if (emotionalTrigger) {
      triggers.push(emotionalTrigger);
    }
  }

  // Sort by priority
  triggers.sort((a, b) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  log.info(
    { agentId, userId, triggerCount: triggers.length },
    'Detected proactive triggers'
  );

  return triggers;
}

/**
 * Check if user has been inactive for configured days
 */
async function checkInactivity(
  agentId: string,
  userId: string,
  inactivityDays: number
): Promise<ProactiveTrigger | null> {
  const lastMessage = await prisma.message.findFirst({
    where: {
      agentId,
      role: 'user', // Last USER message (not assistant)
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!lastMessage) {
    return null; // No messages yet
  }

  const daysSinceLastMessage = Math.floor(
    (Date.now() - lastMessage.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastMessage >= inactivityDays) {
    return {
      type: 'inactivity',
      priority: 'medium',
      context: {
        lastMessageDate: lastMessage.createdAt,
        daysSinceLastMessage,
      },
      reason: `User inactive for ${daysSinceLastMessage} days`,
    };
  }

  return null;
}

/**
 * Check for upcoming important events that should be reminded
 */
async function checkEventReminders(
  agentId: string,
  userId: string,
  reminderHours: number
): Promise<ProactiveTrigger[]> {
  const triggers: ProactiveTrigger[] = [];

  // Get events in the reminder window
  const now = new Date();
  const reminderWindow = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);

  const upcomingEvents = await prisma.importantEvent.findMany({
    where: {
      agentId,
      userId,
      eventDate: {
        gte: now,
        lte: reminderWindow,
      },
      mentioned: false, // Only events not yet mentioned
      eventHappened: false,
    },
    orderBy: {
      eventDate: 'asc',
    },
  });

  for (const event of upcomingEvents) {
    const hoursUntil = Math.floor(
      (event.eventDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    // Determine priority based on event priority and time until event
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    if (event.priority === 'critical') {
      priority = 'critical';
    } else if (event.priority === 'high' || hoursUntil <= 4) {
      priority = 'high';
    } else if (hoursUntil <= 12) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    triggers.push({
      type: 'event_reminder',
      priority,
      context: {
        event,
        hoursUntil,
      },
      reason: `Event "${event.description}" in ${hoursUntil} hours`,
    });
  }

  return triggers;
}

/**
 * Check if last conversation was emotionally difficult and needs follow-up
 */
async function checkEmotionalCheckIn(
  agentId: string,
  userId: string
): Promise<ProactiveTrigger | null> {
  // Get last few messages
  const recentMessages = await prisma.message.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (recentMessages.length === 0) {
    return null;
  }

  const lastMessage = recentMessages[0];

  // Check if last conversation happened 1-2 days ago
  const hoursSinceLastMessage = Math.floor(
    (Date.now() - lastMessage.createdAt.getTime()) / (1000 * 60 * 60)
  );

  if (hoursSinceLastMessage < 24 || hoursSinceLastMessage > 48) {
    return null; // Too soon or too late
  }

  // Check if any recent message has negative emotional metadata
  const hasNegativeEmotion = recentMessages.some(msg => {
    if (!msg.metadata || typeof msg.metadata !== 'object') return false;
    const metadata = msg.metadata as any;

    // Check various emotional indicators
    const emotions = metadata.emotions || metadata.emotion;
    if (typeof emotions === 'string') {
      return ['sad', 'anxious', 'fearful', 'angry', 'distressed'].some(e =>
        emotions.toLowerCase().includes(e)
      );
    }

    return false;
  });

  if (hasNegativeEmotion) {
    return {
      type: 'emotional_checkin',
      priority: 'high',
      context: {
        lastMessageDate: lastMessage.createdAt,
        hoursSinceLastMessage,
      },
      reason: `User had difficult conversation ${hoursSinceLastMessage}h ago`,
    };
  }

  return null;
}

/**
 * Check rate limits (messages per day/week)
 */
async function checkRateLimits(
  agentId: string,
  userId: string,
  config: any
): Promise<boolean> {
  const now = new Date();

  // Check daily limit
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const messagesLast24h = await prisma.proactiveMessage.count({
    where: {
      agentId,
      userId,
      status: 'sent',
      sentAt: {
        gte: oneDayAgo,
      },
    },
  });

  if (messagesLast24h >= config.maxMessagesPerDay) {
    log.debug(
      { agentId, userId, messagesLast24h, limit: config.maxMessagesPerDay },
      'Daily rate limit reached'
    );
    return false;
  }

  // Check weekly limit
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const messagesLastWeek = await prisma.proactiveMessage.count({
    where: {
      agentId,
      userId,
      status: 'sent',
      sentAt: {
        gte: oneWeekAgo,
      },
    },
  });

  if (messagesLastWeek >= config.maxMessagesPerWeek) {
    log.debug(
      { agentId, userId, messagesLastWeek, limit: config.maxMessagesPerWeek },
      'Weekly rate limit reached'
    );
    return false;
  }

  return true;
}

/**
 * Check if currently in quiet hours
 */
function isQuietHours(config: any): boolean {
  if (!config.quietHoursStart || !config.quietHoursEnd) {
    return false; // No quiet hours configured
  }

  const now = new Date();
  const currentHour = now.getHours();

  const start = config.quietHoursStart;
  const end = config.quietHoursEnd;

  // Handle quiet hours that span midnight
  if (start > end) {
    return currentHour >= start || currentHour < end;
  } else {
    return currentHour >= start && currentHour < end;
  }
}

/**
 * Get configuration for an agent (create if doesn't exist)
 */
export async function getOrCreateProactiveConfig(
  agentId: string,
  userId: string
): Promise<any> {
  let config = await prisma.proactiveConfig.findUnique({
    where: { agentId },
  });

  if (!config) {
    config = await prisma.proactiveConfig.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        agentId,
        userId,
      },
    });
  }

  return config;
}

/**
 * Update config's last proactive message timestamp
 */
export async function updateLastProactiveMessage(agentId: string): Promise<void> {
  await prisma.proactiveConfig.update({
    where: { agentId },
    data: {
      lastProactiveMessage: new Date(),
    },
  });
}
