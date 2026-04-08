import { NextRequest, NextResponse } from 'next/server';
import { PostFollowEmailService } from '@/lib/services/post-follow-email.service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/cron/daily-digest - Enviar digests diarios
 *
 * Esta ruta debe ser llamada por un cron job diariamente.
 * Ejemplo de configuración de Vercel Cron:
 * {
 *   "crons": [{
 *     "path": "/api/cron/daily-digest",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 *
 * IMPORTANTE: Proteger esta ruta con un secreto en producción
 */
export async function POST(request: NextRequest) {
  try {
    // Check authorization secret (in production)
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    console.log('[CRON] Iniciando envío de digests diarios...');

    // Get usuarios con digest diario configurado
    const usersWithDailyDigest = await prisma.emailNotificationConfig.findMany({
      where: {
        frequency: 'daily',
        digestSummary: true
      },
      select: {
        userId: true,
        digestTime: true,
        lastDigestSentAt: true
      }
    });

    console.log(`[CRON] Encontrados ${usersWithDailyDigest.length} usuarios con digest diario`);

    const results = {
      total: usersWithDailyDigest.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Send digests
    for (const userConfig of usersWithDailyDigest) {
      try {
        // Check si ya se envió hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (userConfig.lastDigestSentAt) {
          const lastSent = new Date(userConfig.lastDigestSentAt);
          lastSent.setHours(0, 0, 0, 0);

          if (lastSent.getTime() === today.getTime()) {
            results.skipped++;
            continue;
          }
        }

        // Send digest
        const result = await PostFollowEmailService.sendDailyDigest(userConfig.userId);

        if (result.success) {
          results.sent++;
        } else {
          results.skipped++;
        }

      } catch (error: any) {
        console.error(`[CRON] Error enviando digest a usuario ${userConfig.userId}:`, error);
        results.failed++;
        results.errors.push(`User ${userConfig.userId}: ${error.message}`);
      }
    }

    console.log('[CRON] Digests diarios enviados:', results);

    return NextResponse.json({
      success: true,
      message: 'Digests diarios procesados',
      results
    });

  } catch (error: any) {
    console.error('[CRON] Error en cron job de daily digest:', error);
    return NextResponse.json(
      { error: error.message || 'Error procesando digests diarios' },
      { status: 500 }
    );
  }
}

// Permitir GET para testing (solo en desarrollo)
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Método no permitido' },
      { status: 405 }
    );
  }

  return POST(request);
}
