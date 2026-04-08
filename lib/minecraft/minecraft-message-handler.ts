import { prisma } from "@/lib/prisma";
import { getVeniceClient } from "@/lib/emotional-system/llm/venice";
import { proximityDetector } from "./proximity-detector";

import { nanoid } from "nanoid";
import {
  MinecraftPlayer,
  MinecraftAgent,
  MinecraftChatMessage,
  MinecraftAgentResponse,
  ProximityContext,
  MinecraftMessageResponse,
  MinecraftChatError,
  MINECRAFT_ERROR_CODES,
  DEFAULT_MINECRAFT_CHAT_CONFIG,
} from "@/types/minecraft-chat";
import { normalizeCoreValuesToStringArray } from "@/lib/psychological-analysis/corevalues-normalizer";

/**
 * Minecraft Message Handler
 * 
 * Adapter that converts the web group chat system to the 3D spatial context of Minecraft. Reuses the GroupMessageService logic but with proximity detection.
 * 
 * Flow:
 * 1. Analyze proximity context (who is nearby, who is the target)
 * 2. Determine if it is an individual or group conversation
 * 3. Select agents that will respond (based on proximity + personality)
 * 4. Generate responses with spatial context
 * 5. Apply delays between responses (simulate natural turns)
 */
export class MinecraftMessageHandler {
  private readonly config = DEFAULT_MINECRAFT_CHAT_CONFIG;

