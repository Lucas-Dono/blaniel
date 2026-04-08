import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * GET /api/user/api-key
 * Obtiene la API key actual del usuario
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { apiKey: true },
    });

    return NextResponse.json({
      apiKey: userData?.apiKey || null,
      hasKey: !!userData?.apiKey,
    });
  } catch (error: any) {
    console.error('[API Key GET Error]', error);
    return NextResponse.json(
      { error: 'Error al obtener API key' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/api-key
 * Genera una nueva API key para el usuario
 * WARNING: Invalida la anterior si existe
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Generate API key única (formato: blnl_<32 chars random>)
    const apiKey = `blnl_${crypto.randomBytes(32).toString('hex')}`;

    // Update en base de datos
    await prisma.user.update({
      where: { id: user.id },
      data: { apiKey },
    });

    return NextResponse.json({
      apiKey,
      message: 'API key generada exitosamente',
    });
  } catch (error: any) {
    console.error('[API Key POST Error]', error);
    return NextResponse.json(
      { error: 'Error al generar API key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/api-key
 * Elimina la API key del usuario
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { apiKey: null },
    });

    return NextResponse.json({
      message: 'API key eliminada exitosamente',
    });
  } catch (error: any) {
    console.error('[API Key DELETE Error]', error);
    return NextResponse.json(
      { error: 'Error al eliminar API key' },
      { status: 500 }
    );
  }
}
