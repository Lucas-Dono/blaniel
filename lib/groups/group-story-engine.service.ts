import { prisma } from "@/lib/prisma";
import { getVeniceClient } from "@/lib/emotional-system/llm/venice";
import { nanoid } from "nanoid";

/**
 * Group Story Engine Service
 * 
 * Guided narrative system for groups that:
 * - Generates narrative beats
 * - Coordinates story arcs
 * - Manages narrative progress
 * - Generates scene directions
 */

interface StoryBeat {
  type: "introduction" | "rising_action" | "conflict" | "climax" | "resolution" | "transition";
  description: string;
  objectives: string[];
  suggestedFocus?: string[]; // IDs de agentes sugeridos para este beat
  duration: "short" | "medium" | "long";
}

interface StoryArc {
  title: string;
  theme: string;
  beats: StoryBeat[];
  currentBeatIndex: number;
  progress: number;
}

export class GroupStoryEngineService {
  /**
   * Initialize story mode for a group
   */
  async initializeStoryMode(groupId: string): Promise<void> {
    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          GroupMember: {
            where: { isActive: true, memberType: "agent" },
            include: {
              Agent: {
                select: {
                  id: true,
                  name: true,
                  PersonalityCore: true,
                },
              },
            },
          },
        },
      });

      if (!group || !group.storyMode) {
        throw new Error("Story mode not enabled");
      }

      // Generate initial story arc based on group composition
      const storyArc = await this.generateStoryArc(group);

      // Update group with initial story state
      await prisma.group.update({
        where: { id: groupId },
        data: {
          currentStoryBeat: JSON.stringify(storyArc.beats[0]),
          storyProgress: 0,
          currentSceneDirection: {
            type: "introduction",
            direction: "Comienza la historia. Los personajes se encuentran por primera vez.",
            focus: storyArc.beats[0].suggestedFocus || [],
            timestamp: new Date().toISOString(),
          },
        },
      });

      console.log(`Story mode initialized for group ${groupId}`);
    } catch (error) {
      console.error("Error initializing story mode:", error);
      throw error;
    }
  }

  /**
   * Generate a story arc based on group composition
   */
  private async generateStoryArc(group: any): Promise<StoryArc> {
    // Get AI personalities for context
    const aiPersonalities = group.GroupMember
      .map((m: any) => ({
        name: m.Agent?.name,
        traits: m.Agent?.PersonalityCore?.traits || [],
      }))
      .filter((ai: any) => ai.name);

    // Use LLM to generate story arc
    const venice = getVeniceClient();
    const prompt = `Genera un arco narrativo para una conversación grupal con los siguientes personajes:

${aiPersonalities.map((ai: any, i: number) => `${i + 1}. ${ai.name}: ${ai.traits.join(", ")}`).join("\n")}

Crea un arco narrativo interesante que incluya:
1. Introducción - Los personajes se conocen
2. Rising Action - Se desarrolla tensión o interés
3. Conflict - Surge un desafío o conflicto
4. Climax - Momento de mayor tensión
5. Resolution - Resolución del conflicto

Retorna un JSON con la siguiente estructura:
{
  "title": "Título del arco",
  "theme": "Tema principal",
  "beats": [
    {
      "type": "introduction",
      "description": "Descripción del beat",
      "objectives": ["objetivo1", "objetivo2"],
      "duration": "short"
    }
  ]
}`;

    try {
      const response = await venice.generateWithSystemPrompt(
        "Eres un director narrativo experto en crear arcos de historia para conversaciones grupales. Retorna solo JSON válido.",
        prompt,
        {
          model: "venice-uncensored",
          temperature: 0.9,
          maxTokens: 1000,
        }
      );

      const storyArc = JSON.parse(response.text);
      return {
        ...storyArc,
        currentBeatIndex: 0,
        progress: 0,
      };
    } catch (error) {
      console.error("Error generating story arc:", error);
      // Fallback to default story arc
      return this.getDefaultStoryArc(aiPersonalities);
    }
  }

  /**
   * Get default story arc (fallback)
   */
  private getDefaultStoryArc(_aiPersonalities: any[]): StoryArc {
    return {
      title: "Un Encuentro Inesperado",
      theme: "Amistad y Descubrimiento",
      currentBeatIndex: 0,
      progress: 0,
      beats: [
        {
          type: "introduction",
          description: "Los personajes se encuentran y se presentan",
          objectives: [
            "Establecer personalidades",
            "Crear primeras impresiones",
          ],
          duration: "short",
        },
        {
          type: "rising_action",
          description: "Descubren intereses comunes o diferencias intrigantes",
          objectives: [
            "Desarrollar dinámicas de grupo",
            "Revelar trasfondos",
          ],
          duration: "medium",
        },
        {
          type: "conflict",
          description: "Surge un desacuerdo o desafío que enfrentar juntos",
          objectives: [
            "Crear tensión narrativa",
            "Revelar valores y motivaciones",
          ],
          duration: "medium",
        },
        {
          type: "climax",
          description: "El grupo debe tomar una decisión importante",
          objectives: [
            "Momento de mayor tensión",
            "Revelar verdaderas personalidades",
          ],
          duration: "short",
        },
        {
          type: "resolution",
          description: "El grupo resuelve el conflicto y reflexiona",
          objectives: [
            "Resolver tensiones",
            "Establecer nuevas dinámicas",
          ],
          duration: "medium",
        },
      ],
    };
  }

  /**
   * Update story progress based on recent messages
   */
  async updateStoryProgress(groupId: string): Promise<void> {
    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: {
          id: true,
          storyMode: true,
          currentStoryBeat: true,
          storyProgress: true,
          totalMessages: true,
        },
      });

      if (!group || !group.storyMode || !group.currentStoryBeat) {
        return;
      }

      const currentBeat = JSON.parse(group.currentStoryBeat as string);

      // Calculate progress based on messages and beat duration
      const messagesInBeat = await prisma.groupMessage.count({
        where: {
          groupId,
          createdAt: {
            gte: new Date(Date.now() - this.getBeatDuration(currentBeat.duration)),
          },
        },
      });

      const targetMessages = this.getTargetMessages(currentBeat.duration);
      const beatProgress = Math.min(messagesInBeat / targetMessages, 1);

      // Update progress
      await prisma.group.update({
        where: { id: groupId },
        data: {
          storyProgress: beatProgress,
        },
      });

      // Check if beat is complete
      if (beatProgress >= 1) {
        await this.advanceToNextBeat(groupId);
      }
    } catch (error) {
      console.error("Error updating story progress:", error);
    }
  }

  /**
   * Advance to next story beat
   */
  private async advanceToNextBeat(groupId: string): Promise<void> {
    try {
      // Load current story state
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          GroupMember: {
            where: { isActive: true, memberType: "agent" },
          },
        },
      });

      if (!group) return;

      // For simplicity, we'll generate a new beat
      // In production, you'd load from a predefined arc
      const nextBeat = await this.generateNextBeat(group);

      await prisma.group.update({
        where: { id: groupId },
        data: {
          currentStoryBeat: JSON.stringify(nextBeat),
          storyProgress: 0,
          currentSceneDirection: {
            type: nextBeat.type,
            direction: nextBeat.description,
            focus: nextBeat.suggestedFocus || [],
            timestamp: new Date().toISOString(),
          },
        },
      });

      // Create system message announcing new beat
      await prisma.groupMessage.create({
        data: {
          id: nanoid(),
          groupId,
          authorType: "user",
          content: `📖 Nuevo capítulo: ${nextBeat.description}`,
          contentType: "system",
          isSystemMessage: true,
          turnNumber: (await prisma.groupMessage.count({ where: { groupId } })) + 1,
          updatedAt: new Date(),
        },
      });

      console.log(`Advanced to next beat for group ${groupId}`);
    } catch (error) {
      console.error("Error advancing to next beat:", error);
    }
  }

  /**
   * Generate next story beat
   */
  private async generateNextBeat(group: any): Promise<StoryBeat> {
    // Load recent messages for context
    const recentMessages = await prisma.groupMessage.findMany({
      where: { groupId: group.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        User: { select: { name: true } },
        Agent: { select: { name: true } },
      },
    });

    const venice = getVeniceClient();
    const prompt = `Basado en esta conversación reciente, genera el siguiente beat narrativo:

${recentMessages.reverse().map((m: any) => {
  const author = m.authorType === "user" ? m.User?.name : m.Agent?.name;
  return `${author}: ${m.content}`;
}).join("\n")}

Genera un JSON con el siguiente beat narrativo que continúe la historia de forma natural:
{
  "type": "rising_action" | "conflict" | "climax" | "resolution",
  "description": "Descripción del siguiente beat",
  "objectives": ["objetivo1", "objetivo2"],
  "duration": "short" | "medium" | "long"
}`;

    try {
      const response = await venice.generateWithSystemPrompt(
        "Eres un director narrativo. Retorna solo JSON válido.",
        prompt,
        {
          model: "venice-uncensored",
          temperature: 0.8,
          maxTokens: 300,
        }
      );

      return JSON.parse(response.text);
    } catch (error) {
      console.error("Error generating next beat:", error);
      return {
        type: "transition",
        description: "La conversación continúa de forma natural",
        objectives: ["Mantener el flujo narrativo"],
        duration: "medium",
      };
    }
  }

  /**
   * Generate scene direction for current beat
   */
  async generateSceneDirection(groupId: string): Promise<string> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        currentStoryBeat: true,
        currentSceneDirection: true,
      },
    });

    if (!group?.currentStoryBeat) {
      return "La conversación fluye libremente.";
    }

    const beat = JSON.parse(group.currentStoryBeat as string);
    return beat.description;
  }

  /**
   * Helper: Get beat duration in milliseconds
   */
  private getBeatDuration(duration: string): number {
    switch (duration) {
      case "short":
        return 10 * 60 * 1000; // 10 minutes
      case "medium":
        return 30 * 60 * 1000; // 30 minutes
      case "long":
        return 60 * 60 * 1000; // 1 hour
      default:
        return 20 * 60 * 1000;
    }
  }

  /**
   * Helper: Get target messages for beat completion
   */
  private getTargetMessages(duration: string): number {
    switch (duration) {
      case "short":
        return 15;
      case "medium":
        return 30;
      case "long":
        return 50;
      default:
        return 25;
    }
  }
}

// Export singleton
export const groupStoryEngineService = new GroupStoryEngineService();
