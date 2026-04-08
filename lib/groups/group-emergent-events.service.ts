import { prisma } from "@/lib/prisma";
import { getVeniceClient } from "@/lib/emotional-system/llm/venice";
import { nanoid } from "nanoid";

/**
 * Group Emergent Events Service
 *
 * System of emergent events for groups that:
 * - Generates unexpected situations
 * - Adds variety and surprise
 * - Creates memorable moments
 * - Adapts to group context
 */

export interface EmergentEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  impact: EventImpact;
  affectedAIs?: string[]; // IDs of affected AIs
  duration: number; // minutes
  triggers: EventTrigger[];
  metadata?: any;
}

export type EventType =
  | "external_arrival" // New AI or user joins temporarily
  | "mood_shift" // Collective emotional shift
  | "topic_injection" // Unexpected topic arises
  | "time_pressure" // Need to make quick decision
  | "revelation" // One of the members reveals something
  | "challenge" // Challenge or dilemma appears
  | "celebration" // Positive collective event
  | "mystery" // Something strange or unexplainable happens
  | "technical_glitch"; // Simulation of fun technical issue

export type EventImpact = "minor" | "moderate" | "major";

export interface EventTrigger {
  condition: string;
  threshold: number;
  currentValue: number;
}

export class GroupEmergentEventsService {
  /**
   * Check if an emergent event should occur
   */
  async checkForEvent(groupId: string): Promise<EmergentEvent | null> {
    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          GroupMember: {
            where: { isActive: true },
            include: {
              Agent: {
                select: {
                  id: true,
                  name: true,
                  PersonalityCore: true,
                },
              },
              User: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!group || !group.emergentEventsEnabled) {
        return null;
      }

      // Don't trigger if there's already an active event
      if (group.currentEmergentEvent) {
        const activeEvent = group.currentEmergentEvent as any;
        const eventEnd = new Date(activeEvent.startedAt);
        eventEnd.setMinutes(eventEnd.getMinutes() + activeEvent.duration);

        if (eventEnd > new Date()) {
          return null; // Event still active
        }
      }

      // Get group context
      const recentMessages = await prisma.groupMessage.findMany({
        where: { groupId },
        orderBy: { createdAt: "desc" },
        take: 30,
      });

      // Calculate event probability
      const probability = await this.calculateEventProbability(
        group,
        recentMessages
      );

      // Random check
      if (Math.random() > probability) {
        return null;
      }

      // Generate event
      const event = await this.generateEvent(group, recentMessages);

      if (event) {
        await this.activateEvent(groupId, event);
      }

      return event;
    } catch (error) {
      console.error("Error checking for emergent event:", error);
      return null;
    }
  }

  /**
   * Calculate probability of event occurring (0-1)
   */
  private async calculateEventProbability(
    group: any,
    recentMessages: any[]
  ): Promise<number> {
    let baseProbability = 0.05; // 5% base chance

    // Increase probability if conversation is long
    if (recentMessages.length >= 25) {
      baseProbability += 0.1;
    }

    // Increase if story mode is active
    if (group.storyMode) {
      baseProbability += 0.15;
    }

    // Increase based on time since last event
    const lastEventTime = group.currentEmergentEvent?.startedAt;
    if (lastEventTime) {
      const minutesSinceLastEvent =
        (Date.now() - new Date(lastEventTime).getTime()) / (1000 * 60);

      if (minutesSinceLastEvent > 60) {
        baseProbability += 0.2;
      }
    } else {
      // No event has occurred yet, increase probability
      baseProbability += 0.1;
    }

    return Math.min(baseProbability, 0.4); // Max 40%
  }

