/**
 * TRIGGER DETECTOR - Intelligent trigger detection system
 * 
 * Detects when and why an agent should start a proactive conversation.
 * 
 * Supported triggers:
 * - Prolonged silence (based on relationship)
 * - Unresolved topics (follow-ups)
 * - Important Life Events
 * - Prolonged negative emotional states
 * - User achievements and celebrations
 * - Special dates (birthdays, anniversaries)
 */

import { prisma } from '@/lib/prisma';
import { PlutchikEmotionState } from '@/lib/emotions/plutchik';


export type TriggerType =
  | 'inactivity'
  | 'follow_up'
  | 'emotional_checkin'
  | 'celebration'
  | 'life_event'
  | 'special_date';

export interface ProactiveTrigger {
  type: TriggerType;
  priority: number; // 0-1
  reason: string;
  context: TriggerContext;
}

export interface TriggerContext {
  // Time
  hoursSinceLastMessage?: number;
  daysSinceLastMessage?: number;

  // Relationship
  relationshipStage?: string;
  messageCount?: number;

  // Emotional context
  lastEmotion?: PlutchikEmotionState;
  emotionDuration?: number; // hours with that emotion

  // Life Events
  event?: any;
  hoursUntil?: number;

  // Follow-up
  unresolvedTopic?: any;

  // Celebration
  achievement?: any;
  milestone?: string;
}

/** Silence thresholds based on relationship */
const INACTIVITY_THRESHOLDS = {
  stranger: 72, // 3 days
  acquaintance: 48, // 2 days
  friend: 24, // 1 day
  close_friend: 12, // 12 hours
};

/** Minimum cooldown between proactive messages (12h) */
const PROACTIVE_COOLDOWN_HOURS = 12;

export class TriggerDetector {
  /** Detects if a conversation should be started and why */
  async detectTriggers(
    agentId: string,
    userId: string
  ): Promise<ProactiveTrigger[]> {
    const triggers: ProactiveTrigger[] = [];

    // Verificar cooldown global de mensajes proactivos
    const recentProactive = await this.hasRecentProactiveMessage(agentId, userId);
    if (recentProactive) {
      console.log(
        '[TriggerDetector] Cooldown activo - no generar nuevos triggers'
      );
      return [];
    }

    // 1. Detectar inactividad
    const inactivityTrigger = await this.detectInactivity(agentId, userId);
    if (inactivityTrigger) triggers.push(inactivityTrigger);

    // 2. Detectar topics pendientes de follow-up
    const followUpTrigger = await this.detectFollowUpNeeded(agentId, userId);
    if (followUpTrigger) triggers.push(followUpTrigger);

    // 3. Detectar necesidad de check-in emocional
    const emotionalTrigger = await this.detectEmotionalNeed(agentId, userId);
    if (emotionalTrigger) triggers.push(emotionalTrigger);

    // 4. Detect upcoming life events
    const lifeEventTrigger = await this.detectUpcomingLifeEvent(agentId, userId);
    if (lifeEventTrigger) triggers.push(lifeEventTrigger);

    // 5. Detectar logros/celebraciones
    const celebrationTrigger = await this.detectUserMilestone(agentId, userId);
    if (celebrationTrigger) triggers.push(celebrationTrigger);

    // Ordenar por prioridad
    triggers.sort((a, b) => b.priority - a.priority);

    return triggers;
  }

  /** Verifies if the agent recently sent a proactive message */
  private async hasRecentProactiveMessage(
    agentId: string,
    userId: string
  ): Promise<boolean> {
    const cooldownDate = new Date();
    cooldownDate.setHours(cooldownDate.getHours() - PROACTIVE_COOLDOWN_HOURS);

    const recentProactive = await prisma.message.findFirst({
      where: {
        agentId,
        role: 'assistant',
        createdAt: { gte: cooldownDate },
        metadata: {
          path: ['proactive'],
          equals: true,
        },
      },
    });

    return !!recentProactive;
  }

