import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { ResearchService } from '@/lib/services/research.service';

/**
 * POST /api/community/research/[id]/join - Solicitar unirse como colaborador
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

    const { message } = await request.json();
    const contributor = await ResearchService.requestToJoin(
      (await params).id,
      session.user.id,
      message
    );

    return NextResponse.json(contributor, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
