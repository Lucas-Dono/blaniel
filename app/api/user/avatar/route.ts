import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadImageFromDataUrl } from '@/lib/storage/cloud-storage';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';

/**
 * Endpoint para subir avatar de usuario
 * POST /api/user/avatar
 *
 * Acepta una imagen en base64 y la guarda usando el servicio de almacenamiento
 * (Cloudflare R2 en producción, local en desarrollo)
 *
 * Soporta autenticación mediante:
 * - Cookies de sesión (better-auth)
 * - JWT Bearer token (app móvil)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[USER-AVATAR] Processing avatar upload request');

    // Try JWT authentication first (mobile app)
    let userId: string | null = null;

    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwtPayload = await verifyToken(token);

      if (jwtPayload) {
        userId = jwtPayload.userId;
        console.log('[USER-AVATAR] Authenticated via JWT:', userId);
      }
    }

    // If no JWT, try with cookie session
    if (!userId) {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (session?.user) {
        userId = session.user.id;
        console.log('[USER-AVATAR] Authenticated via session:', userId);
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    console.log('[USER-AVATAR] User ID:', userId);

    // Parsear el body
    const body = await request.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json(
        { error: 'No se proporcionó imagen' },
        { status: 400 }
      );
    }

    // Validate que sea una imagen base64
    if (!image.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Formato de imagen inválido. Debe ser una imagen en base64' },
        { status: 400 }
      );
    }

    // Extraer el tipo de imagen y los datos
    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: 'Formato de imagen inválido' },
        { status: 400 }
      );
    }

    const imageType = matches[1];
    const base64Data = matches[2];

    // Validate tipo de imagen
    const validTypes = ['jpeg', 'jpg', 'png', 'webp'];
    if (!validTypes.includes(imageType.toLowerCase())) {
      return NextResponse.json(
        { error: 'Tipo de imagen no soportado. Usa JPG, PNG o WebP' },
        { status: 400 }
      );
    }

    // Convertir base64 a buffer para validar tamaño
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate tamaño (máximo 5MB antes de optimización)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (buffer.length > maxSize) {
      return NextResponse.json(
        { error: 'La imagen es demasiado grande. Máximo 5MB' },
        { status: 400 }
      );
    }

    // Subir usando el servicio de almacenamiento
    // Esto automáticamente:
    // - Optimiza la imagen a WebP
    // - La sube a Cloudflare R2 (o local según config)
    // - Retorna la URL pública
    console.log('[USER-AVATAR] Uploading to storage service...');
    const avatarUrl = await uploadImageFromDataUrl(image, userId, `avatar-${userId}.${imageType}`);

    // Update usuario en la base de datos
    await prisma.user.update({
      where: { id: userId },
      data: { image: avatarUrl },
    });

    console.log('[USER-AVATAR] Avatar uploaded successfully:', avatarUrl);

    return NextResponse.json({
      success: true,
      imageUrl: avatarUrl,
    });
  } catch (error: any) {
    console.error('[USER-AVATAR] Error uploading avatar:', error);
    return NextResponse.json(
      {
        error: 'Error al subir el avatar',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Obtener avatar actual del usuario
 * GET /api/user/avatar
 *
 * Soporta autenticación mediante:
 * - Cookies de sesión (better-auth)
 * - JWT Bearer token (app móvil)
 */
export async function GET(request: NextRequest) {
  try {
    // Try JWT authentication first (mobile app)
    let userId: string | null = null;

    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwtPayload = await verifyToken(token);

      if (jwtPayload) {
        userId = jwtPayload.userId;
      }
    }

    // If no JWT, try with cookie session
    if (!userId) {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (session?.user) {
        userId = session.user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });

    return NextResponse.json({
      imageUrl: user?.image || null,
    });
  } catch (error: any) {
    console.error('[USER-AVATAR] Error getting avatar:', error);
    return NextResponse.json(
      { error: 'Error al obtener el avatar' },
      { status: 500 }
    );
  }
}

