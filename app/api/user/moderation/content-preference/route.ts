import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { UserModerationService } from '@/lib/services/user-moderation.service';

/**
 * POST /api/user/moderation/content-preference - Marcar contenido como "No me interesa"
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { type, value, action = 'hide' } = await request.json();

    if (!type || !value) {
      return NextResponse.json(
        { error: 'type y value requeridos' },
        { status: 400 }
      );
    }

    if (!['tag', 'postType', 'community'].includes(type)) {
      return NextResponse.json(
        { error: 'type debe ser: tag, postType o community' },
        { status: 400 }
      );
    }

    if (!['hide', 'reduce', 'block'].includes(action)) {
      return NextResponse.json(
        { error: 'action debe ser: hide, reduce o block' },
        { status: 400 }
      );
    }

    const result = await UserModerationService.setContentPreference(
      session.user.id,
      type as 'tag' | 'postType' | 'community',
      value,
      action as 'hide' | 'reduce' | 'block'
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error setting content preference:', error);
    return NextResponse.json(
      { error: error.message || 'Error al configurar preferencia' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/user/moderation/content-preference - Eliminar preferencia
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const value = searchParams.get('value');

    if (!type || !value) {
      return NextResponse.json(
        { error: 'type y value requeridos' },
        { status: 400 }
      );
    }

    const result = await UserModerationService.removeContentPreference(
      session.user.id,
      type as 'tag' | 'postType' | 'community',
      value
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error removing content preference:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar preferencia' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/user/moderation/content-preference - Obtener preferencias
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const preferences = await UserModerationService.getContentPreferences(
      session.user.id
    );

    return NextResponse.json({ preferences });
  } catch (error: any) {
    console.error('Error getting content preferences:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener preferencias' },
      { status: 400 }
    );
  }
}
