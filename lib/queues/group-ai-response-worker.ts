/**
 * BullMQ Worker for Group AI Responses
 *
 * Procesa los jobs de respuesta de IAs en grupos:
 * - FLUSH_BUFFER: Obtener mensajes del buffer, calcular qué IAs responderán
 * - GENERATE_RESPONSE: Generar la respuesta de una IA específica
 */

import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { getVeniceClient } from "@/lib/emotional-system/llm/venice";
import { groupMessageBufferService } from "@/lib/groups/group-message-buffer.service";
import type { BufferedMessage } from "@/lib/director/types";
import { nanoid } from "nanoid";
import { groupAIStateService } from "@/lib/groups/group-ai-state.service";
import { groupDispositionService } from "@/lib/groups/group-disposition.service";
import {
  calculateTypingDuration,
  calculateReadingTime,
} from "@/lib/groups/group-typing-calculator";
import {
  GroupAIJobTypes,
  enqueueAIResponse,
  type FlushBufferJobData,
  type GenerateResponseJobData,
} from "./group-ai-response-jobs";
import {
  emitGroupMessage,
  emitGroupAIResponding,
  emitGroupAIStopped,
} from "@/lib/socket/server";

// Helper for typing events (may not exist in socket server)
const emitGroupTyping = (groupId: string, agentId: string, isTyping: boolean) => {
  // No-op if not implemented in socket server
  console.log(`[GroupTyping] ${agentId} is ${isTyping ? 'typing' : 'not typing'} in ${groupId}`);
};
import type { GroupMessageEvent } from "@/lib/socket/events";
import { checkAvailability, recordSpacedResponse } from "@/lib/chat/availability-system";
import { relationSyncService } from "@/lib/chat/relation-sync.service";
import { sharedKnowledgeService } from "@/lib/groups/shared-knowledge.service";
import { groupAIDirectorService } from "@/lib/groups/group-ai-director.service";

// Director Conversacional
import {
  conversationalDirectorService,
  sceneExecutorService,
  loopDetectorService,
  tensionSeedService,
  sceneCatalogService,
} from "@/lib/director";

// Check if Redis is configured for BullMQ
const isRedisConfigured = !!(
  process.env.REDIS_URL ||
  (process.env.REDIS_HOST && process.env.REDIS_PORT)
);

// Connection config
const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
};

// ============================================================================
// JOB HANDLERS
// ============================================================================

/**
 * Procesar flush del buffer de mensajes
 */
export async function handleBufferFlush(
  data: FlushBufferJobData
): Promise<{ processed: boolean; aiCount: number }> {
  const { groupId } = data;

  console.log(`[GroupAIWorker] Processing buffer flush for group ${groupId}`);

  // 1. Obtener mensajes del buffer
  const messages = await groupMessageBufferService.flushBuffer(groupId);

  if (messages.length === 0) {
    console.log(`[GroupAIWorker] No messages in buffer for group ${groupId}`);
    return { processed: false, aiCount: 0 };
  }

  console.log(`[GroupAIWorker] Found ${messages.length} messages in buffer`);

  // 2. Verificar que el grupo esté activo y tenga autoAIResponses habilitado
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      GroupMember: {
        where: { isActive: true, memberType: "agent" },
        include: { Agent: true },
      },
      GroupSceneState: true,
    },
  });

  if (!group || group.status !== "ACTIVE" || !group.autoAIResponses) {
    console.log(`[GroupAIWorker] Group ${groupId} not eligible for AI responses`);
    return { processed: false, aiCount: 0 };
  }

  // 3. Si el Director está habilitado, usar flujo con Director
  if (group.directorVersion >= 1) {
    console.log(`[GroupAIWorker] Director enabled for group ${groupId}`);
    return await handleBufferFlushWithDirector(group, messages);
  }

  // 3. Identificar el usuario que escribió el último mensaje
  const lastMessage = messages[messages.length - 1];
  const triggeredByUserId = lastMessage.userId;
  const triggeredByUserName = lastMessage.userName;

  // 4. Combinar menciones de todos los mensajes
  const allMentionedAgents = [
    ...new Set(messages.flatMap((m) => m.mentionedAgents)),
  ];

  // 5. Combinar contenido de todos los mensajes para el análisis
  const combinedContent = messages.map((m) => m.content).join(" ");

  // 6. Calcular disposition scores
  const scores = await groupDispositionService.calculateGroupScores(
    groupId,
    triggeredByUserId,
    combinedContent,
    allMentionedAgents
  );

  if (scores.length === 0) {
    console.log(`[GroupAIWorker] No AIs available to respond in group ${groupId}`);
    return { processed: true, aiCount: 0 };
  }

  // 7. Seleccionar qué IAs responderán
  const respondingAIs = groupDispositionService.selectRespondingAIs(scores);

  console.log(
    `[GroupAIWorker] Selected ${respondingAIs.length} AIs to respond:`,
    respondingAIs.map((ai) => `${ai.agentName} (score: ${ai.score.toFixed(1)})`)
  );

  // 8. Encolar jobs de respuesta para cada IA
  for (let i = 0; i < respondingAIs.length; i++) {
    const ai = respondingAIs[i];

    await enqueueAIResponse({
      groupId,
      agentId: ai.agentId,
      agentName: ai.agentName,
      triggeredByUserId,
      triggeredByUserName,
      bufferedMessages: messages as any,
      dispositionScore: ai.score,
      responseIndex: i,
    });
  }

  return { processed: true, aiCount: respondingAIs.length };
}

