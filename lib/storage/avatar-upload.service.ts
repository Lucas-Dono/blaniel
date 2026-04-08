/**
 * Avatar Upload Service
 *
 * Handles avatar image uploads for Smart Start character creation
 * - Validates image format, size, dimensions
 * - Uploads to S3/R2 storage
 * - Returns public URL
 */

import { storageService } from './cloud-storage';
import sharp from 'sharp';

export interface AvatarUploadOptions {
  /** User ID (for organizing files) */
  userId: string;

  /** Original filename */
  filename?: string;

  /** Whether this is for a character or user profile */
  type?: 'character' | 'user';
}

export interface AvatarUploadResult {
  /** Public URL of the uploaded avatar */
  url: string;

  /** Upload metadata */
  metadata: {
    originalSize: number;
    finalSize: number;
    width: number;
    height: number;
    format: string;
  };
}

export class AvatarUploadService {
  // Validation constants
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly MIN_DIMENSIONS = 256; // 256x256 minimum
  private static readonly MAX_DIMENSIONS = 4096; // 4096x4096 maximum
  private static readonly ALLOWED_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

  /**
   * Upload avatar from buffer
   */
  async uploadAvatar(
    buffer: Buffer,
    options: AvatarUploadOptions
  ): Promise<AvatarUploadResult> {
    const { userId, filename = 'avatar.png', type = 'character' } = options;

    console.log('[AvatarUpload] Starting upload:', {
      userId,
      filename,
      type,
      size: buffer.length,
    });

    // 1. Validate file size
    if (buffer.length > AvatarUploadService.MAX_FILE_SIZE) {
      throw new Error(
        `Imagen demasiado grande. Tamaño máximo: 5MB. Tamaño actual: ${(
          buffer.length /
          1024 /
          1024
        ).toFixed(2)}MB`
      );
    }

    // 2. Validate and get image metadata
    const metadata = await this.validateAndGetMetadata(buffer);

    // 3. Upload to storage with appropriate path
    const key = this.generateStorageKey(userId, filename, type);
    const url = await storageService.uploadFile(buffer, key, `image/${metadata.format}`);

    console.log('[AvatarUpload] ✅ Upload successful:', url);

    return {
      url,
      metadata: {
        originalSize: buffer.length,
        finalSize: metadata.size,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
      },
    };
  }

  /**
   * Upload avatar from data URL (base64)
   */
  async uploadAvatarFromDataUrl(
    dataUrl: string,
    options: AvatarUploadOptions
  ): Promise<AvatarUploadResult> {
    // Extract buffer from data URL
    const buffer = this.dataUrlToBuffer(dataUrl);

    // Upload using buffer method
    return this.uploadAvatar(buffer, options);
  }

  /**
   * Upload avatar from File object (browser)
   */
  async uploadAvatarFromFile(
    file: File,
    options: AvatarUploadOptions
  ): Promise<AvatarUploadResult> {
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload using buffer method
    return this.uploadAvatar(buffer, {
      ...options,
      filename: file.name,
    });
  }

  /**
   * Validate image and extract metadata
   */
  private async validateAndGetMetadata(buffer: Buffer): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
  }> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      // Validate format
      if (
        !metadata.format ||
        !AvatarUploadService.ALLOWED_FORMATS.includes(metadata.format)
      ) {
        throw new Error(
          `Formato no soportado. Formatos permitidos: ${AvatarUploadService.ALLOWED_FORMATS.join(
            ', '
          )}`
        );
      }

      // Validate dimensions
      const width = metadata.width || 0;
      const height = metadata.height || 0;

      if (width < AvatarUploadService.MIN_DIMENSIONS || height < AvatarUploadService.MIN_DIMENSIONS) {
        throw new Error(
          `Imagen demasiado pequeña. Tamaño mínimo: ${AvatarUploadService.MIN_DIMENSIONS}x${AvatarUploadService.MIN_DIMENSIONS}px`
        );
      }

      if (width > AvatarUploadService.MAX_DIMENSIONS || height > AvatarUploadService.MAX_DIMENSIONS) {
        throw new Error(
          `Imagen demasiado grande. Tamaño máximo: ${AvatarUploadService.MAX_DIMENSIONS}x${AvatarUploadService.MAX_DIMENSIONS}px`
        );
      }

      // Get file size
      const _stats = await image.stats();
      const size = buffer.length;

      return {
        width,
        height,
        format: metadata.format,
        size,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error al procesar la imagen. Asegúrate de que sea una imagen válida.');
    }
  }

  /**
   * Convert data URL to Buffer
   */
  private dataUrlToBuffer(dataUrl: string): Buffer {
    // If it's already a regular URL, throw error (should use URL directly)
    if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
      throw new Error('Ya es una URL pública. No es necesario subirla nuevamente.');
    }

    // Extract base64 data
    const matches = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!matches) {
      throw new Error('Formato de data URL inválido');
    }

    return Buffer.from(matches[1], 'base64');
  }

  /**
   * Generate storage key (path) for the avatar
   */
  private generateStorageKey(userId: string, filename: string, type: 'character' | 'user'): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const extension = sanitizedFilename.split('.').pop() || 'png';
    const nameWithoutExt = sanitizedFilename.replace(/\.[^/.]+$/, '');

    if (type === 'character') {
      return `user-avatars/${userId}/characters/${timestamp}-${nameWithoutExt}.${extension}`;
    } else {
      return `user-avatars/${userId}/profile/${timestamp}-${nameWithoutExt}.${extension}`;
    }
  }

  /**
   * Get validation requirements (for UI display)
   */
  static getValidationRequirements() {
    return {
      maxFileSize: AvatarUploadService.MAX_FILE_SIZE,
      maxFileSizeMB: AvatarUploadService.MAX_FILE_SIZE / 1024 / 1024,
      minDimensions: AvatarUploadService.MIN_DIMENSIONS,
      maxDimensions: AvatarUploadService.MAX_DIMENSIONS,
      allowedFormats: AvatarUploadService.ALLOWED_FORMATS,
    };
  }
}

// Singleton instance
let avatarUploadService: AvatarUploadService | null = null;

export function getAvatarUploadService(): AvatarUploadService {
  if (!avatarUploadService) {
    avatarUploadService = new AvatarUploadService();
  }
  return avatarUploadService;
}

export const avatarUploader = getAvatarUploadService();
