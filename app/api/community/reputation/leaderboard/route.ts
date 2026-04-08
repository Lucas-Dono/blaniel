import { NextRequest, NextResponse } from 'next/server';
import { ReputationService } from '@/lib/services/reputation.service';

/**
 * GET /api/community/reputation/leaderboard?timeRange=day|week|month|all - Leaderboard
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = (searchParams.get('timeRange') || 'all') as any;
    const limit = parseInt(searchParams.get('limit') || '50');

    const leaders = await ReputationService.getLeaderboard(timeRange, limit);
    return NextResponse.json(leaders);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