/**
 * Procesar flush del buffer con Director Conversacional
 */
async function handleBufferFlushWithDirector(
  group: any,
  messages: BufferedMessage[]
): Promise<{ processed: boolean; aiCount: number }> {
  const groupId = group.id;

  console.log(`[Director] Processing buffer with Director for group ${groupId}`);

  // 1. Preparar contexto para el Director
  const aiMembers = group.GroupMember.map((m: any) => ({
    id: m.Agent.id,
    name: m.Agent.name,
    personality: m.Agent.personalityCore,
  }));

  // 2. Obtener mensajes recientes para contexto
  const recentMessages = await prisma.groupMessage.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      User: { select: { name: true } },
      Agent: { select: { id: true, name: true } },
    },
  });

  // 3. Analizar estado actual del grupo
  const {
    participationBalance,
    conversationEnergy,
    narrativeTension,
  } = await groupAIDirectorService.analyzeGroup(groupId);

  // 4. Detectar loops
  const detectedLoops = await loopDetectorService.detectLoops(
    groupId,
    recentMessages as any
  );

  if (detectedLoops.length > 0) {
    console.log(
      `[Director] Loops detectados: ${detectedLoops.map((l) => l.type).join(", ")}`
    );
  }

  // 5. Contar semillas activas
  const activeSeedsCount = await prisma.tensionSeed.count({
    where: {
      groupId,
      status: { in: ["LATENT", "ACTIVE", "ESCALATING"] },
    },
  });

  // 6. Consultar al Director
  const directorOutput = await conversationalDirectorService.selectScene({
    groupId,
    bufferedMessages: messages,
    groupContext: {
      aiMembers,
      recentMessages: recentMessages.reverse(),
      currentEnergy: conversationEnergy,
      currentTension: narrativeTension,
      participationBalance,
    },
    sceneState: group.GroupSceneState,
    activeSeedsCount,
    detectedLoops,
  });

  // 7. Si no hay escena, flujo normal con disposition
  if (!directorOutput.sceneCode) {
    console.log(`[Director] No scene selected, using normal flow`);
    return await handleBufferFlushLegacy(group, messages);
  }

  // 8. Ejecutar escena seleccionada
  return await executeSceneResponse(group, messages, directorOutput);
}

/**
 * Ejecuta respuesta basada en escena del Director
 */
