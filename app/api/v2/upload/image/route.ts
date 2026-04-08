/**
 * POST /api/v2/upload/image
 *
 * Upload an image for character avatar/reference
 *
 * NOTE: This is a placeholder implementation using base64.
 * For production, replace with actual cloud storage (Cloudinary, UploadThing, S3, etc)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    // Get file from FormData (using type assertion to work around TypeScript definitions)
    const fileValue = (formData as any).get('file');

    // Type guard to ensure file is a File instance
    if (!fileValue || !(fileValue instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided or invalid file type' },
        { status: 400 }
      );
    }

    const file: File = fileValue;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // TODO: Replace this with actual cloud upload
    // For now, convert to base64 data URL (not recommended for production!)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    // In production, you would:
    // 1. Upload to cloud storage (Cloudinary, S3, UploadThing, etc)
    // 2. Return the public URL
    // Example with Cloudinary:
    // const result = await cloudinary.uploader.upload(dataUrl, {
    //   folder: 'character-avatars',
    //   public_id: `${user.id}_${Date.now()}`,
    // });
    // return { url: result.secure_url };

    return NextResponse.json({
      success: true,
      url: dataUrl, // This is temporary! Replace with actual cloud URL
      filename: file.name,
      size: file.size,
      type: file.type,
      message: 'Image uploaded successfully (using base64, replace with cloud storage in production)',
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
