/**
 * Minecraft Mod Version Management Service
 *
 * Handles storage, retrieval and distribution of mod versions
 * from Cloudflare R2/S3, with SHA-256 verification and download tracking.
 */

import { prisma } from '@/lib/prisma';
import { storageService } from '@/lib/storage/cloud-storage';
import crypto from 'crypto';

export interface ModVersionInfo {
  version: string;
  downloadUrl: string;
  changelog: string;
  releaseDate: string;
  required: boolean;
  minimumVersion?: string;
  fileSize: number;
  sha256: string;
  hasUpdate?: boolean;
  currentVersion?: string;
  updateAvailable?: boolean;
}

export class ModVersionService {
  /**
   * Get the latest version of the mod
   */
  static async getLatestVersion(): Promise<ModVersionInfo | null> {
    const latestVersion = await prisma.minecraftModVersion.findFirst({
      where: { isLatest: true },
      orderBy: { releaseDate: 'desc' },
    });

    if (!latestVersion) {
      return null;
    }

    // Build server download URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const downloadUrl = `${baseUrl}/api/v1/minecraft/mod/download/${latestVersion.version}`;

    return {
      version: latestVersion.version,
      downloadUrl,
      changelog: latestVersion.changelog,
      releaseDate: latestVersion.releaseDate.toISOString(),
      required: latestVersion.required,
      minimumVersion: latestVersion.minimumVersion || undefined,
      fileSize: Number(latestVersion.fileSize),
      sha256: latestVersion.sha256,
    };
  }

  /**
   * Check if an update is available
   */
  static async checkForUpdate(currentVersion: string): Promise<ModVersionInfo | null> {
    const latest = await this.getLatestVersion();

    if (!latest) {
      return null;
    }

    const hasUpdate = this.compareVersions(latest.version, currentVersion) > 0;

    return {
      ...latest,
      hasUpdate,
      currentVersion,
      updateAvailable: hasUpdate,
    };
  }

  /**
   * Get mod file by version
   */
  static async getModFile(version: string): Promise<Buffer | null> {
    const modVersion = await prisma.minecraftModVersion.findUnique({
      where: { version },
    });

    if (!modVersion) {
      return null;
    }

    try {
      const buffer = await storageService.getFile(modVersion.storageKey);

      // Increment download counter
      await prisma.minecraftModVersion.update({
        where: { version },
        data: {
          downloadCount: {
            increment: 1,
          },
        },
      });

      return buffer;
    } catch (error) {
      console.error('[ModVersionService] Error getting file:', error);
      return null;
    }
  }

  /**
   * Upload new mod version
   */
  static async uploadNewVersion(params: {
    version: string;
    jarBuffer: Buffer;
    changelog: string;
    required?: boolean;
    minimumVersion?: string;
  }): Promise<ModVersionInfo> {
    const { version, jarBuffer, changelog, required = false, minimumVersion } = params;

    // Validate that version does not exist
    const existing = await prisma.minecraftModVersion.findUnique({
      where: { version },
    });

    if (existing) {
      throw new Error(`Version ${version} already exists`);
    }

    // Calculate SHA-256
    const sha256 = crypto.createHash('sha256').update(jarBuffer).digest('hex');

    // Calculate size
    const fileSize = jarBuffer.length;

    // Storage key
    const storageKey = `minecraft-mod/blaniel-mc-${version}.jar`;

    // Upload to R2/S3
    await storageService.uploadFile(jarBuffer, storageKey, 'application/java-archive');

    // Mark all previous versions as not latest
    await prisma.minecraftModVersion.updateMany({
      where: { isLatest: true },
      data: { isLatest: false },
    });

    // Create new version
    const newVersion = await prisma.minecraftModVersion.create({
      data: {
        version,
        downloadUrl: '', // Se construye dinámicamente
        storageKey,
        changelog,
        releaseDate: new Date(),
        fileSize: BigInt(fileSize),
        sha256,
        required,
        minimumVersion,
        isLatest: true,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const downloadUrl = `${baseUrl}/api/v1/minecraft/mod/download/${version}`;

    return {
      version: newVersion.version,
      downloadUrl,
      changelog: newVersion.changelog,
      releaseDate: newVersion.releaseDate.toISOString(),
      required: newVersion.required,
      minimumVersion: newVersion.minimumVersion || undefined,
      fileSize: Number(newVersion.fileSize),
      sha256: newVersion.sha256,
    };
  }

  /**
   * Delete mod version
   */
  static async deleteVersion(version: string): Promise<void> {
    const modVersion = await prisma.minecraftModVersion.findUnique({
      where: { version },
    });

    if (!modVersion) {
      throw new Error(`Version ${version} does not exist`);
    }

    // Delete from storage
    try {
      await storageService.deleteFile(modVersion.storageKey);
    } catch (error) {
      console.error('[ModVersionService] Error deleting file from storage:', error);
    }

    // Delete from database
    await prisma.minecraftModVersion.delete({
      where: { version },
    });
  }

  /**
   * List all versions
   */
  static async listVersions() {
    return await prisma.minecraftModVersion.findMany({
      orderBy: { releaseDate: 'desc' },
      select: {
        version: true,
        releaseDate: true,
        fileSize: true,
        required: true,
        isLatest: true,
        downloadCount: true,
      },
    });
  }

  /**
   * Mark version as latest
   */
  static async setLatestVersion(version: string): Promise<void> {
    // Unmark all
    await prisma.minecraftModVersion.updateMany({
      where: { isLatest: true },
      data: { isLatest: false },
    });

    // Mark the specified one
    await prisma.minecraftModVersion.update({
      where: { version },
      data: { isLatest: true },
    });
  }

  /**
   * Compare semantic versions (semver)
   * @returns >0 if v1 > v2, <0 if v1 < v2, 0 if equal
   */
  private static compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }

    return 0;
  }

  /**
   * Get download statistics
   */
  static async getDownloadStats() {
    const versions = await prisma.minecraftModVersion.findMany({
      orderBy: { releaseDate: 'desc' },
    });

    const totalDownloads = versions.reduce((sum: number, v: { downloadCount: number }) => sum + v.downloadCount, 0);
    const latest = versions.find((v: { isLatest: boolean }) => v.isLatest);

    return {
      totalVersions: versions.length,
      totalDownloads,
      latestVersion: latest?.version,
      latestDownloads: latest?.downloadCount || 0,
      versions: versions.map((v: { version: string; downloadCount: number; releaseDate: Date; isLatest: boolean }) => ({
        version: v.version,
        downloads: v.downloadCount,
        releaseDate: v.releaseDate,
        isLatest: v.isLatest,
      })),
    };
  }
}