  /**
   * Generate an appropriate event for current context
   */
  private async generateEvent(
    group: any,
    recentMessages: any[]
  ): Promise<EmergentEvent | null> {
    const venice = getVeniceClient();

    // Build context
    const conversationSummary = recentMessages
      .reverse()
      .slice(-10)
      .map((m: any) => {
        const author =
          m.authorType === "user" ? m.User?.name : m.Agent?.name || "Unknown";
        return `${author}: ${m.content}`;
      })
      .join("\n");

    const aiPersonalities = group.GroupMember
      .filter((m: any) => m.memberType === "agent" && m.Agent)
      .map((m: { agentId: string; Agent: { name: string; PersonalityCore?: { traits?: any } | null } | null }) => ({
        id: m.agentId,
        name: m.Agent?.name,
        traits: m.Agent?.PersonalityCore?.traits || [],
      }));

    const prompt = `Basado en esta conversación grupal, genera un evento emergente interesante:

CONVERSACIÓN RECIENTE:
${conversationSummary}

PERSONAJES:
${aiPersonalities.map((ai: any) => `- ${ai.name}: ${ai.traits.join(", ")}`).join("\n")}

Genera un evento emergente en JSON con esta estructura:
{
  "type": "topic_injection" | "mood_shift" | "challenge" | "revelation" | "mystery" | "celebration",
  "title": "Título corto del evento",
  "description": "Descripción del evento (1-2 oraciones)",
  "impact": "minor" | "moderate" | "major",
  "affectedAIs": ["id1", "id2"],
  "duration": 15
}

El evento debe:
- Ser apropiado para el contexto
- Añadir variedad sin ser disruptivo
- Crear oportunidades para interacción interesante`;

    try {
      const response = await venice.generateWithSystemPrompt(
        "Eres un director creativo que diseña eventos emergentes para conversaciones grupales. Retorna solo JSON válido.",
        prompt,
        {
          model: "venice-uncensored",
          temperature: 0.9,
          maxTokens: 300,
        }
      );

      const eventData = JSON.parse(response.text);

      return {
        id: `event_${Date.now()}`,
        ...eventData,
        triggers: [],
      };
    } catch (error) {
      console.error("Error generating event:", error);
      return this.getRandomDefaultEvent(aiPersonalities);
    }
  }

  /**
   * Get a random default event (fallback)
   */
  private getRandomDefaultEvent(aiPersonalities: any[]): EmergentEvent {
    const defaultEvents: Omit<EmergentEvent, "id">[] = [
      {
        type: "topic_injection",
        title: "Tema Inesperado",
        description: "Alguien menciona un tema completamente inesperado.",
        impact: "minor",
        duration: 10,
        triggers: [],
      },
      {
        type: "mood_shift",
        title: "Cambio de Ánimo",
        description: "El ambiente del grupo cambia repentinamente.",
        impact: "moderate",
        duration: 15,
        triggers: [],
      },
      {
        type: "challenge",
        title: "Dilema Interesante",
        description: "Surge una pregunta difícil que todos deben considerar.",
        impact: "moderate",
        duration: 20,
        triggers: [],
      },
      {
        type: "revelation",
        title: "Revelación Sorpresa",
        description: "Uno de los miembros comparte algo inesperado.",
        impact: "major",
        duration: 15,
        affectedAIs: aiPersonalities.length > 0 ? [aiPersonalities[0].id] : [],
        triggers: [],
      },
      {
        type: "celebration",
        title: "Momento de Celebración",
        description: "Algo positivo ocurre que todos pueden celebrar.",
        impact: "minor",
        duration: 10,
        triggers: [],
      },
      {
        type: "mystery",
        title: "Misterio Intrigante",
        description: "Algo extraño sucede que genera curiosidad.",
        impact: "moderate",
        duration: 20,
        triggers: [],
      },
    ];

    const randomEvent =
      defaultEvents[Math.floor(Math.random() * defaultEvents.length)];

    return {
      id: `event_${Date.now()}`,
      ...randomEvent,
    };
  }

  /**
   * Activate an event in the group
   */
  private async activateEvent(groupId: string, event: EmergentEvent) {
    // Update group with active event
    await prisma.group.update({
      where: { id: groupId },
      data: {
        currentEmergentEvent: {
          ...event,
          startedAt: new Date().toISOString(),
        } as any,
      },
    });

    // Create system message announcing the event
    const turnNumber =
      (await prisma.groupMessage.count({ where: { groupId } })) + 1;

    await prisma.groupMessage.create({
      data: {
        id: nanoid(),
        groupId,
        authorType: "user",
        content: `✨ **${event.title}**: ${event.description}`,
        contentType: "system",
        isSystemMessage: true,
        turnNumber,
        updatedAt: new Date(),
      },
    });

    // Apply event effects to affected AIs
    if (event.affectedAIs && event.affectedAIs.length > 0) {
      for (const agentId of event.affectedAIs) {
        await prisma.groupMember.update({
          where: {
            groupId_agentId: { groupId, agentId },
          },
          data: {
            isFocused: true,
            focusedUntil: new Date(Date.now() + event.duration * 60 * 1000),
            importanceLevel: event.impact === "major" ? "main" : "secondary",
          },
        });
      }
    }

    console.log(`Emergent event activated: ${event.title} (${event.type})`);
  }

