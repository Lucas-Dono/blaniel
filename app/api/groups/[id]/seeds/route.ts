/**
 * API: Tension Seeds (Semillas de Tensión)
 *
 * GET - Obtener semillas activas del grupo
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/groups/[id]/seeds - Semillas activas
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
    const statusFilter = searchParams.get("status");
    const includeResolved = searchParams.get("includeResolved") === "true";

    // Construir filtro
    const where: any = { groupId };

    if (statusFilter) {
      where.status = statusFilter;
    } else if (!includeResolved) {
      // Por defecto, excluir resueltas y expiradas
      where.status = {
        notIn: ["RESOLVED", "EXPIRED"],
      };
    }

    // Get semillas
    const seeds = await prisma.tensionSeed.findMany({
      where,
      orderBy: [
        { status: "asc" }, // LATENT < ACTIVE < ESCALATING
        { createdAt: "desc" },
      ],
    });

    // Agrupar por estado
    const byStatus = {
      LATENT: seeds.filter((s) => s.status === "LATENT"),
      ACTIVE: seeds.filter((s) => s.status === "ACTIVE"),
      ESCALATING: seeds.filter((s) => s.status === "ESCALATING"),
      RESOLVING: seeds.filter((s) => s.status === "RESOLVING"),
      RESOLVED: seeds.filter((s) => s.status === "RESOLVED"),
      EXPIRED: seeds.filter((s) => s.status === "EXPIRED"),
    };

    return NextResponse.json({
      total: seeds.length,
      seeds,
      byStatus: {
        LATENT: byStatus.LATENT.length,
        ACTIVE: byStatus.ACTIVE.length,
        ESCALATING: byStatus.ESCALATING.length,
        RESOLVING: byStatus.RESOLVING.length,
        RESOLVED: byStatus.RESOLVED.length,
        EXPIRED: byStatus.EXPIRED.length,
      },
      activeSeedsDetail: [...byStatus.ACTIVE, ...byStatus.ESCALATING].map((seed) => ({
        id: seed.id,
        type: seed.type,
        title: seed.title,
        content: seed.content,
        involvedAgents: seed.involvedAgents,
        status: seed.status,
        currentTurn: seed.currentTurn,
        maxTurns: seed.maxTurns,
        escalationLevel: seed.escalationLevel,
        progress: `${seed.currentTurn}/${seed.maxTurns}`,
        createdAt: seed.createdAt,
      })),
    });
  } catch (error) {
    console.error("[SeedsAPI] Error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
