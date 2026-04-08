import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmailToken } from "@/lib/email/auth-emails.service";

const verifyEmailSchema = z.object({
  email: z.string().email("Email inválido"),
  token: z.string().min(1, "Token requerido"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validationResult = verifyEmailSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, token } = validationResult.data;

    // Verify email token
    const result = await verifyEmailToken(email, token);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email verificado exitosamente",
    });
  } catch (error) {
    console.error("Error en verify email:", error);
    return NextResponse.json(
      { error: "Error al verificar el email" },
      { status: 500 }
    );
  }
}

// GET endpoint for verification links (token in URL)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const token = searchParams.get('token');

    if (!email || !token) {
      return NextResponse.json(
        { error: "Email y token son requeridos" },
        { status: 400 }
      );
    }

    // Verify email token
    const result = await verifyEmailToken(email, token);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email verificado exitosamente",
    });
  } catch (error) {
    console.error("Error en verify email (GET):", error);
    return NextResponse.json(
      { error: "Error al verificar el email" },
      { status: 500 }
    );
  }
}
