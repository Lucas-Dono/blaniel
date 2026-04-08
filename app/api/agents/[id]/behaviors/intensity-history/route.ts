/**
 * API Endpoint: GET /api/agents/[id]/behaviors/intensity-history
 *
 * Retrieves historical intensity data of behaviors for charts.
 * Calculates intensity based on detected triggers over time.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // Check that agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Get BehaviorProfiles to know what behaviors are active
    const behaviorProfiles = await prisma.behaviorProfile.findMany({
      where: { agentId },
      select: {
        id: true,
        behaviorType: true,
        baseIntensity: true,
        currentPhase: true,
        createdAt: true,
      },
    });

    if (behaviorProfiles.length === 0) {
      return NextResponse.json({
        data: [],
        behaviors: [],
      });
    }

    // Get all triggers ordered by date
    const allTriggers = await prisma.behaviorTriggerLog.findMany({
      where: {
        Message: { agentId },
        behaviorType: {
          in: behaviorProfiles.map((p) => p.behaviorType),
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        behaviorType: true,
        triggerType: true,
        weight: true,
        createdAt: true,
      },
    });

    // Group by behavior and calculate cumulative intensity
    const behaviorData: Record<
      string,
      Array<{ timestamp: string; intensity: number; phase: number }>
    > = {};

    behaviorProfiles.forEach((profile) => {
      const behaviorType = profile.behaviorType;
      behaviorData[behaviorType] = [];

      // Initial point: behavior creation
      behaviorData[behaviorType].push({
        timestamp: profile.createdAt.toISOString(),
        intensity: profile.baseIntensity,
        phase: 1,
      });

      // Calculate cumulative intensity based on triggers
      let currentIntensity = profile.baseIntensity;
      const triggersForBehavior = allTriggers.filter(
        (t) => t.behaviorType === behaviorType
      );

      triggersForBehavior.forEach((trigger) => {
        // Increase intensity based on trigger weight
        // Positive weight increases, negative weight (reassurance) decreases
        const intensityChange = trigger.weight * 0.1; // Scaling factor
        currentIntensity = Math.max(
          0,
          Math.min(1, currentIntensity + intensityChange)
        );

        // Determine phase based on intensity
        // Simplification: 0-0.2 = phase 1, 0.2-0.4 = phase 2, etc.
        const phase = Math.min(8, Math.floor(currentIntensity * 10) + 1);

        behaviorData[behaviorType].push({
          timestamp: trigger.createdAt.toISOString(),
          intensity: currentIntensity,
          phase,
        });
      });

      // Current point: latest intensity
      if (triggersForBehavior.length > 0) {
        behaviorData[behaviorType].push({
          timestamp: new Date().toISOString(),
          intensity: currentIntensity,
          phase: profile.currentPhase,
        });
      }
    });

    // Format for response
    const formattedData = Object.entries(behaviorData).map(
      ([behaviorType, dataPoints]) => ({
        behaviorType,
        data: dataPoints,
        currentIntensity:
          dataPoints.length > 0
            ? dataPoints[dataPoints.length - 1].intensity
            : 0,
        totalDataPoints: dataPoints.length,
      })
    );

    return NextResponse.json({
      data: formattedData,
      behaviors: behaviorProfiles.map((p) => ({
        type: p.behaviorType,
        baseIntensity: p.baseIntensity,
        currentPhase: p.currentPhase,
      })),
      metadata: {
        totalTriggers: allTriggers.length,
        dateRange: {
          start:
            allTriggers.length > 0
              ? allTriggers[0].createdAt.toISOString()
              : new Date().toISOString(),
          end: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("[API] Error fetching intensity history:", error);
    return NextResponse.json(
      { error: "Failed to fetch intensity history" },
      { status: 500 }
    );
  }
}
