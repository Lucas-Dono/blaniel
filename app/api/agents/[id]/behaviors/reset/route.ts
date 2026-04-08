/**
 * API Endpoint: POST /api/agents/[id]/behaviors/reset
 *
 * Resets all behaviors of an agent to their initial state.
 * - Deletes all BehaviorProfiles
 * - Deletes all BehaviorTriggerLogs
 * - Resets BehaviorProgressionState
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // Check that agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Delete all behavior data in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete BehaviorProfiles (this will delete triggers by CASCADE)
      await tx.behaviorProfile.deleteMany({
        where: { agentId },
      });

      // 2. Delete or reset BehaviorProgressionState
      const progressionState = await tx.behaviorProgressionState.findUnique({
        where: { agentId },
      });

      if (progressionState) {
        await tx.behaviorProgressionState.update({
          where: { agentId },
          data: {
            totalInteractions: 0,
            positiveInteractions: 0,
            negativeInteractions: 0,
            currentIntensities: {},
            lastCalculatedAt: new Date(),
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Behaviors reset for ${agent.name}`,
      agentId: agent.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Error resetting behaviors:", error);
    return NextResponse.json(
      {
        error: "Failed to reset behaviors",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
