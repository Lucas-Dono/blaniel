import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAPIAuth } from "@/lib/api/auth";

/**
 * GET /api/v1/agents/:id/goals/:goalId
 * Get a specific goal
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; goalId: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId, goalId } = await params;

    // Verify agent access
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        OR: [{ userId }, { visibility: "public" }],
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found or access denied" },
        { status: 404 }
      );
    }

    // Get goal
    const goal = await prisma.personalGoal.findFirst({
      where: {
        id: goalId,
        agentId,
      },
    });

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    return NextResponse.json(goal);
  });
}

/**
 * PATCH /api/v1/agents/:id/goals/:goalId
 * Update a goal
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; goalId: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId, goalId } = await params;

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found or access denied" },
        { status: 404 }
      );
    }

    // Verify goal exists
    const existingGoal = await prisma.personalGoal.findFirst({
      where: {
        id: goalId,
        agentId,
      },
    });

    if (!existingGoal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      title,
      description,
      category,
      timeScale,
      importance,
      emotionalInvestment,
      stressLevel,
      intrinsic,
      motivation,
      obstacles,
      milestones,
      progress,
      status,
      targetCompletionDate,
      lastSetback,
      nextMilestone,
    } = body;

    // Prepare update data
    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (timeScale !== undefined) updateData.timeScale = timeScale;
    if (importance !== undefined) updateData.importance = importance;
    if (emotionalInvestment !== undefined)
      updateData.emotionalInvestment = emotionalInvestment;
    if (stressLevel !== undefined) updateData.stressLevel = stressLevel;
    if (intrinsic !== undefined) updateData.intrinsic = intrinsic;
    if (motivation !== undefined) updateData.motivation = motivation;
    if (obstacles !== undefined) updateData.obstacles = obstacles;
    if (milestones !== undefined) updateData.milestones = milestones;
    if (status !== undefined) updateData.status = status;
    if (targetCompletionDate !== undefined)
      updateData.targetCompletionDate = targetCompletionDate
        ? new Date(targetCompletionDate)
        : null;
    if (lastSetback !== undefined) updateData.lastSetback = lastSetback;
    if (nextMilestone !== undefined) updateData.nextMilestone = nextMilestone;

    // Handle progress update
    if (progress !== undefined && progress !== existingGoal.progress) {
      updateData.progress = progress;
      updateData.daysSinceProgress = 0;
      updateData.lastProgressUpdate = new Date();

      // Add to progress history
      const progressHistory = existingGoal.progressHistory as any[];
      progressHistory.push({
        date: new Date().toISOString(),
        progress,
        note: body.progressNote || "Progress updated",
      });
      updateData.progressHistory = progressHistory;

      // Check if goal is completed
      if (progress >= 100 && existingGoal.status === "active") {
        updateData.status = "completed";
      }
    }

    // Update goal
    const goal = await prisma.personalGoal.update({
      where: { id: goalId },
      data: updateData,
    });

    return NextResponse.json(goal);
  });
}

/**
 * DELETE /api/v1/agents/:id/goals/:goalId
 * Delete a goal
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; goalId: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId, goalId } = await params;

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found or access denied" },
        { status: 404 }
      );
    }

    // Verify goal exists
    const existingGoal = await prisma.personalGoal.findFirst({
      where: {
        id: goalId,
        agentId,
      },
    });

    if (!existingGoal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Delete goal
    await prisma.personalGoal.delete({
      where: { id: goalId },
    });

    return NextResponse.json({ success: true });
  });
}
