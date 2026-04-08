/**
 * API Endpoint for Agent Proactive Messages
 *
 * GET /api/agents/[id]/proactive-messages - Get pending proactive messages for an agent
 * PATCH /api/agents/[id]/proactive-messages/[messageId] - Mark message as delivered/read
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/agents/[id]/proactive-messages
 * Get pending proactive messages for an agent
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get session using Next-Auth v5
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const agentId = params.id;
    const userId = user.id;

    // Check que el agente existe
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get mensajes proactivos pendientes
    const messages = await prisma.proactiveMessage.findMany({
      where: {
        agentId,
        userId,
        status: "pending",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10, // Limitar a 10 mensajes para no sobrecargar
    });

    // Si hay mensajes, marcarlos como sent
    if (messages.length > 0) {
      await prisma.proactiveMessage.updateMany({
        where: {
          id: { in: messages.map(m => m.id) },
          status: "pending",
        },
        data: {
          status: "sent",
          sentAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        triggerType: msg.triggerType,
        createdAt: msg.createdAt,
        context: msg.context,
      })),
      count: messages.length,
    });
  } catch (error) {
    console.error("Error getting proactive messages:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/[id]/proactive-messages
 * Mark specific message as read or update status
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get session using Next-Auth v5
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const agentId = params.id;
    const userId = user.id;
    const body = await request.json();
    const { messageId, status, userResponse } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: "messageId is required" },
        { status: 400 }
      );
    }

    // Check que el mensaje existe y pertenece al usuario
    const message = await prisma.proactiveMessage.findFirst({
      where: {
        id: messageId,
        agentId,
        userId,
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    // Update el mensaje
    const updateData: any = {};

    if (status === "read") {
      updateData.status = "read";
      updateData.readAt = new Date();
    } else if (status === "dismissed") {
      updateData.status = "dismissed";
    }

    if (userResponse) {
      updateData.userResponse = userResponse;
      updateData.respondedAt = new Date();
    }

    const updatedMessage = await prisma.proactiveMessage.update({
      where: { id: messageId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: updatedMessage,
    });
  } catch (error) {
    console.error("Error updating proactive message:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
