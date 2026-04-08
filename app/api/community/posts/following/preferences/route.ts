import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { UserPreferenceService } from '@/lib/services/user-preference.service';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

/**
 * GET /api/community/posts/following/preferences - Obtener preferencias del usuario
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get preferencias de contenido
    const contentPreferences = await UserPreferenceService.getUserPreferences(userId);

    // Get configuración de email
    let emailConfig = await prisma.emailNotificationConfig.findUnique({
      where: { userId }
    });

    if (!emailConfig) {
      // Create configuración por defecto
      emailConfig = await prisma.emailNotificationConfig.create({
        data: {
          id: nanoid(),
          userId,
          frequency: 'instant',
          newComments: true,
          newReplies: true,
          postUpdates: true,
          digestSummary: true,
          updatedAt: new Date()
        }
      });
    }

    // Get historial de acciones
    const actionHistory = await prisma.userActionHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return NextResponse.json({
      contentPreferences,
      emailConfig,
      actionHistory
    });

  } catch (error: any) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener preferencias' },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/community/posts/following/preferences - Actualizar preferencias
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();

    // Update configuración de email si se proporcionó
    if (body.emailConfig) {
      await prisma.emailNotificationConfig.upsert({
        where: { userId },
        create: {
          id: nanoid(),
          userId,
          updatedAt: new Date(),
          ...body.emailConfig
        },
        update: body.emailConfig
      });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error updating preferences:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar preferencias' },
      { status: 400 }
    );
  }
}
