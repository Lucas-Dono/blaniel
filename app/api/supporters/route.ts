/**
 * Public Supporters Endpoint
 *
 * GET /api/supporters - List supporters publicly (for landing page)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/supporters
 * Get public list of supporters (names only)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const supporters = await prisma.user.findMany({
      where: { isSupporter: true },
      select: {
        id: true,
        name: true,
        image: true,
        supporterSince: true,
      },
      orderBy: { supporterSince: 'desc' },
      take: limit,
    });

    // Only return first name or anonymous if no name
    const publicSupporters = supporters.map(supporter => ({
      id: supporter.id,
      name: supporter.name?.split(' ')[0] || 'Supporter',
      image: supporter.image,
      supporterSince: supporter.supporterSince,
    }));

    return NextResponse.json({
      supporters: publicSupporters,
      count: publicSupporters.length,
    });

  } catch (error) {
    console.error('[supporters] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supporters' },
      { status: 500 }
    );
  }
}
