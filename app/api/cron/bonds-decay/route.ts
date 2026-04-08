/**
 * GET /api/cron/bonds-decay
 *
 * Cron job que procesa el decay de todos los bonds
 * Ejecutar diariamente (ej: 3 AM)
 *
 * Configurar en tu sistema de cron jobs o servicio cloud:
 * - Vercel Cron: https://vercel.com/docs/cron-jobs
 * - O usar cron job en servidor con curl
 */

import { NextRequest, NextResponse } from "next/server";
import { processAllBondDecay } from "@/lib/services/symbolic-bonds.service";

export async function GET(req: NextRequest) {
  try {
    // Check authorization (CRON_SECRET env var)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.warn("CRON_SECRET not configured");
    }

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    console.log("Starting bond decay process...");

    const results = await processAllBondDecay();

    console.log("Bond decay process completed:", results);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error("Error in bond decay cron job:", error);
    return NextResponse.json(
      { error: error.message || "Error procesando decay" },
      { status: 500 }
    );
  }
}
