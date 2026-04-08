/**
 * API Route: Grant Rewarded Messages
 * Otorga mensajes al usuario después de ver un video ad
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { grantRewardedMessages } from "@/lib/usage/daily-limits";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { videoId, provider } = body;

    if (!videoId || !provider) {
      return NextResponse.json(
        { error: "Missing videoId or provider" },
        { status: 400 }
      );
    }

    // Aquí podrías verificar con el proveedor de ads (Google AdMob, etc.)
    // que el video realmente fue visto completo
    // Por ahora, confiamos en el cliente

    const result = await grantRewardedMessages(
      user.id,
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
      messagesGranted: result.messagesGranted,
      message: `¡Genial! Se agregaron ${result.messagesGranted} mensajes a tu cuenta.`,
    });
  } catch (error) {
    console.error("Error granting rewarded messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
