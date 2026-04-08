import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { canToggleSFWProtection } from "@/lib/middleware/sfw-injector";

/**
 * GET /api/user/sfw-protection
 * Obtener estado de protección SFW
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.email) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: {
        id: true,
        sfwProtection: true,
        plan: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Check si puede desactivar protección
    const toggleCheck = await canToggleSFWProtection(dbUser.id);

    return NextResponse.json({
      sfwProtection: dbUser.sfwProtection,
      plan: dbUser.plan,
      canToggle: toggleCheck.canToggle,
      canToggleReason: toggleCheck.reason,
    });
  } catch (error) {
    console.error("[SFW PROTECTION] Error getting status:", error);
    return NextResponse.json(
      { error: "Error al obtener estado" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/sfw-protection
 * Activar o desactivar protección SFW (solo usuarios premium)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.email) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { sfwProtection } = body;

    if (typeof sfwProtection !== 'boolean') {
      return NextResponse.json(
        { error: "sfwProtection debe ser un boolean" },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: {
        id: true,
        plan: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Si intenta DESACTIVAR protección, verificar que sea premium
    if (!sfwProtection) {
      const toggleCheck = await canToggleSFWProtection(dbUser.id);

      if (!toggleCheck.canToggle) {
        console.log(`[SFW] Intento de desactivar protección por usuario FREE: ${user.email}`);
        return NextResponse.json(
          {
            error: toggleCheck.reason,
            requiresPremium: true,
            upgradeUrl: "/pricing",
          },
          { status: 403 }
        );
      }
    }

    // Update configuración
    const updatedUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: { sfwProtection },
      select: { id: true, sfwProtection: true, plan: true },
    });

    console.log(
      `[SFW] Usuario ${user.email} (${updatedUser.plan}) - Protección ${sfwProtection ? 'ACTIVADA' : 'DESACTIVADA'}`
    );

    return NextResponse.json({
      success: true,
      sfwProtection: updatedUser.sfwProtection,
      message: sfwProtection
        ? 'Protección SFW activada. Todas tus IAs respetarán límites de contenido apropiado.'
        : 'Protección SFW desactivada. Tus IAs podrán responder con contenido sin restricciones. Recuerda: esta función es solo para mayores de 18 años.',
    });
  } catch (error) {
    console.error("[SFW PROTECTION] Error:", error);
    return NextResponse.json(
      { error: "Error al actualizar protección" },
      { status: 500 }
    );
  }
}
