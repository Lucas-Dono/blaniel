/**
 * CRON JOB: Expire Temporary Tier Grants
 *
 * Desactiva grants temporales de eventos especiales que ya expiraron.
 *
 * Configuración en Vercel:
 * - Path: /api/cron/expire-temp-grants
 * - Schedule: "0 * * * *" (cada hora)
 * - Authorization: Bearer {CRON_SECRET}
 *
 * Testing local:
 * curl -H "Authorization: Bearer tu_cron_secret" http://localhost:3000/api/cron/expire-temp-grants
 */

import { NextResponse } from 'next/server';
import { deactivateExpiredGrants } from '@/lib/usage/special-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    // Check authorization
    const authHeader = req.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET) {
      console.error('[Cron] ❌ CRON_SECRET not configured in environment');
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      );
    }

    if (authHeader !== expectedAuth) {
      console.warn('[Cron] ⚠️ Unauthorized cron attempt:', {
        receivedAuth: authHeader?.slice(0, 20) + '...',
        ip: req.headers.get('x-forwarded-for'),
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Ejecutar desactivación de grants expirados
    console.log('[Cron] 🔄 Starting expiration check...');
    const startTime = Date.now();

    const count = await deactivateExpiredGrants();

    const duration = Date.now() - startTime;

    console.log(`[Cron] ✅ Deactivated ${count} expired grants in ${duration}ms`);

    return NextResponse.json({
      success: true,
      deactivated: count,
      timestamp: new Date().toISOString(),
      duration,
    });

  } catch (error) {
    console.error('[Cron] ❌ Error in expire-temp-grants:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