async function executeSceneResponse(
  group: any,
  messages: BufferedMessage[],
  directorOutput: any
): Promise<{ processed: boolean; aiCount: number }> {
  const groupId = group.id;

  console.log(
    `[Director] Executing scene: ${directorOutput.sceneCode}`
  );

  try {
    // 1. Preparar plan de ejecución
    const plan = await sceneExecutorService.preparePlan(
      directorOutput.sceneCode,
      directorOutput.roleAssignments,
      { groupId, members: group.GroupMember }
    );

    if (!plan) {
      console.warn(`[Director] Failed to prepare plan for ${directorOutput.sceneCode}`);
      return await handleBufferFlushLegacy(group, messages);
    }

    // 2. Guardar estado de escena
    await prisma.groupSceneState.upsert({
      where: { groupId },
      update: {
        currentSceneId: plan.scene.id,
        currentSceneCode: plan.scene.code,
        sceneStartedAt: new Date(),
        currentStep: 0,
        totalSteps: plan.interventions.length,
        roleAssignments: directorOutput.roleAssignments,
        recentScenes: {
          push: plan.scene.code,
        },
      },
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        groupId,
        currentSceneId: plan.scene.id,
        currentSceneCode: plan.scene.code,
        sceneStartedAt: new Date(),
        currentStep: 0,
        totalSteps: plan.interventions.length,
        roleAssignments: directorOutput.roleAssignments,
        recentScenes: [plan.scene.code],
      },
    });

    // 3. Encolar respuestas según secuencia de la escena
    const lastMessage = messages[messages.length - 1];

    for (const intervention of plan.interventions) {
      const agentName =
        group.GroupMember.find((m: any) => m.AgentId === intervention.agentId)
          ?.agent.name || "Unknown";

      await enqueueAIResponse({
        groupId,
        agentId: intervention.agentId,
        agentName,
        triggeredByUserId: lastMessage.userId,
        triggeredByUserName: lastMessage.userName,
        bufferedMessages: messages as any,
        dispositionScore: 100, // Alta prioridad por escena
        responseIndex: intervention.step,
        // Directiva de escena
        sceneDirective: {
          sceneCode: plan.scene.code,
          role: intervention.role,
          directive: intervention.directive,
          targetAgents: intervention.targetAgentIds,
          emotionalTone: intervention.emotionalTone,
        },
      });
    }

    console.log(
      `[Director] Enqueued ${plan.interventions.length} responses for scene ${plan.scene.code}`
    );

    return { processed: true, aiCount: plan.interventions.length };
  } catch (error) {
    console.error("[Director] Error executing scene:", error);
    return await handleBufferFlushLegacy(group, messages);
  }
}

/**
 * Flujo legacy sin Director (original)
 */
async function handleBufferFlushLegacy(
  group: any,
  messages: BufferedMessage[]
): Promise<{ processed: boolean; aiCount: number }> {
  const groupId = group.id;

  // Lógica original del handleBufferFlush
  const lastMessage = messages[messages.length - 1];
  const triggeredByUserId = lastMessage.userId;
  const triggeredByUserName = lastMessage.userName;

  const allMentionedAgents = [
    ...new Set(messages.flatMap((m) => m.mentionedAgents)),
  ];

  const combinedContent = messages.map((m) => m.content).join(" ");

  const scores = await groupDispositionService.calculateGroupScores(
    groupId,
    triggeredByUserId,
    combinedContent,
    allMentionedAgents
  );

  if (scores.length === 0) {
    console.log(
      `[GroupAIWorker] No AIs available to respond in group ${groupId}`
    );
    return { processed: true, aiCount: 0 };
  }

  const respondingAIs = groupDispositionService.selectRespondingAIs(scores);

  console.log(
    `[GroupAIWorker] Selected ${respondingAIs.length} AIs to respond:`,
    respondingAIs.map((ai) => `${ai.agentName} (score: ${ai.score.toFixed(1)})`)
  );

  for (let i = 0; i < respondingAIs.length; i++) {
    const ai = respondingAIs[i];

    await enqueueAIResponse({
      groupId,
      agentId: ai.agentId,
      agentName: ai.agentName,
      triggeredByUserId,
      triggeredByUserName,
      bufferedMessages: messages as any,
      dispositionScore: ai.score,
      responseIndex: i,
    });
  }

  return { processed: true, aiCount: respondingAIs.length };
}

/**
 * Generar respuesta de una IA específica
 */
