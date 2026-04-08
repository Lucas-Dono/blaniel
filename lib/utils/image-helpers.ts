/**
 * Helpers para manejo de imágenes
 * - Conversión entre data URLs y archivos físicos
 * - Conversión entre URLs y base64 para AI Horde
 */

import { writeFile, readFile } from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';

/**
 * Convierte una data URL (base64) a un archivo físico en el servidor
 * O sube a cloud storage si está configurado
 * @param dataUrl - Data URL en formato "data:image/png;base64,..."
 * @param userId - ID del usuario (para generar nombre único)
 * @returns Ruta pública del archivo guardado (ej: "/uploads/avatar-123.png" o URL de CDN)
 */
export async function saveDataUrlAsFile(dataUrl: string, userId: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) {
    throw new Error('Invalid data URL');
  }

  // Extraer el tipo de imagen y los datos base64
  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL format');
  }

  const [, extension, base64Data] = matches;
  const buffer = Buffer.from(base64Data, 'base64');

  // Si está configurado cloud storage, usarlo (para producción)
  const storageProvider = process.env.STORAGE_PROVIDER;
  if (storageProvider === 's3' || storageProvider === 'r2') {
    const { storageService } = await import('@/lib/storage/cloud-storage');
    const filename = `avatar-${Date.now()}.${extension}`;
    return await storageService.uploadImage(buffer, filename, userId);
  }

  // Fallback: Local filesystem (solo para desarrollo)
  console.warn('[saveDataUrlAsFile] Using local storage - not recommended for production');

  // Generate unique name
  const timestamp = Date.now();
  const filename = `${userId}-${timestamp}.${extension}`;

  // Asegurar que existe el directorio de uploads
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }

  // Guardar archivo
  const filepath = path.join(uploadDir, filename);
  await writeFile(filepath, buffer);

  // Return public URL
  return `/uploads/${filename}`;
}

/**
 * Convierte una URL de imagen a base64
 * Útil para enviar imágenes a AI Horde que requiere base64
 * @param imageUrl - URL de la imagen (puede ser ruta relativa o absoluta)
 * @returns Data URL en formato base64
 */
export async function convertUrlToBase64(imageUrl: string): Promise<string> {
  // Si ya es una data URL, retornarla tal cual
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  // Si es una URL relativa, construir ruta al archivo
  let filepath: string;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // Es una URL externa, necesitamos descargarla
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } else {
    // Es una ruta local
    filepath = imageUrl.startsWith('/')
      ? path.join(process.cwd(), 'public', imageUrl)
      : path.join(process.cwd(), 'public', '/', imageUrl);

    // Leer archivo
    const buffer = await readFile(filepath);

    // Detect image type by extension
    const ext = path.extname(filepath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const mimeType = mimeTypes[ext] || 'image/png';

    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }
}

/**
 * Verifica si una cadena es una data URL
 */
export function isDataUrl(str: string): boolean {
  return str.startsWith('data:');
}

/**
 * Obtiene el tamaño de una imagen en bytes
 */
export function getDataUrlSize(dataUrl: string): number {
  if (!isDataUrl(dataUrl)) {
    return 0;
  }

  const base64 = dataUrl.split(',')[1];
  return Buffer.from(base64, 'base64').length;
}
