import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { PostFollowService } from '@/lib/services/post-follow.service';
import { UserPreferenceService } from '@/lib/services/user-preference.service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/community/posts/[id]/follow - Seguir post
 * DELETE /api/community/posts/[id]/follow - Dejar de seguir post
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get información del post para actualizar preferencias
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        type: true,
        tags: true,
        communityId: true
      }
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post no encontrado' },
        { status: 404 }
      );
    }

    // Seguir el post
    const follow = await PostFollowService.followPost(userId, postId);

    // Update preferencias del usuario
    // "Follow" tiene un peso alto (3) porque indica interés explícito
    await UserPreferenceService.trackAction(userId, 'follow', {
      postType: post.type,
      tags: Array.isArray(post.tags) ? post.tags as string[] : [],
      communityId: post.communityId || undefined
    });

    return NextResponse.json({
      success: true,
      follow,
      message: 'Ahora sigues esta publicación'
    });
  } catch (error: any) {
    console.error('Error following post:', error);
    return NextResponse.json(
      { error: error.message || 'Error al seguir publicación' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Dejar de seguir el post
    const success = await PostFollowService.unfollowPost(userId, postId);

    if (!success) {
      return NextResponse.json(
        { error: 'No estabas siguiendo este post' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Dejaste de seguir esta publicación'
    });
  } catch (error: any) {
    console.error('Error unfollowing post:', error);
    return NextResponse.json(
      { error: error.message || 'Error al dejar de seguir publicación' },
      { status: 400 }
    );
  }
}
