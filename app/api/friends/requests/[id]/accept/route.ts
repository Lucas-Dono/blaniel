/**
 * API: /api/friends/requests/[id]/accept
 * POST - Aceptar solicitud de amistad
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { FriendshipService } from '@/lib/services/friendship.service';

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

    const result = await FriendshipService.acceptFriendRequest(id, session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      friendship: result.friendship,
    });
  } catch (error) {
    console.error('Error aceptando solicitud:', error);
    return NextResponse.json(
      { error: 'Error al aceptar solicitud' },
      { status: 500 }
    );
  }
}
