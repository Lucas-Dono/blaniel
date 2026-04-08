/**
 * Cron Job: Análisis ML de Moderación Nocturno
 *
 * DISABLED: This feature uses Prisma models and relations that don't exist in the schema yet.
 * Missing relations: User.hiddenPosts, User.blockedUsers
 * Missing model: MLSuggestion
 *
 * TODO: Implement these models and relations in Prisma schema before enabling this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('MLModerationCron');

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutos

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      log.warn('Intento de acceso no autorizado al cron ML');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Feature is disabled
    return NextResponse.json(
      {
        success: false,
        error: 'ML moderation analysis feature is not yet implemented. Required Prisma models and relations are missing.',
        message: 'This endpoint requires MLSuggestion model and User relations (hiddenPosts, blockedUsers) to be added to the Prisma schema.',
        timestamp: new Date().toISOString(),
      },
      { status: 501 } // 501 Not Implemented
    );
  } catch (error: any) {
    log.error({ error }, 'Error en cron de análisis ML');
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
