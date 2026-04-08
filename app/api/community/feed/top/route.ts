import { NextRequest, NextResponse } from 'next/server';
import { FeedService } from '@/lib/services/feed.service';
import { getAuthSession } from '@/lib/middleware/auth-helper';

/**
 * GET /api/community/feed/top?timeRange=day|week|month|year|all - Feed Top
 * Filtra posts según privacidad de comunidades
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = (searchParams.get('timeRange') || 'day') as any;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');

    // Get user if authenticated (optional)
    const session = await getAuthSession(request);
    const userId = session?.user?.id;

    const posts = await FeedService.getTopFeed(timeRange, page, limit, userId);

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
