import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/proactive-messages/all
 * 
 * Optimized endpoint that returns all user proactive messages
 * in a single call, avoiding multiple queries per agent.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Query optimizada: obtiene todos los mensajes proactivos pendientes
    // from the user in a single call with JOIN
    const messages = await prisma.proactiveMessage.findMany({
      where: {
        Agent: {
          userId: session.user.id,
        },
        status: {
          in: ["pending", "sent"]
        },
        OR: [
          { deliveredAt: null },
          {
            deliveredAt: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Más de 24h
            }
          }
        ]
      },
      include: {
        Agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20, // Límite razonable
    });

    // Mapear a formato esperado por el frontend
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      agentId: msg.Agent.id,
      agentName: msg.Agent.name,
      agentAvatar: msg.Agent.avatar,
      content: msg.content,
      triggerType: msg.triggerType,
      createdAt: msg.createdAt.toISOString(),
    }));

    return NextResponse.json({
      messages: formattedMessages,
      count: formattedMessages.length
    });

  } catch (error) {
    console.error("[API] Error fetching proactive messages:", error);
    return NextResponse.json(
      { error: "Error al obtener mensajes proactivos" },
      { status: 500 }
    );
  }
}
