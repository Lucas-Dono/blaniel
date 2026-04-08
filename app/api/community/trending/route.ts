import { NextRequest, NextResponse } from 'next/server';
import { FeedService } from '@/lib/services/feed.service';

/**
 * GET /api/community/trending - Trending Communities
 * Comunidades con más actividad reciente (últimos 7 días)
 * No requiere autenticación
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    const communities = await FeedService.getTrendingCommunities(limit);

    return NextResponse.json({ communities });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
