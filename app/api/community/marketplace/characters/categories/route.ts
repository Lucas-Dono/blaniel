import { NextRequest, NextResponse } from 'next/server';
import { MarketplaceCharacterService } from '@/lib/services/marketplace-character.service';

/**
 * GET /api/community/marketplace/characters/categories - Categorías populares
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    const categories = await MarketplaceCharacterService.getPopularCategories(limit);
    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
