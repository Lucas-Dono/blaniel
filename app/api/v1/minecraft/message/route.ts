import { NextRequest, NextResponse } from "next/server";
import { minecraftMessageHandler } from "@/lib/minecraft/minecraft-message-handler";
import {
  MinecraftMessageRequestSchema,
  MinecraftChatError,
  MINECRAFT_ERROR_CODES,
} from "@/types/minecraft-chat";
import { checkTierRateLimit } from "@/lib/redis/ratelimit";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractTokenFromHeader } from "@/lib/jwt";

/**
 * POST /api/v1/minecraft/message
 *
 * Main endpoint for sending messages from Minecraft
 *
 * Authentication: JWT token in Authorization: Bearer <token> header
 *
 * Body:
 * {
 *   "content": "Hello, how are you?",
 *   "player": {
 *     "uuid": "...",
 *     "name": "Steve",
 *     "position": { "x": 100, "y": 64, "z": 200, "yaw": 90, "pitch": 0 },
 *     "userId": "user_id_from_db" (optional)
 *   },
 *   "nearbyAgents": [
 *     {
 *       "agentId": "agent_123",
 *       "entityId": 42,
 *       "name": "Alice",
 *       "position": { "x": 102, "y": 64, "z": 201 },
 *       "isActive": true
 *     }
 *   ],
 *   "replyToId": "msg_abc" (optional),
 *   "config": { "maxResponders": 2 } (optional)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "userMessage": { "messageId": "...", "content": "...", "timestamp": "..." },
 *   "proximityContext": { ... },
 *   "agentResponses": [
 *     {
 *       "messageId": "...",
 *       "agentId": "...",
 *       "agentName": "Alice",
 *       "content": "Hello! I'm doing well, thank you.",
 *       "emotion": "joy",
 *       "timestamp": "...",
 *       "animationHint": "waving"
 *     }
 *   ],
 *   "metadata": { "responseTime": 1234, "agentsEvaluated": 3, "agentsResponded": 1 }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");

    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: "Token requerido", code: MINECRAFT_ERROR_CODES.PLAYER_NOT_AUTHENTICATED },
        { status: 401 }
      );
    }

    const tokenData = await verifyToken(token);

    if (!tokenData) {
      return NextResponse.json(
        { error: "Token inválido", code: MINECRAFT_ERROR_CODES.PLAYER_NOT_AUTHENTICATED },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: {
        id: true,
        plan: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado", code: MINECRAFT_ERROR_CODES.PLAYER_NOT_AUTHENTICATED },
        { status: 404 }
      );
    }

    const rateLimitResult = await checkTierRateLimit(user.id, user.plan);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Límite de tasa excedido",
          code: MINECRAFT_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          ...rateLimitResult.error
        },
        { status: 429 }
      );
    }

    const body = await req.json();

    const validation = MinecraftMessageRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          code: MINECRAFT_ERROR_CODES.INVALID_MESSAGE,
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { content, player, nearbyAgents, replyToId, config} = validation.data;

    player.userId = user.id;

    const result = await minecraftMessageHandler.processMessage(
      player,
      content,
      nearbyAgents,
      replyToId
    );

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error("Error in Minecraft message endpoint:", error);

    if (error instanceof MinecraftChatError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        code: MINECRAFT_ERROR_CODES.GENERATION_FAILED
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/minecraft/message
 * 
 * Returns information about the endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/minecraft/message",
    method: "POST",
    description: "Envía mensajes desde Minecraft y recibe respuestas de agentes IA",
    authentication: "JWT token en header Authorization: Bearer <token>",
    rateLimit: {
      free: "10 req/min, 100 req/hora, 300 req/día",
      plus: "30 req/min, 600 req/hora, 3000 req/día",
      ultra: "100 req/min, 6000 req/hora, 10000 req/día",
    },
    documentation: "https://docs.blaniel.com/minecraft-integration",
  });
}
