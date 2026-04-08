import { NextRequest, NextResponse } from 'next/server';
import { MarketplaceCharacterService } from '@/lib/services/marketplace-character.service';

/**
 * GET /api/community/marketplace/characters/tags - Tags populares
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');

    const tags = await MarketplaceCharacterService.getPopularTags(limit);
    return NextResponse.json(tags);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
