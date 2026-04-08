import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MINECRAFT_ERROR_CODES } from "@/types/minecraft-chat";

/**
 * GET /api/v1/minecraft/agents/[id]
 *
 * Obtiene información detallada de un agente para Minecraft
 *
 * Headers:
 * - X-API-Key: API key del usuario
 *
 * Response:
 * {
 *   "agent": {
 *     "id": "agent_123",
 *     "name": "Alice",
 *     "avatar": "https://...",
 *     "personality": { ... },
 *     "appearance": {
 *       "skinUrl": "https://.../skin.png",
 *       "hairColor": "#8B4513",
 *       "skinTone": "#F5D7B1"
 *     },
 *     "voice": {
 *       "voiceId": "...",
 *       "enabled": true
 *     },
 *     "currentState": {
 *       "mood": "happy",
 *       "arousal": 0.6,
 *       "dominance": 0.5
 *     }
 *   }
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // 1. Authentication
    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "API Key requerida",
          code: MINECRAFT_ERROR_CODES.PLAYER_NOT_AUTHENTICATED,
        },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { apiKey },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "API Key inválida",
          code: MINECRAFT_ERROR_CODES.PLAYER_NOT_AUTHENTICATED,
        },
        { status: 401 }
      );
    }

    // 2. Buscar agente
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        PersonalityCore: true,
        InternalState: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        {
          error: "Agente no encontrado",
          code: MINECRAFT_ERROR_CODES.AGENT_NOT_FOUND,
        },
        { status: 404 }
      );
    }

    // 3. Verificar permisos (el agente debe pertenecer al usuario)
    if (agent.userId !== user.id) {
      return NextResponse.json(
        {
          error: "No tienes permiso para acceder a este agente",
          code: MINECRAFT_ERROR_CODES.PLAYER_NOT_AUTHENTICATED,
        },
        { status: 403 }
      );
    }

    // 4. Formatear respuesta con datos relevantes para Minecraft
    const profile = agent.profile as any;
    const appearance = profile?.apariencia || {};

    const response = {
      agent: {
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar,
        personality: {
          extraversion: agent.PersonalityCore?.extraversion || 50,
          agreeableness: agent.PersonalityCore?.agreeableness || 50,
          conscientiousness: agent.PersonalityCore?.conscientiousness || 50,
          neuroticism: agent.PersonalityCore?.neuroticism || 50,
          openness: agent.PersonalityCore?.openness || 50,
          coreValues: (agent.PersonalityCore?.coreValues as string[]) || [],
        },
        appearance: {
          skinUrl: `/api/v1/minecraft/agents/${agent.id}/skin`,
          gender: profile?.identidad?.genero || "unknown",
          age: profile?.identidad?.edad || 25,
          hairColor: appearance.colorPelo || "#8B4513",
          eyeColor: appearance.colorOjos || "#8B4513",
          skinTone: appearance.tonoPiel || "#F5D7B1",
          height: appearance.altura || 170,
        },
        voice: {
          voiceId: (agent as any).voiceId || undefined,
          enabled: false, // Simplificado
          stability: 0.5,
        },
        currentState: {
          mood: "neutral",
          arousal: agent.InternalState?.moodArousal || 0.5,
          dominance: agent.InternalState?.moodDominance || 0.5,
          pleasure: agent.InternalState?.moodValence || 0.5,
        },
        isActive: true, // Simplificado
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching Minecraft agent:", error);
    return NextResponse.json(
      {
        error: "Error al obtener agente",
        code: MINECRAFT_ERROR_CODES.GENERATION_FAILED,
      },
      { status: 500 }
    );
  }
}
