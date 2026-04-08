/**
 * API Route: Multimodal Agent Message
 *
 * Endpoint that processes user messages and generates multimodal responses:
 * - Analyzes message emotion
 * - Generates text response
 * - Generates audio (character voice)
 * - Generates image (facial expression)
 * - Autonomously decides which combination to send
 *
 * POST /api/agents/[id]/message-multimodal
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { getEmotionalAnalyzer } from "@/lib/multimodal/emotional-analyzer";
import { getEmotionalOrchestrator } from "@/lib/multimodal/orchestrator";
import { getVoiceService } from "@/lib/multimodal/voice-service";
import { getUserTier } from "@/lib/billing/user-tier";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const agentId = id;

    // 1. Verify that agent exists and user has access
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        InternalState: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log(`[MultimodalAPI] Processing message for agent: ${agent.name}`);

    // 2. Analyze emotion of user message
    const analyzer = getEmotionalAnalyzer();
    const userEmotion = await analyzer.analyzeMessage(message);

    console.log(`[MultimodalAPI] User emotion:`, userEmotion);

    // 3. Generate complete agent response (with emotion and personality)
    const orchestrator = getEmotionalOrchestrator();
    const agentResponse = await orchestrator.generateResponse({
      agentId,
      userMessage: message,
      userEmotion,
      includeMetadata: true,
    });

    console.log(`[MultimodalAPI] Agent response generated`);
    console.log(`[MultimodalAPI] Agent emotion:`, agentResponse.emotion);

    // 4. Get user tier
    const userTier = await getUserTier(user.id);
    console.log(`[MultimodalAPI] User tier:`, userTier);

    // 5. Decidir qué modalidades incluir
    const modalityDecision = decideModalities({
      messageLength: agentResponse.text.length,
      emotion: agentResponse.emotion,
      userTier,
      hasVoice: true, // Voice is available for all agents
    });

    console.log(`[MultimodalAPI] Modalities:`, modalityDecision);

    // 6. Generar contenido según modalidades
    const responseContent: {
      text: string;
      audioUrl?: string;
      imageUrl?: string;
      emotion: {
        type: string;
        intensity: "low" | "medium" | "high";
      };
    } = {
      text: agentResponse.text,
      emotion: {
        type: agentResponse.emotion.dominantEmotion,
        intensity: agentResponse.emotion.intensity,
      },
    };

    // 6.1 Generar imagen (expresión facial) - Comentado por ahora
    // TODO: Descomentar cuando se necesite generación de imágenes
    /*
    if (modalityDecision.includeImage && agent.avatar) {
      try {
        const visualService = getVisualGenerationService();
        const imageResult = await visualService.getOrGenerateExpression({
          agentId,
          emotionType: agentResponse.emotion.dominantEmotion,
          intensity: agentResponse.emotion.intensity,
          contentType: "sfw",
          userTier,
        });

        responseContent.imageUrl = imageResult.imageUrl;
        console.log(`[MultimodalAPI] Image generated: ${imageResult.cached ? "cached" : "new"}`);
      } catch (error) {
        console.error(`[MultimodalAPI] Error generating image:`, error);
        // Continuar sin imagen si falla
      }
    }
    */

    // 6.2 Generar audio (voz del personaje)
    if (modalityDecision.includeAudio) {
      try {
        const voiceService = getVoiceService();
        const audioResult = await voiceService.generateSpeech({
          text: agentResponse.text,
          agentId,
          emotion: agentResponse.emotion.dominantEmotion,
          intensity: agentResponse.emotion.intensity,
        });

        responseContent.audioUrl = audioResult.audioUrl;
        console.log(`[MultimodalAPI] Audio generated: ${audioResult.cached ? "cached" : "new"}`);
      } catch (error) {
        console.error(`[MultimodalAPI] Error generating audio:`, error);
        // Continuar sin audio si falla
      }
    }

    // 7. Guardar mensaje en la base de datos - Comentado por ahora
    // TODO: Descomentar cuando se implemente el modelo Conversation
    /*
    const conversation = await prisma.conversation.findFirst({
      where: {
        agentId,
        userId: user.id,
      },
    });

    if (conversation) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: agentResponse.text,
          metadata: {
            audioUrl: responseContent.audioUrl,
            imageUrl: responseContent.imageUrl,
            emotion: responseContent.emotion,
            modalities: modalityDecision,
          },
        },
      });
    }
    */

    // 8. Retornar respuesta multimodal
    return NextResponse.json({
      success: true,
      response: responseContent,
      messageId: Date.now().toString(),
    });
  } catch (error) {
    console.error("[MultimodalAPI] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Decide qué modalidades incluir en la respuesta
 * La IA decide autónomamente basándose en contexto
 */
function decideModalities(params: {
  messageLength: number;
  emotion: {
    dominantEmotion: string;
    intensity: "low" | "medium" | "high";
  };
  userTier: string;
  hasVoice: boolean;
}): {
  includeText: boolean;
  includeAudio: boolean;
  includeImage: boolean;
} {
  const { messageLength, emotion, userTier, hasVoice } = params;

  // Siempre incluir texto
  const includeText = true;

  // Incluir audio si:
  // - El agente tiene voz configurada
  // - Y (mensaje corto-medio O emoción intensa)
  // - Y el usuario tiene tier plus/ultra
  const includeAudio =
    hasVoice &&
    (messageLength < 200 || emotion.intensity === "high") &&
    (userTier === "plus" || userTier === "ultra");

  // Incluir imagen deshabilitado por ahora
  const includeImage = false;

  return {
    includeText,
    includeAudio,
    includeImage,
  };
}
