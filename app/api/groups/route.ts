import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { checkFeature } from "@/lib/feature-flags";
import { Feature } from "@/lib/feature-flags/types";
import { getTierLimits } from "@/lib/usage/tier-limits";
import { sanitizeAndValidateName } from "@/lib/security/unicode-sanitizer";

/**
 * POST /api/groups
 * Create a new group
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const userPlan = user.plan || "free";

    // 1. Verificar feature access
    const featureCheck = await checkFeature(user.id, Feature.GROUPS);
    if (!featureCheck.hasAccess) {
      return NextResponse.json(
        {
          error: "Grupos solo disponibles en Free+",
          upgradeUrl: "/pricing",
        },
        { status: 403 }
      );
    }

    // 2. Validar datos del request primero (antes de la transacción)
    const body = await req.json();
    const { name: rawName, description, visibility = "private" } = body;

    if (!rawName || rawName.trim().length === 0) {
      return NextResponse.json(
        { error: "El nombre del grupo es requerido" },
        { status: 400 }
      );
    }

    // SECURITY: Sanitize name to prevent visual confusion attacks
    const nameValidation = sanitizeAndValidateName(rawName);
    if (!nameValidation.valid || !nameValidation.sanitized) {
      console.warn('[API] Nombre de grupo rechazado:', {
        original: rawName,
        reason: nameValidation.reason,
        detections: nameValidation.detections
      });
      return NextResponse.json(
        {
          error: nameValidation.reason || 'El nombre contiene caracteres no permitidos',
          field: 'name',
          detections: nameValidation.detections
        },
        { status: 400 }
      );
    }

    const name = nameValidation.sanitized;

    // Log if anything was sanitized
    if (rawName !== name) {
      console.info('[API] Nombre de grupo sanitizado:', {
        original: rawName,
        sanitized: name,
        detections: nameValidation.detections
      });
    }

    const limits = getTierLimits(userPlan);

    // 3. CRITICAL: Usar transacción atómica para prevenir race condition
    // Sin esto, múltiples requests simultáneos pueden bypassear el límite
    const result = await prisma.$transaction(
      async (tx) => {
        // 3.1. Contar grupos DENTRO de la transacción con lock
        // Esto previene que otras transacciones lean el mismo valor simultáneamente
        const groupCount = await tx.group.count({
          where: {
            creatorId: user.id,
            status: "ACTIVE",
          },
        });

        // 3.2. Verificar límite
        if (groupCount >= limits.resources.activeGroups) {
          throw new Error(
            JSON.stringify({
              error: `Límite de ${limits.resources.activeGroups} grupos alcanzado`,
              current: groupCount,
              limit: limits.resources.activeGroups,
              upgradeUrl: "/pricing",
            })
          );
        }

        // 3.3. Crear grupo dentro de la transacción
        const group = await tx.group.create({
          data: {
            id: nanoid(),
            updatedAt: new Date(),
            name: name.trim(),
            description: description?.trim() || null,
            creatorId: user.id,
            visibility: ["private", "invite_only", "public"].includes(visibility)
              ? visibility
              : "private",
            status: "ACTIVE",
          },
        });

        // 3.4. Añadir creador como owner
        await tx.groupMember.create({
          data: {
            id: nanoid(),
            updatedAt: new Date(),
            groupId: group.id,
            memberType: "user",
            userId: user.id,
            role: "owner",
            canInviteMembers: true,
            canRemoveMembers: true,
            canManageAIs: true,
            canEditSettings: true,
            isActive: true,
          },
        });

        // 3.5. Crear estado de simulación inicial
        await tx.groupSimulationState.create({
          data: {
            id: nanoid(),
            groupId: group.id,
            currentTurn: 0,
            totalMessages: 0,
            lastSpeakerId: null,
            lastSpeakerType: null,
            recentTopics: [],
            activeSpeakers: [],
            aiQueueOrder: [],
          },
        });

        return group;
      },
      {
        // CRITICAL: Isolation level serializable previene race conditions
        // Esto garantiza que las transacciones se ejecuten como si fueran secuenciales
        isolationLevel: "Serializable",
        maxWait: 5000, // 5 segundos máximo de espera
        timeout: 10000, // 10 segundos timeout total
      }
    ).catch((error) => {
      // Si el error es de límite, parsearlo
      if (error.message.startsWith("{")) {
        const errorData = JSON.parse(error.message);
        throw errorData;
      }
      throw error;
    });

    const group = result;

    // 4. Retornar grupo creado
    return NextResponse.json(
      {
        group,
        message: "Grupo creado exitosamente",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating group:", error);

    // If it's a rate limit error (thrown from the transaction)
    if (error.error && error.limit) {
      return NextResponse.json(error, { status: 403 });
    }

    // Prisma transaction errors
    if (error.code === "P2034") {
      // Serialization failure - race condition detectada
      return NextResponse.json(
        {
          error: "El límite de grupos fue alcanzado. Por favor intenta de nuevo.",
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
 * GET /api/groups
 * List user's groups
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // 1. Obtener grupos del usuario
    const groups = await prisma.group.findMany({
      where: {
        status: "ACTIVE",
        GroupMember: {
          some: {
            userId: user.id,
            isActive: true,
          },
        },
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
        _count: {
          select: {
            GroupMessage: true,
            GroupMember: true,
          },
        },
      },
      orderBy: { lastActivityAt: "desc" },
    });

    // 2. Calcular estadísticas y unread counts para cada grupo
    const groupsWithStats = await Promise.all(
      groups.map(async (group) => {
        // Encontrar el miembro actual
        const currentMember = group.GroupMember.find(
          (m: any) => m.userId === user.id && m.memberType === "user"
        );

        return {
          ...group,
          unreadCount: currentMember?.unreadCount || 0,
          lastSeenAt: currentMember?.lastSeenAt || null,
          role: currentMember?.role || "member",
          isMuted: currentMember?.isMuted || false,
        };
      })
    );

    return NextResponse.json({
      groups: groupsWithStats,
      total: groupsWithStats.length,
    });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
