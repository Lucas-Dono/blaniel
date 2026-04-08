/**
 * API Endpoints for individual behavior management
 *
 * DELETE /api/agents/[id]/behaviors/[behaviorId] - Delete a specific behavior
 * PATCH /api/agents/[id]/behaviors/[behaviorId] - Update behavior configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * DELETE - Delete specific behavior
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; behaviorId: string }> }
) {
  try {
    const { id: agentId, behaviorId } = await params;

    // Check that behavior exists and belongs to agent
    const behavior = await prisma.behaviorProfile.findFirst({
      where: {
        id: behaviorId,
        agentId,
      },
    });

    if (!behavior) {
      return NextResponse.json(
        { error: "Behavior not found" },
        { status: 404 }
      );
    }

    // Delete behavior (triggers are deleted by CASCADE)
    await prisma.behaviorProfile.delete({
      where: { id: behaviorId },
    });

    return NextResponse.json({
      success: true,
      message: `Behavior ${behavior.behaviorType} deleted`,
      behaviorId,
      behaviorType: behavior.behaviorType,
    });
  } catch (error) {
    console.error("[API] Error deleting behavior:", error);
    return NextResponse.json(
      { error: "Failed to delete behavior" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update behavior configuration
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; behaviorId: string }> }
) {
  try {
    const { id: agentId, behaviorId } = await params;
    const body = await req.json();

    // Validate that behavior exists and belongs to agent
    const behavior = await prisma.behaviorProfile.findFirst({
      where: {
        id: behaviorId,
        agentId,
      },
    });

    if (!behavior) {
      return NextResponse.json(
        { error: "Behavior not found" },
        { status: 404 }
      );
    }

    // Allowed fields to update
    const allowedFields = [
      "baseIntensity",
      "volatility",
      "escalationRate",
      "deEscalationRate",
      "thresholdForDisplay",
    ];

    const updateData: any = {};

    // Filter only allowed fields and validate values
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const value = body[field];

        // Validate that it is a number between 0 and 1
        if (typeof value !== "number" || value < 0 || value > 1) {
          return NextResponse.json(
            { error: `${field} must be a number between 0 and 1` },
            { status: 400 }
          );
        }

        updateData[field] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update behavior
    const updated = await prisma.behaviorProfile.update({
      where: { id: behaviorId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Behavior updated",
      behavior: {
        id: updated.id,
        behaviorType: updated.behaviorType,
        baseIntensity: updated.baseIntensity,
        volatility: updated.volatility,
        escalationRate: updated.escalationRate,
        deEscalationRate: updated.deEscalationRate,
        thresholdForDisplay: updated.thresholdForDisplay,
      },
    });
  } catch (error) {
    console.error("[API] Error updating behavior:", error);
    return NextResponse.json(
      { error: "Failed to update behavior" },
      { status: 500 }
    );
  }
}
