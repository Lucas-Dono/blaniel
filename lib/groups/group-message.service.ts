import { prisma } from "@/lib/prisma";
import { getVeniceClient } from "@/lib/emotional-system/llm/venice";
import { crossContextMemoryService } from "./cross-context-memory.service";
import { groupStoryEngineService } from "./group-story-engine.service";
import { groupAIDirectorService } from "./group-ai-director.service";
import { groupEmergentEventsService } from "./group-emergent-events.service";
import { emitGroupMessage, emitGroupAIResponding, emitGroupAIStopped } from "@/lib/socket/server";
import { nanoid } from "nanoid";

interface AISelectionScore {
  member: any;
  score: number;
  reasons: string[];
}

/**
 * Group Message Service
 *
 * Handles generation of AI responses in groups, including:
 * - Intelligent selection of AIs that will respond
 * - Generation of responses with group context
 * - Integration with cross-context memory
 * - Delays and cooldowns
 */
export class GroupMessageService {
  /**
   * Generate AI responses to a user message
   *
   * This is called in background after a user sends a message
   */
  async generateAIResponses(
    groupId: string,
    triggeringMessage: any
  ): Promise<any[]> {
    try {
      // 1. Load complete group context
      const group = await this.loadGroupContext(groupId);

      if (!group) {
        console.error(`Group ${groupId} not found`);
        return [];
      }

      // 2. Get active AIs in the group
      const aiMembers = group.members.filter(
        (m: any) => m.memberType === "agent" && m.isActive
      );

      if (aiMembers.length === 0) {
        return [];
      }

      // 3. Select which AIs will respond (1-3 AIs)
      const respondingAIs = await this.selectRespondingAIs(
        aiMembers,
        triggeringMessage,
        group
      );

      if (respondingAIs.length === 0) {
        return [];
      }

      const responses = [];

      // 3.5. Check for emergent events (ULTRA tier)
      if (group.emergentEventsEnabled) {
        await groupEmergentEventsService
          .checkForEvent(groupId)
          .catch((err) => console.error("Error checking emergent event:", err));
      }

      // 4. Generate responses sequentially with delays
      for (let i = 0; i < respondingAIs.length; i++) {
        const aiMember = respondingAIs[i];

        // Delay between responses (configurable per group)
        if (i > 0) {
          await this.delay(group.responseDelay || 2000);
        }

        try {
          // Emit AI responding indicator
          emitGroupAIResponding(groupId, aiMember.agentId, aiMember.agent.name);

          const response = await this.generateSingleAIResponse(
            aiMember.agent,
            triggeringMessage,
            group,
            responses // Context from previous responses
          );

          // Emit AI stopped indicator
          emitGroupAIStopped(groupId, aiMember.agentId);

          if (response) {
            responses.push(response);

            // Emit the new message to all group members
            emitGroupMessage(groupId, {
              id: response.id,
              groupId,
              authorType: "agent",
              authorId: aiMember.agentId,
              content: response.content,
              createdAt: response.createdAt.toISOString(),
              replyToId: response.replyToId || undefined,
              agent: response.Agent ? {
                id: response.Agent.id,
                name: response.Agent.name,
                avatar: response.Agent.avatar,
              } : undefined,
            });
          }
        } catch (error) {
          console.error(`Error generating response for AI ${aiMember.agentId}:`, error);
          // Emit stopped even on error
          emitGroupAIStopped(groupId, aiMember.agentId);
        }
      }

      // 5. Update story progress (if Story Mode active)
      if (group.storyMode) {
        await groupStoryEngineService
          .updateStoryProgress(groupId)
          .catch((err) => console.error("Error updating story progress:", err));
      }

      // 6. Run AI Director autopilot (if enabled)
      if (group.directorEnabled) {
        await groupAIDirectorService
          .runDirectorAutopilot(groupId)
          .catch((err) => console.error("Error in director autopilot:", err));
      }

      return responses;
    } catch (error) {
      console.error("Error generating AI responses:", error);
      return [];
    }
  }

