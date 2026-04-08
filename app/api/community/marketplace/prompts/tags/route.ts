import { NextRequest, NextResponse } from 'next/server';
import { MarketplacePromptService } from '@/lib/services/marketplace-prompt.service';

/**
 * GET /api/community/marketplace/prompts/tags - Tags populares
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');

    const tags = await MarketplacePromptService.getPopularTags(limit);
    return NextResponse.json(tags);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
