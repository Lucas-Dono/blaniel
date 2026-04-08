import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
/**
 * POST /api/community/communities/[id]/owners - Agregar co-owner
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

    const { userId } = await request.json();
    const _communityId = (await params).id;

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    // TODO: Implement addCoOwner method in CommunityService
    // await CommunityService.addCoOwner(communityId, session.user.id, userId);

    return NextResponse.json({ error: 'Method not implemented' }, { status: 501 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * DELETE /api/community/communities/[id]/owners - Remover co-owner
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

    const { userId } = await request.json();
    const _communityId = (await params).id;

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    // TODO: Implement removeCoOwner method in CommunityService
    // await CommunityService.removeCoOwner(communityId, session.user.id, userId);

    return NextResponse.json({ error: 'Method not implemented' }, { status: 501 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
