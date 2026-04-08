/**
 * Proactive Messaging Service
 *
 * Main coordinator for proactive messaging system.
 * Handles detection, generation, and sending of proactive messages.
 */

import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { detectTriggers, updateLastProactiveMessage } from './trigger-detector';
import { generateProactiveMessage } from './message-generator';
import type { ProactiveTrigger } from '@/lib/proactive-behavior/trigger-detector';
import { nanoid } from 'nanoid';

const log = createLogger('ProactiveService');

export interface ProactiveMessageResult {
  success: boolean;
  messageId?: string;
  proactiveMessageId?: string;
  error?: string;
}

export interface ProcessAllAgentsResult {
  totalProcessed: number;
  results: Array<{
    agentId: string;
    userId: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

/**
 * Process proactive messaging for all agents
 * This should be called periodically (e.g., every hour) by a cron job
 */
export async function processAllAgents(): Promise<ProcessAllAgentsResult> {
  log.info('Starting proactive message processing for all agents');

  const results: ProcessAllAgentsResult['results'] = [];

  try {
    // Get all agents with proactive config enabled
    const configs = await prisma.proactiveConfig.findMany({
      where: {
        enabled: true,
      },
      include: {
        Agent: true,
      },
    });

    log.info({ count: configs.length }, 'Found agents with proactive messaging enabled');

    // Process each agent
    for (const config of configs) {
      try {
        const result = await processAgent(config.agentId, config.userId);
        if (result) {
          results.push({
            agentId: config.agentId,
            userId: config.userId,
            ...result,
          });
        }
      } catch (error) {
        log.error(
          { error, agentId: config.agentId, userId: config.userId },
          'Error processing agent'
        );
        results.push({
          agentId: config.agentId,
          userId: config.userId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    log.info('Completed proactive message processing');

    return {
      totalProcessed: configs.length,
      results,
    };
  } catch (error) {
    log.error({ error }, 'Error in processAllAgents');
    return {
      totalProcessed: 0,
      results,
    };
  }
}

/**
 * Process proactive messaging for a single agent
 */
export async function processAgent(
  agentId: string,
  userId: string
): Promise<ProactiveMessageResult | null> {
  log.debug({ agentId, userId }, 'Processing agent for proactive messaging');

  try {
    // Detect triggers
    const triggers = await detectTriggers(agentId, userId);

    if (triggers.length === 0) {
      log.debug({ agentId, userId }, 'No triggers detected');
      return null;
    }

    // Use highest priority trigger
    const trigger = triggers[0];

    log.info(
      { agentId, userId, triggerType: trigger.type, priority: trigger.priority },
      'Trigger detected, generating message'
    );

    // Generate message
    const messageContent = await generateProactiveMessage(agentId, userId, trigger as unknown as ProactiveTrigger);

    // Save proactive message record
    const proactiveMessage = await prisma.proactiveMessage.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        agentId,
        userId,
        triggerType: trigger.type,
        content: messageContent,
        context: trigger.context,
        status: 'pending',
      },
    });

    // Create actual message in chat
    const message = await prisma.message.create({
      data: {
        id: nanoid(),
        agentId,
        role: 'assistant',
        content: messageContent,
        metadata: {
          proactive: true,
          triggerType: trigger.type,
          priority: trigger.priority,
          messageType: 'text',
        },
      },
    });

    // Update proactive message with real message ID and status
    await prisma.proactiveMessage.update({
      where: { id: proactiveMessage.id },
      data: {
        messageId: message.id,
        status: 'sent',
        sentAt: new Date(),
      },
    });

    // Update config's last proactive message timestamp
    await updateLastProactiveMessage(agentId);

    log.info(
      {
        agentId,
        userId,
        messageId: message.id,
        proactiveMessageId: proactiveMessage.id,
      },
      'Proactive message created successfully'
    );

    return {
      success: true,
      messageId: message.id,
      proactiveMessageId: proactiveMessage.id,
    };
  } catch (error) {
    log.error({ error, agentId, userId }, 'Error processing proactive message');

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get proactive message statistics for an agent
 */
export async function getProactiveStats(agentId: string): Promise<any> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [sentLast24h, sentLastWeek, total, responseRate] = await Promise.all([
    prisma.proactiveMessage.count({
      where: {
        agentId,
        status: 'sent',
        sentAt: { gte: oneDayAgo },
      },
    }),
    prisma.proactiveMessage.count({
      where: {
        agentId,
        status: 'sent',
        sentAt: { gte: oneWeekAgo },
      },
    }),
    prisma.proactiveMessage.count({
      where: {
        agentId,
        status: 'sent',
      },
    }),
    prisma.proactiveMessage.count({
      where: {
        agentId,
        status: 'sent',
        userResponded: true,
      },
    }),
  ]);

  return {
    sentLast24h,
    sentLastWeek,
    total,
    responseRate: total > 0 ? (responseRate / total) * 100 : 0,
  };
}

/**
 * Mark proactive message as responded (called when user replies)
 */
export async function markProactiveMessageResponded(messageId: string): Promise<void> {
  // Find proactive message by the message ID
  const proactiveMessage = await prisma.proactiveMessage.findFirst({
    where: { messageId },
  });

  if (proactiveMessage && !proactiveMessage.userResponded) {
    await prisma.proactiveMessage.update({
      where: { id: proactiveMessage.id },
      data: {
        userResponded: true,
        responseAt: new Date(),
      },
    });

    log.info({ messageId, proactiveMessageId: proactiveMessage.id }, 'User responded to proactive message');
  }
}

/**
 * Update proactive config for an agent
 */
export async function updateProactiveConfig(
  agentId: string,
  updates: Partial<{
    enabled: boolean;
    maxMessagesPerDay: number;
    maxMessagesPerWeek: number;
    quietHoursStart: number;
    quietHoursEnd: number;
    inactivityEnabled: boolean;
    inactivityDays: number;
    eventRemindersEnabled: boolean;
    eventReminderHours: number;
    emotionalCheckInEnabled: boolean;
  }>
): Promise<any> {
  return prisma.proactiveConfig.update({
    where: { agentId },
    data: updates,
  });
}
