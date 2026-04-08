/**
 * Smart Start - Generate Random Character
 * "Surprise me" button - generates random original character
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getSmartStartOrchestrator } from '@/lib/smart-start/core/orchestrator';
import { z } from 'zod';

const GenerateRandomSchema = z.object({
  sessionId: z.string(),
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
    const validation = GenerateRandomSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { sessionId } = validation.data;

    // 3. Get user tier
    const userTier = (user.plan?.toUpperCase() || 'FREE') as 'FREE' | 'PLUS' | 'ULTRA';

    // 4. Generate random character
    const orchestrator = getSmartStartOrchestrator();

    console.log('[API] Generating random character:', {
      userId: user.id,
      sessionId,
      tier: userTier,
    });

    const draft = await orchestrator.generateRandomCharacter(sessionId, userTier);

    // 5. Return generated character
    return NextResponse.json({
      success: true,
      draft,
      message: '¡Personaje aleatorio generado!',
    });
  } catch (error) {
    console.error('[API] Error generating random character:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Error al generar personaje aleatorio';

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
