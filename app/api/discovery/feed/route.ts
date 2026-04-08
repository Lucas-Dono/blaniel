/**
 * API: Feed de Descubrimiento
 * GET /api/discovery/feed - Feed infinito con mix aleatorio de vibes, historias y nuevos
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = 20;

    // Fetch all public agents (we'll filter in JS to avoid Prisma JSON filter issues)
    const allPublicAgents = await prisma.agent.findMany({
      where: {
        visibility: 'public'
      },
      select: {
        id: true,
        name: true,
        description: true,
        avatar: true,
        categories: true,
        generationTier: true,
        aiGeneratedFields: true,
        kind: true,
        createdAt: true,
        userId: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Shuffle function for randomization
    const shuffleArray = <T,>(array: T[]) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // Calculate pagination
    const skip = (page - 1) * pageSize;

    // Shuffle all public agents and paginate
    const shuffled = shuffleArray(allPublicAgents);
    const paginatedAgents = shuffled.slice(skip, skip + pageSize);

    return NextResponse.json({
      agents: paginatedAgents,
      page,
      hasMore: allPublicAgents.length > skip + pageSize
    });
  } catch (error) {
    console.error('Error fetching discovery feed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
