/**
 * Cron Job: Database Backup
 *
 * Endpoint para crear backups automáticos de la base de datos.
 * Debe ejecutarse diariamente a las 3 AM (horario servidor).
 *
 * SEGURIDAD:
 * - Requiere token de autorización CRON_SECRET
 * - Solo accesible desde servidor
 *
 * SETUP EN VERCEL:
 * 1. Agregar variables de entorno:
 *    - CRON_SECRET=<token-seguro>
 *    - R2_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
 *    - R2_ACCESS_KEY_ID=<access-key>
 *    - R2_SECRET_ACCESS_KEY=<secret-key>
 *    - R2_BUCKET_NAME=database-backups
 * 2. Configurar cron job en vercel.json
 * 3. URL: https://tu-dominio.com/api/cron/backup-database
 * 4. Headers: Authorization: Bearer <CRON_SECRET>
 *
 * ALTERNATIVAS:
 * - Vercel Cron Jobs (recomendado) - incluido en vercel.json
 * - GitHub Actions scheduled workflow
 * - Servicio externo como cron-job.org
 *
 * CARACTERÍSTICAS:
 * - Backup completo con pg_dump
 * - Compresión gzip
 * - Upload a Cloudflare R2
 * - Retención automática de 30 días
 * - Notificaciones de éxito/fallo
 */

import { NextRequest, NextResponse } from 'next/server';
import { DatabaseBackupService } from '@/lib/services/database-backup.service';
import { createLogger } from '@/lib/logging/logger';

const log = createLogger('CronBackup');

// Aumentar timeout para cron job (backups pueden tardar)
export const maxDuration = 300; // 5 minutos

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // SECURITY: Verificar token de autorización
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;

    if (!expectedToken) {
      log.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron job not configured' },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      log.warn('Unauthorized backup attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    log.info('Starting database backup cron job');

    // Ejecutar backup
    const result = await DatabaseBackupService.createBackup();

    // Send notificación (no bloquea la respuesta)
    DatabaseBackupService.sendNotification(result).catch(error => {
      log.error({ error }, 'Error sending notification');
    });

    const totalDuration = Date.now() - startTime;

    if (result.success) {
      log.info(
        {
          filename: result.filename,
          size: result.size,
          durationMs: totalDuration,
        },
        'Backup cron job completed successfully'
      );

      return NextResponse.json({
        success: true,
        filename: result.filename,
        size: result.size,
        uploadedToR2: result.uploadedToR2,
        durationMs: totalDuration,
        timestamp: new Date().toISOString(),
      });
    } else {
      log.error(
        {
          error: result.error,
          durationMs: totalDuration,
        },
        'Backup cron job failed'
      );

      return NextResponse.json(
        {
          success: false,
          error: result.error,
          durationMs: totalDuration,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;

    log.error(
      {
        error,
        durationMs: duration,
      },
      'Backup cron job crashed'
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// GET endpoint para verificar estado de backups (solo en desarrollo)
export async function GET(req: NextRequest) {
  try {
    // Check authentication incluso en desarrollo
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const [stats, backups] = await Promise.all([
      DatabaseBackupService.getBackupStats(),
      DatabaseBackupService.listBackups(),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        totalBackups: stats.totalBackups,
        totalSize: stats.totalSize,
        oldestBackup: stats.oldestBackup?.toISOString(),
        newestBackup: stats.newestBackup?.toISOString(),
      },
      recentBackups: backups.slice(0, 10).map(backup => ({
        filename: backup.key.replace('postgres-backups/', ''),
        size: backup.size,
        createdAt: backup.lastModified.toISOString(),
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ error }, 'Error getting backup stats');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
