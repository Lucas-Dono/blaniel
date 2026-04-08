/**
 * GET /api/users/search - Búsqueda de usuarios para mensajería
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const currentUser = await requireAuth(req);

    // Get query de búsqueda
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    // Validate longitud mínima de búsqueda
    if (query.length < 2) {
      return NextResponse.json({
        users: [],
        message: 'Escribe al menos 2 caracteres para buscar',
      });
    }

    // Search usuarios (excluir el usuario actual)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUser.id } }, // Excluir usuario actual
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        isSupporter: true,
      },
      take: 10, // Limitar a 10 resultados
      orderBy: [
        { name: 'asc' }, // Sort alfabéticamente
      ],
    });

    return NextResponse.json({
      users,
      count: users.length,
    });
  } catch (error: any) {
    console.error('Error searching users:', error);

    if (error.message === 'No autorizado') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Error al buscar usuarios. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}