  /**
   * Select which AIs will respond to a message
   *
   * Algoritmo de selección basado en:
   * 1. Menciones directas (@nombre)
   * 2. Personalidad (extraversión)
   * 3. Participación reciente (balancear)
   * 4. Estado emocional (arousal)
   * 5. Importancia narrativa (si storyMode)
   */
  private async selectRespondingAIs(
    aiMembers: any[],
    triggeringMessage: any,
    group: any
  ): Promise<any[]> {
    const scores: AISelectionScore[] = [];

    for (const member of aiMembers) {
      const score = await this.calculateAIScore(member, triggeringMessage, group);
      scores.push(score);
    }

    // Sort by descending score
    const sorted = scores.sort((a, b) => b.score - a.score);

    // Determine how many AIs will respond
    // Probability: 60% one AI, 30% two AIs, 10% three AIs
    const random = Math.random();
    let numResponding = 1;
    if (random > 0.6 && sorted.length >= 2) numResponding = 2;
    if (random > 0.9 && sorted.length >= 3) numResponding = 3;

    // If Story Mode is active, prioritize "main" characters
    if (group.storyMode) {
      const mainCharacters = sorted.filter(
        (s) => s.member.importanceLevel === "main"
      );
      if (mainCharacters.length > 0 && Math.random() > 0.3) {
        // 70% chance main character responds
        return mainCharacters.slice(0, 1).map((s) => s.member);
      }
    }

    return sorted.slice(0, numResponding).map((s) => s.member);
  }

  /**
   * Calculate score for AI selection
   */
  private async calculateAIScore(
    member: any,
    triggeringMessage: any,
    group: any
  ): Promise<AISelectionScore> {
    let score = 0;
    const reasons: string[] = [];

    // 1. Direct mentions (maximum priority)
    const content = triggeringMessage.content.toLowerCase();
    const agentName = member.agent.name.toLowerCase();
    if (content.includes(agentName) || content.includes(`@${agentName}`)) {
      score += 100;
      reasons.push("directly mentioned");
    }

    // 2. Personality - Extraversion
    if (member.agent.personalityCore) {
      const extraversion = member.agent.personalityCore.extraversion || 50;
      score += (extraversion / 100) * 20;
      if (extraversion > 70) {
        reasons.push("extroverted personality");
      }
    }

    // 3. Recent participation (balance - less participation = higher probability)
    try {
      const recentMessages = await prisma.groupMessage.count({
        where: {
          groupId: group.id,
          agentId: member.agentId,
          createdAt: {
            gte: new Date(Date.now() - 10 * 60 * 1000), // Last 10 minutes
          },
        },
      });

      const balanceScore = Math.max(0, 15 - recentMessages * 3);
      score += balanceScore;

      if (recentMessages === 0) {
        reasons.push("has not participated recently");
      }
    } catch (error) {
      console.error("Error calculating recent participation:", error);
    }

    // 4. Emotional state - Arousal
    if (member.agent.internalState) {
      const arousal = member.agent.internalState.moodArousal || 0.5;
      score += arousal * 15;
      if (arousal > 0.7) {
        reasons.push("active emotional state");
      }
    }

    // 5. Narrative importance (Story Mode)
    if (group.storyMode) {
      if (member.importanceLevel === "main") {
        score += 25;
        reasons.push("main character");
      } else if (member.importanceLevel === "secondary") {
        score += 10;
      }

      // Focus state
      if (member.isFocused) {
        score += 20;
        reasons.push("in narrative focus");
      }
    }

    // 6. Randomness (for variety)
    score += Math.random() * 10;

    return { member, score, reasons };
  }

