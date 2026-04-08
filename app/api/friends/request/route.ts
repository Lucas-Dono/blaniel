/**
 * API: /api/friends/request
 * POST - Enviar solicitud de amistad
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { FriendshipService } from '@/lib/services/friendship.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'Se requiere userId' },
        { status: 400 }
      );
    }

    const result = await FriendshipService.sendFriendRequest(
      session.user.id,
      userId
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      friendship: result.friendship,
    });
  } catch (error) {
    console.error('Error enviando solicitud:', error);
    return NextResponse.json(
      { error: 'Error al enviar solicitud' },
      { status: 500 }
    );
  }
}
