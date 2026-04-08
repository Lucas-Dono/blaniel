import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { UserModerationService } from '@/lib/services/user-moderation.service';

/**
 * GET /api/user/moderation/stats - Obtener estadísticas de moderación
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const stats = await UserModerationService.getModerationStats(session.user.id);

    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error('Error getting moderation stats:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener estadísticas' },
      { status: 400 }
    );
  }
}
