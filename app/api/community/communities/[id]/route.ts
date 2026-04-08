import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { CommunityService } from '@/lib/services/community.service';

/** GET /api/community/communities/[id] - Get community by ID or slug */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(request);
    const identifier = (await params).id;

    // Try to get by slug first, then by ID
    let community = await CommunityService.getCommunityBySlug(identifier, session?.user?.id);

    if (!community) {
      community = await CommunityService.getCommunity(identifier, session?.user?.id);
    }

    if (!community) {
      return NextResponse.json({ error: 'Comunidad no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ community });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}

/**
 * PATCH /api/community/communities/[id] - Actualizar comunidad
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
    const community = await CommunityService.updateCommunity(
      (await params).id,
      session.user.id,
      data
    );

    return NextResponse.json(community);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * DELETE /api/community/communities/[id] - Eliminar comunidad
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

    const result = await CommunityService.deleteCommunity((await params).id, session.user.id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
