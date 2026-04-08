/**
 * POST /api/upload/image - Upload de imágenes para avatares, perfiles, etc.
 * Usa cloud-storage service (R2 en producción, local en desarrollo)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { storageService } from '@/lib/storage/cloud-storage';

// Tipos de imágenes permitidos
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

// Tamaño máximo: 5MB
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const formData = await req.formData();
    const file = (formData as any).get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Tipo de archivo no soportado. Usa: ${ALLOWED_TYPES.map(t =>
            t.split('/')[1].toUpperCase()
          ).join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `El archivo es demasiado grande. Máximo: ${MAX_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = file.name || 'upload.png';
    const url = await storageService.uploadImage(buffer, filename, user.id);

    return NextResponse.json({
      success: true,
      url,
      filename,
      size: file.size,
      type: file.type,
    });
  } catch (error: any) {
    console.error('Error uploading image:', error);

    if (error.message === 'No autorizado') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Error al subir la imagen. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}
