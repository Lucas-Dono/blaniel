import { NextRequest, NextResponse } from 'next/server';
import { FeedService } from '@/lib/services/feed.service';
import { getAuthSession } from '@/lib/middleware/auth-helper';

/**
 * GET /api/community/feed/home - Feed Home (Personalizado)
 * Muestra posts de las comunidades a las que el usuario está suscrito
 * Similar al feed "Home" de Reddit
 * Requiere autenticación
 */
export async function GET(request: NextRequest) {
  try {
    // Autenticación requerida
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');

    const posts = await FeedService.getHomeFeed(session.user.id, page, limit);

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        hasMore: posts.length === limit
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
