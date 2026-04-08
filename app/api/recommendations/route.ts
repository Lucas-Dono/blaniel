import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { generateRecommendations } from "@/lib/recommendations/engine";
import { prisma } from "@/lib/prisma";

// GET /api/recommendations - Obtener recomendaciones personalizadas
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);

    if (!authUser?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: authUser.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Generate recomendaciones (usa cache si está disponible)
    const recommendations = await generateRecommendations(user.id);

    return NextResponse.json({
      recommendations,
      total: recommendations.length,
      algorithm: "hybrid",
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json(
      { error: "Error al generar recomendaciones" },
      { status: 500 }
    );
  }
}

// POST /api/recommendations/regenerate - Forzar regeneración
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);

    if (!authUser?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: authUser.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Invalidar cache
    await prisma.recommendationCache.deleteMany({
      where: { userId: user.id },
    });

    // Generate nuevas recomendaciones
    const recommendations = await generateRecommendations(user.id);

    return NextResponse.json({
      recommendations,
      total: recommendations.length,
      message: "Recomendaciones actualizadas",
    });
  } catch (error) {
    console.error("Error regenerating recommendations:", error);
    return NextResponse.json(
      { error: "Error al regenerar recomendaciones" },
      { status: 500 }
    );
  }
}
