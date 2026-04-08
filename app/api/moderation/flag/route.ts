/**
 * Flag Content Endpoint
 *
 * POST /api/moderation/flag
 * Permite a usuarios reportar contenido inapropiado
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { flagContent } from '@/lib/moderation/moderation.service';
import { checkReportRate } from '@/lib/moderation/rate-limiter';
import { apiLogger as log } from '@/lib/logging';
import { z } from 'zod';

// Validation schema
const flagSchema = z.object({
  contentType: z.enum(['message', 'post', 'comment', 'agent', 'world']),
  contentId: z.string(),
  reason: z.enum([
    'spam',
    'harassment',
    'hate_speech',
    'misinformation',
    'inappropriate_content',
    'copyright',
    'other',
  ]),
  description: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. AUTHENTICATION
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. RATE LIMIT CHECK
    const rateLimit = await checkReportRate(user.id);
    if (!rateLimit.allowed) {
      log.warn({ userId: user.id, rateLimit }, 'User exceeded report rate limit');
      return NextResponse.json(
        {
          error: 'Demasiados reportes',
          message: rateLimit.reason,
          retryAfter: rateLimit.retryAfter,
        },
        { status: 429 }
      );
    }

    // 3. VALIDATE INPUT
    const body = await req.json();
    const validation = flagSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { contentType, contentId, reason, description } = validation.data;

    // 4. FLAG CONTENT
    const result = await flagContent({
      userId: user.id,
      contentType,
      contentId,
      reason,
      description,
      severity: 'medium', // Default severity for user reports
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to flag content',
          message: result.message,
        },
        { status: 500 }
      );
    }

    log.info({ userId: user.id, flagId: result.flagId, contentType, contentId }, 'Content flagged');

    return NextResponse.json({
      success: true,
      flagId: result.flagId,
      message: result.message,
    });

  } catch (error) {
    log.error({ error }, 'Error flagging content');
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process report',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/moderation/flag
 * Get user's own reports
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const { prisma } = await import('@/lib/prisma');

    const reports = await prisma.moderationAction.findMany({
      where: {
        moderatorId: user.id,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        action: true,
        createdAt: true,
        expiresAt: true,
        details: true,
      },
    });

    return NextResponse.json({
      reports,
      count: reports.length,
    });

  } catch (error) {
    log.error({ error }, 'Error fetching user reports');
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
