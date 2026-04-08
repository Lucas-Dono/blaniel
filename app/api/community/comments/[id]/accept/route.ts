import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { CommentService } from '@/lib/services/comment.service';

/**
 * POST /api/community/comments/[id]/accept - Marcar como respuesta aceptada
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

    const comment = await CommentService.markAsAccepted((await params).id, session.user.id);
    return NextResponse.json(comment);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
