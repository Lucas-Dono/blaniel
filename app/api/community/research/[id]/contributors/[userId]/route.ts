import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { ResearchService } from '@/lib/services/research.service';

/**
 * PATCH /api/community/research/[id]/contributors/[userId] - Aceptar colaborador
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, userId } = await params;
    const { role } = await request.json();
    const contributor = await ResearchService.acceptContributor(
      id,
      userId,
      session.user.id,
      role
    );

    return NextResponse.json(contributor);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * DELETE /api/community/research/[id]/contributors/[userId] - Remover colaborador
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, userId } = await params;
    const result = await ResearchService.removeContributor(
      id,
      userId,
      session.user.id
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
