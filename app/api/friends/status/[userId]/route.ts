/**
 * API: /api/friends/status/[userId]
 * GET - Obtener estado de amistad con un usuario
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { FriendshipService } from '@/lib/services/friendship.service';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { userId } = await params;

    // Check si el usuario existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Get estado de amistad
    const friendshipStatus = await FriendshipService.getFriendshipStatus(
      session.user.id,
      userId
    );

    // También verificar si hay follow
    const followStatus = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.user.id,
          followingId: userId,
        },
      },
    });

    return NextResponse.json({
      friendship: friendshipStatus,
      isFollowing: !!followStatus,
    });
  } catch (error) {
    console.error('Error obteniendo estado:', error);
    return NextResponse.json(
      { error: 'Error al obtener estado' },
      { status: 500 }
    );
  }
}
