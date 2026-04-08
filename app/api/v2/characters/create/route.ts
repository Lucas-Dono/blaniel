/**
 * POST /api/v2/characters/create
 *
 * Endpoint principal para crear personajes con el sistema V2
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { createCharacter, validateBeforeCreation } from '@/lib/services/character-creation-orchestrator.service';
import type { CharacterDraft } from '@/lib/services/validation.service';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const user = await getAuthenticatedUser(request);

    if (!user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // 2. Parse body
    const body = await request.json();

    // Support both formats:
    // - Old format: body is the draft directly
    // - New format: { draft: ..., cloneFromId: ... }
    const draft: CharacterDraft = body.draft || body;
    const cloneFromId: string | undefined = body.cloneFromId;

    if (!draft || !draft.name) {
      return NextResponse.json(
        { error: 'Draft is required' },
        { status: 400 }
      );
    }

    // 3. Validate before creation
    const preValidation = await validateBeforeCreation(draft, userId);

    if (!preValidation.valid) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          errors: preValidation.errors,
        },
        { status: 400 }
      );
    }

    // 4. Create character
    const result = await createCharacter({
      draft,
      userId,
      // Progress callback se maneja via streaming en endpoint separado
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Creation failed',
        },
        { status: 500 }
      );
    }

    // 5. If this is a clone, update clone count and create record
    if (cloneFromId && result.agentId) {
      try {
        await prisma.$transaction([
          // Increment clone count on original agent
          prisma.agent.update({
            where: { id: cloneFromId },
            data: { cloneCount: { increment: 1 } },
          }),
          // Create clone record
          prisma.agentClone.create({
            data: {
              id: nanoid(),
              originalAgentId: cloneFromId,
              clonedByUserId: userId,
              clonedAgentId: result.agentId,
            },
          }),
        ]);
        console.log(`Clone count incremented for agent ${cloneFromId}`);
      } catch (cloneError) {
        // Log error but don't fail the creation since the agent was already created
        console.error('Error updating clone count:', cloneError);
      }
    }

    // 6. Return success
    return NextResponse.json({
      success: true,
      agentId: result.agentId,
      agent: result.agent,
      coherenceScore: result.coherenceScore,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Character creation API error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
