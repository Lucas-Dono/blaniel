/**
 * REMEMBER Command Interceptor
 *
 * Detects [REMEMBER:...] commands in AI responses and saves important events.
 * Similar to knowledge-interceptor but for temporal events.
 *
 * Command format:
 * [REMEMBER:2025-10-23|medical|Cirugía de Max (perro)|high]
 * [REMEMBER:2025-03-15|birthday|Cumpleaños del usuario|critical]
 *
 * Parts: date|type|description|priority
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';

const log = createLogger('RememberInterceptor');

// Regex to detect REMEMBER commands
const REMEMBER_PATTERN = /\[REMEMBER:([^\]]+)\]/g;

export interface RememberCommand {
  raw: string;
  date: Date;
  type: string;
  description: string;
  priority: string;
}

export interface RememberInterceptResult {
  shouldIntercept: boolean;
  commands: RememberCommand[];
  cleanResponse: string; // Response with [REMEMBER:...] removed
}

/**
 * Extract REMEMBER commands from AI response
 */
export async function interceptRememberCommands(
  agentId: string,
  userId: string,
  response: string
): Promise<RememberInterceptResult> {
  const matches = Array.from(response.matchAll(REMEMBER_PATTERN));

  if (matches.length === 0) {
    return {
      shouldIntercept: false,
      commands: [],
      cleanResponse: response,
    };
  }

  const commands: RememberCommand[] = [];

  for (const match of matches) {
    try {
      const commandStr = match[1];
      const parts = commandStr.split('|').map(p => p.trim());

      if (parts.length < 3) {
        log.warn({ commandStr }, 'Invalid REMEMBER command: not enough parts');
        continue;
      }

      const [dateStr, type, description, priority = 'medium'] = parts;

      // Parse date (supports multiple formats)
      const date = parseEventDate(dateStr);

      if (!date) {
        log.warn({ dateStr }, 'Invalid REMEMBER command: could not parse date');
        continue;
      }

      commands.push({
        raw: match[0],
        date,
        type,
        description,
        priority,
      });
    } catch (error) {
      log.warn({ error, match: match[0] }, 'Error parsing REMEMBER command');
    }
  }

  // Save all valid commands to database
  if (commands.length > 0) {
    await saveRememberCommands(agentId, userId, commands);
  }

  // Remove commands from response
  const cleanResponse = response.replace(REMEMBER_PATTERN, '').trim();

  return {
    shouldIntercept: true,
    commands,
    cleanResponse,
  };
}

/**
 * Parse date from various formats
 */
function parseEventDate(dateStr: string): Date | null {
  try {
    // Format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(dateStr + 'T12:00:00Z'); // Noon UTC to avoid timezone issues
    }

    // Format: DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/');
      return new Date(`${year}-${month}-${day}T12:00:00Z`);
    }

    // Relative dates: "tomorrow", "in 3 days", "next week"
    if (dateStr.toLowerCase() === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      return tomorrow;
    }

    if (dateStr.toLowerCase().includes('in') && dateStr.toLowerCase().includes('day')) {
      const match = dateStr.match(/in\s+(\d+)\s+days?/i);
      if (match) {
        const days = parseInt(match[1]);
        const future = new Date();
        future.setDate(future.getDate() + days);
        future.setHours(12, 0, 0, 0);
        return future;
      }
    }

    // Try ISO format as fallback
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Save REMEMBER commands to database
 */
async function saveRememberCommands(
  agentId: string,
  userId: string,
  commands: RememberCommand[]
): Promise<void> {
  try {
    // Save all commands in parallel
    await Promise.all(
      commands.map(cmd => {
        // Detect if event should be recurring (birthdays and anniversaries)
        const isRecurring = cmd.type === 'birthday' || cmd.type === 'anniversary';

        const data: any = {
          agentId,
          userId,
          eventDate: cmd.date,
          type: cmd.type,
          description: cmd.description,
          priority: cmd.priority,
          mentioned: false,
          eventHappened: false,
          isRecurring,
        };

        // If recurring, store day/month for auto-renewal
        if (isRecurring) {
          data.recurringDay = cmd.date.getDate();
          data.recurringMonth = cmd.date.getMonth() + 1; // JavaScript months are 0-indexed
        }

        return prisma.importantEvent.create({ data });
      })
    );

    log.info(
      { agentId, userId, count: commands.length },
      'Saved REMEMBER commands to database'
    );
  } catch (error) {
    log.error({ error, agentId, userId }, 'Failed to save REMEMBER commands');
  }
}

