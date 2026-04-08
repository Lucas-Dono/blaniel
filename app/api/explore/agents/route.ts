/**
 * API: /api/explore/agents
 * GET - Buscar agentes/IAs públicos con filtros y paginación
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

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
    const tag = searchParams.get('tag') || ''; // Tag para filtrar
    const gender = searchParams.get('gender') || ''; // male, female, non-binary
    const tier = searchParams.get('tier') || ''; // free, ultra
    const sort = searchParams.get('sort') || 'popular'; // popular, recent, name

    // Construir filtro de búsqueda
    // DEBE incluir: agentes públicos + agentes privados del usuario
    const searchConditions: any[] = [
      // Condición 1: Agentes públicos de cualquier usuario
      {
        visibility: { in: ['public', 'world'] },
      },
      // Condición 2: Agentes privados del usuario autenticado
      {
        userId: session.user.id,
        visibility: 'private',
      },
    ];

    const where: any = {
      OR: searchConditions,
      ...(query && {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      }),
      ...(tag && { tags: { array_contains: tag } }),
      ...(gender && { gender }),
      ...(tier && { generationTier: tier }),
    };

    // Ordenamiento
    let orderBy: any = { cloneCount: 'desc' };
    if (sort === 'recent') {
      orderBy = { createdAt: 'desc' };
    } else if (sort === 'name') {
      orderBy = { name: 'asc' };
    } else if (sort === 'rating') {
      orderBy = { rating: 'desc' };
    }

    // Get agentes
    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        select: {
          id: true,
          name: true,
          avatar: true,
          description: true,
          tags: true,
          gender: true,
          generationTier: true,
          kind: true,
          rating: true,
          cloneCount: true,
          featured: true,
          createdAt: true,
          User: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      prisma.agent.count({ where }),
    ]);

    return NextResponse.json({
      agents,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error explorando agentes:', error);
    return NextResponse.json(
      { error: 'Error al buscar agentes' },
      { status: 500 }
    );
  }
}
