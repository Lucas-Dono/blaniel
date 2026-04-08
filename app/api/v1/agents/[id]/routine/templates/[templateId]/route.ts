import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAPIAuth } from "@/lib/api/auth";
import type { UpdateTemplateRequest } from "@/types/routine";

/**
 * PATCH /api/v1/agents/:id/routine/templates/:templateId
 * Update a template
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId, templateId } = await params;

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get template
    const template = await prisma.routineTemplate.findFirst({
      where: {
        id: templateId,
        CharacterRoutine: {
          agentId,
        },
      },
      include: {
        CharacterRoutine: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const body: UpdateTemplateRequest = await req.json();

    // Update template
    const updated = await prisma.routineTemplate.update({
      where: { id: templateId },
      data: {
        name: body.name,
        description: body.description,
        type: body.type,
        startTime: body.startTime,
        endTime: body.endTime,
        daysOfWeek: body.daysOfWeek,
        priority: body.priority,
        isFlexible: body.isFlexible,
        allowVariations: body.allowVariations,
        variationParameters: body.variationParameters as any,
        moodImpact: body.moodImpact as any,
        location: body.location,
      },
    });

    // Mark routine as manually modified
    await prisma.characterRoutine.update({
      where: { id: template.routineId },
      data: { manuallyModified: true },
    });

    return NextResponse.json({
      message: "Template updated successfully",
      template: updated,
    });
  });
}

/**
 * DELETE /api/v1/agents/:id/routine/templates/:templateId
 * Delete a template
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId, templateId } = await params;

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get template
    const template = await prisma.routineTemplate.findFirst({
      where: {
        id: templateId,
        CharacterRoutine: {
          agentId,
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Delete template (cascade will delete instances)
    await prisma.routineTemplate.delete({
      where: { id: templateId },
    });

    // Mark routine as manually modified
    await prisma.characterRoutine.update({
      where: { id: template.routineId },
      data: { manuallyModified: true },
    });

    return NextResponse.json({
      message: "Template deleted successfully",
    });
  });
}
