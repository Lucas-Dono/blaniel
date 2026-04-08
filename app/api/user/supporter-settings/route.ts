/**
 * User Supporter Settings Endpoint
 *
 * GET /api/user/supporter-settings - Get supporter settings
 * PUT /api/user/supporter-settings - Update supporter settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

/**
 * GET /api/user/supporter-settings
 * Get current supporter settings
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        isSupporter: true,
        supporterSince: true,
        supporterAcknowledged: true,
      },
    });

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      isSupporter: userData.isSupporter,
      supporterSince: userData.supporterSince,
      supporterAcknowledged: userData.supporterAcknowledged,
    });

  } catch (error) {
    console.error('[supporter-settings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get supporter settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/supporter-settings
 * Update supporter settings (toggle AI acknowledgment)
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate input
    const schema = z.object({
      supporterAcknowledged: z.boolean(),
    });

    const body = await req.json();
    const validation = schema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { supporterAcknowledged } = validation.data;

    // Check if user is actually a supporter
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSupporter: true },
    });

    if (!userData?.isSupporter) {
      return NextResponse.json(
        { error: 'Only supporters can change this setting' },
        { status: 403 }
      );
    }

    // Update setting
    await prisma.user.update({
      where: { id: user.id },
      data: { supporterAcknowledged },
    });

    return NextResponse.json({
      success: true,
      supporterAcknowledged,
    });

  } catch (error) {
    console.error('[supporter-settings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update supporter settings' },
      { status: 500 }
    );
  }
}
