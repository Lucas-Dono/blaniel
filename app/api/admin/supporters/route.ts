/**
 * Admin Supporters Endpoint
 *
 * GET /api/admin/supporters - List all supporters
 * POST /api/admin/supporters - Mark user as supporter
 * DELETE /api/admin/supporters - Remove supporter status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';
import { apiLogger as log } from '@/lib/logging';
import { z } from 'zod';

// Check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, metadata: true },
  });

  if (!user) return false;

  // Check if user has admin role in metadata
  const metadata = user.metadata as any;
  if (metadata?.role === 'admin' || metadata?.isAdmin === true) {
    return true;
  }

  return false;
}

/**
 * GET /api/admin/supporters
 * List all supporters
 */
export async function GET(req: NextRequest) {
  try {
    // 1. AUTHENTICATION
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. AUTHORIZATION
    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      log.warn({ userId: user.id }, 'Non-admin user attempted to access supporters endpoint');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. PARSE QUERY PARAMS
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || undefined;

    // 4. FETCH SUPPORTERS
    const whereClause: any = { isSupporter: true };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [supporters, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          isSupporter: true,
          supporterSince: true,
          supporterAcknowledged: true,
          createdAt: true,
        },
        orderBy: { supporterSince: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      supporters,
      total,
      limit,
      offset,
    });

  } catch (error) {
    log.error({ error }, 'Error fetching supporters');
    return NextResponse.json(
      { error: 'Failed to fetch supporters' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/supporters
 * Mark user as supporter
 */
export async function POST(req: NextRequest) {
  try {
    // 1. AUTHENTICATION
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. AUTHORIZATION
    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      log.warn({ userId: user.id }, 'Non-admin user attempted to add supporter');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. VALIDATE INPUT
    const schema = z.object({
      userId: z.string().optional(),
      email: z.string().email().optional(),
    }).refine(data => data.userId || data.email, {
      message: 'Either userId or email is required',
    });

    const body = await req.json();
    const validation = schema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { userId: targetUserId, email } = validation.data;

    // 4. FIND USER
    const targetUser = await prisma.user.findFirst({
      where: targetUserId ? { id: targetUserId } : { email },
      select: { id: true, name: true, email: true, isSupporter: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (targetUser.isSupporter) {
      return NextResponse.json({
        error: 'Usuario ya es supporter',
        user: { id: targetUser.id, name: targetUser.name },
      }, { status: 409 });
    }

    // 5. UPDATE USER
    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        isSupporter: true,
        supporterSince: new Date(),
        supporterAcknowledged: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isSupporter: true,
        supporterSince: true,
      },
    });

    log.info({
      adminId: user.id,
      targetUserId: targetUser.id,
    }, 'Admin marked user as supporter');

    return NextResponse.json({
      success: true,
      message: `${updatedUser.name || updatedUser.email} ahora es Supporter`,
      user: updatedUser,
    });

  } catch (error) {
    log.error({ error }, 'Error adding supporter');
    return NextResponse.json(
      { error: 'Failed to add supporter' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/supporters
 * Remove supporter status
 */
export async function DELETE(req: NextRequest) {
  try {
    // 1. AUTHENTICATION
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. AUTHORIZATION
    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      log.warn({ userId: user.id }, 'Non-admin user attempted to remove supporter');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. GET USER ID
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // 4. FIND USER
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, isSupporter: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!targetUser.isSupporter) {
      return NextResponse.json({ error: 'Usuario no es supporter' }, { status: 409 });
    }

    // 5. UPDATE USER
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        isSupporter: false,
        supporterSince: null,
        supporterAcknowledged: true,
      },
    });

    log.info({
      adminId: user.id,
      targetUserId,
    }, 'Admin removed supporter status');

    return NextResponse.json({
      success: true,
      message: `Supporter status removed from ${targetUser.name || targetUserId}`,
    });

  } catch (error) {
    log.error({ error }, 'Error removing supporter');
    return NextResponse.json(
      { error: 'Failed to remove supporter' },
      { status: 500 }
    );
  }
}
