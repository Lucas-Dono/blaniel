import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { UserModerationService } from '@/lib/services/user-moderation.service';

/**
 * POST /api/user/moderation/block-user - Bloquear un usuario
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { userId: blockedId, reason } = await request.json();

    if (!blockedId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    const result = await UserModerationService.blockUser(
      session.user.id,
      blockedId,
      reason
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error blocking user:', error);
    return NextResponse.json(
      { error: error.message || 'Error al bloquear usuario' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/user/moderation/block-user - Desbloquear un usuario
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const blockedId = searchParams.get('userId');

    if (!blockedId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    const result = await UserModerationService.unblockUser(
      session.user.id,
      blockedId
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error unblocking user:', error);
    return NextResponse.json(
      { error: error.message || 'Error al desbloquear usuario' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/user/moderation/block-user - Obtener lista de usuarios bloqueados
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const blockedUsers = await UserModerationService.getBlockedUsers(
      session.user.id
    );

    return NextResponse.json({ blockedUsers });
  } catch (error: any) {
    console.error('Error getting blocked users:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener usuarios bloqueados' },
      { status: 400 }
    );
  }
}
