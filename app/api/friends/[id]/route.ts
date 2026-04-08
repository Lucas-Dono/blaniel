/**
 * API: /api/friends/[id]
 * DELETE - Eliminar amistad o cancelar solicitud
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { FriendshipService } from '@/lib/services/friendship.service';
import { prisma } from '@/lib/prisma';

export async function DELETE(
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

    // Check el estado de la amistad
    const friendship = await prisma.friendship.findUnique({
      where: { id },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: 'Amistad no encontrada' },
        { status: 404 }
      );
    }

    // Si es pendiente y el usuario es el solicitante, cancelar
    if (friendship.status === 'PENDING' && friendship.requesterId === session.user.id) {
      const result = await FriendshipService.cancelFriendRequest(id, session.user.id);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, action: 'cancelled' });
    }

    // Si es aceptada, eliminar amistad
    if (friendship.status === 'ACCEPTED') {
      const result = await FriendshipService.removeFriend(id, session.user.id);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, action: 'removed' });
    }

    return NextResponse.json(
      { error: 'No se puede eliminar esta relación' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error eliminando amistad:', error);
    return NextResponse.json(
      { error: 'Error al eliminar amistad' },
      { status: 500 }
    );
  }
}
