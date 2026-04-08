import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { FeedService } from '@/lib/services/feed.service';

/**
 * GET /api/community/feed/following - Feed de usuarios seguidos
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');

    const posts = await FeedService.getFollowingFeed(session.user.id, page, limit);

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
