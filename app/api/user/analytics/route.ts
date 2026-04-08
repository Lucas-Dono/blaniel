import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { UserAnalyticsService } from '@/lib/services/user-analytics.service';

/**
 * GET /api/user/analytics - Obtener estadísticas completas del usuario
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include'); // 'stats', 'top', 'activity', 'trends', 'all'

    const response: any = {};

    if (!include || include === 'all' || include === 'stats') {
      response.stats = await UserAnalyticsService.getUserStats(session.user.id);
    }

    if (include === 'all' || include === 'top') {
      response.topPosts = await UserAnalyticsService.getTopPosts(session.user.id);
    }

    if (include === 'all' || include === 'activity') {
      response.recentActivity = await UserAnalyticsService.getRecentActivity(session.user.id);
    }

    if (include === 'all' || include === 'trends') {
      response.trends = await UserAnalyticsService.getUserTrends(session.user.id);
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error getting user analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener estadísticas' },
      { status: 400 }
    );
  }
}
