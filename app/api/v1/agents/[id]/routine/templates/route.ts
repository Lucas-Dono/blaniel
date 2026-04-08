import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { withAPIAuth } from "@/lib/api/auth";
import type { CreateTemplateRequest } from "@/types/routine";

/**
 * POST /api/v1/agents/:id/routine/templates
 * Create a new template
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

    const body: CreateTemplateRequest = await req.json();

    // Create template
    const template = await prisma.routineTemplate.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        routineId: routine.id,
        name: body.name,
        description: body.description,
        type: body.type,
        startTime: body.startTime,
        endTime: body.endTime,
        daysOfWeek: body.daysOfWeek,
        priority: body.priority || "medium",
        isFlexible: body.isFlexible ?? true,
        allowVariations: body.allowVariations ?? true,
        variationParameters: (body.variationParameters || {}) as any,
        moodImpact: (body.moodImpact || {}) as any,
        location: body.location,
      },
    });

    // Mark routine as manually modified
    await prisma.characterRoutine.update({
      where: { id: routine.id },
      data: { manuallyModified: true },
    });

    return NextResponse.json(
      {
        message: "Template created successfully",
        template,
      },
      { status: 201 }
    );
  });
}
