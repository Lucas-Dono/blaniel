import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { nanoid } from "nanoid";

/**
 * DELETE /api/groups/[id]/agents/[agentId]
 * Remove an AI agent from a group
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  try {
    const { id: groupId, agentId } = await params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // 1. Verificar permisos (canManageAIs)
    const requestingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        memberType: "user",
        isActive: true,
      },
    });

    if (!requestingMember || !requestingMember.canManageAIs) {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar IAs en este grupo" },
        { status: 403 }
      );
    }

    // 2. Encontrar el miembro agente
    const agentMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        agentId,
        memberType: "agent",
        isActive: true,
      },
      include: {
        Agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!agentMember) {
      return NextResponse.json(
        { error: "Agente no encontrado en este grupo" },
        { status: 404 }
      );
    }

    // 3. Desactivar miembro (soft delete)
    await prisma.groupMember.update({
      where: { id: agentMember.id },
      data: {
        isActive: false,
      },
    });

    // 4. Actualizar total de miembros
    await prisma.group.update({
      where: { id: groupId },
      data: {
        totalMembers: { decrement: 1 },
      },
    });

    // 5. Crear mensaje de sistema
    await prisma.groupMessage.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        groupId,
        authorType: "user",
        content: `${agentMember.Agent?.name} fue removido del grupo`,
        contentType: "system",
        isSystemMessage: true,
        turnNumber: (await prisma.groupMessage.count({ where: { groupId } })) + 1,
      },
    });

    return NextResponse.json({
      message: "Agente removido exitosamente",
    });
  } catch (error) {
    console.error("Error removing agent from group:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/groups/[id]/agents/[agentId]
 * Update AI agent settings in a group (e.g., importance level)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  try {
    const { id: groupId, agentId } = await params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // 1. Verificar permisos (canManageAIs)
    const requestingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        memberType: "user",
        isActive: true,
      },
    });

    if (!requestingMember || !requestingMember.canManageAIs) {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar IAs en este grupo" },
        { status: 403 }
      );
    }

    // 2. Encontrar el miembro agente
    const agentMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        agentId,
        memberType: "agent",
        isActive: true,
      },
    });

    if (!agentMember) {
      return NextResponse.json(
        { error: "Agente no encontrado en este grupo" },
        { status: 404 }
      );
    }

    // 3. Parse request body
    const body = await req.json();
    const updateData: any = {};

    // Importance level (para Story Mode)
    if (body.importanceLevel !== undefined) {
      if (!["main", "secondary", "filler"].includes(body.importanceLevel)) {
        return NextResponse.json(
          { error: "importanceLevel inválido" },
          { status: 400 }
        );
      }
      updateData.importanceLevel = body.importanceLevel;
    }

    // Focus state (para Story Mode)
    if (body.isFocused !== undefined) {
      updateData.isFocused = Boolean(body.isFocused);

      if (body.isFocused && body.focusedUntil) {
        updateData.focusedUntil = new Date(body.focusedUntil);
      } else if (!body.isFocused) {
        updateData.focusedUntil = null;
      }
    }

    // 4. Actualizar miembro
    const updatedMember = await prisma.groupMember.update({
      where: { id: agentMember.id },
      data: updateData,
      include: {
        Agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json({
      member: updatedMember,
      message: "Configuración del agente actualizada",
    });
  } catch (error) {
    console.error("Error updating agent in group:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
