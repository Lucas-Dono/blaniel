import { NextRequest, NextResponse } from "next/server";
import { AmbientDialogueService } from "@/lib/minecraft/ambient-dialogue-service";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger("MinecraftAmbientDialogue");

const RequestSchema = z.object({
  agentIds: z.array(z.string()).min(2).max(8), // 2-8 NPCs
  location: z.string(),
  contextHint: z.string().optional(),
  hasImportantHistory: z.boolean().optional(), // Si hay conversaciones importantes
});

/**
 * POST /api/v1/minecraft/ambient-dialogue
 *
 * Genera diálogos ambientales para un grupo de NPCs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = RequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { agentIds, location, contextHint, hasImportantHistory } = validation.data;

    log.info({
      agentIds,
      location,
      contextHint,
      hasImportantHistory,
    }, "Generating ambient dialogue");

    // Get participant information
    const participants = await AmbientDialogueService.getParticipantInfo(agentIds);

    if (participants.length < 2) {
      return NextResponse.json(
        {
          error: "At least 2 valid agents required",
        },
        { status: 400 }
      );
    }

    // Generate diálogo
    const dialogue = await AmbientDialogueService.getAmbientDialogue({
      participants,
      location,
      contextHint,
      hasImportantHistory: hasImportantHistory || false,
    });

    return NextResponse.json(
      {
        success: true,
        dialogues: dialogue.dialogues,
        groupHash: dialogue.groupHash,
        fromCache: dialogue.totalTokens === 0,
        metadata: {
          participants: participants.length,
          totalTokens: dialogue.totalTokens,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    log.error({ error }, "Error generating ambient dialogue");

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
