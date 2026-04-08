import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { PostService } from '@/lib/services/post.service';
import { checkTierRateLimit } from '@/lib/redis/ratelimit';

/**
 * GET /api/community/posts/[id] - Obtener post
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const post = await PostService.getPost((await params).id);
    return NextResponse.json(post);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}

/**
 * PATCH /api/community/posts/[id] - Actualizar post
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

    // Tier-based rate limiting
    const rateLimitResult = await checkTierRateLimit(session.user.id, session.user.plan);
    if (!rateLimitResult.success) {
      const error = rateLimitResult.error!;
      return NextResponse.json(error, {
        status: 429,
        headers: {
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.reset?.toString() || "0",
          "X-RateLimit-Tier": rateLimitResult.tier,
        },
      });
    }

    const data = await request.json();
    const post = await PostService.updatePost((await params).id, session.user.id, data);

    return NextResponse.json(post);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * DELETE /api/community/posts/[id] - Eliminar post
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

    // Tier-based rate limiting
    const rateLimitResult = await checkTierRateLimit(session.user.id, session.user.plan);
    if (!rateLimitResult.success) {
      const error = rateLimitResult.error!;
      return NextResponse.json(error, {
        status: 429,
        headers: {
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.reset?.toString() || "0",
          "X-RateLimit-Tier": rateLimitResult.tier,
        },
      });
    }

    const result = await PostService.deletePost((await params).id, session.user.id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
