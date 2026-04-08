/**
 * POST /api/v2/characters/check-name
 *
 * Check if a character name is available
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const { name } = await request.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    if (trimmedName.length < 1) {
      return NextResponse.json(
        { error: 'Name is too short' },
        { status: 400 }
      );
    }

    // Check exact match (case-insensitive) for this user
    const exactMatch = await prisma.agent.findFirst({
      where: {
        userId,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Find similar names for suggestions
    const similarNames = await prisma.agent.findMany({
      where: {
        userId,
        name: {
          contains: trimmedName,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
      },
      take: 5,
    });

    const isAvailable = !exactMatch;

    return NextResponse.json({
      available: isAvailable,
      name: trimmedName,
      exactMatch: exactMatch || undefined,
      similarNames: similarNames.length > 0 ? similarNames : undefined,
    });
  } catch (error) {
    console.error('Name check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