/**
 * Get upcoming events for an agent/user
 */
export async function getUpcomingEvents(
  agentId: string,
  userId: string,
  daysAhead: number = 7
): Promise<any[]> {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return prisma.importantEvent.findMany({
    where: {
      agentId,
      userId,
      eventDate: {
        gte: now,
        lte: futureDate,
      },
      eventHappened: false,
    },
    orderBy: {
      eventDate: 'asc',
    },
  });
}

/**
 * Get recent past events that haven't been mentioned yet
 */
export async function getRecentPastEvents(
  agentId: string,
  userId: string,
  daysAgo: number = 3
): Promise<any[]> {
  const now = new Date();
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - daysAgo);

  return prisma.importantEvent.findMany({
    where: {
      agentId,
      userId,
      eventDate: {
        gte: pastDate,
        lt: now,
      },
      mentioned: false,
      eventHappened: false,
    },
    orderBy: {
      eventDate: 'desc',
    },
  });
}

/**
 * Mark event as mentioned
 */
export async function markEventAsMentioned(eventId: string): Promise<void> {
  await prisma.importantEvent.update({
    where: { id: eventId },
    data: {
      mentioned: true,
      reminderSentAt: new Date(),
    },
  });
}

/**
 * Build reminder context for system prompt
 * Includes upcoming and recent past events that should be mentioned
 */
