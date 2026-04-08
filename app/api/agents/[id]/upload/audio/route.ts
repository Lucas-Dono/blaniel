import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/agents/[id]/upload/audio
 *
 * Audio upload and transcription with emotional analysis
 *
 * Flow:
 * 1. Receives user audio
 * 2. Transcribes with Whisper (gpt-4o-audio-preview)
 * 3. Analyzes user emotion, tone, and context
 * 4. Saves message to DB
 * 5. Returns transcription and emotional analysis
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: agentId } = await params;
    const formData = await request.formData();

    const audioFile = (formData as any).get("audio") as Blob | null;
    const duration = (formData as any).get("duration") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    // Check that agent exists and belongs to user
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, userId: true, name: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Convert Blob to File for OpenAI
    const audioBuffer = await audioFile.arrayBuffer();
    const file = new File([audioBuffer], "audio.webm", {
      type: audioFile.type,
    });

    // Step 1: Transcribir audio con Whisper
    console.log("Transcribing audio...");
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "es", // Español
      response_format: "verbose_json",
    });

    const transcribedText = transcription.text;

    if (!transcribedText || transcribedText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not transcribe audio" },
        { status: 400 }
      );
    }

    // Step 2: Analizar emoción y tono del usuario usando GPT-4
    console.log("Analyzing emotional state...");
    const emotionalAnalysis = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Eres un experto en análisis emocional. Analiza el siguiente texto transcrito de un mensaje de voz y determina:
1. La emoción principal del usuario (happy, sad, angry, anxious, excited, neutral, confused, frustrated)
2. La intensidad emocional (low, medium, high)
3. El tono de voz implícito (formal, casual, enthusiastic, monotone, urgent)
4. El contexto emocional (qué está sintiendo y por qué)

Responde SOLO con un JSON válido en este formato exacto:
{
  "emotion": "emotion_name",
  "intensity": "low|medium|high",
  "tone": "tone_description",
  "context": "brief emotional context"
}`,
        },
        {
          role: "user",
          content: `Texto transcrito: "${transcribedText}"`,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const analysisContent = emotionalAnalysis.choices[0]?.message?.content;
    let emotionalData = {
      emotion: "neutral",
      intensity: "medium",
      tone: "casual",
      context: "Usuario envió un mensaje de voz",
    };

    if (analysisContent) {
      try {
        emotionalData = JSON.parse(analysisContent);
      } catch (error) {
        console.error("Error parsing emotional analysis:", error);
      }
    }

    // Step 3: Guardar mensaje en base de datos
    const message = await prisma.message.create({
      data: {
        id: nanoid(),
        agentId,
        userId: user.id,
        content: transcribedText,
        role: "user",
        metadata: {
          type: "audio",
          duration: duration ? parseInt(duration) : 0,
          emotion: emotionalData.emotion,
          intensity: emotionalData.intensity,
          tone: emotionalData.tone,
          emotionalContext: emotionalData.context,
          transcribedAt: new Date().toISOString(),
        },
      },
    });

    // Step 4: Retornar resultado
    return NextResponse.json({
      success: true,
      messageId: message.id,
      transcription: transcribedText,
      emotional: emotionalData,
      duration: duration ? parseInt(duration) : 0,
    });
  } catch (error: any) {
    console.error("Error in audio upload:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
