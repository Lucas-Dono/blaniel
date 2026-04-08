import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { SavedPostService } from '@/lib/services/saved-post.service';

/**
 * GET /api/community/saved - Obtener posts guardados del usuario
 * Requiere autenticación
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

    const searchParams = request.nextUrl.searchParams;
    const collectionName = searchParams.get('collection') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');

    const savedPosts = await SavedPostService.getSavedPosts(session.user.id, {
      collectionName,
      page,
      limit,
    });

    const stats = await SavedPostService.getStats(session.user.id);

    return NextResponse.json({
      savedPosts,
      stats,
      pagination: {
        page,
        limit,
        hasMore: savedPosts.length === limit,
      },
    });
  } catch (error: any) {
    console.error('Error fetching saved posts:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener posts guardados' },
      { status: 400 }
    );
  }
}
