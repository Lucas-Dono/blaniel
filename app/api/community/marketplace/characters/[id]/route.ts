import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { MarketplaceCharacterService } from '@/lib/services/marketplace-character.service';

/**
 * GET /api/community/marketplace/characters/[id] - Obtener personaje
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(request);
    const character = await MarketplaceCharacterService.getCharacter((await params).id, session?.user?.id);
    return NextResponse.json(character);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}

/**
 * PATCH /api/community/marketplace/characters/[id] - Actualizar personaje
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const data = await request.json();
    const character = await MarketplaceCharacterService.updateCharacter(
      (await params).id,
      session.user.id,
      data
    );

    return NextResponse.json(character);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * DELETE /api/community/marketplace/characters/[id] - Eliminar personaje
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const result = await MarketplaceCharacterService.deleteCharacter((await params).id, session.user.id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
