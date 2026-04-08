/**
 * API: /api/users/me/mention-privacy
 * GET - Obtener configuración de privacidad de menciones
 * PUT - Actualizar configuración de privacidad de menciones
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

const VALID_PRIVACY_OPTIONS = ['anyone', 'friends', 'no_one'];

export async function GET(_request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mentionPrivacy: true },
    });

    return NextResponse.json({
      mentionPrivacy: user?.mentionPrivacy || 'anyone',
    });
  } catch (error) {
    console.error('Error obteniendo privacidad:', error);
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { mentionPrivacy } = body;

    if (!mentionPrivacy || !VALID_PRIVACY_OPTIONS.includes(mentionPrivacy)) {
      return NextResponse.json(
        { error: 'Opción de privacidad inválida' },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { mentionPrivacy },
      select: { mentionPrivacy: true },
    });

    return NextResponse.json({
      success: true,
      mentionPrivacy: updated.mentionPrivacy,
    });
  } catch (error) {
    console.error('Error actualizando privacidad:', error);
    return NextResponse.json(
      { error: 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}
