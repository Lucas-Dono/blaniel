import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { MarketplaceCharacterService } from '@/lib/services/marketplace-character.service';

/**
 * POST /api/community/marketplace/characters/[id]/download - Descargar personaje
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

    const character = await MarketplaceCharacterService.downloadCharacter((await params).id, session.user.id);
    return NextResponse.json(character);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
