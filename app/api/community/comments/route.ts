import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { CommentService } from '@/lib/services/comment.service';

/**
 * GET /api/community/comments?postId=xxx - Listar comentarios de un post
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json({ error: 'postId requerido' }, { status: 400 });
    }

    const comments = await CommentService.getPostComments(postId);
    return NextResponse.json(comments);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * POST /api/community/comments - Crear comentario
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const data = await request.json();

    // RATE LIMITING
    const { checkCommentCreationLimit, checkCommentCooldown } = await import('@/lib/redis/ratelimit');
    const { prisma } = await import('@/lib/prisma');

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });

    const plan = user?.plan || 'free';

    const limitCheck = await checkCommentCreationLimit(session.user.id, plan);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.reason },
        { status: 429 }
      );
    }

    const cooldownCheck = await checkCommentCooldown(session.user.id, plan);
    if (!cooldownCheck.allowed) {
      return NextResponse.json(
        { error: cooldownCheck.reason },
        { status: 429 }
      );
    }

    // AUTOMOD - Check community rules for comments
    if (data.postId) {
      const post = await prisma.communityPost.findUnique({
        where: { id: data.postId },
        select: { communityId: true },
      });

      if (post?.communityId) {
        const { AutoModService } = await import('@/lib/services/automod.service');
        const autoModResult = await AutoModService.checkContent({
          content: data.content || '',
          authorId: session.user.id,
          communityId: post.communityId,
          type: 'comment',
        });

        if (!autoModResult.passed) {
          const mostSevere = autoModResult.triggeredRules[0];
          switch (autoModResult.finalAction) {
            case 'remove':
            case 'ban':
              return NextResponse.json(
                {
                  error: 'Comentario bloqueado por reglas de la comunidad',
                  reason: mostSevere.reason,
                },
                { status: 400 }
              );
            case 'flag':
            case 'auto_report':
              // El comentario se creará como flagged
              data.status = 'flagged';
              break;
          }
        }
      }
    }

    // CONTENT MODERATION - Quick check for comments
    const { moderateComment } = await import('@/lib/moderation/moderation.service');
    const moderationResult = await moderateComment(
      session.user.id,
      data.content || ''
    );

    if (moderationResult.blocked) {
      return NextResponse.json({
        error: 'Contenido no permitido',
        reason: moderationResult.reason,
        suggestion: moderationResult.suggestion,
      }, { status: 400 });
    }

    const comment = await CommentService.createComment(session.user.id, data);

    return NextResponse.json(comment, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
