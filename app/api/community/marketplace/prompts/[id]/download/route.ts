import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { MarketplacePromptService } from '@/lib/services/marketplace-prompt.service';

/**
 * POST /api/community/marketplace/prompts/[id]/download - Descargar prompt
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const prompt = await MarketplacePromptService.downloadPrompt((await params).id, session.user.id);
    return NextResponse.json(prompt);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
