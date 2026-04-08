/**
 * API: Scene Catalog (Debug)
 *
 * GET - Obtener escenas disponibles en el catálogo
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/groups/[id]/scenes - Escenas disponibles (debug)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: groupId } = await params;

    // Check que el usuario es miembro del grupo
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "No eres miembro de este grupo" }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const subcategory = searchParams.get("subcategory");
    const code = searchParams.get("code");

    // Construir filtro
    const where: any = { isActive: true };

    if (category) {
      where.category = category;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    if (code) {
      where.code = code;
    }

    // Get escenas
    const scenes = await prisma.scene.findMany({
      where,
      select: {
        code: true,
        name: true,
        category: true,
        subcategory: true,
        triggerType: true,
        description: true,
        objectives: true,
        participantRoles: true,
        interventionSequence: true,
        consequences: true,
        minAIs: true,
        maxAIs: true,
        duration: true,
        usageCount: true,
        successRate: true,
        avgEngagement: true,
      },
      orderBy: [
        { category: "asc" },
        { code: "asc" },
      ],
      take: 100, // Limitar a 100 escenas por request
    });

    // Get estadísticas por categoría
    const statsByCategory = await prisma.scene.groupBy({
      by: ["category"],
      where: { isActive: true },
      _count: true,
      _avg: {
        successRate: true,
        avgEngagement: true,
      },
    });

    // Get escenas más usadas en este grupo
    const mostUsedInGroup = await prisma.sceneExecution.groupBy({
      by: ["sceneCode"],
      where: { groupId },
      _count: true,
      orderBy: {
        _count: {
          sceneCode: "desc",
        },
      },
      take: 10,
    });

    return NextResponse.json({
      total: scenes.length,
      scenes,
      stats: {
        byCategory: statsByCategory.map((stat) => ({
          category: stat.category,
          count: stat._count,
          avgSuccessRate: stat._avg.successRate,
          avgEngagement: stat._avg.avgEngagement,
        })),
        mostUsedInThisGroup: mostUsedInGroup.map((stat) => ({
          sceneCode: stat.sceneCode,
          timesExecuted: stat._count,
        })),
      },
    });
  } catch (error) {
    console.error("[ScenesAPI] Error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