export async function handleGenerateResponse(
  data: GenerateResponseJobData
): Promise<{ success: boolean; messageId?: string; reason?: string }> {
  const { groupId, agentId, agentName, bufferedMessages, triggeredByUserName } = data;

  console.log(`[GroupAIWorker] Generating response for ${agentName} in group ${groupId}`);

  try {
    // 1. Verificar si la IA puede responder (coordinación)
    const { canRespond, reason } = await groupAIStateService.canRespond(
      groupId,
      agentId
    );

    if (!canRespond) {
      console.log(`[GroupAIWorker] ${agentName} cannot respond: ${reason}`);
      return { success: false, reason };
    }

    // Double verification of availability
    const relation = await prisma.relation.findFirst({
      where: {
        subjectId: agentId,
        targetId: data.triggeredByUserId,
        targetType: "user",
      },
      select: { stage: true },
    });

    const availabilityStatus = await checkAvailability(agentId, relation?.stage ?? "stranger");

    if (!availabilityStatus.available && !availabilityStatus.canRespondSpaced) {
      console.log(`[GroupAIWorker] ${agentName} no disponible: ${availabilityStatus.reason}`);
      return { success: false, reason: "agent_unavailable" };
    }

    // 2. Actualizar estado a "reading"
    await groupAIStateService.setState(groupId, agentId, "reading");

    // 3. Cargar datos del agente
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
        systemPrompt: true,
        PersonalityCore: {
          select: {
            extraversion: true,
            conscientiousness: true,
            neuroticism: true,
            agreeableness: true,
            openness: true,
          },
        },
        InternalState: {
          select: {
            moodValence: true,
            moodArousal: true,
            moodDominance: true,
          },
        },
      },
    });

    if (!agent) {
      console.error(`[GroupAIWorker] Agent ${agentId} not found`);
      await groupAIStateService.setState(groupId, agentId, "idle");
      return { success: false, reason: "agent_not_found" };
    }

    // 4. Calcular reading time (simular que la IA lee los mensajes)
    const combinedContent = bufferedMessages.map((m) => m.content).join(" ");
    const readingTime = calculateReadingTime(combinedContent, agent.PersonalityCore || undefined);

    console.log(`[GroupAIWorker] ${agentName} reading for ${readingTime}ms`);
    await delay(readingTime);

    // 5. Actualizar estado a "typing" y emitir eventos
    await groupAIStateService.setState(groupId, agentId, "typing");
    emitGroupAIResponding(groupId, agentId, agentName);
    emitGroupTyping(groupId, agentId, true);

    // 6. Cargar contexto del grupo y mensajes recientes
    const [group, recentMessages] = await Promise.all([
      prisma.group.findUnique({
        where: { id: groupId },
        select: {
          id: true,
          name: true,
          description: true,
          storyMode: true,
          currentStoryBeat: true,
        },
      }),
      prisma.groupMessage.findMany({
        where: { groupId },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: {
          User: { select: { name: true } },
          Agent: { select: { name: true } },
        },
      }),
    ]);

    if (!group) {
      console.error(`[GroupAIWorker] Group ${groupId} not found`);
      await groupAIStateService.setState(groupId, agentId, "idle");
      emitGroupTyping(groupId, agentId, false);
      emitGroupAIStopped(groupId, agentId);
      return { success: false, reason: "group_not_found" };
    }

    // 7. Construir prompt (con o sin directiva de escena)
    let prompt: string;
    if (data.sceneDirective) {
      prompt = await buildSceneDirectedPrompt(
        agent,
        group,
        bufferedMessages,
        recentMessages.reverse(),
        triggeredByUserName,
        data.sceneDirective
      );
    } else {
      prompt = await buildGroupPrompt(
        agent,
        group,
        bufferedMessages,
        recentMessages.reverse(),
        triggeredByUserName,
        agentId,
        data.triggeredByUserId
      );
    }

    // 8. Generar respuesta con LLM
    const venice = getVeniceClient();
    const response = await venice.generateWithSystemPrompt(
      prompt,
      bufferedMessages.map((m) => `${m.userName}: ${m.content}`).join("\n"),
      {
        model: "venice-uncensored",
        temperature: 0.8,
        maxTokens: 200,
      }
    );

    const responseText = response.text.trim();

    if (!responseText) {
      console.log(`[GroupAIWorker] ${agentName} generated empty response`);
      await groupAIStateService.setState(groupId, agentId, "idle");
      emitGroupTyping(groupId, agentId, false);
      emitGroupAIStopped(groupId, agentId);
      return { success: false, reason: "empty_response" };
    }

    // 9. Calcular typing duration y esperar
    const typingDuration = calculateTypingDuration(
      responseText,
      agent.PersonalityCore || undefined
    );

    console.log(`[GroupAIWorker] ${agentName} typing for ${typingDuration}ms`);
    await delay(typingDuration);

    // 10. Obtener siguiente turnNumber
    const lastMessage = await prisma.groupMessage.findFirst({
      where: { groupId },
      orderBy: { turnNumber: "desc" },
      select: { turnNumber: true },
    });
    const nextTurnNumber = (lastMessage?.turnNumber || 0) + 1;

    // 11. Guardar mensaje
    const aiMessage = await prisma.groupMessage.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        groupId,
        authorType: "agent",
        agentId,
        content: responseText,
        contentType: "text",
        turnNumber: nextTurnNumber,
        replyToId: bufferedMessages[bufferedMessages.length - 1].id,
        agentEmotion: agent.InternalState
          ? ({
              valence: agent.InternalState.moodValence,
              arousal: agent.InternalState.moodArousal,
              dominance: agent.InternalState.moodDominance,
            } as object)
          : undefined,
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

    // 12. Emitir mensaje al grupo
    const agentData = (aiMessage as any).Agent;
    const messageEvent: GroupMessageEvent = {
      id: aiMessage.id,
      groupId,
      authorType: "agent",
      authorId: agentId,
      content: responseText,
      createdAt: aiMessage.createdAt.toISOString(),
      replyToId: aiMessage.replyToId || undefined,
      agent: agentData
        ? {
            id: agentData.id,
            name: agentData.name,
            avatar: agentData.avatar,
          }
        : undefined,
    };

    // Stop typing indicator and emit message
    emitGroupTyping(groupId, agentId, false);
    emitGroupMessage(groupId, messageEvent);
    emitGroupAIStopped(groupId, agentId);

    // 13. Actualizar estadísticas
    await Promise.all([
      prisma.group.update({
        where: { id: groupId },
        data: {
          totalMessages: { increment: 1 },
          lastActivityAt: new Date(),
        },
      }),
      prisma.groupMember.updateMany({
        where: { groupId, agentId },
        data: {
          totalMessages: { increment: 1 },
          lastMessageAt: new Date(),
          screenTime: { increment: responseText.length },
        },
      }),
      prisma.groupSimulationState.upsert({
        where: { groupId },
        update: {
          currentTurn: nextTurnNumber,
          totalMessages: { increment: 1 },
          lastSpeakerId: agentId,
          lastSpeakerType: "agent",
          lastUpdated: new Date(),
        },
        create: {
          id: nanoid(),
          groupId,
          currentTurn: nextTurnNumber,
          totalMessages: 1,
          lastSpeakerId: agentId,
          lastSpeakerType: "agent",
        },
      }),
    ]);

    // 14. Actualizar estado a "cooldown"
    await groupAIStateService.setState(groupId, agentId, "cooldown", 5000);

    // Si respondió espaciado, registrar la respuesta
    if (availabilityStatus.canRespondSpaced) {
      await recordSpacedResponse(agentId);
    }

    // 15. Sincronizar relacion despues de la interaccion
    const sentiment = relationSyncService.detectSentiment(
      bufferedMessages.map((m) => m.content).join(" ")
    );
    await relationSyncService.syncAfterInteraction({
      agentId,
      userId: data.triggeredByUserId,
      groupId,
      sentiment,
      interactionType: "group",
    });

    // 16. Extraer conocimiento de los mensajes del usuario
    for (const msg of bufferedMessages) {
      await sharedKnowledgeService.extractFromMessage(
        agentId,
        msg.userId,
        msg.content,
        groupId
      );
    }

    console.log(`[GroupAIWorker] ${agentName} sent message: "${responseText.substring(0, 50)}..."`);

    // 17. Procesar consecuencias si era escena del Director
    if (data.sceneDirective) {
      await processSceneStep(groupId, data.sceneDirective);
    }

    // 18. Avanzar turnos de semillas
    await tensionSeedService.advanceTurn(groupId);

    return { success: true, messageId: aiMessage.id };
  } catch (error) {
    console.error(`[GroupAIWorker] Error generating response for ${agentName}:`, error);

    // Limpiar estado
    await groupAIStateService.setState(groupId, agentId, "idle");
    emitGroupTyping(groupId, agentId, false);
    emitGroupAIStopped(groupId, agentId);

    throw error;
  }
}

