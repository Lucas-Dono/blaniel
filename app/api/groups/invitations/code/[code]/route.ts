/**
 * API: /api/groups/invitations/code/[code]
 * GET - Obtener invitación por código
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { GroupInvitationService } from '@/lib/services/group-invitation.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { code } = await params;

    const invitation = await GroupInvitationService.getInvitationByCode(code);

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitación no encontrada' },
        { status: 404 }
      );
    }

    // Verify that the invitation is for this user
    if (invitation.inviteeId !== session.user.id) {
      return NextResponse.json(
        { error: 'Esta invitación no es para ti' },
        { status: 403 }
      );
    }

    // Check expiration
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: 'Esta invitación ha expirado', expired: true },
        { status: 410 }
      );
    }

    // Check si ya fue procesada
    if (invitation.status !== 'pending') {
      return NextResponse.json({
        invitation,
        alreadyProcessed: true,
        status: invitation.status,
      });
    }

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        inviteCode: invitation.inviteCode,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        group: (invitation as any).Group,
        inviter: (invitation as any).Inviter,
      },
    });
  } catch (error) {
    console.error('Error obteniendo invitación:', error);
    return NextResponse.json(
      { error: 'Error al obtener invitación' },
      { status: 500 }
    );
  }
}
