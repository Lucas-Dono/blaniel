/**
 * API Route: GET /api/analytics/kpis
 *
 * Obtiene todos los KPIs del sistema según la Fase 6 del plan de coordinación.
 * Incluye métricas de:
 * - Compliance & Safety
 * - User Experience
 * - Engagement
 * - Monetization
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getAllKPIs, checkAlerts } from "@/lib/analytics/kpi-tracker";

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Solo admins pueden ver KPIs globales
    // TODO: Agregar verificación de rol admin cuando se implemente
    // Por ahora, permitir a todos los usuarios autenticados

    // Get parámetros de fecha opcional
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    const startDate = startParam ? new Date(startParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = endParam ? new Date(endParam) : new Date();

    // Get todos los KPIs
    const kpis = await getAllKPIs(startDate, endDate);

    // Get alertas
    const alerts = await checkAlerts();

    return NextResponse.json({
      success: true,
      data: {
        ...kpis,
        alerts,
      },
    });
  } catch (error) {
    console.error("[KPIs API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/kpis - Forzar recálculo de KPIs (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // TODO: Verificar rol admin

    // Por ahora, simplemente recalcular y retornar
    const kpis = await getAllKPIs();
    const alerts = await checkAlerts();

    return NextResponse.json({
      success: true,
      message: "KPIs recalculated successfully",
      data: {
        ...kpis,
        alerts,
      },
    });
  } catch (error) {
    console.error("[KPIs API POST] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
