import { NextRequest, NextResponse } from 'next/server';
import { MarketplacePromptService } from '@/lib/services/marketplace-prompt.service';

/**
 * GET /api/community/marketplace/prompts/categories - Categorías populares
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    const categories = await MarketplacePromptService.getPopularCategories(limit);
    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
