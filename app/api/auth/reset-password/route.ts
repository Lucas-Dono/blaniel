import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  verifyPasswordResetToken,
  deletePasswordResetToken,
  sendPasswordChangedNotification,
} from "@/lib/email/auth-emails.service";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validationResult = resetPasswordSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { token, email, password } = validationResult.data;

    // Verify token
    const verifyResult = await verifyPasswordResetToken(email, token);
    if (!verifyResult.success) {
      return NextResponse.json(
        { error: verifyResult.error },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Delete used token
    await deletePasswordResetToken(email, token);

    // Get client IP for notification
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;

    // Send password changed notification (works even if emails are disabled)
    await sendPasswordChangedNotification(email, ipAddress);

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada exitosamente",
    });
  } catch (error) {
    console.error("Error en reset password:", error);
    return NextResponse.json(
      { error: "Error al restablecer la contraseña" },
      { status: 500 }
    );
  }
}
