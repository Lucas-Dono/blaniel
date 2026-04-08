/**
 * Smart Start - Upload Avatar
 * Handles avatar image uploads for character creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getAvatarUploadService } from '@/lib/storage/avatar-upload.service';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get FormData
    const formData = await req.formData();
    const file = (formData as any).get('avatar') as File | null;

    if (!file) {
      return NextResponse.json(
        {
          error: 'No se proporcionó ninguna imagen',
        },
        { status: 400 }
      );
    }

    // 3. Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        {
          error: 'El archivo debe ser una imagen',
        },
        { status: 400 }
      );
    }

    // 4. Convert to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Upload
    const uploadService = getAvatarUploadService();

    console.log('[API] Uploading avatar:', {
      userId: user.id,
      filename: file.name,
      size: file.size,
      type: file.type,
    });

    const result = await uploadService.uploadAvatar(buffer, {
      userId: user.id,
      filename: file.name,
      type: 'character',
    });

    // 6. Return success with URL
    console.log('[API] Upload successful, returning URL:', result.url);

    return NextResponse.json({
      success: true,
      avatarUrl: result.url,
      url: result.url, // También incluir como 'url' para compatibilidad
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('[API] Error uploading avatar:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Error al subir la imagen';

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve validation requirements
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user (optional for GET, but good practice)
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return validation requirements
    const requirements = {
      maxFileSize: 5 * 1024 * 1024, // 5MB
      maxFileSizeMB: 5,
      minDimensions: 256,
      maxDimensions: 4096,
      allowedFormats: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
    };

    return NextResponse.json({
      success: true,
      requirements,
    });
  } catch (error) {
    console.error('[API] Error getting validation requirements:', error);

    return NextResponse.json(
      {
        error: 'Error al obtener requisitos de validación',
      },
      { status: 500 }
    );
  }
}
