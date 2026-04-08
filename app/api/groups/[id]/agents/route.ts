import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { atomicCheckGroupAILimit } from "@/lib/usage/atomic-resource-check";
import { nanoid } from "nanoid";

/**
 * POST /api/groups/[id]/agents
 * Add an AI agent to a group
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

    // 1. Verificar permisos (canManageAIs)
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        memberType: "user",
        isActive: true,
      },
    });

    if (!member || !member.canManageAIs) {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar IAs en este grupo" },
        { status: 403 }
      );
    }

    // 2. Obtener grupo y plan (antes de la transacción)
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        User: {
          select: { plan: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Grupo no encontrado" },
        { status: 404 }
      );
    }

    const creatorPlan = group.User?.plan || "free";

    // 3. Parse request body
    const body = await req.json();
    const { agentId, importanceLevel = "secondary" } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId es requerido" },
        { status: 400 }
      );
    }

    // 4. Verificar que el agente exista
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
        avatar: true,
        userId: true,
        visibility: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agente no encontrado" },
        { status: 404 }
      );
    }

    // 5. Verificar permisos de acceso al agente
    // El agente debe ser del usuario o público
    if (agent.userId !== user.id && agent.visibility !== "public") {
      return NextResponse.json(
        { error: "No tienes acceso a este agente" },
        { status: 403 }
      );
    }

    // 6. Verificar que no esté ya en el grupo
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        agentId,
        memberType: "agent",
      },
    });

    if (existingMember) {
      if (existingMember.isActive) {
        return NextResponse.json(
          { error: "El agente ya está en el grupo" },
          { status: 400 }
        );
      } else {
        // Reactivar
        const reactivatedMember = await prisma.groupMember.update({
          where: { id: existingMember.id },
          data: {
            isActive: true,
            joinedAt: new Date(),
            importanceLevel,
          },
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
          member: reactivatedMember,
          message: "Agente reactivado exitosamente",
        });
      }
    }

    // 7. Validar importanceLevel
    if (!["main", "secondary", "filler"].includes(importanceLevel)) {
      return NextResponse.json(
        { error: "importanceLevel inválido" },
        { status: 400 }
      );
    }

    // 8. CRITICAL: Crear miembro con verificación atómica
    const newMember = await prisma.$transaction(
      async (tx) => {
        // 8.1. Verificar límite DENTRO de la transacción
        await atomicCheckGroupAILimit(tx, groupId, creatorPlan);

        // 8.2. Crear nuevo miembro (agente)
        const member = await tx.groupMember.create({
          data: {
            id: nanoid(),
            updatedAt: new Date(),
            groupId,
            memberType: "agent",
            agentId,
            role: "member",
            isActive: true,
            importanceLevel,
          },
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

        // 8.3. Actualizar total de miembros
        await tx.group.update({
          where: { id: groupId },
          data: {
            totalMembers: { increment: 1 },
          },
        });

        // 8.4. Crear mensaje de sistema
        const messageCount = await tx.groupMessage.count({ where: { groupId } });
        await tx.groupMessage.create({
          data: {
            id: nanoid(),
            updatedAt: new Date(),
            groupId,
            authorType: "user",
            content: `${agent.name} se unió al grupo`,
            contentType: "system",
            isSystemMessage: true,
            turnNumber: messageCount + 1,
          },
        });

        return member;
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 10000,
      }
    ).catch((error) => {
      if (error.message.startsWith("{")) {
        const errorData = JSON.parse(error.message);
        throw errorData;
      }
      throw error;
    });

    return NextResponse.json(
      {
        member: newMember,
        message: "Agente añadido exitosamente",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error adding agent to group:", error);

    // If it's a rate limit error (thrown from the transaction)
    if (error.error && error.limit) {
      return NextResponse.json(error, { status: 403 });
    }

    // Prisma transaction errors
    if (error.code === "P2034") {
      // Serialization failure - race condition detectada
      return NextResponse.json(
        {
          error: "El límite de IAs por grupo fue alcanzado. Por favor intenta de nuevo.",
          hint: "Múltiples requests detectados"
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/groups/[id]/agents
 * List all AI agents in a group
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

    // 1. Verificar que el usuario sea miembro
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

    // 2. Obtener todos los agentes del grupo
    const agents = await prisma.groupMember.findMany({
      where: {
        groupId,
        memberType: "agent",
        isActive: true,
      },
      include: {
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
        { importanceLevel: "asc" }, // main, secondary, filler
        { joinedAt: "asc" },
      ],
    });

    return NextResponse.json({
      agents,
      total: agents.length,
    });
  } catch (error) {
    console.error("Error fetching group agents:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
