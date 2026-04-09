/**
 * Database Backup Service
 * 
 * Service to create and manage automatic backups of the PostgreSQL database.
 * Supports:
 * - Daily automatic backups
 * - Upload to Cloudflare R2 (S3 compatible)
 * - 30-day retention
 * - gzip compression
 * - Failure notifications
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream, createWriteStream, unlinkSync, existsSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createLogger } from '@/lib/logging/logger';

const execAsync = promisify(exec);
const log = createLogger('DatabaseBackup');

// S3/R2 Configuration
const s3Client = new S3Client({
  region: 'auto', // Cloudflare R2 usa 'auto'
  endpoint: process.env.R2_ENDPOINT, // https://[account-id].r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'database-backups';
const BACKUP_PREFIX = 'postgres-backups/';
const RETENTION_DAYS = 30;

export interface BackupResult {
  success: boolean;
  filename?: string;
  size?: number;
  durationMs?: number;
  error?: string;
  uploadedToR2?: boolean;
}

export interface BackupStats {
  totalBackups: number;
  totalSize: number;
  oldestBackup?: Date;
  newestBackup?: Date;
}

export class DatabaseBackupService {
  /** Create a full backup of the database */
  static async createBackup(): Promise<BackupResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.sql`;
    const gzipFilename = `${filename}.gz`;
    const localPath = `/tmp/${filename}`;
    const gzipPath = `/tmp/${gzipFilename}`;

    try {
      log.info({ filename }, 'Starting database backup');

      // Validate that DATABASE_URL is configured
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL not configured');
      }

      // Validate R2 configuration
      if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
        throw new Error('R2 credentials not configured');
      }

      // 1. Crear dump con pg_dump
      log.info({ localPath }, 'Creating database dump');
      const dumpCommand = `pg_dump "${process.env.DATABASE_URL}" > ${localPath}`;
      await execAsync(dumpCommand);

      // Verify that the file was created
      if (!existsSync(localPath)) {
        throw new Error('Dump file was not created');
      }

      // 2. Comprimir con gzip
      log.info({ gzipPath }, 'Compressing backup');
      await pipeline(
        createReadStream(localPath),
        createGzip(),
        createWriteStream(gzipPath)
      );

      // Get size of the compressed file
      const { stdout } = await execAsync(`stat -c%s ${gzipPath}`);
      const fileSize = parseInt(stdout.trim());

      // 3. Subir a R2
      log.info({ bucket: BUCKET_NAME, key: `${BACKUP_PREFIX}${gzipFilename}` }, 'Uploading to R2');
      const fileStream = createReadStream(gzipPath);

      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${BACKUP_PREFIX}${gzipFilename}`,
        Body: fileStream,
        ContentType: 'application/gzip',
        Metadata: {
          'backup-timestamp': timestamp,
          'database-name': 'blaniel',
          'backup-type': 'full',
        },
      }));

      // 4. Limpiar archivos locales
      log.info({}, 'Cleaning up local files');
      unlinkSync(localPath);
      unlinkSync(gzipPath);

      // 5. Clean up old backups (>30 days)
      await this.cleanupOldBackups();

      const durationMs = Date.now() - startTime;

      log.info({
        filename: gzipFilename,
        size: fileSize,
        durationMs,
      }, 'Backup completed successfully');

      return {
        success: true,
        filename: gzipFilename,
        size: fileSize,
        durationMs,
        uploadedToR2: true,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      log.error({ error, durationMs }, 'Backup failed');

      // Limpiar archivos locales en caso de error
      try {
        if (existsSync(localPath)) unlinkSync(localPath);
        if (existsSync(gzipPath)) unlinkSync(gzipPath);
      } catch (cleanupError) {
        log.warn({ error: cleanupError }, 'Error cleaning up local files');
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs,
        uploadedToR2: false,
      };
    }
  }

  /** Cleans backups older than RETENTION_DAYS */
  static async cleanupOldBackups(): Promise<number> {
    try {
      log.info({ retentionDays: RETENTION_DAYS }, 'Starting cleanup of old backups');

      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: BACKUP_PREFIX,
      });

      const response = await s3Client.send(listCommand);
      const objects = response.Contents || [];

      const now = Date.now();
      const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const obj of objects) {
        if (!obj.Key || !obj.LastModified) continue;

        const age = now - obj.LastModified.getTime();

        if (age > retentionMs) {
          log.info({
            key: obj.Key,
            age: Math.floor(age / (24 * 60 * 60 * 1000)),
          }, 'Deleting old backup');

          await s3Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: obj.Key,
          }));

          deletedCount++;
        }
      }

      log.info({ deletedCount }, 'Cleanup completed');
      return deletedCount;
    } catch (error) {
      log.error({ error }, 'Error cleaning up old backups');
      throw error;
    }
  }

  /** Gets backup statistics */
  static async getBackupStats(): Promise<BackupStats> {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: BACKUP_PREFIX,
      });

      const response = await s3Client.send(listCommand);
      const objects = response.Contents || [];

      const totalBackups = objects.length;
      const totalSize = objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);

      const dates = objects
        .map(obj => obj.LastModified)
        .filter((date): date is Date => date !== undefined)
        .sort((a, b) => a.getTime() - b.getTime());

      return {
        totalBackups,
        totalSize,
        oldestBackup: dates[0],
        newestBackup: dates[dates.length - 1],
      };
    } catch (error) {
      log.error({ error }, 'Error getting backup stats');
      throw error;
    }
  }

  /**
   * Lista todos los backups disponibles
   */
  static async listBackups(): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: BACKUP_PREFIX,
      });

      const response = await s3Client.send(listCommand);
      const objects = response.Contents || [];

      return objects
        .filter(obj => obj.Key && obj.Size && obj.LastModified)
        .map(obj => ({
          key: obj.Key!,
          size: obj.Size!,
          lastModified: obj.LastModified!,
        }))
        .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    } catch (error) {
      log.error({ error }, 'Error listing backups');
      throw error;
    }
  }

  /**
   * Verifica si un backup existe
   */
  static async backupExists(filename: string): Promise<boolean> {
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${BACKUP_PREFIX}${filename}`,
      }));
      return true;
    } catch {
      return false;
    }
  }

  /** Send backup notification (Email or Slack) */
  static async sendNotification(result: BackupResult): Promise<void> {
    try {
      const message = result.success
        ? `✅ Database backup completed successfully\n` +
          `Filename: ${result.filename}\n` +
          `Size: ${this.formatBytes(result.size || 0)}\n` +
          `Duration: ${result.durationMs}ms`
        : `❌ Database backup failed\n` +
          `Error: ${result.error}\n` +
          `Duration: ${result.durationMs}ms`;

      // Option 1: Slack Webhook
      if (process.env.SLACK_WEBHOOK_URL) {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: message,
            icon_emoji: result.success ? ':white_check_mark:' : ':x:',
          }),
        });
      }

      // Option 2: Email with Resend
      if (process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL) {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'backups@blaniel.com',
          to: process.env.ADMIN_EMAIL,
          subject: result.success ? '✅ Database Backup Success' : '❌ Database Backup Failed',
          text: message,
        });
      }

      log.info({ success: result.success }, 'Notification sent');
    } catch (error) {
      log.error({ error }, 'Error sending notification');
      // No lanzar error para no fallar el backup
    }
  }

  /**
   * Formatea bytes a formato legible
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
