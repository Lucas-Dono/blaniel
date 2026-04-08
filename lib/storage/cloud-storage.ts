/**
 * Cloud Storage Service - Escalable para miles de usuarios
 *
 * Opciones soportadas:
 * 1. AWS S3 (más popular, $0.023/GB/mes)
 * 2. Cloudflare R2 (gratis egress, $0.015/GB/mes)
 * 3. Google Cloud Storage (similar a S3)
 *
 * IMPORTANTE: Configurar ANTES de producción
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

// Configuración según el proveedor elegido
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local'; // 'local' | 's3' | 'r2' | 'gcs'

// AWS S3 / Cloudflare R2 configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT, // Para Cloudflare R2 o S3-compatible
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || '';
const CDN_URL = process.env.CDN_URL; // ej: https://cdn.tuapp.com

/**
 * Interfaz unificada para almacenamiento
 */
export interface StorageService {
  uploadImage(buffer: Buffer, filename: string, userId: string): Promise<string>;
  deleteImage(url: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  uploadFile(buffer: Buffer, key: string, contentType?: string): Promise<string>;
  getFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
}

/**
 * Implementación S3/R2
 */
class S3StorageService implements StorageService {
  /**
   * Sube imagen optimizada a S3/R2
   */
  async uploadImage(buffer: Buffer, filename: string, userId: string): Promise<string> {
    // 1. Obtener metadata de la imagen original
    const metadata = await sharp(buffer).metadata();
    console.log('[S3StorageService] Imagen recibida:', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    });

    // 2. Optimizar imagen con sharp
    const optimizedBuffer = await sharp(buffer)
      .resize(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 }) // WebP = mejor compresión que PNG/JPG
      .toBuffer();

    const optimizedMetadata = await sharp(optimizedBuffer).metadata();
    console.log('[S3StorageService] Imagen después de optimizar:', {
      width: optimizedMetadata.width,
      height: optimizedMetadata.height,
      format: optimizedMetadata.format,
    });

    // 3. Organizar en carpetas por usuario
    const key = `avatars/${userId}/${Date.now()}-${filename.replace(/\.[^/.]+$/, '.webp')}`;

    // 4. Subir a S3/R2
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: optimizedBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000', // Cache 1 año
      })
    );

    // 5. Return public URL (CDN if configured)
    if (CDN_URL) {
      return `${CDN_URL}/${key}`;
    }

    // Sin CDN: URL directa de S3/R2
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
  }

  async deleteImage(url: string): Promise<void> {
    const key = this.extractKeyFromUrl(url);
    if (!key) return;

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  private extractKeyFromUrl(url: string): string | null {
    // Extraer key de URLs de S3/CDN
    const match = url.match(/avatars\/[^?]+/);
    return match ? match[0] : null;
  }

  /**
   * Sube archivo genérico a S3/R2
   */
  async uploadFile(buffer: Buffer, key: string, contentType?: string): Promise<string> {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
        CacheControl: 'public, max-age=31536000', // Cache 1 año
      })
    );

    // Return public URL
    if (CDN_URL) {
      return `${CDN_URL}/${key}`;
    }

    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
  }

  /**
   * Obtiene archivo desde S3/R2
   */
  async getFile(key: string): Promise<Buffer> {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    // Convertir stream a buffer
    const chunks: Buffer[] = [];
    const stream = response.Body as any;

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  /**
   * Elimina archivo desde S3/R2
   */
  async deleteFile(key: string): Promise<void> {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
  }
}

/**
 * Implementación Local (solo para desarrollo)
 * NO USAR EN PRODUCCIÓN
 */
class LocalStorageService implements StorageService {
  async uploadImage(buffer: Buffer, filename: string, userId: string): Promise<string> {
    const { writeFile, mkdir } = await import('fs/promises');
    const path = await import('path');
    const { existsSync } = await import('fs');

    // Optimizar imagen
    const optimizedBuffer = await sharp(buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    // Organizar por usuario
    const userDir = path.join(process.cwd(), 'public', 'uploads', userId);
    if (!existsSync(userDir)) {
      await mkdir(userDir, { recursive: true });
    }

    const finalFilename = `${Date.now()}-${filename.replace(/\.[^/.]+$/, '.webp')}`;
    const filepath = path.join(userDir, finalFilename);
    await writeFile(filepath, optimizedBuffer);

    return `/uploads/${userId}/${finalFilename}`;
  }

  async deleteImage(url: string): Promise<void> {
    const { unlink } = await import('fs/promises');
    const path = await import('path');

    const filepath = path.join(process.cwd(), 'public', url);
    try {
      await unlink(filepath);
    } catch (error) {
      console.error('[LocalStorage] Error deleting file:', error);
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    // En local no hay signed URLs, retornar la ruta directa
    return key;
  }

  /**
   * Sube archivo genérico al sistema local
   */
  async uploadFile(buffer: Buffer, key: string, contentType?: string): Promise<string> {
    const { writeFile, mkdir } = await import('fs/promises');
    const path = await import('path');
    const { existsSync } = await import('fs');

    const filepath = path.join(process.cwd(), 'public', key);
    const dir = path.dirname(filepath);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(filepath, buffer);
    return `/${key}`;
  }

  /**
   * Obtiene archivo desde el sistema local
   */
  async getFile(key: string): Promise<Buffer> {
    const { readFile } = await import('fs/promises');
    const path = await import('path');

    const filepath = path.join(process.cwd(), 'public', key);
    return await readFile(filepath);
  }

  /**
   * Elimina archivo del sistema local
   */
  async deleteFile(key: string): Promise<void> {
    const { unlink } = await import('fs/promises');
    const path = await import('path');

    const filepath = path.join(process.cwd(), 'public', key);
    try {
      await unlink(filepath);
    } catch (error) {
      console.error('[LocalStorage] Error deleting file:', error);
    }
  }
}

/**
 * Factory: Retorna el servicio según la configuración
 */
function getStorageService(): StorageService {
  if (STORAGE_PROVIDER === 's3' || STORAGE_PROVIDER === 'r2') {
    console.log(`[Storage] Using ${STORAGE_PROVIDER.toUpperCase()} storage`);
    return new S3StorageService();
  }

  console.warn('[Storage] Using LOCAL storage - NOT RECOMMENDED FOR PRODUCTION');
  return new LocalStorageService();
}

// Export singleton
export const storageService = getStorageService();

/**
 * Helper para subir data URL o Buffer
 */
export async function uploadImageFromDataUrl(
  dataUrl: string,
  userId: string,
  filename: string = 'avatar.png'
): Promise<string> {
  // Si ya es una URL de S3/CDN, retornarla tal cual
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    return dataUrl;
  }

  // Si es data URL, extraer buffer
  let buffer: Buffer;
  if (dataUrl.startsWith('data:')) {
    const matches = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!matches) throw new Error('Invalid data URL');
    buffer = Buffer.from(matches[1], 'base64');
  } else {
    throw new Error('Unsupported image format');
  }

  return await storageService.uploadImage(buffer, filename, userId);
}
