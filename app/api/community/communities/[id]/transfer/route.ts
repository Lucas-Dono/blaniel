import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { CommunityService } from '@/lib/services/community.service';

/**
 * POST /api/community/communities/[id]/transfer - Transferir ownership principal
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

    const { newOwnerId } = await request.json();
    const communityId = (await params).id;

    if (!newOwnerId) {
      return NextResponse.json({ error: 'newOwnerId es requerido' }, { status: 400 });
    }

    const result = await CommunityService.transferOwnership(
      communityId,
      session.user.id,
      newOwnerId
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
