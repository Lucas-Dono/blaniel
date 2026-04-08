import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { ReportService } from '@/lib/services/report.service';

/**
 * POST /api/community/posts/[id]/report - Reportar un post
 * Requiere autenticación
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

    const body = await request.json();
    const { reason, description } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'Razón requerida' },
        { status: 400 }
      );
    }

    // Validate razones permitidas
    const validReasons = [
      'spam',
      'harassment',
      'inappropriate',
      'misinformation',
      'violence',
      'hate_speech',
      'self_harm',
      'nsfw',
      'other',
    ];

    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: 'Razón inválida' },
        { status: 400 }
      );
    }

    const report = await ReportService.reportPost({
      postId: id,
      reporterId: session.user.id,
      reason,
      description,
    });

    return NextResponse.json({ report });
  } catch (error: any) {
    console.error('Error reporting post:', error);
    return NextResponse.json(
      { error: error.message || 'Error al reportar post' },
      { status: 400 }
    );
  }
}
