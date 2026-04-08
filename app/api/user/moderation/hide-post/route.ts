import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { UserModerationService } from '@/lib/services/user-moderation.service';

/**
 * POST /api/user/moderation/hide-post - Ocultar un post del feed
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { postId, reason } = await request.json();

    if (!postId) {
      return NextResponse.json({ error: 'postId requerido' }, { status: 400 });
    }

    const result = await UserModerationService.hidePost(
      session.user.id,
      postId,
      reason
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error hiding post:', error);
    return NextResponse.json(
      { error: error.message || 'Error al ocultar post' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/user/moderation/hide-post - Desocultar un post
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json({ error: 'postId requerido' }, { status: 400 });
    }

    const result = await UserModerationService.unhidePost(session.user.id, postId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error unhiding post:', error);
    return NextResponse.json(
      { error: error.message || 'Error al desocultar post' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/user/moderation/hide-post - Obtener lista de posts ocultos
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const hiddenPosts = await UserModerationService.getHiddenPosts(session.user.id);

    return NextResponse.json({ hiddenPosts });
  } catch (error: any) {
    console.error('Error getting hidden posts:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener posts ocultos' },
      { status: 400 }
    );
  }
}