// ============================================================================
// SCENE PROCESSING
// ============================================================================

/**
 * Procesa un paso de escena y maneja consecuencias si es el último
 */
async function processSceneStep(
  groupId: string,
  sceneDirective: NonNullable<GenerateResponseJobData["sceneDirective"]>
): Promise<void> {
  try {
    const sceneState = await prisma.groupSceneState.findUnique({
      where: { groupId },
    });

    if (!sceneState || sceneState.currentSceneCode !== sceneDirective.sceneCode) {
      // Scene is no longer active or changed
      return;
    }

    const isLastStep = sceneState.currentStep === sceneState.totalSteps - 1;

    if (isLastStep) {
      console.log(
        `[Director] Último paso de escena ${sceneDirective.sceneCode}, procesando consecuencias`
      );

      // Procesar consecuencias
      const scene = await sceneCatalogService.getByCode(sceneDirective.sceneCode);
      if (scene) {
        await sceneExecutorService.processConsequences(
          groupId,
          scene,
          (sceneState.roleAssignments as Record<string, string>) || {}
        );
      }

      // Update métricas de escena
      await sceneCatalogService.incrementUsage(sceneDirective.sceneCode, true);

      // Limpiar estado de escena
      await prisma.groupSceneState.update({
        where: { groupId },
        data: {
          currentSceneId: null,
          currentSceneCode: null,
          scenesExecuted: { increment: 1 },
          lastDramaticScene: ["TENSION", "VULNERABILIDAD"].includes(scene?.category || "")
            ? new Date()
            : sceneState.lastDramaticScene,
        },
      });

      console.log(`[Director] Escena ${sceneDirective.sceneCode} completada`);
    } else {
      // Avanzar paso
      await prisma.groupSceneState.update({
        where: { groupId },
        data: { currentStep: { increment: 1 } },
      });

      console.log(
        `[Director] Avanzado a paso ${sceneState.currentStep + 1}/${sceneState.totalSteps} de escena ${sceneDirective.sceneCode}`
      );
    }
  } catch (error) {
    console.error("[Director] Error procesando paso de escena:", error);
  }
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

async function buildGroupPrompt(
  agent: any,
  group: any,
  bufferedMessages: BufferedMessage[],
  recentMessages: any[],
  triggeredByUserName: string,
  agentId: string,
  userId: string
): Promise<string> {
  let prompt = `${agent.systemPrompt || ""}\n\n`;

  prompt += `=== CONTEXTO DEL GRUPO ===\n`;
  prompt += `Grupo: ${group.name}\n`;
  if (group.description) {
    prompt += `Descripción: ${group.description}\n`;
  }

  // Story Mode context
  if (group.storyMode && group.currentStoryBeat) {
    try {
      const currentBeat = JSON.parse(group.currentStoryBeat);
      prompt += `\n[MODO HISTORIA ACTIVO]\n`;
      prompt += `Beat narrativo: ${currentBeat.description}\n`;
    } catch {
      // Ignore parse errors
    }
  }

  // Conocimiento compartido sobre el usuario
  const combinedContent = bufferedMessages.map((m) => m.content).join(" ");
  const sharedKnowledge = await sharedKnowledgeService.getKnowledgeForPrompt(
    agentId,
    userId,
    group.id,
    combinedContent
  );
  if (sharedKnowledge) {
    prompt += sharedKnowledge;
  }

  // Contexto de sincronización grupo/privado
  const syncContext = await relationSyncService.getSyncContextForPrompt(
    agentId,
    userId,
    "group"
  );
  if (syncContext) {
    prompt += syncContext;
  }

  // Mensajes recientes
  if (recentMessages.length > 0) {
    prompt += `\n=== CONVERSACIÓN RECIENTE ===\n`;
    for (const msg of recentMessages) {
      const author =
        msg.authorType === "user" ? msg.User?.name : msg.Agent?.name;
      prompt += `${author || "???"}: ${msg.content}\n`;
    }
  }

  // Nuevos mensajes a los que responder
  prompt += `\n=== NUEVOS MENSAJES ===\n`;
  for (const msg of bufferedMessages) {
    prompt += `${msg.userName}: ${msg.content}\n`;
  }

  // Instrucciones
  prompt += `\n=== INSTRUCCIONES ===\n`;
  prompt += `Responde como ${agent.name} a estos mensajes del grupo.\n`;
  prompt += `- Sé natural y conversacional (2-3 oraciones máximo)\n`;
  prompt += `- NO incluyas tu nombre al inicio\n`;
  prompt += `- Puedes responder a uno o varios mensajes\n`;
  prompt += `- Si ${triggeredByUserName} te mencionó directamente, respóndele a él/ella\n`;
  prompt += `- Si tienes conocimiento previo sobre el usuario, úsalo naturalmente\n`;

  return prompt;
}

/**
 * Construye prompt con directiva de escena
 */
async function buildSceneDirectedPrompt(
  agent: any,
  group: any,
  bufferedMessages: BufferedMessage[],
  recentMessages: any[],
  triggeredByUserName: string,
  sceneDirective: NonNullable<GenerateResponseJobData["sceneDirective"]>
): Promise<string> {
  let prompt = `${agent.systemPrompt || ""}\n\n`;

  prompt += `=== CONTEXTO DEL GRUPO ===\n`;
  prompt += `Grupo: ${group.name}\n`;

  // Mensajes recientes (contexto reducido para escenas)
  if (recentMessages.length > 0) {
    prompt += `\n=== CONVERSACIÓN RECIENTE ===\n`;
    for (const msg of recentMessages.slice(-10)) {
      const author =
        msg.authorType === "user" ? msg.User?.name : msg.Agent?.name;
      prompt += `${author || "???"}: ${msg.content}\n`;
    }
  }

  // Nuevos mensajes
  prompt += `\n=== NUEVOS MENSAJES ===\n`;
  for (const msg of bufferedMessages) {
    prompt += `${msg.userName}: ${msg.content}\n`;
  }

  // [CLAVE] Directiva de escena
  prompt += `\n=== DIRECTIVA NARRATIVA ===\n`;
  prompt += `Tu rol en esta escena: ${sceneDirective.role}\n`;
  prompt += `Directiva: ${sceneDirective.directive}\n`;

  if (sceneDirective.targetAgents && sceneDirective.targetAgents.length > 0) {
    // Get nombres de los targets
    const targetAgents = await prisma.agent.findMany({
      where: { id: { in: sceneDirective.targetAgents } },
      select: { name: true },
    });
    const targetNames = targetAgents.map((a) => a.name).join(", ");
    prompt += `Dirígete a: ${targetNames}\n`;
  }

  if (sceneDirective.emotionalTone) {
    prompt += `Tono: ${sceneDirective.emotionalTone}\n`;
  }

  prompt += `\n=== INSTRUCCIONES ===\n`;
  prompt += `Responde siguiendo la directiva narrativa.\n`;
  prompt += `- Mantente en tu rol (${sceneDirective.role})\n`;
  prompt += `- Sigue el tono indicado\n`;
  prompt += `- 2-3 oraciones máximo\n`;
  prompt += `- NO incluyas tu nombre al inicio\n`;

  return prompt;
}

// ============================================================================
// WORKER
// ============================================================================

export const groupAIWorker = isRedisConfigured
  ? new Worker(
      "group-ai-responses",
      async (job) => {
        console.log(`[GroupAIWorker] Processing job: ${job.name} (${job.id})`);

        try {
          switch (job.name) {
            case GroupAIJobTypes.FLUSH_BUFFER:
              return await handleBufferFlush(job.data as FlushBufferJobData);

            case GroupAIJobTypes.GENERATE_RESPONSE:
              return await handleGenerateResponse(
                job.data as GenerateResponseJobData
              );

            default:
              throw new Error(`Unknown job type: ${job.name}`);
          }
        } catch (error) {
          console.error(`[GroupAIWorker] Error processing job ${job.name}:`, error);
          throw error;
        }
      },
      {
        connection,
        concurrency: 5, // Procesar hasta 5 jobs en paralelo
      }
    )
  : null;

// ============================================================================
// UTILITIES
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// CLEANUP
// ============================================================================

export async function closeGroupAIWorker(): Promise<void> {
  if (groupAIWorker) {
    await groupAIWorker.close();
    console.log("[GroupAIWorker] Worker closed");
  }
}

// Log status
if (!isRedisConfigured) {
  console.warn("[GroupAIWorker] ⚠️  Redis not configured - using direct execution");
}