  /** Processes a player message and generates agent responses */
  async processMessage(
    player: MinecraftPlayer,
    message: string,
    nearbyAgents: MinecraftAgent[],
    replyToId?: string
  ): Promise<MinecraftMessageResponse> {
    const startTime = Date.now();

    try {
      // 1. Validate input
      this.validateInput(player, message, nearbyAgents);

      // 2. Analyze proximity context
      const proximityContext = await proximityDetector.analyzeProximity(
        player,
        nearbyAgents,
        message
      );

      if (proximityContext.nearbyAgents.length === 0) {
        throw new MinecraftChatError(
          "No hay agentes cercanos para responder",
          MINECRAFT_ERROR_CODES.NO_AGENTS_NEARBY,
          404
        );
      }

      // 3. Create user message in DB
      const userMessage = await this.saveUserMessage(
        player,
        message,
        proximityContext,
        replyToId
      );

      // 4. Select agents that will respond
      const respondingAgents = proximityDetector.selectRespondingAgents(
        proximityContext.nearbyAgents,
        this.config.maxResponders
      );

      // 5. Generate agent responses (sequentially with delays)
      const agentResponses = await this.generateAgentResponses(
        respondingAgents,
        userMessage,
        proximityContext
      );

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        userMessage: {
          messageId: userMessage.id,
          content: userMessage.content,
          timestamp: userMessage.createdAt,
        },
        proximityContext,
        agentResponses,
        metadata: {
          responseTime,
          agentsEvaluated: proximityContext.nearbyAgents.length,
          agentsResponded: agentResponses.length,
        },
      };
    } catch (error) {
      if (error instanceof MinecraftChatError) {
        throw error;
      }

      console.error("Error processing Minecraft message:", error);
      throw new MinecraftChatError(
        "Error al procesar el mensaje",
        MINECRAFT_ERROR_CODES.GENERATION_FAILED,
        500
      );
    }
  }

  /** Validates user input */
  private validateInput(
    player: MinecraftPlayer,
    message: string,
    nearbyAgents: MinecraftAgent[]
  ): void {
    if (!player || !player.uuid) {
      throw new MinecraftChatError(
        "Invalid player data",
        MINECRAFT_ERROR_CODES.PLAYER_NOT_AUTHENTICATED,
        400
      );
    }

    if (!message || message.trim().length === 0) {
      throw new MinecraftChatError(
        "Message cannot be empty",
        MINECRAFT_ERROR_CODES.INVALID_MESSAGE,
        400
      );
    }

    if (message.length > 5000) {
      throw new MinecraftChatError(
        "Message cannot exceed 5000 characters",
        MINECRAFT_ERROR_CODES.INVALID_MESSAGE,
        400
      );
    }

    if (!Array.isArray(nearbyAgents)) {
      throw new MinecraftChatError(
        "Invalid agents list",
        MINECRAFT_ERROR_CODES.INVALID_MESSAGE,
        400
      );
    }
  }

  /** Saves the user's message in the DB */
  private async saveUserMessage(
    player: MinecraftPlayer,
    content: string,
    proximityContext: ProximityContext,
    replyToId?: string
  ): Promise<any> {
    // Search for user in DB (if authenticated)
    let userId: string | undefined;

    if (player.userId) {
      const user = await prisma.user.findUnique({
        where: { id: player.userId },
      });
      userId = user?.id;
    }

    // If no userId, create a temporary "ghost user"
    // In production, this would require authentication via API key
    if (!userId) {
      throw new MinecraftChatError(
        "Player not authenticated",
        MINECRAFT_ERROR_CODES.PLAYER_NOT_AUTHENTICATED,
        401
      );
    }

    // Save message in GroupMessage (reuse groups table)
    // Use special groupId for Minecraft: "minecraft:{world}"
    const worldId = proximityContext.player.position.dimensionId;
    const minecraftGroupId = `minecraft:${worldId}`;

    // Create "virtual group" if it doesn't exist
    let group = await prisma.group.findUnique({
      where: { id: minecraftGroupId },
    });

    if (!group) {
      group = await prisma.group.create({
        data: {
          id: minecraftGroupId,
          name: `Minecraft - ${worldId}`,
          description: "Virtual group for Minecraft spatial chat",
          creatorId: userId,
          visibility: "private",
          storyMode: false,
          emergentEventsEnabled: false,
        },
      });
    }

    // Save message
    const message = await prisma.groupMessage.create({
      data: {
        id: nanoid(),
        groupId: minecraftGroupId,
        userId,
        content,
        authorType: "user",
        replyToId,
        turnNumber: 0,
        metadata: {
          minecraftContext: {
            playerName: player.name,
            playerPosition: player.position,
            proximityAgents: proximityContext.nearbyAgents.map((a) => ({
              agentId: a.agent.agentId,
              distance: a.distance,
              score: a.confidenceScore,
            })),
            isGroupConversation: proximityContext.isGroupConversation,
          },
        },
      },
    });

    return message;
  }

  /** Generates responses from multiple agents (sequentially) */
  private async generateAgentResponses(
    respondingAgents: MinecraftAgent[],
    userMessage: any,
    proximityContext: ProximityContext
  ): Promise<MinecraftAgentResponse[]> {
    const responses: MinecraftAgentResponse[] = [];

    for (let i = 0; i < respondingAgents.length; i++) {
      const agent = respondingAgents[i];

      // Delay between responses (except the first one)
      if (i > 0) {
        await this.delay(this.config.responseDelay);
      }

      try {
        const response = await this.generateSingleAgentResponse(
          agent,
          userMessage,
          proximityContext,
          responses // Context of previous responses
        );

        if (response) {
          responses.push(response);
        }
      } catch (error) {
        console.error(
          `Error generating response for agent ${agent.agentId}:`,
          error
        );
        // Continue with the next agent
      }
    }

    return responses;
  }

  /**
   * Genera respuesta de un agente individual
   */
  private async generateSingleAgentResponse(
    minecraftAgent: MinecraftAgent,
    userMessage: any,
    proximityContext: ProximityContext,
    previousResponses: MinecraftAgentResponse[]
  ): Promise<MinecraftAgentResponse | null> {
    // 1. Load complete agent data from DB
    const agent = await prisma.agent.findUnique({
      where: { id: minecraftAgent.agentId },
      include: {
        PersonalityCore: true,
        InternalState: true,
      },
    });

    if (!agent) {
      console.error(`Agent ${minecraftAgent.agentId} not found in database`);
      return null;
    }

    // 2. Build spatial context
    const proximityInfo = proximityContext.nearbyAgents.find(
      (a) => a.agent.agentId === minecraftAgent.agentId
    );

    const spatialContext = this.buildSpatialContext(
      proximityContext.player,
      minecraftAgent,
      proximityInfo
    );

    // 3. Load cross-context memory (previous conversations)
    const memoryContext = "";
    // TODO: Implement queryMemories in crossContextMemoryService
    // try {
    //   const memories = await crossContextMemoryService.queryMemories(
    //     minecraftAgent.agentId,
    //     userMessage.content,
    //     5
    //   );
    //   if (memories.length > 0) {
    //     memoryContext = "\n\n[Memorias relevantes de conversaciones previas]\n";
    //     memories.forEach((mem) => {
    //       memoryContext += `- ${mem.summary}\n`;
    //     });
    //   }
    // } catch (error) {
    //   console.error("Error loading cross-context memories:", error);
    // }

    // 4. Load recent group messages
    const recentMessages = await prisma.groupMessage.findMany({
      where: {
        groupId: userMessage.groupId,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        User: { select: { name: true } },
        Agent: { select: { name: true } },
      },
    });

    const conversationHistory = recentMessages
      .reverse()
      .map((m) => {
        const authorName =
          m.authorType === "user" ? m.User?.name || "Player" : m.Agent?.name;
        return `${authorName}: ${m.content}`;
      })
      .join("\n");

    // 5. Include previous responses from other agents in this turn
    let previousResponsesContext = "";
    if (previousResponses.length > 0) {
      previousResponsesContext =
        "\n\n[Other agents have already responded in this turn]\n";
      previousResponses.forEach((resp) => {
        previousResponsesContext += `${resp.agentName}: ${resp.content}\n`;
      });
    }

    // 6. Build complete prompt
    const systemPrompt = this.buildSystemPrompt(
      agent,
      spatialContext,
      proximityContext.isGroupConversation
    );

    const userPrompt = `${conversationHistory}

${spatialContext}${memoryContext}${previousResponsesContext}

${proximityContext.player.name}: ${userMessage.content}

Respond as ${agent.name} in this Minecraft spatial context. Keep the message short and natural (1-3 sentences).`;

    // 7. Generate response with LLM (using correct Venice client)
    const venice = getVeniceClient();
    const response = await venice.generateWithSystemPrompt(
      systemPrompt,
      userPrompt,
      {
        model: process.env.VENICE_MODEL, // Usa el modelo del .env
        temperature: 0.9,
        maxTokens: 200, // Respuestas cortas para chat
      }
    );

    const content = response.text;

    if (!content) {
      console.error("Venice returned empty response");
      return null;
    }

    // 8. Guardar respuesta en BD
    const savedMessage = await prisma.groupMessage.create({
      data: {
        id: nanoid(),
        groupId: userMessage.groupId,
        agentId: agent.id,
        content,
        authorType: "agent",
        replyToId: userMessage.id,
        turnNumber: previousResponses.length + 1,
        metadata: {
          minecraftResponse: true,
          spatialContext: {
            distance: proximityInfo?.distance,
            isVisible: proximityInfo?.isVisible,
            isFacing: proximityInfo?.isFacing,
          },
        },
      },
    });

    // 9. Guardar en cross-context memory (para futuras interacciones)
    // TODO: Implementar saveMemory correcto en crossContextMemoryService
    // try {
    //   await crossContextMemoryService.saveMemory(
    //     agent.id,
    //     proximityContext.player.userId || "unknown",
    // [2]
    //     "minecraft_chat",
    //     0.7
    //   );
    // } catch (error) {
    //   console.error("Error saving cross-context memory:", error);
    // }

    // 10. Retornar respuesta formateada
    return {
      messageId: savedMessage.id,
      agentId: agent.id,
      agentName: agent.name,
      content,
      emotion: this.detectEmotion(content), // TODO: Integrar con sistema emocional
      emotionalIntensity: 0.5,
      timestamp: savedMessage.createdAt,
      turnNumber: previousResponses.length + 1,
      animationHint: this.suggestAnimation(content),
    };
  }

  /**
   * Construye contexto espacial para el prompt
   */
  private buildSpatialContext(
    player: MinecraftPlayer,
    agent: MinecraftAgent,
    proximityInfo?: any
  ): string {
    if (!proximityInfo) {
      return `Estás en Minecraft cerca de ${player.name}.`;
    }

    const distance = Math.round(proximityInfo.distance);
    const distanceDesc =
      distance <= 3
        ? "muy cerca"
        : distance <= 7
        ? "cerca"
        : distance <= 12
        ? "a media distancia"
        : "algo lejos";

    let context = `[CONTEXTO ESPACIAL]
Ubicación: Minecraft - ${agent.position.dimensionId}
Tu posición: (${Math.round(agent.position.x)}, ${Math.round(
      agent.position.y
    )}, ${Math.round(agent.position.z)})
${player.name} está ${distanceDesc} de ti (${distance} bloques)`;

    if (proximityInfo.isFacing) {
      context += `\n${player.name} te está mirando directamente.`;
    }

    if (proximityInfo.isVisible) {
      context += `\nTienes línea de visión con ${player.name}.`;
    }

    return context;
  }

  /**
   * Construye system prompt adaptado al contexto de Minecraft
   */
  private buildSystemPrompt(
    agent: any,
    spatialContext: string,
    isGroupConversation: boolean
  ): string {
    const conversationType = isGroupConversation
      ? "conversación grupal"
      : "conversación individual";

    return `Eres ${agent.name}, un personaje en el mundo de Minecraft.

${spatialContext}

Tipo de conversación: ${conversationType}

Personalidad:
${normalizeCoreValuesToStringArray(agent.PersonalityCore?.coreValues).join(", ") || "Amigable y servicial"}

Instrucciones:
- Responde de forma natural y breve (1-3 oraciones)
- Ten en cuenta la distancia física y el contexto espacial
- Si estás cerca, puedes ser más informal; si estás lejos, habla más alto conceptualmente
- Mantén tu personalidad consistente
- NO uses emojis (estamos en Minecraft, no en chat web)
- NO narres acciones entre asteriscos
- Habla como si estuvieras ahí, cara a cara`;
  }

  /**
   * Detecta emoción básica del contenido (simplificado)
   * TODO: Integrar con HybridEmotionalOrchestrator
   */
  private detectEmotion(content: string): string {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes("!") || lowerContent.includes("genial")) {
      return "joy";
    }
    if (lowerContent.includes("?")) {
      return "curiosity";
    }
    if (
      lowerContent.includes("triste") ||
      lowerContent.includes("mal")
    ) {
      return "sadness";
    }

    return "neutral";
  }

  /** Sugiere animación basada en el contenido */
  private suggestAnimation(content: string): MinecraftAgentResponse["animationHint"] {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes("hola") || lowerContent.includes("hey")) {
      return "waving";
    }
    if (lowerContent.includes("!")) {
      return "happy";
    }
    if (lowerContent.includes("?")) {
      return "thinking";
    }

    return "talking";
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Exportar instancia singleton
export const minecraftMessageHandler = new MinecraftMessageHandler();
