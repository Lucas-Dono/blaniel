import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { SavedPostService } from '@/lib/services/saved-post.service';

/**
 * POST /api/community/posts/[id]/save - Guardar post
 * DELETE /api/community/posts/[id]/save - Remover post guardado
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { collectionName } = body;

    const savedPost = await SavedPostService.savePost(
      session.user.id,
      id,
      collectionName
    );

    return NextResponse.json({ savedPost });
  } catch (error: any) {
    console.error('Error saving post:', error);
    return NextResponse.json(
      { error: error.message || 'Error al guardar post' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    await SavedPostService.unsavePost(session.user.id, id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error unsaving post:', error);
    return NextResponse.json(
      { error: error.message || 'Error al remover post guardado' },
      { status: 400 }
    );
  }
}
