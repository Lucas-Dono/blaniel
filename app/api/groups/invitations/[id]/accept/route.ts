/**
 * API: /api/groups/invitations/[id]/accept
 * POST - Aceptar invitación a grupo
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

    const result = await GroupInvitationService.acceptInvitation(id, session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      invitation: result.invitation,
    });
  } catch (error) {
    console.error('Error aceptando invitación:', error);
    return NextResponse.json(
      { error: 'Error al aceptar invitación' },
      { status: 500 }
    );
  }
}
