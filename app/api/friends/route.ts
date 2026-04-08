/**
 * API: /api/friends
 * GET - Obtener lista de amigos
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || undefined;

    const result = await FriendshipService.getFriends(session.user.id, {
      page,
      limit,
      search,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error obteniendo amigos:', error);
    return NextResponse.json(
      { error: 'Error al obtener amigos' },
      { status: 500 }
    );
  }
}
