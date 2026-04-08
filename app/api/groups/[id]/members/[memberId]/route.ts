import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { nanoid } from "nanoid";

/**
 * PATCH /api/groups/[id]/members/[memberId]
 * Update member role or permissions
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id: groupId, memberId } = await params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // 1. Verificar que el usuario tenga permisos (owner o moderator)
    const requestingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        memberType: "user",
        isActive: true,
      },
    });

    if (!requestingMember || requestingMember.role === "member") {
      return NextResponse.json(
        { error: "No tienes permisos para modificar miembros" },
        { status: 403 }
      );
    }

    // 2. Obtener el miembro a modificar
    const targetMember = await prisma.groupMember.findUnique({
      where: { id: memberId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!targetMember || targetMember.groupId !== groupId) {
      return NextResponse.json(
        { error: "Miembro no encontrado" },
        { status: 404 }
      );
    }

    // 3. No se puede modificar al owner
    if (targetMember.role === "owner") {
      return NextResponse.json(
        { error: "No se puede modificar al owner del grupo" },
        { status: 403 }
      );
    }

    // 4. Solo owner puede modificar moderators
    if (
      targetMember.role === "moderator" &&
      requestingMember.role !== "owner"
    ) {
      return NextResponse.json(
        { error: "Solo el owner puede modificar moderadores" },
        { status: 403 }
      );
    }

    // 5. Parse request body
    const body = await req.json();
    const updateData: any = {};

    // Cambiar rol (solo owner)
    if (body.role !== undefined) {
      if (requestingMember.role !== "owner") {
        return NextResponse.json(
          { error: "Solo el owner puede cambiar roles" },
          { status: 403 }
        );
      }

      if (!["member", "moderator"].includes(body.role)) {
        return NextResponse.json(
          { error: "Rol inválido" },
          { status: 400 }
        );
      }

      updateData.role = body.role;

      // Auto-set permissions based on role
      if (body.role === "moderator") {
        updateData.canInviteMembers = true;
        updateData.canRemoveMembers = true;
        updateData.canManageAIs = true;
      } else {
        updateData.canInviteMembers = false;
        updateData.canRemoveMembers = false;
        updateData.canManageAIs = false;
        updateData.canEditSettings = false;
      }
    }

    // Permisos individuales (owner y moderator)
    if (body.canInviteMembers !== undefined) {
      updateData.canInviteMembers = Boolean(body.canInviteMembers);
    }
    if (body.canRemoveMembers !== undefined) {
      updateData.canRemoveMembers = Boolean(body.canRemoveMembers);
    }
    if (body.canManageAIs !== undefined) {
      updateData.canManageAIs = Boolean(body.canManageAIs);
    }
    if (body.canEditSettings !== undefined && requestingMember.role === "owner") {
      updateData.canEditSettings = Boolean(body.canEditSettings);
    }

    // Mute/unmute
    if (body.isMuted !== undefined) {
      updateData.isMuted = Boolean(body.isMuted);
    }

    // 6. Actualizar miembro
    const updatedMember = await prisma.groupMember.update({
      where: { id: memberId },
      data: updateData,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({
      member: updatedMember,
      message: "Miembro actualizado exitosamente",
    });
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/groups/[id]/members/[memberId]
 * Remove a member from a group
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id: groupId, memberId } = await params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // 1. Verificar permisos
    const requestingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        memberType: "user",
        isActive: true,
      },
    });

    if (!requestingMember) {
      return NextResponse.json(
        { error: "No eres miembro de este grupo" },
        { status: 403 }
      );
    }

    // 2. Obtener el miembro a remover
    const targetMember = await prisma.groupMember.findUnique({
      where: { id: memberId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!targetMember || targetMember.groupId !== groupId) {
      return NextResponse.json(
        { error: "Miembro no encontrado" },
        { status: 404 }
      );
    }

    // 3. No se puede remover al owner
    if (targetMember.role === "owner") {
      return NextResponse.json(
        { error: "No se puede remover al owner del grupo" },
        { status: 403 }
      );
    }

    // 4. Verificar permisos para remover
    const isSelfLeaving = targetMember.userId === user.id;

    if (!isSelfLeaving && !requestingMember.canRemoveMembers) {
      return NextResponse.json(
        { error: "No tienes permisos para remover miembros" },
        { status: 403 }
      );
    }

    // 5. Solo owner puede remover moderators
    if (
      targetMember.role === "moderator" &&
      requestingMember.role !== "owner" &&
      !isSelfLeaving
    ) {
      return NextResponse.json(
        { error: "Solo el owner puede remover moderadores" },
        { status: 403 }
      );
    }

    // 6. Desactivar miembro (soft delete)
    await prisma.groupMember.update({
      where: { id: memberId },
      data: {
        isActive: false,
      },
    });

    // 7. Actualizar total de miembros
    await prisma.group.update({
      where: { id: groupId },
      data: {
        totalMembers: { decrement: 1 },
      },
    });

    // 8. Crear mensaje de sistema
    const actionText = isSelfLeaving ? "salió del grupo" : "fue removido del grupo";
    await prisma.groupMessage.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        groupId,
        authorType: "user",
        content: `${targetMember.User?.name} ${actionText}`,
        contentType: "system",
        isSystemMessage: true,
        turnNumber: (await prisma.groupMessage.count({ where: { groupId } })) + 1,
      },
    });

    return NextResponse.json({
      message: isSelfLeaving
        ? "Has salido del grupo exitosamente"
        : "Miembro removido exitosamente",
    });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
