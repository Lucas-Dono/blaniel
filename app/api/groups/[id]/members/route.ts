import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { atomicCheckGroupUserLimit } from "@/lib/usage/atomic-resource-check";

/**
 * GET /api/groups/[id]/members
 * List all members of a group
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

    // 2. Obtener todos los miembros
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        isActive: true,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true,
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
    });

    return NextResponse.json({
      members,
      total: members.length,
    });
  } catch (error) {
    console.error("Error fetching group members:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/groups/[id]/members
 * Add a user to a group (requires canInviteMembers permission)
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

    // 1. Verificar permisos
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        memberType: "user",
        isActive: true,
      },
    });

    if (!member || !member.canInviteMembers) {
      return NextResponse.json(
        { error: "No tienes permisos para invitar miembros" },
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
    const { userId: newUserId } = body;

    if (!newUserId) {
      return NextResponse.json(
        { error: "userId es requerido" },
        { status: 400 }
      );
    }

    // 4. Verificar que el usuario exista
    const newUser = await prisma.user.findUnique({
      where: { id: newUserId },
      select: { id: true, name: true, image: true },
    });

    if (!newUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // 5. Verificar que no sea ya miembro
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: newUserId,
        memberType: "user",
      },
    });

    if (existingMember) {
      if (existingMember.isActive) {
        return NextResponse.json(
          { error: "El usuario ya es miembro del grupo" },
          { status: 400 }
        );
      } else {
        // Reactivar membresía
        const reactivatedMember = await prisma.groupMember.update({
          where: { id: existingMember.id },
          data: {
            isActive: true,
            joinedAt: new Date(),
          },
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
          member: reactivatedMember,
          message: "Miembro reactivado exitosamente",
        });
      }
    }

    // 6. CRITICAL: Crear miembro con verificación atómica
    const newMember = await prisma.$transaction(
      async (tx) => {
        // 6.1. Verificar límite DENTRO de la transacción
        await atomicCheckGroupUserLimit(tx, groupId, creatorPlan);

        // 6.2. Crear nuevo miembro
        const member = await tx.groupMember.create({
          data: {
            id: nanoid(),
            updatedAt: new Date(),
            groupId,
            memberType: "user",
            userId: newUserId,
            role: "member",
            isActive: true,
          },
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

        // 6.3. Actualizar total de miembros
        await tx.group.update({
          where: { id: groupId },
          data: {
            totalMembers: { increment: 1 },
          },
        });

        // 6.4. Crear mensaje de sistema
        const messageCount = await tx.groupMessage.count({ where: { groupId } });
        await tx.groupMessage.create({
          data: {
            id: nanoid(),
            updatedAt: new Date(),
            groupId,
            authorType: "user",
            content: `${newUser.name} se unió al grupo`,
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
        message: "Miembro añadido exitosamente",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error adding member to group:", error);

    // If it's a rate limit error (thrown from the transaction)
    if (error.error && error.limit) {
      return NextResponse.json(error, { status: 403 });
    }

    // Prisma transaction errors
    if (error.code === "P2034") {
      // Serialization failure - race condition detectada
      return NextResponse.json(
        {
          error: "El límite de usuarios por grupo fue alcanzado. Por favor intenta de nuevo.",
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
