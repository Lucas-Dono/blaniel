import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailCode } from '@/lib/email/auth-emails.service';
import { generateToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

/**
 * Mobile Email Verification Endpoint
 *
 * Verifies the 6-digit code sent to user's email and returns JWT on success.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[MOBILE-VERIFY-EMAIL] Processing email verification request');

    const body = await request.json();
    const { email, code } = body;

    // Validate required fields
    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email y codigo son requeridos' },
        { status: 400 }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'El codigo debe ser de 6 digitos' },
        { status: 400 }
      );
    }

    console.log('[MOBILE-VERIFY-EMAIL] Verifying code for:', email);

    // Verify the code
    const result = await verifyEmailCode(email, code);

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        invalid_code: 'Codigo incorrecto. Por favor, verifica e intenta nuevamente.',
        code_expired: 'El codigo ha expirado. Solicita uno nuevo.',
      };

      const errorMessage = errorMessages[result.error || ''] || 'Error de verificacion';

      console.log('[MOBILE-VERIFY-EMAIL] Verification failed:', result.error);

      return NextResponse.json(
        {
          error: errorMessage,
          code: result.error,
        },
        { status: 400 }
      );
    }

    console.log('[MOBILE-VERIFY-EMAIL] Code verified successfully for user:', result.userId);

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        image: true,
        createdAt: true,
      },
    });

    if (!user) {
      console.error('[MOBILE-VERIFY-EMAIL] User not found after verification');
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Generate JWT
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    });

    console.log('[MOBILE-VERIFY-EMAIL] JWT generated successfully');

    // Return token and user data
    return NextResponse.json({
      token,
      refreshToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        image: user.image,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[MOBILE-VERIFY-EMAIL] Unexpected error:', error.message);
    console.error('[MOBILE-VERIFY-EMAIL] Stack:', error.stack);

    return NextResponse.json(
      {
        error: 'Error del servidor. Intenta mas tarde.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
