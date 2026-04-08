import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { PostService } from '@/lib/services/post.service';

/**
 * POST /api/community/posts/[id]/vote - Votar post
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

    // RATE LIMITING for votes
    const { checkVoteLimit } = await import('@/lib/redis/ratelimit');
    const { prisma } = await import('@/lib/prisma');

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });

    const plan = user?.plan || 'free';

    const limitCheck = await checkVoteLimit(session.user.id, plan);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.reason },
        { status: 429 }
      );
    }

    const { voteType } = await request.json();
    if (!['upvote', 'downvote'].includes(voteType)) {
      return NextResponse.json({ error: 'Tipo de voto inválido' }, { status: 400 });
    }

    const result = await PostService.votePost((await params).id, session.user.id, voteType);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
