/**
 * API: /api/groups/invitations/[id]/decline
 * POST - Rechazar invitación a grupo
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { GroupInvitationService } from '@/lib/services/group-invitation.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const result = await GroupInvitationService.declineInvitation(id, session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error rechazando invitación:', error);
    return NextResponse.json(
      { error: 'Error al rechazar invitación' },
      { status: 500 }
    );
  }
}
