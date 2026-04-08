import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MINECRAFT_ERROR_CODES } from "@/types/minecraft-chat";
import { verifyToken, extractTokenFromHeader } from "@/lib/jwt";

/**
 * GET /api/v1/minecraft/agents
 *
 * Lista TODOS los agentes disponibles para Minecraft:
 * - Agentes privados del usuario
 * - Agentes públicos de otros usuarios
 *
 * Headers:
 * - Authorization: Bearer <JWT token>
 *
 * Query params:
 * - ?active=true (opcional): Solo agentes activos
 * - ?mine=true (opcional): Solo mis agentes
 *
 * Response:
 * {
 *   "agents": [
 *     {
 *       "id": "agent_123",
 *       "name": "Alice",
 *       "avatar": "https://...",
 *       "personality": { ... },
 *       "isPublic": true,
 *       "isOwned": false
 *     }
 *   ]
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authentication
    const authHeader = req.headers.get("authorization");
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        {
          error: "Token requerido",
          code: MINECRAFT_ERROR_CODES.PLAYER_NOT_AUTHENTICATED,
        },
        { status: 401 }
      );
    }

    const tokenData = await verifyToken(token);
    if (!tokenData) {
      return NextResponse.json(
        {
          error: "Token inválido",
          code: MINECRAFT_ERROR_CODES.PLAYER_NOT_AUTHENTICATED,
        },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "Usuario no encontrado",
          code: MINECRAFT_ERROR_CODES.PLAYER_NOT_AUTHENTICATED,
        },
        { status: 404 }
      );
    }

    // 2. Obtener parámetros
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") === "true";
    const mineOnly = searchParams.get("mine") === "true";

    // 3. Buscar agentes (propios + públicos)
    const whereClause = mineOnly
      ? { userId: user.id }
      : {
          OR: [
            { userId: user.id }, // Mis agentes (privados o públicos)
            { visibility: "public" }, // Agentes públicos de otros
            { visibility: "featured" }, // Agentes destacados
          ],
        };

    const agents = await prisma.agent.findMany({
      where: {
        ...whereClause,
        ...(activeOnly && { isActive: true }),
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        visibility: true,
        userId: true,
        PersonalityCore: {
          select: {
            extraversion: true,
            agreeableness: true,
            conscientiousness: true,
            neuroticism: true,
            openness: true,
          },
        },
        profile: true,
      },
      orderBy: [
        { visibility: "desc" }, // Featured primero
        { createdAt: "desc" },
      ],
      take: 100, // Límite razonable
    });

    // 4. Formatear respuesta
    const formattedAgents = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar,
      personality: agent.PersonalityCore || {},
      profile: {
        age: (agent.profile as any)?.identidad?.edad,
        occupation: (agent.profile as any)?.ocupacion?.profesion,
        gender: (agent.profile as any)?.identidad?.genero,
      },
      isPublic: agent.visibility === "public" || agent.visibility === "featured",
      isOwned: agent.userId === user.id,
      isFeatured: agent.visibility === "featured",
    }));

    return NextResponse.json({
      agents: formattedAgents,
      total: formattedAgents.length,
      ownedCount: formattedAgents.filter((a) => a.isOwned).length,
      publicCount: formattedAgents.filter((a) => a.isPublic && !a.isOwned).length,
    });
  } catch (error) {
    console.error("Error fetching Minecraft agents:", error);
    return NextResponse.json(
      {
        error: "Error al obtener agentes",
        code: MINECRAFT_ERROR_CODES.GENERATION_FAILED,
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS para CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
