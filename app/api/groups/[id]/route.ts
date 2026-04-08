import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";

/**
 * GET /api/groups/[id]
 * Get detailed information about a specific group
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

    // 1. Check membership del usuario
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
        { error: "No tienes acceso a este grupo" },
        { status: 403 }
      );
    }

    // 2. Obtener datos completos del grupo
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        GroupMember: {
          where: { isActive: true },
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
                PersonalityCore: true,
              },
            },
          },
          orderBy: [
            { role: "desc" }, // owner, moderator, member
            { joinedAt: "asc" },
          ],
        },
        GroupSimulationState: true,
        _count: {
          select: {
            GroupMessage: true,
            GroupMember: true,
          },
        },
      },
    });

    if (!group || group.status === "DELETED") {
      return NextResponse.json(
        { error: "Grupo no encontrado" },
        { status: 404 }
      );
    }

    // 3. Retornar con información del miembro actual
    return NextResponse.json({
      ...group,
      currentMember: {
        id: member.id,
        role: member.role,
        canInviteMembers: member.canInviteMembers,
        canRemoveMembers: member.canRemoveMembers,
        canManageAIs: member.canManageAIs,
        canEditSettings: member.canEditSettings,
        isMuted: member.isMuted,
        unreadCount: member.unreadCount,
        lastSeenAt: member.lastSeenAt,
      },
    });
  } catch (error) {
    console.error("Error fetching group:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/groups/[id]
 * Update group settings (owner only)
 */
export async function PATCH(
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

    // 1. Verificar permisos (solo owner o con canEditSettings)
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        memberType: "user",
        isActive: true,
      },
    });

    if (!member || (!member.canEditSettings && member.role !== "owner")) {
      return NextResponse.json(
        { error: "No tienes permisos para editar este grupo" },
        { status: 403 }
      );
    }

    // 2. Validar datos del request
    const body = await req.json();
    const updateData: any = {};

    // Campos editables
    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: "El nombre del grupo es requerido" },
          { status: 400 }
        );
      }
      if (body.name.length > 100) {
        return NextResponse.json(
          { error: "El nombre no puede exceder 100 caracteres" },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }

    if (body.visibility !== undefined) {
      if (!["private", "invite_only", "public"].includes(body.visibility)) {
        return NextResponse.json(
          { error: "Visibilidad inválida" },
          { status: 400 }
        );
      }
      updateData.visibility = body.visibility;
    }

    // Configuraciones
    if (body.allowUserMessages !== undefined) {
      updateData.allowUserMessages = Boolean(body.allowUserMessages);
    }

    if (body.autoAIResponses !== undefined) {
      updateData.autoAIResponses = Boolean(body.autoAIResponses);
    }

    if (body.responseDelay !== undefined) {
      const delay = parseInt(body.responseDelay);
      if (delay < 0 || delay > 30000) {
        return NextResponse.json(
          { error: "Response delay debe estar entre 0 y 30000ms" },
          { status: 400 }
        );
      }
      updateData.responseDelay = delay;
    }

    // Features avanzadas (verificar tier del usuario)
    const userPlan = user.plan || "free";

    if (body.storyMode !== undefined) {
      // Check si el tier permite Story Mode
      if (body.storyMode === true && userPlan === "free") {
        return NextResponse.json(
          {
            error: "Story Mode requiere plan Plus o Ultra",
            upgradeUrl: "/pricing",
          },
          { status: 403 }
        );
      }
      updateData.storyMode = Boolean(body.storyMode);
    }

    if (body.directorEnabled !== undefined) {
      if (body.directorEnabled === true && userPlan === "free") {
        return NextResponse.json(
          {
            error: "AI Director requiere plan Plus o Ultra",
            upgradeUrl: "/pricing",
          },
          { status: 403 }
        );
      }
      updateData.directorEnabled = Boolean(body.directorEnabled);
    }

    if (body.emergentEventsEnabled !== undefined) {
      if (body.emergentEventsEnabled === true && userPlan === "free") {
        return NextResponse.json(
          {
            error: "Eventos Emergentes requiere plan Plus o Ultra",
            upgradeUrl: "/pricing",
          },
          { status: 403 }
        );
      }
      updateData.emergentEventsEnabled = Boolean(body.emergentEventsEnabled);
    }

    if (body.allowEmotionalBonds !== undefined) {
      updateData.allowEmotionalBonds = Boolean(body.allowEmotionalBonds);
    }

    if (body.allowConflicts !== undefined) {
      updateData.allowConflicts = Boolean(body.allowConflicts);
    }

    // 3. Actualizar grupo
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        GroupMember: {
          where: { isActive: true },
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
          },
        },
      },
    });

    return NextResponse.json({
      group: updatedGroup,
      message: "Grupo actualizado exitosamente",
    });
  } catch (error) {
    console.error("Error updating group:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/groups/[id]
 * Archive a group (owner only)
 */
export async function DELETE(
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

    // 1. Verificar que sea el owner
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        memberType: "user",
        role: "owner",
        isActive: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Solo el owner puede archivar el grupo" },
        { status: 403 }
      );
    }

    // 2. Archivar el grupo (soft delete)
    await prisma.group.update({
      where: { id: groupId },
      data: {
        status: "ARCHIVED",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Grupo archivado exitosamente",
    });
  } catch (error) {
    console.error("Error archiving group:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