  /**
   * Get context for AI response considering active event
   */
  getEventContext(group: any): string | null {
    if (!group.currentEmergentEvent) return null;

    const event = group.currentEmergentEvent as any;
    const eventEnd = new Date(event.startedAt);
    eventEnd.setMinutes(eventEnd.getMinutes() + event.duration);

    // Check if event is still active
    if (eventEnd < new Date()) {
      return null;
    }

    return `EVENTO ACTUAL: ${event.title} - ${event.description}`;
  }

  /**
   * Clear expired event
   */
  async clearExpiredEvent(groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { currentEmergentEvent: true },
    });

    if (!group?.currentEmergentEvent) return;

    const event = group.currentEmergentEvent as any;
    const eventEnd = new Date(event.startedAt);
    eventEnd.setMinutes(eventEnd.getMinutes() + event.duration);

    if (eventEnd < new Date()) {
      await prisma.group.update({
        where: { id: groupId },
        data: { currentEmergentEvent: null as any },
      });

      console.log(`Event expired and cleared: ${event.title}`);
    }
  }

  /**
   * Manually trigger a specific event type
   */
  async triggerSpecificEvent(
    groupId: string,
    eventType: EventType
  ): Promise<EmergentEvent | null> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        GroupMember: {
          where: { isActive: true, memberType: "agent" },
          include: {
            Agent: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!group) return null;

    const aiIds = group.GroupMember.map((m) => m.agentId!);

    // Create event based on type
    const eventTemplates: Record<
      EventType,
      Omit<EmergentEvent, "id" | "triggers">
    > = {
      external_arrival: {
        type: "external_arrival",
        title: "Visitante Inesperado",
        description: "Alguien nuevo se une temporalmente a la conversación.",
        impact: "moderate",
        duration: 20,
      },
      mood_shift: {
        type: "mood_shift",
        title: "Cambio de Atmósfera",
        description: "El ánimo del grupo cambia repentinamente.",
        impact: "moderate",
        duration: 15,
        affectedAIs: aiIds,
      },
      topic_injection: {
        type: "topic_injection",
        title: "Nuevo Tema",
        description: "Un tema completamente nuevo surge en la conversación.",
        impact: "minor",
        duration: 10,
      },
      time_pressure: {
        type: "time_pressure",
        title: "Decisión Urgente",
        description: "El grupo debe tomar una decisión rápidamente.",
        impact: "major",
        duration: 15,
      },
      revelation: {
        type: "revelation",
        title: "Confesión Sorpresa",
        description: "Alguien revela algo inesperado sobre sí mismo.",
        impact: "major",
        duration: 15,
        affectedAIs: aiIds.length > 0 ? [aiIds[0]] : [],
      },
      challenge: {
        type: "challenge",
        title: "Desafío Grupal",
        description: "Aparece un dilema que el grupo debe resolver.",
        impact: "moderate",
        duration: 20,
      },
      celebration: {
        type: "celebration",
        title: "¡Momento de Celebración!",
        description: "Algo positivo sucede que todos celebran.",
        impact: "minor",
        duration: 10,
      },
      mystery: {
        type: "mystery",
        title: "Misterio Intrigante",
        description: "Algo extraño ocurre que despierta curiosidad.",
        impact: "moderate",
        duration: 20,
      },
      technical_glitch: {
        type: "technical_glitch",
        title: "Fallo Técnico Divertido",
        description:
          "Un pequeño problema técnico crea una situación graciosa.",
        impact: "minor",
        duration: 5,
      },
    };

    const eventTemplate = eventTemplates[eventType];
    const event: EmergentEvent = {
      id: `event_${Date.now()}`,
      ...eventTemplate,
      triggers: [],
    };

    await this.activateEvent(groupId, event);

    return event;
  }
}

// Export singleton
export const groupEmergentEventsService = new GroupEmergentEventsService();
