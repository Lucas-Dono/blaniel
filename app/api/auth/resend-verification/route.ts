import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resendEmailVerification,
  resendEmailVerificationCode,
} from "@/lib/email/auth-emails.service";

const resendVerificationSchema = z.object({
  email: z.string().email("Email invalido"),
  type: z.enum(["link", "code"]).optional().default("link"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validationResult = resendVerificationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, type } = validationResult.data;

    // Resend verification email (code or link based on type)
    const result = type === "code"
      ? await resendEmailVerificationCode(email)
      : await resendEmailVerification(email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: type === "code"
        ? "Codigo de verificacion enviado exitosamente"
        : "Email de verificacion enviado exitosamente",
      emailEnabled: process.env.EMAIL_ENABLED === 'true',
    });
  } catch (error) {
    console.error("Error en resend verification:", error);
    return NextResponse.json(
      { error: "Error al reenviar verificacion" },
      { status: 500 }
    );
  }
}
