import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { checkTierRateLimit } from "@/lib/redis/ratelimit";
import { nanoid } from "nanoid";
import {
  checkAllGroupLimits,
  incrementGroupMessageCount,
} from "@/lib/redis/group-ratelimit";
import { groupMessageService } from "@/lib/groups/group-message.service";
import { sendGroupMessageNotifications } from "@/lib/groups/group-notification.service";
import { emitGroupMessage } from "@/lib/socket/server";

/**
 * POST /api/groups/[id]/messages
 * Send a message to a group
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userPlan = user.plan || "free";

    // 1. Parse request body
    const body = await req.json();
    const { content, replyToId, contentType = "text", mediaUrl } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "El contenido del mensaje es requerido" },
        { status: 400 }
      );
    }

    // Validate contentType
    const validContentTypes = ["text", "emoji", "gif", "sticker", "image"];
    if (!validContentTypes.includes(contentType)) {
      return NextResponse.json(
        { error: "Tipo de contenido no válido" },
        { status: 400 }
      );
    }

    // Validate mediaUrl si el contentType lo requiere
    if (["gif", "sticker", "image"].includes(contentType) && !mediaUrl) {
      return NextResponse.json(
        { error: "Se requiere mediaUrl para este tipo de contenido" },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: "El mensaje no puede exceder 5000 caracteres" },
        { status: 400 }
      );
    }

    // 2. General tier rate limiting
    const rateLimitResult = await checkTierRateLimit(userId, userPlan);
    if (!rateLimitResult.success) {
      return NextResponse.json(rateLimitResult.error, { status: 429 });
    }

    // 3. Group-specific rate limiting
    const groupLimits = await checkAllGroupLimits(
      groupId,
      userId,
      content,
      userPlan
    );
    if (!groupLimits.allowed) {
      return NextResponse.json(
        {
          error: "Límite de mensajes alcanzado",
          violations: groupLimits.violations,
        },
        { status: 429 }
      );
    }

    // 4. Verificar permisos y estado del miembro
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        memberType: "user",
      },
    });

    if (!member || !member.isActive || member.isMuted) {
      const errorMsg = !member
        ? "No eres miembro de este grupo"
        : member.isMuted
        ? "Estás silenciado en este grupo"
        : "Tu membresía no está activa";

      return NextResponse.json({ error: errorMsg }, { status: 403 });
    }

    // 5. Verificar que el grupo esté activo
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        status: true,
        autoAIResponses: true,
        allowUserMessages: true,
      },
    });

    if (!group || group.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Grupo no encontrado o no activo" },
        { status: 404 }
      );
    }

    if (!group.allowUserMessages) {
      return NextResponse.json(
        { error: "Los mensajes de usuarios están deshabilitados en este grupo" },
        { status: 403 }
      );
    }

    // 6. Obtener siguiente turnNumber
    const lastMessage = await prisma.groupMessage.findFirst({
      where: { groupId },
      orderBy: { turnNumber: "desc" },
      select: { turnNumber: true },
    });
    const nextTurnNumber = (lastMessage?.turnNumber || 0) + 1;

    // 7. Validar replyToId si se proporciona
    if (replyToId) {
      const replyToMessage = await prisma.groupMessage.findFirst({
        where: {
          id: replyToId,
          groupId,
        },
      });

      if (!replyToMessage) {
        return NextResponse.json(
          { error: "Mensaje de referencia no encontrado" },
          { status: 400 }
        );
      }
    }

    // 8. Guardar mensaje del usuario
    const userMessage = await prisma.groupMessage.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        groupId,
        authorType: "user",
        userId,
        content: content.trim(),
        contentType,
        mediaUrl: mediaUrl || null,
        turnNumber: nextTurnNumber,
        replyToId: replyToId || null,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        GroupMessage: {
          select: {
            id: true,
            content: true,
            authorType: true,
            User: { select: { name: true } },
            Agent: { select: { name: true } },
          },
        },
      },
    });

    // 8.5. Emit real-time event to group members
    emitGroupMessage(groupId, {
      id: userMessage.id,
      groupId,
      authorType: "user",
      authorId: userId,
      content: userMessage.content,
      contentType: userMessage.contentType,
      mediaUrl: userMessage.mediaUrl || undefined,
      createdAt: userMessage.createdAt.toISOString(),
      replyToId: userMessage.replyToId || undefined,
      user: userMessage.User ? {
        id: userMessage.User.id,
        name: userMessage.User.name,
        image: userMessage.User.image,
      } : undefined,
      replyTo: userMessage.GroupMessage ? {
        id: userMessage.GroupMessage.id,
        content: userMessage.GroupMessage.content,
        authorType: userMessage.GroupMessage.authorType as 'user' | 'agent',
        user: userMessage.GroupMessage.User ? { name: userMessage.GroupMessage.User.name } : undefined,
        agent: userMessage.GroupMessage.Agent ? { name: userMessage.GroupMessage.Agent.name } : undefined,
      } : undefined,
    });

    // 9. Actualizar estadísticas (en paralelo)
    await Promise.all([
      // Update grupo
      prisma.group.update({
        where: { id: groupId },
        data: {
          totalMessages: { increment: 1 },
          lastActivityAt: new Date(),
        },
      }),
      // Update miembro
      prisma.groupMember.update({
        where: { id: member.id },
        data: {
          totalMessages: { increment: 1 },
          lastMessageAt: new Date(),
        },
      }),
      // Incrementar unreadCount para otros miembros
      prisma.groupMember.updateMany({
        where: {
          groupId,
          userId: { not: userId },
          memberType: "user",
          isActive: true,
        },
        data: { unreadCount: { increment: 1 } },
      }),
      // Update simulation state
      prisma.groupSimulationState.update({
        where: { groupId },
        data: {
          currentTurn: nextTurnNumber,
          totalMessages: { increment: 1 },
          lastSpeakerId: userId,
          lastSpeakerType: "user",
          lastUpdated: new Date(),
        },
      }),
      // Increment message count for analytics
      incrementGroupMessageCount(userId, groupId),
    ]);

    // 10. Trigger AI responses in background (no await)
    if (group.autoAIResponses) {
      groupMessageService
        .generateAIResponses(groupId, userMessage)
        .catch((error) => {
          console.error("Error generating AI responses:", error);
        });
    }

    // 11. Send notifications in background (no await)
    sendGroupMessageNotifications(group, userMessage, userId).catch((error) => {
      console.error("Error sending notifications:", error);
    });

    return NextResponse.json(
      {
        message: userMessage,
        aiResponsesTriggered: group.autoAIResponses,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error posting group message:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/groups/[id]/messages
 * Retrieve messages from a group
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // 1. Check membership
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        memberType: "user",
        isActive: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "No eres miembro de este grupo" },
        { status: 403 }
      );
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 200);
    const before = searchParams.get("before"); // Cursor-based pagination
    const after = searchParams.get("after");

    // 3. Build query
    const whereClause: any = { groupId };

    if (before) {
      whereClause.id = { lt: before };
    } else if (after) {
      whereClause.id = { gt: after };
    }

    // 4. Obtener mensajes
    const messages = await prisma.groupMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: before ? "desc" : "asc" },
      take: limit,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        Agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        GroupMessage: {
          select: {
            id: true,
            content: true,
            authorType: true,
            User: {
              select: {
                id: true,
                name: true,
              },
            },
            Agent: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // If using "before" cursor, reverse to get chronological order
    if (before) {
      messages.reverse();
    }

    // 5. Marcar mensajes como leídos
    await prisma.groupMember.update({
      where: { id: member.id },
      data: {
        lastSeenAt: new Date(),
        unreadCount: 0,
      },
    });

    // 6. Return messages with pagination metadata
    return NextResponse.json({
      messages,
      hasMore: messages.length === limit,
      nextCursor: messages.length > 0 ? messages[messages.length - 1].id : null,
      prevCursor: messages.length > 0 ? messages[0].id : null,
    });
  } catch (error) {
    console.error("Error fetching group messages:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
