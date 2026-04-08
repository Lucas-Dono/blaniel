/**
 * API: /api/mentions/autocomplete
 * GET - Autocompletado de usuarios para menciones
 * Respeta la configuración de privacidad de cada usuario
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

    if (!query || query.length < 1) {
      return NextResponse.json({ users: [] });
    }

    // Search usuarios que coincidan con la query
    const users = await prisma.user.findMany({
      where: {
        id: { not: session.user.id }, // Excluir usuario actual
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { startsWith: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        image: true,
        mentionPrivacy: true,
      },
      take: limit * 2, // Get más para filtrar después
    });

    // Filter según privacidad de menciones
    const filteredUsers = await Promise.all(
      users.map(async (user) => {
        let canMention = true;

        // Check privacidad
        switch (user.mentionPrivacy) {
          case 'no_one':
            canMention = false;
            break;
          case 'friends':
            canMention = await FriendshipService.areFriends(
              session.user.id,
              user.id
            );
            break;
          case 'anyone':
          default:
            canMention = true;
        }

        return {
          id: user.id,
          name: user.name,
          image: user.image,
          canMention,
        };
      })
    );

    // Sort: primero los que se pueden mencionar
    const sortedUsers = filteredUsers
      .sort((a, b) => {
        if (a.canMention && !b.canMention) return -1;
        if (!a.canMention && b.canMention) return 1;
        return 0;
      })
      .slice(0, limit);

    return NextResponse.json({ users: sortedUsers });
  } catch (error) {
    console.error('Error en autocompletado de menciones:', error);
    return NextResponse.json(
      { error: 'Error al buscar usuarios' },
      { status: 500 }
    );
  }
}
