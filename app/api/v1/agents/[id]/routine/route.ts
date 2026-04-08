import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAPIAuth } from "@/lib/api/auth";
import {
  generateAndSaveRoutine,
} from "@/lib/routine/routine-generator";
import { generateRoutineContext } from "@/lib/routine/routine-simulator";
import type {
  CreateRoutineRequest,
  UpdateRoutineRequest,
} from "@/types/routine";

/**
 * GET /api/v1/agents/:id/routine
 * Get routine for an agent with current state
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId } = await params;

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId },
      include: {
        User: {
          select: { plan: true },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Check premium access
    if (!["plus", "ultra"].includes(agent.User?.plan || "free")) {
      return NextResponse.json(
        {
          error: "Routine system requires Plus or Ultra plan",
          feature: "character_routines",
          requiredPlan: "plus",
        },
        { status: 403 }
      );
    }

    // Get routine
    const routine = await prisma.characterRoutine.findUnique({
      where: { agentId },
      include: {
        RoutineTemplate: {
          orderBy: { startTime: "asc" },
        },
      },
    });

    if (!routine) {
      return NextResponse.json(
        {
          error: "No routine found for this agent",
          message: "Create a routine first",
        },
        { status: 404 }
      );
    }

    // Get current state
    const currentState = await generateRoutineContext(agentId);

    // Get today's instances
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayInstances = await prisma.routineInstance.findMany({
      where: {
        agentId,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { scheduledStart: "asc" },
    });

    return NextResponse.json({
      routine: {
        id: routine.id,
        agentId: routine.agentId,
        timezone: routine.timezone,
        enabled: routine.enabled,
        realismLevel: routine.realismLevel,
        autoGenerateVariations: routine.autoGenerateVariations,
        variationIntensity: routine.variationIntensity,
        generatedByAI: routine.generatedByAI,
        lastRegenerated: routine.lastRegenerated,
        createdAt: routine.createdAt,
        updatedAt: routine.updatedAt,
      },
      templates: routine.RoutineTemplate,
      currentState: {
        currentActivity: currentState.currentActivity,
        nextActivity: currentState.nextActivity,
        timezone: currentState.timezone,
      },
      todayInstances: todayInstances.map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        scheduledStart: i.scheduledStart,
        scheduledEnd: i.scheduledEnd,
        actualStart: i.actualStart,
        actualEnd: i.actualEnd,
        status: i.status,
        variations: i.variations,
        notes: i.notes,
      })),
      stats: {
        totalTemplates: routine.RoutineTemplate.length,
        todayTotal: todayInstances.length,
        todayCompleted: todayInstances.filter((i) => i.status === "completed")
          .length,
        todayInProgress: todayInstances.filter((i) => i.status === "in_progress")
          .length,
      },
    });
  });
}

/**
 * POST /api/v1/agents/:id/routine
 * Create a new routine for an agent (with AI generation)
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
      include: {
        User: {
          select: { plan: true },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Check premium access
    if (!["plus", "ultra"].includes(agent.User?.plan || "free")) {
      return NextResponse.json(
        {
          error: "Routine system requires Plus or Ultra plan",
          feature: "character_routines",
          requiredPlan: "plus",
        },
        { status: 403 }
      );
    }

    // Check if routine already exists
    const existingRoutine = await prisma.characterRoutine.findUnique({
      where: { agentId },
    });

    if (existingRoutine) {
      return NextResponse.json(
        {
          error: "Routine already exists for this agent",
          message: "Use PATCH to update or POST to /regenerate",
        },
        { status: 409 }
      );
    }

    const body: CreateRoutineRequest = await req.json();

    // Generate routine
    const routineId = await generateAndSaveRoutine(agentId, userId, {
      timezone: body.timezone,
      realismLevel: body.realismLevel,
      customPrompt: body.generationInput?.customPrompt,
    });

    // Fetch created routine
    const routine = await prisma.characterRoutine.findUnique({
      where: { id: routineId },
      include: {
        RoutineTemplate: true,
      },
    });

    return NextResponse.json(
      {
        message: "Routine created successfully",
        routine,
      },
      { status: 201 }
    );
  });
}

/**
 * PATCH /api/v1/agents/:id/routine
 * Update routine configuration
 */
export async function PATCH(
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

    const body: UpdateRoutineRequest = await req.json();

    // Update routine
    const updated = await prisma.characterRoutine.update({
      where: { id: routine.id },
      data: {
        timezone: body.timezone,
        enabled: body.enabled,
        realismLevel: body.realismLevel,
        autoGenerateVariations: body.autoGenerateVariations,
        variationIntensity: body.variationIntensity,
      },
    });

    return NextResponse.json({
      message: "Routine updated successfully",
      routine: updated,
    });
  });
}

/**
 * DELETE /api/v1/agents/:id/routine
 * Delete routine (and all templates/instances)
 */
export async function DELETE(
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

    // Delete routine (cascade will delete templates, instances, state)
    await prisma.characterRoutine.delete({
      where: { id: routine.id },
    });

    return NextResponse.json({
      message: "Routine deleted successfully",
    });
  });
}