export async function buildReminderContext(
  agentId: string,
  userId: string,
  relationshipStage: string
): Promise<string> {
  // First, check and renew any past recurring events
  await checkAndRenewPastRecurringEvents(agentId, userId);

  // Get upcoming events (next 7 days)
  const upcoming = await getUpcomingEvents(agentId, userId, 7);

  // Get recent past events (last 2 days) that haven't been mentioned
  const recentPast = await getRecentPastEvents(agentId, userId, 2);

  if (upcoming.length === 0 && recentPast.length === 0) {
    return '';
  }

  let context = '\n\n## Recordatorios de Eventos Importantes\n';

  // Events that already happened
  if (recentPast.length > 0) {
    context += '\n**Eventos recientes que debes preguntar cómo fueron:**\n';
    for (const event of recentPast) {
      const daysAgo = Math.floor(
        (Date.now() - event.eventDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const when = daysAgo === 0 ? 'hoy' : daysAgo === 1 ? 'ayer' : `hace ${daysAgo} días`;

      context += `- ${event.description} (${when}) [${event.priority}]\n`;

      if (shouldShowReminderGuidance(relationshipStage, event)) {
        context += `  Guía: Pregunta cómo fue de manera ${getEventToneGuidance(relationshipStage)}\n`;
      }
    }
  }

  // Upcoming events
  if (upcoming.length > 0) {
    context += '\n**Eventos próximos que puedes mencionar si es relevante:**\n';
    for (const event of upcoming) {
      const daysUntil = Math.ceil(
        (event.eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      const when =
        daysUntil === 0
          ? 'hoy'
          : daysUntil === 1
          ? 'mañana'
          : `en ${daysUntil} días`;

      context += `- ${event.description} (${when}) [${event.priority}]\n`;

      if (event.priority === 'critical' || event.priority === 'high') {
        if (daysUntil <= 1 && shouldShowReminderGuidance(relationshipStage, event)) {
          context += `  Guía: Menciona con empatía, ofrece apoyo\n`;
        }
      }
    }
  }

  context +=
    '\nUSO: Solo menciona estos eventos si es apropiado para el contexto de la conversación y tu nivel de intimidad con el usuario. No los fuerces.';

  return context;
}

/**
 * Determine if reminder guidance should be shown based on relationship stage
 */
function shouldShowReminderGuidance(relationshipStage: string, event: any): boolean {
  const stageRank = STAGE_RANKS[relationshipStage.toLowerCase()] || 0;

  // Critical events can be mentioned at acquaintance level
  if (event.priority === 'critical') {
    return stageRank >= STAGE_RANKS['acquaintance'];
  }

  // High priority events at friend level
  if (event.priority === 'high') {
    return stageRank >= STAGE_RANKS['friend'];
  }

  // Other events at intimate level
  return stageRank >= STAGE_RANKS['intimate'];
}

/**
 * Get tone guidance based on relationship stage
 */
function getEventToneGuidance(relationshipStage: string): string {
  const stage = relationshipStage.toLowerCase();

  switch (stage) {
    case 'stranger':
      return 'casual y breve';
    case 'acquaintance':
      return 'amigable pero no invasiva';
    case 'friend':
      return 'cálida y con interés genuino';
    case 'intimate':
      return 'cercana y con conexión emocional';
    default:
      return 'apropiada';
  }
}

const STAGE_RANKS: Record<string, number> = {
  stranger: 0,
  acquaintance: 1,
  friend: 2,
  intimate: 3,
};

/**
 * Renew recurring events (birthdays, anniversaries) for next year
 * Should be called periodically or when past events are detected
 */
export async function renewRecurringEvents(): Promise<void> {
  const now = new Date();

  try {
    // Find past recurring events that haven't been renewed yet
    const pastRecurringEvents = await prisma.importantEvent.findMany({
      where: {
        isRecurring: true,
        eventDate: {
          lt: now, // Event already happened
        },
      },
    });

    if (pastRecurringEvents.length === 0) {
      log.debug('No recurring events to renew');
      return;
    }

    // Create next year's occurrence for each event
    const renewals = pastRecurringEvents.map(event => {
      const nextYear = now.getFullYear() + 1;
      const nextDate = new Date(
        nextYear,
        (event.recurringMonth || 1) - 1, // Convert back to 0-indexed
        event.recurringDay || 1,
        12,
        0,
        0,
        0
      );

      return prisma.importantEvent.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          agentId: event.agentId,
          userId: event.userId,
          eventDate: nextDate,
          type: event.type,
          description: event.description,
          priority: event.priority,
          isRecurring: true,
          recurringDay: event.recurringDay,
          recurringMonth: event.recurringMonth,
          relationship: event.relationship,
          emotionalTone: event.emotionalTone,
          mentioned: false,
          eventHappened: false,
        },
      });
    });

    await Promise.all(renewals);

    log.info(
      { count: renewals.length },
      'Renewed recurring events for next year'
    );
  } catch (error) {
    log.error({ error }, 'Failed to renew recurring events');
  }
}

/**
 * Mark past events that should be renewed and create next year's occurrence
 * Call this when building reminder context to ensure events are up to date
 */
export async function checkAndRenewPastRecurringEvents(
  agentId: string,
  userId: string
): Promise<void> {
  const now = new Date();

  try {
    // Find past recurring events for this agent/user
    const pastRecurringEvents = await prisma.importantEvent.findMany({
      where: {
        agentId,
        userId,
        isRecurring: true,
        eventDate: {
          lt: now,
        },
      },
    });

    if (pastRecurringEvents.length === 0) {
      return;
    }

    // Check if next year's occurrence already exists
    for (const event of pastRecurringEvents) {
      const nextYear = now.getFullYear() + 1;
      const nextDate = new Date(
        nextYear,
        (event.recurringMonth || 1) - 1,
        event.recurringDay || 1,
        12,
        0,
        0,
        0
      );

      // Check if already exists
      const existing = await prisma.importantEvent.findFirst({
        where: {
          agentId,
          userId,
          eventDate: nextDate,
          type: event.type,
          description: event.description,
        },
      });

      if (!existing) {
        // Create next year's occurrence
        await prisma.importantEvent.create({
          data: {
            id: nanoid(),
            updatedAt: new Date(),
            agentId: event.agentId,
            userId: event.userId,
            eventDate: nextDate,
            type: event.type,
            description: event.description,
            priority: event.priority,
            isRecurring: true,
            recurringDay: event.recurringDay,
            recurringMonth: event.recurringMonth,
            relationship: event.relationship,
            emotionalTone: event.emotionalTone,
            mentioned: false,
            eventHappened: false,
          },
        });

        log.info(
          { agentId, userId, description: event.description, nextDate },
          'Created next year occurrence for recurring event'
        );
      }

      // Mark old event as happened
      await prisma.importantEvent.update({
        where: { id: event.id },
        data: { eventHappened: true },
      });
    }
  } catch (error) {
    log.error({ error, agentId, userId }, 'Failed to check and renew recurring events');
  }
}
