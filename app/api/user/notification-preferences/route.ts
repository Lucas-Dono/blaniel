import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logging/logger";
import { getAuthenticatedUser } from "@/lib/auth-server";
/**
 * GET /api/user/notification-preferences
 * Obtener preferencias de notificaciones del usuario actual
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Get o crear preferencias
    let preferences = await prisma.notificationPreferences.findUnique({
      where: { userId: user.id },
    });

    // Si no existen, crear con valores por defecto
    if (!preferences) {
      preferences = await prisma.notificationPreferences.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          userId: user.id,
        },
      });
    }

    return NextResponse.json(preferences);
  } catch (error) {
    logger.error({ error }, "Error fetching notification preferences");
    return NextResponse.json(
      { error: "Error al obtener preferencias" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/notification-preferences
 * Actualizar preferencias de notificaciones
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate frecuencias
    const validFrequencies = ["daily", "weekly", "never"];
    if (body.bondWarningFrequency && !validFrequencies.includes(body.bondWarningFrequency)) {
      return NextResponse.json(
        { error: "Frecuencia inválida para bondWarningFrequency" },
        { status: 400 }
      );
    }
    if (body.bondDormantFrequency && !validFrequencies.includes(body.bondDormantFrequency)) {
      return NextResponse.json(
        { error: "Frecuencia inválida para bondDormantFrequency" },
        { status: 400 }
      );
    }
    if (body.bondFragileFrequency && !validFrequencies.includes(body.bondFragileFrequency)) {
      return NextResponse.json(
        { error: "Frecuencia inválida para bondFragileFrequency" },
        { status: 400 }
      );
    }

    // Validate horas preferidas
    if (body.preferredNotificationHours) {
      if (!Array.isArray(body.preferredNotificationHours)) {
        return NextResponse.json(
          { error: "preferredNotificationHours debe ser un array" },
          { status: 400 }
        );
      }
      const invalidHours = body.preferredNotificationHours.filter(
        (h: number) => h < 0 || h > 23
      );
      if (invalidHours.length > 0) {
        return NextResponse.json(
          { error: "Las horas deben estar entre 0 y 23" },
          { status: 400 }
        );
      }
    }

    // Update preferencias (upsert)
    const preferences = await prisma.notificationPreferences.upsert({
      where: { userId: user.id },
      update: body,
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        userId: user.id,
        ...body,
      },
    });

    logger.info(
      { userId: user.id, updates: Object.keys(body) },
      "Notification preferences updated"
    );

    return NextResponse.json(preferences);
  } catch (error) {
    logger.error({ error }, "Error updating notification preferences");
    return NextResponse.json(
      { error: "Error al actualizar preferencias" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/notification-preferences/mute-bond
 * Silenciar notificaciones de un bond específico
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bondId, unmute } = body;

    if (!bondId) {
      return NextResponse.json(
        { error: "bondId es requerido" },
        { status: 400 }
      );
    }

    // Check que el bond pertenece al usuario
    const bond = await prisma.symbolicBond.findFirst({
      where: {
        id: bondId,
        userId: user.id,
      },
    });

    if (!bond) {
      return NextResponse.json(
        { error: "Bond no encontrado" },
        { status: 404 }
      );
    }

    // Get preferencias actuales
    let preferences = await prisma.notificationPreferences.findUnique({
      where: { userId: user.id },
    });

    if (!preferences) {
      preferences = await prisma.notificationPreferences.create({
        data: { id: nanoid(), updatedAt: new Date(), userId: user.id },
      });
    }

    // Update lista de bonds silenciados
    const mutedBonds = (preferences.mutedBonds as string[]) || [];
    let newMutedBonds: string[];

    if (unmute) {
      // Remover de la lista
      newMutedBonds = mutedBonds.filter((id) => id !== bondId);
    } else {
      // Agregar a la lista si no está ya
      newMutedBonds = mutedBonds.includes(bondId)
        ? mutedBonds
        : [...mutedBonds, bondId];
    }

    // Update
    const _updated = await prisma.notificationPreferences.update({
      where: { userId: user.id },
      data: {
        mutedBonds: newMutedBonds,
      },
    });

    logger.info(
      { userId: user.id, bondId, action: unmute ? "unmute" : "mute" },
      "Bond notification preferences updated"
    );

    return NextResponse.json({
      success: true,
      bondId,
      muted: !unmute,
      mutedBonds: newMutedBonds,
    });
  } catch (error) {
    logger.error({ error }, "Error muting/unmuting bond");
    return NextResponse.json(
      { error: "Error al actualizar preferencias" },
      { status: 500 }
    );
  }
}
