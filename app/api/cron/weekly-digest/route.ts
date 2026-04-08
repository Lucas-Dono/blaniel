import { NextRequest, NextResponse } from 'next/server';
import { PostFollowEmailService } from '@/lib/services/post-follow-email.service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/cron/weekly-digest - Enviar digests semanales
 *
 * Esta ruta debe ser llamada por un cron job semanalmente.
 * Ejemplo de configuración de Vercel Cron:
 * {
 *   "crons": [{
 *     "path": "/api/cron/weekly-digest",
 *     "schedule": "0 9 * * 1"
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

    console.log('[CRON] Iniciando envío de digests semanales...');

    // Get día actual de la semana
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = daysOfWeek[new Date().getDay()];

    // Get usuarios con digest semanal configurado para hoy (o sin día específico)
    const usersWithWeeklyDigest = await prisma.emailNotificationConfig.findMany({
      where: {
        frequency: 'weekly',
        digestSummary: true,
        OR: [
          { digestDay: today },
          { digestDay: null }
        ]
      },
      select: {
        userId: true,
        digestTime: true,
        digestDay: true,
        lastDigestSentAt: true
      }
    });

    console.log(`[CRON] Encontrados ${usersWithWeeklyDigest.length} usuarios con digest semanal`);

    const results = {
      total: usersWithWeeklyDigest.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Send digests
    for (const userConfig of usersWithWeeklyDigest) {
      try {
        // Check si ya se envió esta semana
        if (userConfig.lastDigestSentAt) {
          const lastSent = new Date(userConfig.lastDigestSentAt);
          const now = new Date();
          const daysSinceLastSent = Math.floor((now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24));

          if (daysSinceLastSent < 7) {
            results.skipped++;
            continue;
          }
        }

        // Send digest
        const result = await PostFollowEmailService.sendWeeklyDigest(userConfig.userId);

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

    console.log('[CRON] Digests semanales enviados:', results);

    return NextResponse.json({
      success: true,
      message: 'Digests semanales procesados',
      results
    });

  } catch (error: any) {
    console.error('[CRON] Error en cron job de weekly digest:', error);
    return NextResponse.json(
      { error: error.message || 'Error procesando digests semanales' },
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
