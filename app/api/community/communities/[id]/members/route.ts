import { NextRequest, NextResponse } from 'next/server';
import { CommunityService } from '@/lib/services/community.service';

/**
 * GET /api/community/communities/[id]/members - Listar miembros
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const members = await CommunityService.getMembers((await params).id);
    return NextResponse.json(members);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}
