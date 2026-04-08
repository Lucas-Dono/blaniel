/**
 * API Route: Grant Rewarded Image Analysis
 * Otorga créditos de análisis de imágenes después de ver un video ad
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { grantRewardedImages } from "@/lib/usage/daily-limits";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { videoId, provider, watchedSeconds } = body;

    if (!videoId || !provider || typeof watchedSeconds !== "number") {
      return NextResponse.json(
        { error: "Missing videoId, provider, or watchedSeconds" },
        { status: 400 }
      );
    }

    // Check que vio al menos 1 minuto
    if (watchedSeconds < 60) {
      return NextResponse.json(
        {
          error: "Debes ver al menos 1 minuto completo del video.",
          granted: 0,
        },
        { status: 400 }
      );
    }

    const result = await grantRewardedImages(
      user.id,
      watchedSeconds,
      user.plan || "free"
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.reason,
          granted: 0,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      imagesGranted: result.imagesGranted,
      message: `¡Genial! Se agregaron ${result.imagesGranted} análisis de imágenes a tu cuenta.`,
    });
  } catch (error) {
    console.error("Error granting rewarded images:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
