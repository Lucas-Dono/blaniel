import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { sendEmailVerificationCode, send2FALoginCode } from '@/lib/email/auth-emails.service';

/**
 * Mobile Login Endpoint
 *
 * Usa better-auth internamente para validar credenciales.
 * Recibe email/password por HTTPS (cifrado en tránsito) y retorna JWT.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[MOBILE-LOGIN] 📱 Processing mobile login request');

    // Parsear el body
    const body = await request.json();
    const { email, password } = body;

    console.log('[MOBILE-LOGIN] 📧 Email:', email);
    console.log('[MOBILE-LOGIN] 🔑 Password received (length):', password?.length);

    console.log('[MOBILE-LOGIN] 🔄 About to call auth.api.signInEmail...');
    console.log('[MOBILE-LOGIN] 🔄 Params:', { email, password: '***' });

    let result;
    try {
      // Llamar a better-auth API pasando el body como objeto plano
      result = await auth.api.signInEmail({
        body: {
          email,
          password,
        },
      });
      console.log('[MOBILE-LOGIN] ✅ auth.api.signInEmail returned successfully');
    } catch (authError: any) {
      console.error('[MOBILE-LOGIN] ❌ auth.api.signInEmail failed:', authError.message);
      console.error('[MOBILE-LOGIN] ❌ Error type:', authError.constructor?.name);
      console.error('[MOBILE-LOGIN] ❌ Stack:', authError.stack);

      // Analizar el error de better-auth para devolver el código apropiado
      const errorMessage = authError.message?.toLowerCase() || '';

      // Errores de credenciales incorrectas (401)
      if (
        errorMessage.includes('invalid') ||
        errorMessage.includes('incorrect') ||
        errorMessage.includes('password') ||
        errorMessage.includes('credentials') ||
        errorMessage.includes('not found') ||
        errorMessage.includes('no user')
      ) {
        console.error('[MOBILE-LOGIN] ❌ Authentication failed - invalid credentials');
        return NextResponse.json(
          { error: 'Credenciales incorrectas. Verifica tu email y contraseña.' },
          { status: 401 }
        );
      }

      // For otros errores, continuar con el catch general
      throw authError;
    }

    console.log('[MOBILE-LOGIN] 📦 Better-auth result type:', typeof result);
    console.log('[MOBILE-LOGIN] 📦 Better-auth result keys:', Object.keys(result || {}));

    // Check que tengamos token y usuario
    if (!result || !result.token || !result.user) {
      console.log('[MOBILE-LOGIN] ❌ No token or user in result');
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    console.log('[MOBILE-LOGIN] ✅ Login successful for:', result.user.email);

    // CRITICAL: Better-auth no incluye campos custom como 'plan', 'emailVerified' y 'twoFactorEnabled'
    // Necesitamos consultar Prisma para obtener estos campos
    const userWithPlan = await prisma.user.findUnique({
      where: { id: result.user.id },
      select: { plan: true, emailVerified: true, twoFactorEnabled: true, name: true }
    });

    const userPlan = userWithPlan?.plan || 'free';
    console.log('[MOBILE-LOGIN] 📋 User plan from database:', userPlan);
    console.log('[MOBILE-LOGIN] 📧 Email verified:', userWithPlan?.emailVerified);
    console.log('[MOBILE-LOGIN] 🔐 2FA enabled:', userWithPlan?.twoFactorEnabled);

    // Check if email is verified
    if (!userWithPlan?.emailVerified) {
      console.log('[MOBILE-LOGIN] ❌ Email not verified, sending new code...');

      // Send new verification code
      await sendEmailVerificationCode(
        result.user.id,
        result.user.email,
        userWithPlan?.name || result.user.name || undefined
      );

      return NextResponse.json(
        {
          error: 'email_not_verified',
          requiresVerification: true,
          email: result.user.email,
          message: 'Por favor verifica tu email. Hemos enviado un nuevo codigo.',
        },
        { status: 403 }
      );
    }

    // Check if 2FA is enabled
    if (userWithPlan?.twoFactorEnabled) {
      console.log('[MOBILE-LOGIN] 🔐 2FA enabled, sending code...');

      // Send 2FA code
      await send2FALoginCode(
        result.user.id,
        result.user.email,
        userWithPlan?.name || result.user.name || undefined
      );

      return NextResponse.json(
        {
          requires2FA: true,
          email: result.user.email,
          message: 'Ingresa el codigo de verificacion enviado a tu email.',
        },
        { status: 200 }
      );
    }

    // Generate JWT propio (no usar el session token de better-auth)
    // El JWT incluye la información del usuario y se puede decodificar en el cliente
    const jwtToken = await generateToken({
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name || null,
      plan: userPlan,
    });

    console.log('[MOBILE-LOGIN] 🎟️ JWT generated successfully');

    // Retornar en formato compatible con mobile
    return NextResponse.json({
      token: jwtToken,
      refreshToken: jwtToken, // Por ahora usar el mismo token
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        plan: userPlan,
        image: result.user.image,
        createdAt: result.user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[MOBILE-LOGIN] ❌ Unexpected error:', error.message);
    console.error('[MOBILE-LOGIN] ❌ Stack:', error.stack);

    // Errores de servidor o inesperados
    return NextResponse.json(
      {
        error: 'Error del servidor. Intenta más tarde.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
