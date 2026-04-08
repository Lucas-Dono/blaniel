import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/jwt';
import { z } from 'zod';

/**
 * Endpoint de login OAuth2 para Minecraft
 *
 * El mod envía el id_token de Google, nosotros lo validamos,
 * auto-registramos/logeamos al usuario, y retornamos un JWT de Blaniel.
 *
 * POST /api/auth/minecraft-oauth-login
 * Body: { id_token: string }
 * Response: { token: string, user: {...}, agents: [...] }
 */

// Cliente OAuth2 de Google
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Validation schema
const MinecraftOAuthLoginSchema = z.object({
  id_token: z.string().min(1, 'id_token es requerido'),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Validar request body
    const body = await req.json();
    const validation = MinecraftOAuthLoginSchema.safeParse(body);

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
    console.log('[Minecraft OAuth Login] Verificando id_token con Google...');

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

    console.log(`[Minecraft OAuth Login] Token verificado para: ${email}`);

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
      include: {
        Agent: {
          select: {
            id: true,
            name: true,
            gender: true,
            profile: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    // Si no existe, crear usuario nuevo (auto-registro)
    if (!user) {
      console.log('[Minecraft OAuth Login] Usuario nuevo, creando cuenta...');

      const newUser = await prisma.user.create({
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

      // Re-fetch with Agent include
      user = await prisma.user.findUnique({
        where: { id: newUser.id },
        include: {
          Agent: {
            select: {
              id: true,
              name: true,
              gender: true,
              profile: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      console.log('[Minecraft OAuth Login] Usuario creado:', newUser.id);
    } else {
      console.log('[Minecraft OAuth Login] Usuario existente:', user.id);
    }

    // 4. Generar JWT de Blaniel (30 días)
    const token = await generateToken({
      userId: user!.id,
      email: user!.email,
      name: user!.name,
      plan: user!.plan,
    });

    // 5. Registrar login exitoso
    console.log(`[Minecraft OAuth Login] Usuario autenticado: ${user!.email}`);

    // 6. Retornar JWT + datos del usuario
    return NextResponse.json({
      token,
      expiresIn: 30 * 24 * 60 * 60, // 30 días en segundos
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        image: user!.image,
        plan: user!.plan,
      },
      agents: user!.Agent.map((agent) => {
        const profile = agent.profile as any;
        const age = profile?.identidad?.edad || profile?.age || null;

        return {
          id: agent.id,
          name: agent.name,
          gender: agent.gender || 'unknown',
          age: age,
        };
      }),
      message: 'Login exitoso con Google',
    });
  } catch (error: any) {
    console.error('[Minecraft OAuth Login Error]', error);
    return NextResponse.json(
      {
        error: 'Error al iniciar sesión',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
