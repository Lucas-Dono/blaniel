/**
 * API: /api/friends/requests/count
 * GET - Obtener conteo de solicitudes pendientes
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { FriendshipService } from '@/lib/services/friendship.service';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const count = await FriendshipService.getPendingRequestsCount(session.user.id);

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error obteniendo conteo:', error);
    return NextResponse.json(
      { error: 'Error al obtener conteo' },
      { status: 500 }
    );
  }
}
