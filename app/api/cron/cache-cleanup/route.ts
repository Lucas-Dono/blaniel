/**
 * Cache Cleanup Cron Job
 *
 * GET /api/cron/cache-cleanup
 * - Limpia entradas antiguas del cache
 * - Se ejecuta automáticamente cada día
 * - Requiere CRON_SECRET para autenticación
 */

import { NextRequest, NextResponse } from 'next/server';
import { semanticCache } from '@/lib/cache/semantic-cache';
import { apiLogger as log } from '@/lib/logging';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Check cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      log.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      log.warn({ authHeader }, 'Unauthorized cron job attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    log.info('Starting cache cleanup cron job...');

    // Ejecutar limpieza
    await semanticCache.cleanup();

    log.info('Cache cleanup completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Cache cleanup completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ error }, 'Cache cleanup cron job failed');
    return NextResponse.json(
      {
        error: 'Cache cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
