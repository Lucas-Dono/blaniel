/**
 * Admin Moderation Endpoint
 *
 * GET /api/admin/moderation - Get recent violations
 * POST /api/admin/moderation - Take action on violations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import {
  getRecentViolations,
  getModerationStats,
  getTopViolators,
  banUserPermanent,
  unbanUserPermanent,
} from '@/lib/moderation/moderation.service';
import { apiLogger as log } from '@/lib/logging';
import { z } from 'zod';

// Check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  // TODO: Implement proper admin check
  // For now, check if user has 'ultra' plan or specific admin role
  const { prisma } = await import('@/lib/prisma');
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

  // Fallback: ultra plan users have some admin capabilities
  return user.plan === 'ultra';
}

/**
 * GET /api/admin/moderation
 * Get recent violations and moderation stats
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
      log.warn({ userId: user.id }, 'Non-admin user attempted to access moderation endpoint');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. PARSE QUERY PARAMS
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'violations'; // violations, stats, violators
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const severity = searchParams.get('severity') as 'low' | 'medium' | 'high' | null;
    const action = searchParams.get('action');
    const contentType = searchParams.get('contentType');
    const hoursBack = parseInt(searchParams.get('hoursBack') || '24');

    // 4. FETCH DATA BASED ON VIEW
    let data: any = {};

    switch (view) {
      case 'violations':
        const violations = await getRecentViolations({
          limit,
          severity: severity || undefined,
          action: action || undefined,
          contentType: contentType || undefined,
        });

        data = {
          violations,
          count: violations.length,
        };
        break;

      case 'stats':
        const stats = await getModerationStats(hoursBack);
        data = stats;
        break;

      case 'violators':
        const violators = await getTopViolators(limit, hoursBack);
        data = {
          violators,
          count: violators.length,
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid view parameter' }, { status: 400 });
    }

    return NextResponse.json({
      view,
      data,
      filters: {
        severity,
        action,
        contentType,
        hoursBack,
      },
    });

  } catch (error) {
    log.error({ error }, 'Error fetching moderation data');
    return NextResponse.json(
      { error: 'Failed to fetch moderation data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/moderation
 * Take action on violations (ban, unban, review)
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
      log.warn({ userId: user.id }, 'Non-admin user attempted moderation action');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. VALIDATE INPUT
    const actionSchema = z.object({
      action: z.enum(['ban', 'unban', 'review_violation']),
      targetUserId: z.string(),
      reason: z.string().optional(),
      duration: z.number().optional(), // Ban duration in hours (null = permanent)
      violationId: z.string().optional(),
    });

    const body = await req.json();
    const validation = actionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { action, targetUserId, reason, duration, violationId: _violationId } = validation.data;

    // 4. EXECUTE ACTION
    let result: any = {};

    switch (action) {
      case 'ban':
        const expiresAt = duration
          ? new Date(Date.now() + duration * 60 * 60 * 1000)
          : null; // null = permanent

        await banUserPermanent(
          targetUserId,
          reason || 'Banned by admin',
          expiresAt || undefined
        );

        result = {
          success: true,
          message: `User ${targetUserId} banned ${expiresAt ? `for ${duration} hours` : 'permanently'}`,
        };

        log.info({
          adminId: user.id,
          targetUserId,
          reason,
          expiresAt,
        }, 'Admin banned user');
        break;

      case 'unban':
        await unbanUserPermanent(targetUserId);

        result = {
          success: true,
          message: `User ${targetUserId} unbanned`,
        };

        log.info({
          adminId: user.id,
          targetUserId,
        }, 'Admin unbanned user');
        break;

      case 'review_violation':
        // TODO: Restore when contentViolation model is added to Prisma schema
        return NextResponse.json(
          { error: 'contentViolation model not found in schema' },
          { status: 501 }
        );
        /*
        if (!violationId) {
          return NextResponse.json(
            { error: 'violationId required for review action' },
            { status: 400 }
          );
        }

        const { prisma } = await import('@/lib/prisma');
        await prisma.contentViolation.update({
          where: { id: violationId },
          data: {
            reviewedBy: user.id,
            reviewedAt: new Date(),
          },
        });

        result = {
          success: true,
          message: `Violation ${violationId} marked as reviewed`,
        };

        log.info({
          adminId: user.id,
          violationId,
        }, 'Admin reviewed violation');
        break;
        */

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error) {
    log.error({ error }, 'Error executing moderation action');
    return NextResponse.json(
      { error: 'Failed to execute moderation action' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/moderation
 * Delete a violation record
 * TODO: Restore when contentViolation model is added to Prisma schema
 */
export async function DELETE(_req: NextRequest) {
  return NextResponse.json(
    { error: 'contentViolation model not found in schema' },
    { status: 501 }
  );
  /*
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const violationId = searchParams.get('violationId');

    if (!violationId) {
      return NextResponse.json({ error: 'violationId required' }, { status: 400 });
    }

    const { prisma } = await import('@/lib/prisma');
    await prisma.contentViolation.delete({
      where: { id: violationId },
    });

    log.info({ adminId: user.id, violationId }, 'Admin deleted violation record');

    return NextResponse.json({
      success: true,
      message: 'Violation deleted',
    });

  } catch (error) {
    log.error({ error }, 'Error deleting violation');
    return NextResponse.json(
      { error: 'Failed to delete violation' },
      { status: 500 }
    );
  }
  */
}
