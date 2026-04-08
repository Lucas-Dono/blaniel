/**
 * API: Director Conversacional
 *
 * GET - Obtener estado del director
 * PATCH - Activar/configurar director
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";

// GET /api/groups/[id]/director - Estado del director
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    // Check que el usuario es miembro del grupo
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "No eres miembro de este grupo" }, { status: 403 });
    }

    // Get configuración del director
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        directorVersion: true,
        directorSettings: true,
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    // Get estado de escena activa
    const sceneState = await prisma.groupSceneState.findUnique({
      where: { groupId },
    });

    // Get métricas del director
    const executedScenes = await prisma.sceneExecution.count({
      where: { groupId },
    });

    const activeSeeds = await prisma.tensionSeed.count({
      where: {
        groupId,
        status: { in: ["ACTIVE", "ESCALATING"] },
      },
    });

    return NextResponse.json({
      enabled: group.directorVersion >= 1,
      version: group.directorVersion,
      settings: group.directorSettings,
      currentScene: sceneState
        ? {
            code: sceneState.currentSceneCode,
            step: sceneState.currentStep,
            totalSteps: sceneState.totalSteps,
            roleAssignments: sceneState.roleAssignments,
          }
        : null,
      metrics: {
        executedScenes,
        activeSeeds,
      },
    });
  } catch (error) {
    console.error("[DirectorAPI] Error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// PATCH /api/groups/[id]/director - Activar/configurar director
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    // Check que el usuario es admin del grupo
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: "ADMIN",
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Solo los administradores pueden modificar el director" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { enabled, version, settings } = body;

    // Validate versión
    if (version !== undefined && ![0, 1, 2].includes(version)) {
      return NextResponse.json(
        { error: "Versión inválida. Debe ser 0 (off), 1 (basic) o 2 (full)" },
        { status: 400 }
      );
    }

    // Construir actualización
    const updateData: any = {};

    if (enabled !== undefined) {
      updateData.directorVersion = enabled ? 1 : 0;
    }

    if (version !== undefined) {
      updateData.directorVersion = version;
    }

    if (settings !== undefined) {
      updateData.directorSettings = settings;
    }

    // Update grupo
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: updateData,
      select: {
        directorVersion: true,
        directorSettings: true,
      },
    });

    return NextResponse.json({
      success: true,
      director: {
        enabled: updatedGroup.directorVersion >= 1,
        version: updatedGroup.directorVersion,
        settings: updatedGroup.directorSettings,
      },
    });
  } catch (error) {
    console.error("[DirectorAPI] Error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
