/**
 * API: /api/explore/users
 * GET - Buscar usuarios con filtros y paginación
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
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
    const query = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sort = searchParams.get('sort') || 'recent'; // recent, name, popular

    // Construir filtro de búsqueda
    const where: any = {
      id: { not: session.user.id }, // Excluir usuario actual
      ...(query && {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      }),
    };

    // Ordenamiento
    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'name') {
      orderBy = { name: 'asc' };
    }

    // Get usuarios
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          image: true,
          email: true,
          createdAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      prisma.user.count({ where }),
    ]);

    // Get estado de amistad para cada usuario
    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        const friendshipStatus = await FriendshipService.getFriendshipStatus(
          session.user.id,
          user.id
        );

        // Check si sigo a este usuario
        const follow = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: session.user.id,
              followingId: user.id,
            },
          },
        });

        return {
          ...user,
          friendshipStatus: friendshipStatus.status,
          friendshipId: friendshipStatus.friendshipId,
          isFollowing: !!follow,
        };
      })
    );

    return NextResponse.json({
      users: usersWithStatus,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error explorando usuarios:', error);
    return NextResponse.json(
      { error: 'Error al buscar usuarios' },
      { status: 500 }
    );
  }
}
