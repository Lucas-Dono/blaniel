import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAPIAuth } from "@/lib/api/auth";
import { regenerateRoutine } from "@/lib/routine/routine-generator";
import type { RegenerateRoutineRequest } from "@/types/routine";

/**
 * POST /api/v1/agents/:id/routine/regenerate
 * Regenerate routine using AI
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId } = await params;

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const routine = await prisma.characterRoutine.findUnique({
      where: { agentId },
    });

    if (!routine) {
      return NextResponse.json(
        { error: "Routine not found" },
        { status: 404 }
      );
    }

    const body: RegenerateRoutineRequest = await req.json();

    // Regenerate
    await regenerateRoutine(routine.id, {
      customPrompt: body.customPrompt,
      preserveManualEdits: body.preserveManualEdits,
    });

    // Fetch updated routine
    const updated = await prisma.characterRoutine.findUnique({
      where: { id: routine.id },
      include: {
        RoutineTemplate: true,
      },
    });

    return NextResponse.json({
      message: "Routine regenerated successfully",
      routine: updated,
    });
  });
}
