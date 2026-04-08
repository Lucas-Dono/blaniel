/**
 * Smart Start - Generate Character from Description
 * NEW LEGAL FLOW: Generates 100% original characters from user descriptions
 * Replaces old "search existing character" flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getSmartStartOrchestrator } from '@/lib/smart-start/core/orchestrator';
import { z } from 'zod';
import type { GenreId, ArchetypeId } from '@/lib/smart-start/core/types';

const GenerateFromDescriptionSchema = z.object({
  sessionId: z.string(),
  description: z.string().min(10).max(2000),
  uploadedAvatarUrl: z.string().url().optional(), // User-uploaded avatar
  options: z
    .object({
      genreHint: z.string().optional(),
      archetypeHint: z.string().optional(),
      era: z.string().optional(),
      nsfwLevel: z.enum(['sfw', 'romantic', 'suggestive', 'explicit']).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate request
    const body = await req.json();
    const validation = GenerateFromDescriptionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { sessionId, description, uploadedAvatarUrl, options } = validation.data;

    // 3. Get user tier
    const userTier = (user.plan?.toUpperCase() || 'FREE') as 'FREE' | 'PLUS' | 'ULTRA';

    // 4. Generate character from description
    const orchestrator = getSmartStartOrchestrator();

    console.log('[API] Generating character from description:', {
      userId: user.id,
      sessionId,
      descriptionLength: description.length,
      tier: userTier,
      hasUploadedAvatar: !!uploadedAvatarUrl,
    });

    const draft = await orchestrator.generateFromDescription(
      sessionId,
      description,
      userTier,
      {
        genreHint: options?.genreHint as GenreId | undefined,
        archetypeHint: options?.archetypeHint as ArchetypeId | undefined,
        era: options?.era,
        nsfwLevel: options?.nsfwLevel,
        uploadedAvatarUrl, // Pass uploaded avatar URL
      }
    );

    // 5. Return generated character
    return NextResponse.json({
      success: true,
      draft,
      message: 'Personaje generado exitosamente',
    });
  } catch (error) {
    console.error('[API] Error generating from description:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Error al generar personaje';

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
