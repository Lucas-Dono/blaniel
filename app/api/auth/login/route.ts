import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/jwt';
import bcrypt from 'bcryptjs';
import { scrypt, timingSafeEqual, ScryptOptions } from 'crypto';
import { promisify } from 'util';
import { sendEmailVerificationCode, send2FALoginCode } from '@/lib/email/auth-emails.service';

const scryptAsync = promisify<string | Buffer, string | Buffer, number, ScryptOptions, Buffer>(scrypt);

async function verifyBetterAuthPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split(':');

    if (parts.length !== 2) {
      return false;
    }

    const [saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const hash = Buffer.from(hashHex, 'hex');

    const derived = (await scryptAsync(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
    })) as Buffer;

    return timingSafeEqual(hash, derived);
  } catch (error) {
    console.error('[AUTH] Error verifying password:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y password son requeridos' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        { error: 'Este usuario fue creado con OAuth. Por favor inicia sesión con el proveedor correspondiente.' },
        { status: 401 }
      );
    }

    let isValidPassword = false;

    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isValidPassword = await bcrypt.compare(password, user.password);
    } else {
      isValidPassword = await verifyBetterAuthPassword(password, user.password);
    }

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
      await sendEmailVerificationCode(user.id, user.email, user.name || undefined);

      return NextResponse.json(
        {
          error: 'email_not_verified',
          requiresVerification: true,
          email: user.email,
          message: 'Por favor verifica tu email. Hemos enviado un nuevo codigo.',
        },
        { status: 403 }
      );
    }

    if (user.twoFactorEnabled) {
      await send2FALoginCode(user.id, user.email, user.name || undefined);

      return NextResponse.json(
        {
          requires2FA: true,
          email: user.email,
          message: 'Ingresa el codigo de verificacion enviado a tu email.',
        },
        { status: 200 }
      );
    }

    const token = await generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        image: user.image,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Error al iniciar sesión' },
      { status: 500 }
    );
  }
}
