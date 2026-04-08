/**
 * API: /api/friends/requests
 * GET - Obtener solicitudes de amistad pendientes
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { FriendshipService } from '@/lib/services/friendship.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'received'; // received | sent
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (type === 'sent') {
      const result = await FriendshipService.getSentRequests(session.user.id, {
        page,
        limit,
      });
      return NextResponse.json(result);
    }

    const result = await FriendshipService.getPendingRequests(session.user.id, {
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error obteniendo solicitudes:', error);
    return NextResponse.json(
      { error: 'Error al obtener solicitudes' },
      { status: 500 }
    );
  }
}
