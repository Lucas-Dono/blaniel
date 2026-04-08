/**
 * POST /api/bonds/[id]/release
 *
 * Libera voluntariamente un bond
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { releaseBond } from "@/lib/services/symbolic-bonds.service";
import { prisma } from "@/lib/prisma";

export async function POST(
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

    const result = await releaseBond(id, "voluntary");

    return NextResponse.json({
      success: true,
      message: "Bond liberado exitosamente. Tu legado permanece.",
      legacyBadge: result.legacyBadge,
    });
  } catch (error: any) {
    console.error("Error releasing bond:", error);
    return NextResponse.json(
      { error: error.message || "Error al liberar bond" },
      { status: 500 }
    );
  }
}