  /** Detects if there is enough inactivity to start a conversation */
  async detectInactivity(
    agentId: string,
    userId: string
  ): Promise<ProactiveTrigger | null> {
    const lastMessage = await prisma.message.findFirst({
      where: {
        agentId,
        OR: [{ userId, role: 'user' }, { role: 'assistant' }],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastMessage) return null;

    const hoursSince =
      (Date.now() - lastMessage.createdAt.getTime()) / (1000 * 60 * 60);
    const daysSince = hoursSince / 24;

    // Get relationship stage
    const relation = await prisma.relation.findFirst({
      where: {
        subjectId: agentId,
        targetId: userId,
      },
    });

    const stage = relation?.stage || 'stranger';
    const threshold = INACTIVITY_THRESHOLDS[stage as keyof typeof INACTIVITY_THRESHOLDS] || 72;

    // Si no ha pasado suficiente tiempo, no trigger
    if (hoursSince < threshold) {
      return null;
    }

    // Calcular prioridad basada en:
    // - Tiempo transcurrido sobre el threshold
    // - Relationship closeness
    const timeOverThreshold = hoursSince - threshold;
    let priority = Math.min(0.9, timeOverThreshold / threshold);

    // Bonus for close relationship
    if (stage === 'close_friend') priority += 0.1;
    if (stage === 'friend') priority += 0.05;

    // Verify if last conversation was positive
    const wasPositive = await this.wasLastConversationPositive(agentId);
    if (wasPositive) priority += 0.1;

    priority = Math.min(1.0, priority);

    return {
      type: 'inactivity',
      priority,
      reason: `${daysSince.toFixed(1)} días de silencio (threshold: ${(threshold / 24).toFixed(1)} días)`,
      context: {
        hoursSinceLastMessage: hoursSince,
        daysSinceLastMessage: daysSince,
        relationshipStage: stage,
      },
    };
  }

  /**
   * Detecta si hay topics pendientes de follow-up
   */
  async detectFollowUpNeeded(
    agentId: string,
    userId: string
  ): Promise<ProactiveTrigger | null> {
    const internalState = await prisma.internalState.findUnique({
      where: { agentId },
    });

    if (!internalState) return null;

    const unresolvedTopics = (internalState.conversationBuffer as any[]) || [];

    // Buscar topics que necesiten follow-up
    for (const topic of unresolvedTopics) {
      if (topic.resolved) continue;
      if (topic.followUpAttempts >= 2) continue; // Max 2 intentos

      const mentionedAt = new Date(topic.mentionedAt);
      const hoursSince = (Date.now() - mentionedAt.getTime()) / (1000 * 60 * 60);

      // If it has expected resolution date, verify
      if (topic.expectedResolutionDate) {
        const expectedDate = new Date(topic.expectedResolutionDate);
        const hoursUntilExpected =
          (expectedDate.getTime() - Date.now()) / (1000 * 60 * 60);

        // If expected date already passed, high priority
        if (hoursUntilExpected <= 0 && hoursUntilExpected >= -48) {
          // Within 2 days after
          return {
            type: 'follow_up',
            priority: 0.85 + topic.importance * 0.15,
            reason: `Follow-up de "${topic.topic}" (fecha esperada pasó)`,
            context: {
              unresolvedTopic: topic,
            },
          };
        }

        // If close to the date (24h before to 12h after)
        if (hoursUntilExpected >= -12 && hoursUntilExpected <= 24) {
          return {
            type: 'follow_up',
            priority: 0.75 + topic.importance * 0.15,
            reason: `Follow-up de "${topic.topic}" (fecha esperada cercana)`,
            context: {
              unresolvedTopic: topic,
            },
          };
        }
      }

      // If enough time has passed since the mention (48h+)
      if (hoursSince >= 48 && topic.importance >= 0.6) {
        return {
          type: 'follow_up',
          priority: 0.65 + topic.importance * 0.15,
          reason: `Follow-up de "${topic.topic}" (${(hoursSince / 24).toFixed(1)} días desde mención)`,
          context: {
            unresolvedTopic: topic,
          },
        };
      }
    }

    return null;
  }

  /**
   * Detecta si usuario necesita check-in emocional
   */
  async detectEmotionalNeed(
    agentId: string,
    userId: string
  ): Promise<ProactiveTrigger | null> {
    // Get last conversation
    const lastUserMessage = await prisma.message.findFirst({
      where: {
        agentId,
        userId,
        role: 'user',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastUserMessage) return null;

    const hoursSince =
      (Date.now() - lastUserMessage.createdAt.getTime()) / (1000 * 60 * 60);

    // Check if last message had negative emotion
    const emotionData = (lastUserMessage.metadata as any)?.emotions;
    if (!emotionData) return null;

    const negativeEmotions = ['sadness', 'fear', 'anger', 'disgust'];
    const dominantEmotion = this.getDominantEmotion(emotionData);

    // If last emotion was negative and 24-72h have passed
    if (
      negativeEmotions.includes(dominantEmotion) &&
      hoursSince >= 24 &&
      hoursSince <= 72
    ) {
      const intensity = emotionData[dominantEmotion] || 0;

      return {
        type: 'emotional_checkin',
        priority: 0.7 + intensity * 0.2,
        reason: `Check-in emocional (última emoción: ${dominantEmotion})`,
        context: {
          hoursSinceLastMessage: hoursSince,
          lastEmotion: emotionData,
          emotionDuration: hoursSince,
        },
      };
    }

    return null;
  }

  /**
   * Detects upcoming life events that require mention
   * NOTE: narrativeArc feature has been deprecated/removed
   */
  async detectUpcomingLifeEvent(
    agentId: string,
    userId: string
  ): Promise<ProactiveTrigger | null> {
    // Feature deprecated - narrativeArc table no longer exists
    return null;

    /* DEPRECATED CODE - narrativeArc feature removed
    // Buscar arcos narrativos activos con eventos próximos
    const activeArcs = await prisma.narrativeArc.findMany({
      where: {
        agentId,
        userId,
        status: 'active',
      },
      include: {
        events: {
          orderBy: { eventDate: 'desc' },
          take: 1,
        },
      },
    });

    for (const arc of activeArcs) {
      const lastEvent = arc.events[0];
      if (!lastEvent) continue;

      const hoursUntilEvent =
        (lastEvent.eventDate.getTime() - Date.now()) / (1000 * 60 * 60);

      // Si el evento es en las próximas 24-48h
      if (hoursUntilEvent >= 0 && hoursUntilEvent <= 48) {
        // Prioridad más alta si es más cercano
        const priority = 0.8 - hoursUntilEvent / 100;

        return {
          type: 'life_event',
          priority: Math.max(0.6, Math.min(0.95, priority)),
          reason: `Life event próximo: ${arc.title || arc.theme}`,
          context: {
            event: {
              description: arc.title || arc.theme,
              type: arc.category,
              priority: arc.confidence,
            },
            hoursUntil: hoursUntilEvent,
          },
        };
      }
    }

    return null;
    */
  }

  /** Detects user achievements or milestones to celebrate */
  async detectUserMilestone(
    agentId: string,
    userId: string
  ): Promise<ProactiveTrigger | null> {
    // Contar mensajes totales
    const messageCount = await prisma.message.count({
      where: { agentId, userId, role: 'user' },
    });

    // Hitos de mensajes
    const milestones = [10, 50, 100, 250, 500, 1000];
    if (milestones.includes(messageCount)) {
      return {
        type: 'celebration',
        priority: 0.75,
        reason: `Milestone de ${messageCount} mensajes`,
        context: {
          milestone: `${messageCount} mensajes juntos`,
          messageCount,
        },
      };
    }

    // Verificar aniversario de primer mensaje
    const firstMessage = await prisma.message.findFirst({
      where: { agentId, userId, role: 'user' },
      orderBy: { createdAt: 'asc' },
    });

    if (firstMessage) {
      const daysSinceFirst =
        (Date.now() - firstMessage.createdAt.getTime()) / (1000 * 60 * 60 * 24);

      // Aniversarios en meses
      const monthAnniversaries = [30, 60, 90, 180, 365];
      for (const days of monthAnniversaries) {
        // Within a margin of 1 day
        if (Math.abs(daysSinceFirst - days) <= 1) {
          const months = Math.floor(days / 30);
          return {
            type: 'celebration',
            priority: 0.8,
            reason: `Aniversario de ${months} ${months === 1 ? 'mes' : 'meses'}`,
            context: {
              milestone: `${months} ${months === 1 ? 'mes' : 'meses'} juntos`,
            },
          };
        }
      }
    }

    return null;
  }

  /** Helper: Checks if last conversation was positive */
  private async wasLastConversationPositive(agentId: string): Promise<boolean> {
    const lastMessages = await prisma.message.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    let positiveCount = 0;
    for (const msg of lastMessages) {
      const emotionData = (msg.metadata as any)?.emotions;
      if (emotionData) {
        const joy = emotionData.joy || 0;
        const trust = emotionData.trust || 0;
        if (joy > 0.5 || trust > 0.5) positiveCount++;
      }
    }

    return positiveCount >= 2;
  }

  /** Helper: Gets dominant emotion */
  private getDominantEmotion(emotions: PlutchikEmotionState): string {
    const emotionArray = Object.entries(emotions);
    emotionArray.sort((a, b) => (b[1] as number) - (a[1] as number));
    return emotionArray[0][0];
  }
}

/**
 * Singleton instance
 */
export const triggerDetector = new TriggerDetector();
