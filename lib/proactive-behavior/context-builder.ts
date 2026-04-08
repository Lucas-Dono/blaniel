/**
 * CONTEXT BUILDER - Builds rich context for proactive messages
 *
 * Collects all relevant information to generate a natural and personalized
 * proactive message:
 * - Summary of recent conversations
 * - Pending topics
 * - Recent life events
 * - Historical emotional state
 * - Relationship information
 */

import { prisma } from '@/lib/prisma';
import { PlutchikEmotionState } from '@/lib/emotions/plutchik';
import type { ProactiveTrigger } from './trigger-detector';

export interface ProactiveContext {
  // Basic information
  agentName: string;
  agentPersonality: string;
  userName?: string;

  // Relationship
  relationshipStage: string;
  daysTogether: number;
  totalMessages: number;

  // Recent conversations
  recentConversations: ConversationSummary[];

  // Pending topics
  unresolvedTopics: UnresolvedTopicSummary[];

  // Life Events
  activeNarrativeArcs: NarrativeArcSummary[];
  upcomingEvents: EventSummary[];

  // Emotional state
  recentEmotionalTone: string; // positive, negative, mixed, neutral
  lastEmotions: PlutchikEmotionState;

  // Specific trigger
  trigger: ProactiveTrigger;
}

export interface ConversationSummary {
  date: Date;
  messageCount: number;
  topics: string[];
  emotionalTone: string;
  lastUserMessage: string;
}

export interface UnresolvedTopicSummary {
  topic: string;
  category: string;
  mentionedAt: Date;
  importance: number;
  expectedResolutionDate?: Date;
}

export interface NarrativeArcSummary {
  title: string;
  category: string;
  status: string;
  lastEvent: string;
  daysSinceStart: number;
}

export interface EventSummary {
  description: string;
  type: string;
  when: Date;
  hoursUntil: number;
}

