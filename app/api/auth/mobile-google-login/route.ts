import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/jwt';
import { z } from 'zod';

/**
 * Endpoint de login OAuth2 con Google para aplicación móvil
 *
 * La app móvil envía el id_token de Google, nosotros lo validamos,
 * auto-registramos/logeamos al usuario, y retornamos un JWT + refreshToken.
 *
 * POST /api/auth/mobile-google-login
 * Body: { id_token: string }
 * Response: { token: string, refreshToken: string, user: {...} }
 */

// Cliente OAuth2 de Google
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Validation schema
const MobileGoogleLoginSchema = z.object({
  id_token: z.string().min(1, 'id_token es requerido'),
});

export async function POST(req: NextRequest) {
  try {
    console.log('[Mobile Google Login] 📱 Processing Google login request');

    // 1. Validar request body
    const body = await req.json();
    const validation = MobileGoogleLoginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: validation.error.issues.map((issue) => issue.message),
        },
        { status: 400 }
      );
    }

    const { id_token } = validation.data;

    // 2. Verificar id_token con Google
    console.log('[Mobile Google Login] 🔐 Verificando id_token con Google...');

    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Payload inválido del id_token');
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return NextResponse.json(
        { error: 'Email no proporcionado por Google' },
        { status: 400 }
      );
    }

    console.log(`[Mobile Google Login] ✅ Token verificado para: ${email}`);

    // 3. Buscar usuario existente por email o googleId
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          {
            Account: {
              some: {
                providerId: 'google',
                accountId: googleId,
              },
            },
          },
        ],
      },
    });

    // Si no existe, crear usuario nuevo (auto-registro)
    if (!user) {
      console.log('[Mobile Google Login] 👤 Usuario nuevo, creando cuenta...');

      user = await prisma.user.create({
        data: {
          id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          email: email.toLowerCase(),
          name: name || email.split('@')[0],
          image: picture,
          emailVerified: true, // OAuth emails son verificados
          plan: 'FREE',
          Account: {
            create: {
              id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              providerId: 'google',
              accountId: googleId!,
              accessToken: '', // No almacenamos access_token del OAuth
              refreshToken: null,
              expiresAt: null,
            },
          },
        },
      });

      console.log('[Mobile Google Login] ✅ Usuario creado:', user.id);
    } else {
      console.log('[Mobile Google Login] ✅ Usuario existente:', user.id);
    }

    // 4. Generar JWT de Blaniel
    const jwtToken = await generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    });

    console.log('[Mobile Google Login] 🎟️ JWT generated successfully');
    console.log(`[Mobile Google Login] ✅ Usuario autenticado: ${user.email}`);

    // 5. Retornar JWT + datos del usuario (formato compatible con mobile-login)
    return NextResponse.json({
      token: jwtToken,
      refreshToken: jwtToken, // Por ahora usar el mismo token
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        plan: user.plan,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[Mobile Google Login Error]', error);
    console.error('[Mobile Google Login] Stack:', error.stack);

    return NextResponse.json(
      {
        error: 'Error al iniciar sesión con Google',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
