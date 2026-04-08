import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordReset } from "@/lib/email/auth-emails.service";

const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validationResult = forgotPasswordSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = validationResult.data;

    // Get client info for security
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || undefined;

    // Send password reset email (service handles if email is enabled/disabled)
    const result = await sendPasswordReset(email, ipAddress, userAgent);

    // Por seguridad, siempre devolver el mismo mensaje
    // para no revelar si el email existe o no
    return NextResponse.json({
      success: true,
      message: "Si el email existe, recibirás instrucciones para restablecer tu contraseña",
      ...(process.env.NODE_ENV === "development" && result.success === false && { debug: result.error }),
    });
  } catch (error) {
    console.error("Error en forgot password:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
