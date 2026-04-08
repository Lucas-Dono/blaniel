import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { MarketplacePromptService } from '@/lib/services/marketplace-prompt.service';

/**
 * GET /api/community/marketplace/prompts - Listar prompts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || undefined;
    const tags = searchParams.get('tags')?.split(',') || undefined;
    const authorId = searchParams.get('authorId') || undefined;
    const search = searchParams.get('search') || undefined;
    const minRating = searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined;
    const sort = (searchParams.get('sort') || 'popular') as any;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');

    const result = await MarketplacePromptService.listPrompts(
      { category, tags, authorId, search, minRating },
      page,
      limit,
      sort
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * POST /api/community/marketplace/prompts - Crear prompt
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const data = await request.json();
    const prompt = await MarketplacePromptService.createPrompt(session.user.id, data);

    return NextResponse.json(prompt, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
