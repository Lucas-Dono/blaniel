/**
 * PUT /api/bonds/[id]/update
 *
 * Actualiza las métricas de un bond después de una interacción
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { updateBondMetrics } from "@/lib/services/symbolic-bonds.service";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateMetricsSchema = z.object({
  messageQuality: z.number().min(0).max(1).optional(),
  consistencyScore: z.number().min(0).max(1).optional(),
  mutualDisclosure: z.number().min(0).max(1).optional(),
  emotionalResonance: z.number().min(0).max(1).optional(),
  sharedExperiences: z.number().int().min(0).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check que el bond pertenece al usuario
    const bond = await prisma.symbolicBond.findUnique({
      where: { id },
    });

    if (!bond) {
      return NextResponse.json(
        { error: "Bond no encontrado" },
        { status: 404 }
      );
    }

    if (bond.userId !== user.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = updateMetricsSchema.parse(body);

    const updatedBond = await updateBondMetrics(id, validatedData);

    return NextResponse.json({
      success: true,
      bond: updatedBond,
      message: "Bond actualizado exitosamente",
    });
  } catch (error: any) {
    console.error("Error updating bond:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.format() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Error al actualizar bond" },
      { status: 500 }
    );
  }
}
