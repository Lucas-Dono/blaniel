import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sendEmailVerificationCode } from '@/lib/email/auth-emails.service';
import { prisma } from '@/lib/prisma';

/**
 * Mobile Register Endpoint
 *
 * Usa better-auth internamente para crear usuarios.
 * Recibe email/password/name por HTTPS (cifrado en transito).
 * Envia codigo de verificacion por email - NO retorna JWT hasta verificar.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[MOBILE-REGISTER] 📱 Processing mobile registration request');

    // Parsear el body
    const body = await request.json();
    const { email, password, name } = body;

    console.log('[MOBILE-REGISTER] 📧 Email:', email);
    console.log('[MOBILE-REGISTER] 👤 Name:', name);
    console.log('[MOBILE-REGISTER] 🔑 Password received (length):', password?.length);

    // Validate campos requeridos
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos.' },
        { status: 400 }
      );
    }

    console.log('[MOBILE-REGISTER] 🔄 About to call auth.api.signUpEmail...');

    let result;
    try {
      // Llamar a better-auth API para crear el usuario
      result = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name,
        },
      });
      console.log('[MOBILE-REGISTER] ✅ auth.api.signUpEmail returned successfully');
    } catch (authError: any) {
      console.error('[MOBILE-REGISTER] ❌ auth.api.signUpEmail failed:', authError.message);
      console.error('[MOBILE-REGISTER] ❌ Error type:', authError.constructor?.name);
      console.error('[MOBILE-REGISTER] ❌ Stack:', authError.stack);

      // Analizar el error de better-auth para devolver el código apropiado
      const errorMessage = authError.message?.toLowerCase() || '';

      // Email ya existe (409 Conflict)
      if (
        errorMessage.includes('already exists') ||
        errorMessage.includes('duplicate') ||
        errorMessage.includes('unique constraint') ||
        errorMessage.includes('email_unique')
      ) {
        console.error('[MOBILE-REGISTER] ❌ Registration failed - email already exists');
        return NextResponse.json(
          { error: 'Este email ya está registrado. Intenta iniciar sesión.' },
          { status: 409 }
        );
      }

      // Email inválido (400 Bad Request)
      if (
        errorMessage.includes('invalid email') ||
        errorMessage.includes('email format')
      ) {
        console.error('[MOBILE-REGISTER] ❌ Registration failed - invalid email');
        return NextResponse.json(
          { error: 'Email inválido. Verifica el formato.' },
          { status: 400 }
        );
      }

      // Contraseña muy débil (400 Bad Request)
      if (
        errorMessage.includes('password') &&
        (errorMessage.includes('weak') || errorMessage.includes('short') || errorMessage.includes('length'))
      ) {
        console.error('[MOBILE-REGISTER] ❌ Registration failed - weak password');
        return NextResponse.json(
          { error: 'La contraseña debe tener al menos 8 caracteres.' },
          { status: 400 }
        );
      }

      // For otros errores, continuar con el catch general
      throw authError;
    }

    // Check que tengamos token y usuario
    if (!result || !result.token || !result.user) {
      console.log('[MOBILE-REGISTER] ❌ No token or user in result');
      return NextResponse.json(
        { error: 'Error al crear la cuenta.' },
        { status: 500 }
      );
    }

    console.log('[MOBILE-REGISTER] ✅ Registration successful for:', result.user.email);

    // Send verification code email
    console.log('[MOBILE-REGISTER] 📧 Sending verification code...');
    const emailResult = await sendEmailVerificationCode(
      result.user.id,
      result.user.email,
      result.user.name || undefined
    );

    if (!emailResult.success) {
      console.error('[MOBILE-REGISTER] ❌ Failed to send verification email:', emailResult.error);
      // Still return success for registration, but log the error
    } else {
      console.log('[MOBILE-REGISTER] ✅ Verification code sent successfully');
    }

    // Return verification required response (NO JWT)
    return NextResponse.json({
      requiresVerification: true,
      email: result.user.email,
      message: 'Codigo de verificacion enviado a tu email',
    }, { status: 201 });
  } catch (error: any) {
    console.error('[MOBILE-REGISTER] ❌ Unexpected error:', error.message);
    console.error('[MOBILE-REGISTER] ❌ Stack:', error.stack);

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
