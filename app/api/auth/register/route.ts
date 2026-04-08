import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { checkRegisterRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { trackEvent, EventType } from "@/lib/analytics/kpi-tracker";
import { sendEmailVerification } from "@/lib/email/auth-emails.service";
import { nanoid } from "nanoid";

const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  birthDate: z.string().refine((date) => {
    const d = new Date(date);
    const now = new Date();
    const age = now.getFullYear() - d.getFullYear();
    return age >= 13 && age <= 120; // Validate edad mínima 13 años
  }, "Debes tener al menos 13 años para registrarte"),
});

export async function POST(req: Request) {
  try {
    // Rate limiting
    const ip = getClientIp(req);
    const rateLimit = await checkRegisterRateLimit(ip);

    if (!rateLimit.success) {
      console.log(`[REGISTER] Rate limit exceeded for IP: ${ip}`);
      return NextResponse.json(
        {
          error: `Demasiados intentos de registro. Por favor, intenta de nuevo en ${Math.ceil((rateLimit.reset - Date.now()) / 1000 / 60)} minutos.`,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": rateLimit.reset.toString(),
            "Content-Type": "application/json",
          },
        }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error("[REGISTER] Error parsing request body:", error);
      return NextResponse.json(
        { error: "Datos de solicitud inválidos" },
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Validate datos
    const validationResult = registerSchema.safeParse(body);

    if (!validationResult.success) {
      console.log("[REGISTER] Validation failed:", validationResult.error.issues[0].message);
      return NextResponse.json(
        {
          error: validationResult.error.issues[0].message
        },
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { email, password, name, birthDate } = validationResult.data;

    // Check si el usuario ya existe
    let existingUser;
    try {
      existingUser = await prisma.user.findUnique({
        where: { email },
      });
    } catch (dbError) {
      console.error("[REGISTER] Database error checking existing user:", dbError);
      return NextResponse.json(
        { error: "Error de conexión con la base de datos. Por favor, intenta de nuevo." },
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (existingUser) {
      console.log(`[REGISTER] Email already registered: ${email}`);
      return NextResponse.json(
        { error: "Este email ya está registrado" },
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Password hash
    const hashedPassword = await bcrypt.hash(password, 10);

    // Calculate age and verify automatically
    const birthDateObj = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }

    const isAdult = age >= 18;

    // Create user with automatic age verification
    let user;
    try {
      user = await prisma.user.create({
        data: {
          id: nanoid(),
          email,
          password: hashedPassword,
          name,
          birthDate: birthDateObj,
          plan: "free",
          // Automatic age verification at registration
          ageVerified: true,
          isAdult: isAdult,
          ageVerifiedAt: new Date(),
          updatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          birthDate: true,
          plan: true,
          ageVerified: true,
          isAdult: true,
        },
      });
      console.log(`[REGISTER] User created successfully: ${email} (Age: ${age}, Adult: ${isAdult})`);
    } catch (dbError) {
      console.error("[REGISTER] Database error creating user:", dbError);
      return NextResponse.json(
        { error: "Error al crear el usuario. Por favor, intenta de nuevo." },
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // TRACKING: Age Verification Completed (Fase 6 - Compliance)
    try {
      await trackEvent(EventType.AGE_VERIFICATION_COMPLETED, {
        userId: user.id,
        age,
        isAdult,
        method: "birthdate",
      });

      // TRACKING: Signup Completed (Fase 6 - User Experience)
      await trackEvent(EventType.SIGNUP_COMPLETED, {
        userId: user.id,
        method: "credentials",
        email: user.email,
      });
    } catch (trackError) {
      // No lanzar error si falla el tracking, solo loguearlo
      console.error("[REGISTER] Error tracking events:", trackError);
    }

    // Send email verification (works even if emails are disabled)
    try {
      await sendEmailVerification(user.id, user.email, user.name || undefined);
      console.log(`[REGISTER] Email verification sent to: ${user.email}`);
    } catch (emailError) {
      // Do not throw error if email sending fails, just log it
      console.error("[REGISTER] Error sending verification email:", emailError);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Usuario registrado exitosamente",
        user,
        emailVerificationSent: process.env.EMAIL_ENABLED === 'true',
      },
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[REGISTER] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Error inesperado al registrar usuario. Por favor, intenta de nuevo.",
        details: process.env.NODE_ENV === "development" ? String(error) : undefined,
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