  /**
   * Generate a single AI response
   */
  private async generateSingleAIResponse(
    agent: any,
    triggeringMessage: any,
    group: any,
    previousResponses: any[]
  ): Promise<any | null> {
    try {
      // 1. Load recent group messages
      const recentMessages = await prisma.groupMessage.findMany({
        where: { groupId: group.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          User: { select: { name: true, id: true } },
          Agent: { select: { name: true, id: true } },
        },
      });

      // 2. Retrieve relevant cross-context memories
      const relevantMemories = await crossContextMemoryService.retrieveRelevantMemories({
        agentId: agent.id,
        currentContext: "group",
        currentContextId: group.id,
        query: triggeringMessage.content,
        limit: 3,
      });

      // 3. Build prompt
      const prompt = this.buildGroupResponsePrompt(
        agent,
        triggeringMessage,
        group,
        recentMessages.reverse(), // Chronological order
        relevantMemories,
        previousResponses
      );

      // 4. Generar respuesta con LLM
      const venice = getVeniceClient();
      const response = await venice.generateWithSystemPrompt(
        prompt,
        triggeringMessage.content,
        {
          model: "venice-uncensored",
          temperature: 0.8,
          maxTokens: 200, // Respuestas cortas para grupos
        }
      );

      const responseText = response.text.trim();

      if (!responseText || responseText.length === 0) {
        return null;
      }

      // 5. Obtener siguiente turnNumber
      const lastMessage = await prisma.groupMessage.findFirst({
        where: { groupId: group.id },
        orderBy: { turnNumber: "desc" },
        select: { turnNumber: true },
      });
      const nextTurnNumber = (lastMessage?.turnNumber || 0) + 1;

      // 6. Guardar mensaje de la IA
      const aiMessage = await prisma.groupMessage.create({
        data: {
          id: nanoid(),
          groupId: group.id,
          authorType: "agent",
          agentId: agent.id,
          content: responseText,
          contentType: "text",
          turnNumber: nextTurnNumber,
          replyToId: triggeringMessage.id,
          agentEmotion: agent.internalState
            ? ({
                valence: agent.internalState.moodValence,
                arousal: agent.internalState.moodArousal,
                dominance: agent.internalState.moodDominance,
              } as any)
            : null,
          updatedAt: new Date(),
        },
        include: {
          Agent: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      // 7. Update statistics
      await Promise.all([
        // Update grupo
        prisma.group.update({
          where: { id: group.id },
          data: {
            totalMessages: { increment: 1 },
            lastActivityAt: new Date(),
          },
        }),
        // Update miembro IA
        prisma.groupMember.update({
          where: { id: agent.membershipId },
          data: {
            totalMessages: { increment: 1 },
            lastMessageAt: new Date(),
            screenTime: { increment: responseText.length },
          },
        }),
        // Update simulation state
        prisma.groupSimulationState.update({
          where: { groupId: group.id },
          data: {
            currentTurn: nextTurnNumber,
            totalMessages: { increment: 1 },
            lastSpeakerId: agent.id,
            lastSpeakerType: "agent",
            lastUpdated: new Date(),
          },
        }),
      ]);

      // 8. Save cross-context memory (async)
      this.saveMemoryAsync(agent.id, group.id, triggeringMessage, responseText);

      return aiMessage;
    } catch (error) {
      console.error(`Error generating AI response for agent ${agent.id}:`, error);
      return null;
    }
  }

  /**
   * Build prompt for AI group response
   */
  private buildGroupResponsePrompt(
    agent: any,
    triggeringMessage: any,
    group: any,
    recentMessages: any[],
    relevantMemories: any[],
    previousResponses: any[]
  ): string {
    let prompt = `${agent.systemPrompt}\n\n`;

    prompt += `=== CONTEXTO DEL GRUPO ===\n`;
    prompt += `Grupo: ${group.name}\n`;
    if (group.description) {
      prompt += `Descripción: ${group.description}\n`;
    }
    prompt += `Participantes: ${group.members.length} (usuarios e IAs)\n`;

    // Story Mode context
    if (group.storyMode && group.currentStoryBeat) {
      try {
        const currentBeat = JSON.parse(group.currentStoryBeat as string);
        prompt += `\n[MODO HISTORIA ACTIVO]\n`;
        prompt += `Beat narrativo actual: ${currentBeat.description}\n`;
        prompt += `Objetivos: ${currentBeat.objectives?.join(", ") || "N/A"}\n`;
        if (group.currentSceneDirection) {
          const sceneDir = group.currentSceneDirection as any;
          prompt += `Dirección de escena: ${sceneDir.direction}\n`;
        }
      } catch (error) {
        console.error("Error parsing story beat:", error);
      }
    }

    // Emergent event context
    if (group.currentEmergentEvent) {
      const eventContext =
        groupEmergentEventsService.getEventContext(group);
      if (eventContext) {
        prompt += `\n${eventContext}\n`;
      }
    }

    // Memorias cross-contexto
    if (relevantMemories.length > 0) {
      prompt += `\n=== MEMORIAS RELEVANTES ===\n`;
      prompt += `(Recuerdos de otras conversaciones que podrían ser relevantes)\n`;
      relevantMemories.forEach(({ memory, relevanceReason }) => {
        const source =
          memory.sourceType === "individual_chat"
            ? "conversación individual"
            : "otro grupo";
        prompt += `- [${source}] ${memory.summary} (${relevanceReason})\n`;
      });
    } else {
      prompt += `\n=== MEMORIAS RELEVANTES ===\n`;
      prompt += `No hay memorias relevantes de otras conversaciones.\n`;
    }

    // Recent conversation
    prompt += `\n=== CONVERSACIÓN RECIENTE ===\n`;
    recentMessages.forEach((msg: any) => {
      const author = msg.authorType === "user" ? msg.User?.name : msg.Agent?.name;
      const prefix = msg.isSystemMessage ? "[SISTEMA]" : `${author}:`;
      prompt += `${prefix} ${msg.content}\n`;
    });

    // Responses from other AIs (if any)
    if (previousResponses.length > 0) {
      prompt += `\n=== RESPUESTAS DE OTRAS IAs ===\n`;
      previousResponses.forEach((resp) => {
        prompt += `${resp.agent?.name}: ${resp.content}\n`;
      });
    }

    // Instructions
    prompt += `\n=== INSTRUCCIONES ===\n`;
    prompt += `Responde como ${agent.name} a este mensaje grupal. Tu respuesta debe:\n`;
    prompt += `- Ser natural y conversacional (2-3 oraciones máximo)\n`;
    prompt += `- Considerar el contexto del grupo y los participantes\n`;
    prompt += `- Si hay memorias relevantes, puedes referenciarlas sutilmente\n`;
    prompt += `- NO incluyas tu nombre al inicio de la respuesta\n`;
    prompt += `- Contribuir a la conversación de forma significativa\n`;

    if (group.storyMode) {
      prompt += `- [STORY MODE] Contribuir al desarrollo narrativo del grupo\n`;
    }

    return prompt;
  }

  /**
   * Save cross-context memory asynchronously
   */
  private async saveMemoryAsync(
    agentId: string,
    groupId: string,
    triggeringMessage: any,
    aiResponse: string
  ): Promise<void> {
    try {
      // Create a summary of the interaction
      const userName = triggeringMessage.user?.name || "Usuario";
      const summary = `${userName} dijo: "${triggeringMessage.content.substring(0, 100)}". Yo respondí: "${aiResponse.substring(0, 100)}"`;

      // Determinar importancia basada en longitud y contenido
      const importance = this.calculateImportance(triggeringMessage.content, aiResponse);

      // Determinar tono emocional
      const emotionalTone = this.determineEmotionalTone(
        triggeringMessage.content + " " + aiResponse
      );

      await crossContextMemoryService.saveMemory({
        agentId,
        sourceType: "group_interaction",
        sourceGroupId: groupId,
        summary,
        involvedUsers: [
          {
            userId: triggeringMessage.userId!,
            userName,
          },
        ],
        emotionalTone,
        importance,
      });
    } catch (error) {
      console.error("Error saving cross-context memory:", error);
      // No lanzar error para no afectar el flujo principal
    }
  }

  /**
   * Calculate importance of an interaction
   */
  private calculateImportance(userMessage: string, aiResponse: string): number {
    const totalLength = userMessage.length + aiResponse.length;

    // Longer messages tend to be more important
    let importance = Math.min(totalLength / 500, 0.7);

    // Palabras clave que indican importancia
    const importantKeywords = [
      "importante",
      "siempre",
      "nunca",
      "amor",
      "odio",
      "promesa",
      "secreto",
      "important",
      "always",
      "never",
      "love",
      "hate",
      "promise",
      "secret",
    ];

    const combined = (userMessage + " " + aiResponse).toLowerCase();
    const hasImportantKeywords = importantKeywords.some((keyword) =>
      combined.includes(keyword)
    );

    if (hasImportantKeywords) {
      importance = Math.min(importance + 0.3, 1.0);
    }

    return importance;
  }

  /**
   * Determine emotional tone
   */
  private determineEmotionalTone(text: string): string {
    const lowerText = text.toLowerCase();

    const intenseKeywords = [
      "!!",
      "???",
      "amor",
      "odio",
      "increíble",
      "terrible",
      "love",
      "hate",
      "amazing",
      "terrible",
    ];

    const hasIntenseMarkers = intenseKeywords.some((keyword) =>
      lowerText.includes(keyword)
    );

    return hasIntenseMarkers ? "intense" : "neutral";
  }

  /**
   * Load complete group context
   */
  private async loadGroupContext(groupId: string): Promise<any | null> {
    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          GroupMember: {
            where: { isActive: true },
            include: {
              Agent: {
                include: {
                  PersonalityCore: true,
                  InternalState: true,
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
          GroupSimulationState: true,
        },
      });

      // Normalize to use 'members' for easier access in the rest of the code
      if (group) {
        const normalizedGroup = {
          ...group,
          members: group.GroupMember.map((member: any) => ({
            ...member,
            agent: member.Agent ? {
              ...member.Agent,
              personalityCore: member.Agent.PersonalityCore,
              internalState: member.Agent.InternalState,
              membershipId: member.id,
            } : null,
            user: member.User,
          })),
          simulationState: group.GroupSimulationState,
        };
        return normalizedGroup;
      }

      return group;
    } catch (error) {
      console.error("Error loading group context:", error);
      return null;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const groupMessageService = new GroupMessageService();
