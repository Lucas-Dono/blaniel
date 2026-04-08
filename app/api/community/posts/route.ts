import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { PostService } from '@/lib/services/post.service';

/**
 * GET /api/community/posts - Listar posts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const communityId = searchParams.get('communityId') || undefined;
    const type = searchParams.get('type') || undefined;
    const tags = searchParams.get('tags')?.split(',') || undefined;
    const authorId = searchParams.get('authorId') || undefined;
    const search = searchParams.get('search') || undefined;
    const sort = searchParams.get('sort') || 'hot';
    const timeRange = searchParams.get('timeRange') as any || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');

    const result = await PostService.searchPosts(
      { communityId, type, tags, authorId, search, timeRange, sortBy: sort as any },
      page,
      limit
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * POST /api/community/posts - Crear post
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const data = await request.json();

    // RATE LIMITING - Check post creation limits
    const { checkPostCreationLimit, checkPostCooldown } = await import('@/lib/redis/ratelimit');
    const { user } = session;
    const plan = user?.plan || 'free';

    // Check daily limit
    const limitCheck = await checkPostCreationLimit(session.user.id, plan);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: limitCheck.reason,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining,
          resetAt: limitCheck.resetAt,
        },
        { status: 429 }
      );
    }

    // Check cooldown
    const cooldownCheck = await checkPostCooldown(session.user.id, plan);
    if (!cooldownCheck.allowed) {
      return NextResponse.json(
        {
          error: cooldownCheck.reason,
          retryAfter: cooldownCheck.retryAfter,
        },
        { status: 429 }
      );
    }

    // CONTENT MODERATION - Check post before creation
    const { moderatePost } = await import('@/lib/moderation/moderation.service');
    const moderationResult = await moderatePost(
      session.user.id,
      data.content || '',
      data.title || ''
    );

    if (moderationResult.blocked) {
      return NextResponse.json({
        error: 'Contenido no permitido',
        reason: moderationResult.reason,
        suggestion: moderationResult.suggestion,
        severity: moderationResult.severity,
      }, { status: 400 });
    }

    // AUTOMOD - Check community-specific rules
    if (data.communityId) {
      const { AutoModService } = await import('@/lib/services/automod.service');
      const autoModResult = await AutoModService.checkContent({
        content: data.content || '',
        title: data.title || '',
        authorId: session.user.id,
        communityId: data.communityId,
        type: 'post',
      });

      if (!autoModResult.passed) {
        const mostSevere = autoModResult.triggeredRules[0];

        switch (autoModResult.finalAction) {
          case 'remove':
          case 'ban':
            return NextResponse.json({
              error: 'Contenido bloqueado por reglas de la comunidad',
              reason: mostSevere.reason,
              rule: mostSevere.ruleName,
            }, { status: 400 });

          case 'flag':
          case 'auto_report':
            // Permitir crear pero marcar para revisión
            data.status = 'flagged';
            break;
        }
      }
    }

    const post = await PostService.createPost(session.user.id, data);

    // AUTO-FOLLOW: El autor automáticamente sigue su propio post
    try {
      const { PostFollowService } = await import('@/lib/services/post-follow.service');
      await PostFollowService.followPost(session.user.id, post.id);
    } catch (error) {
      console.error('Error auto-following post:', error);
      // No fallar la creación del post si el auto-follow falla
    }

    return NextResponse.json(post, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
