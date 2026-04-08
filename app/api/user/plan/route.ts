import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    console.log("[API /api/user/plan] GET request received");
    const user = await getAuthenticatedUser(req);

    console.log("[API /api/user/plan] User:", {
      userId: user?.id,
      userEmail: user?.email,
    });

    if (!user?.id) {
      console.log("[API /api/user/plan] No autorizado - sin sesión");
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Get el plan actualizado desde la base de datos
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, email: true },
    });

    console.log("[API /api/user/plan] Usuario encontrado:", {
      email: dbUser?.email,
      plan: dbUser?.plan,
    });

    if (!dbUser) {
      console.log("[API /api/user/plan] Usuario no encontrado en BD");
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    console.log("[API /api/user/plan] Respondiendo con plan:", dbUser.plan);
    return NextResponse.json({ plan: dbUser.plan });
  } catch (error) {
    console.error("[API /api/user/plan] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener el plan del usuario" },
      { status: 500 }
    );
  }
}