export class ContextBuilder {
  /**
   * Builds complete context for proactive message
   */
  async buildContext(
    agentId: string,
    userId: string,
    trigger: ProactiveTrigger
  ): Promise<ProactiveContext> {
    // Get datos del agente
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        PersonalityCore: true,
        User: {
          select: { name: true },
        },
      },
    });

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Get relationship
    const relation = await prisma.relation.findFirst({
      where: {
        subjectId: agentId,
        targetId: userId,
      },
    });

    const relationshipStage = relation?.stage || 'stranger';

    // Calcular días juntos
    const firstMessage = await prisma.message.findFirst({
      where: { agentId, userId, role: 'user' },
      orderBy: { createdAt: 'asc' },
    });

    const daysTogether = firstMessage
      ? Math.floor(
          (Date.now() - firstMessage.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0;

    // Contar mensajes totales
    const totalMessages = await prisma.message.count({
      where: { agentId, userId, role: 'user' },
    });

    // Construir cada sección del contexto
    const recentConversations = await this.getRecentConversations(agentId, userId);
    const unresolvedTopics = await this.getUnresolvedTopics(agentId);
    const { activeNarrativeArcs, upcomingEvents } = await this.getLifeEventsContext(
      agentId,
      userId
    );
    const { recentEmotionalTone, lastEmotions } = await this.getEmotionalContext(
      agentId,
      userId
    );

    return {
      agentName: agent.name,
      agentPersonality: agent.PersonalityCore
        ? `openness:${agent.PersonalityCore.openness} extraversion:${agent.PersonalityCore.extraversion}`
        : 'friendly',
      userName: agent.User?.name || undefined,

      relationshipStage,
      daysTogether,
      totalMessages,

      recentConversations,
      unresolvedTopics,
      activeNarrativeArcs,
      upcomingEvents,

      recentEmotionalTone,
      lastEmotions,

      trigger,
    };
  }

  /**
   * Obtiene resumen de conversaciones recientes
   */
  private async getRecentConversations(
    agentId: string,
    userId: string
  ): Promise<ConversationSummary[]> {
    // Agrupar mensajes por día (últimos 7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const messages = await prisma.message.findMany({
      where: {
        agentId,
        userId,
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limitar a últimos 50 mensajes
    });

    // Agrupar por día
    const conversationsByDay = new Map<string, typeof messages>();

    for (const msg of messages) {
      const dateKey = msg.createdAt.toISOString().split('T')[0];
      if (!conversationsByDay.has(dateKey)) {
        conversationsByDay.set(dateKey, []);
      }
      conversationsByDay.get(dateKey)!.push(msg);
    }

    // Convertir a summaries
    const summaries: ConversationSummary[] = [];

    for (const [dateKey, dayMessages] of conversationsByDay.entries()) {
      const userMessages = dayMessages.filter((m) => m.role === 'user');
      if (userMessages.length === 0) continue;

      // Extraer topics (palabras clave simples)
      const topics = this.extractTopics(
        userMessages.map((m) => m.content).join(' ')
      );

      // Determinar tono emocional
      const emotionalTone = this.determineEmotionalTone(userMessages);

      // Último mensaje del usuario ese día
      const lastUserMessage = userMessages[userMessages.length - 1].content;

      summaries.push({
        date: new Date(dateKey),
        messageCount: dayMessages.length,
        topics,
        emotionalTone,
        lastUserMessage: lastUserMessage.substring(0, 100),
      });
    }

    // Ordenar por fecha descendente
    summaries.sort((a, b) => b.date.getTime() - a.date.getTime());

    return summaries.slice(0, 3); // Solo últimas 3 conversaciones
  }

  /**
   * Obtiene topics sin resolver
   */
  private async getUnresolvedTopics(
    agentId: string
  ): Promise<UnresolvedTopicSummary[]> {
    const internalState = await prisma.internalState.findUnique({
      where: { agentId },
    });

    if (!internalState) return [];

    const unresolvedTopics = (internalState.conversationBuffer as any[]) || [];

    return unresolvedTopics
      .filter((t) => !t.resolved && t.followUpAttempts < 2)
      .map((t) => ({
        topic: t.topic,
        category: t.category,
        mentionedAt: new Date(t.mentionedAt),
        importance: t.importance,
        expectedResolutionDate: t.expectedResolutionDate
          ? new Date(t.expectedResolutionDate)
          : undefined,
      }))
      .slice(0, 3); // Max 3 topics
  }

  /**
   * Obtiene contexto de life events
   * NOTE: narrativeArc feature has been deprecated/removed
   */
  private async getLifeEventsContext(
    agentId: string,
    userId: string
  ): Promise<{
    activeNarrativeArcs: NarrativeArcSummary[];
    upcomingEvents: EventSummary[];
  }> {
    // Feature deprecated - narrativeArc table no longer exists
    // Returning empty data for now
    return {
      activeNarrativeArcs: [],
      upcomingEvents: []
    };

    /* DEPRECATED CODE - narrativeArc feature removed
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
      take: 3,
    });

    const activeNarrativeArcs: NarrativeArcSummary[] = activeArcs.map((arc: any) => {
      const lastEvent = arc.events[0];
      const daysSinceStart = Math.floor(
        (Date.now() - arc.startedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        title: arc.title || arc.theme,
        category: arc.category,
        status: arc.status,
        lastEvent: lastEvent ? lastEvent.description : 'Sin eventos recientes',
        daysSinceStart,
      };
    });

    // Detect upcoming events (next 48h)
    const upcomingEvents: EventSummary[] = [];
    for (const arc of activeArcs) {
      const lastEvent = arc.events[0];
      if (!lastEvent) continue;

      const hoursUntil =
        (lastEvent.eventDate.getTime() - Date.now()) / (1000 * 60 * 60);

      if (hoursUntil >= 0 && hoursUntil <= 48) {
        upcomingEvents.push({
          description: lastEvent.description,
          type: arc.category,
          when: lastEvent.eventDate,
          hoursUntil,
        });
      }
    }

    return { activeNarrativeArcs, upcomingEvents };
    */
  }

  /**
   * Obtiene contexto emocional reciente
   */
  private async getEmotionalContext(
    agentId: string,
    userId: string
  ): Promise<{
    recentEmotionalTone: string;
    lastEmotions: PlutchikEmotionState;
  }> {
    // Get user's last 5 messages
    const recentMessages = await prisma.message.findMany({
      where: { agentId, userId, role: 'user' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (recentMessages.length === 0) {
      return {
        recentEmotionalTone: 'neutral',
        lastEmotions: this.getDefaultEmotions(),
      };
    }

    // Analizar tono general
    let positiveCount = 0;
    let negativeCount = 0;

    for (const msg of recentMessages) {
      const emotionData = (msg.metadata as any)?.emotions;
      if (!emotionData) continue;

      const joy = emotionData.joy || 0;
      const trust = emotionData.trust || 0;
      const sadness = emotionData.sadness || 0;
      const fear = emotionData.fear || 0;
      const anger = emotionData.anger || 0;

      if (joy > 0.5 || trust > 0.5) positiveCount++;
      if (sadness > 0.5 || fear > 0.5 || anger > 0.5) negativeCount++;
    }

    let tone = 'neutral';
    if (positiveCount >= 3) tone = 'positive';
    else if (negativeCount >= 3) tone = 'negative';
    else if (positiveCount > 0 && negativeCount > 0) tone = 'mixed';

    // Get latest emotions
    const lastMessage = recentMessages[0];
    const lastEmotions =
      ((lastMessage.metadata as any)?.emotions as PlutchikEmotionState) ||
      this.getDefaultEmotions();

    return {
      recentEmotionalTone: tone,
      lastEmotions,
    };
  }

  /**
   * Helper: Extrae topics de texto
   */
  private extractTopics(text: string): string[] {
    // Simple keyword extraction (5+ characters, most mentioned)
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 5);

    const frequency = new Map<string, number>();
    for (const word of words) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }

    const sorted = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((e) => e[0]);

    return sorted;
  }

  /**
   * Helper: Determina tono emocional de mensajes
   */
  private determineEmotionalTone(messages: any[]): string {
    let positiveCount = 0;
    let negativeCount = 0;

    for (const msg of messages) {
      const emotionData = (msg.metadata as any)?.emotions;
      if (!emotionData) continue;

      const joy = emotionData.joy || 0;
      const trust = emotionData.trust || 0;
      const sadness = emotionData.sadness || 0;
      const fear = emotionData.fear || 0;

      if (joy > 0.5 || trust > 0.5) positiveCount++;
      if (sadness > 0.5 || fear > 0.5) negativeCount++;
    }

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    if (positiveCount > 0 && negativeCount > 0) return 'mixed';
    return 'neutral';
  }

  /**
   * Helper: Emociones por defecto
   */
  private getDefaultEmotions(): PlutchikEmotionState {
    return {
      joy: 0.5,
      trust: 0.5,
      fear: 0,
      surprise: 0,
      sadness: 0,
      disgust: 0,
      anger: 0,
      anticipation: 0.3,
      lastUpdated: new Date(),
    };
  }
}

/**
 * Singleton instance
 */
export const contextBuilder = new ContextBuilder();
