/**
 * Admin Backups API
 * 
 * Endpoints to manage backups from the admin dashboard.
 * 
 * SECURITY:
 * - Requires admin authentication
 * - Only accessible to users with role "ADMIN"
 * 
 * ENDPOINTS:
 * - GET: Lists all available backups
 * - POST: Creates a new backup manually
 */

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/middleware';
import { DatabaseBackupService } from '@/lib/services/database-backup.service';
import { createLogger } from '@/lib/logging/logger';

const log = createLogger('AdminBackups');

/**
 * GET /api/admin/backups
 * Lista todos los backups disponibles
 */
export const GET = withAdminAuth(async (req, { admin }) => {
  try {
    log.info({ userId: admin.userId, email: admin.email }, 'Admin listing backups');

    const [stats, backups] = await Promise.all([
      DatabaseBackupService.getBackupStats(),
      DatabaseBackupService.listBackups(),
    ]);

    // Format data for UI
    const formattedBackups = backups.map(backup => ({
      id: backup.key,
      filename: backup.key.replace('postgres-backups/', ''),
      size: backup.size,
      sizeFormatted: formatBytes(backup.size),
      createdAt: backup.lastModified.toISOString(),
      age: getAge(backup.lastModified),
    }));

    return NextResponse.json({
      success: true,
      stats: {
        total: stats.totalBackups,
        totalSize: stats.totalSize,
        totalSizeFormatted: formatBytes(stats.totalSize),
        oldestBackup: stats.oldestBackup?.toISOString(),
        newestBackup: stats.newestBackup?.toISOString(),
      },
      backups: formattedBackups,
    });
  } catch (error) {
    log.error({ error }, 'Error listing backups');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/backups
 * Crea un nuevo backup manualmente
 */
export const POST = withAdminAuth(async (req, { admin }) => {
  try {
    log.info({ userId: admin.userId, email: admin.email }, 'Admin creating manual backup');

    const result = await DatabaseBackupService.createBackup();

    if (result.success) {
      // Send notification (non-blocking)
      DatabaseBackupService.sendNotification(result).catch(error => {
        log.error({ error }, 'Error sending notification');
      });

      return NextResponse.json({
        success: true,
        filename: result.filename,
        size: result.size,
        sizeFormatted: formatBytes(result.size || 0),
        durationMs: result.durationMs,
        uploadedToR2: result.uploadedToR2,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    log.error({ error }, 'Error creating backup');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getAge(date: Date): string {
  const now = Date.now();
  const age = now - date.getTime();
  const days = Math.floor(age / (24 * 60 * 60 * 1000));
  const hours = Math.floor((age % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    return 'Less than 1 hour ago';
  }
}
