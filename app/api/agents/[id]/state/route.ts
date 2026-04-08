/**
 * Agent State API Endpoint
 *
 * GET /api/agents/[id]/state
 * Returns the current emotional and behavioral state of an agent
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // Authentication
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Get agent to verify it exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get emotional state (InternalState)
    const internalState = await prisma.internalState.findUnique({
      where: { agentId },
    });

    // Get behavioral state
    const behaviorState = await prisma.behaviorProgressionState.findFirst({
      where: { agentId },
    });

    // Get relationship level (where agent is subject and user is target)
    const relationship = await prisma.relation.findFirst({
      where: {
        subjectId: agentId,
        targetId: userId,
        targetType: 'user',
      },
    });

    // Format emotional data
    const emotionalData = internalState ? {
      state: {
        trust: relationship?.trust ?? 0,
        affinity: relationship?.affinity ?? 0,
        respect: relationship?.respect ?? 0,
        valence: internalState.moodValence,
        arousal: internalState.moodArousal,
        dominance: internalState.moodDominance,
      },
      emotions: internalState.currentEmotions,
      relationLevel: relationship?.stage || 'stranger', // Pass as string, component will handle it
    } : null;

    // Format behavioral data (extract all active behaviors)
    let behaviorData = null;
    if (behaviorState) {
      const intensities = behaviorState.currentIntensities as Record<string, number>;
      const behaviors = Object.entries(intensities);

      // Filter behaviors with intensity > 0 and sort by intensity descending
      const activeBehaviors = behaviors
        .filter(([_, intensity]) => intensity > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([type]) => type);

      if (activeBehaviors.length > 0) {
        // Find highest intensity to determine safety level
        const highestIntensity = Math.max(...behaviors.map(([_, i]) => i));

        // Determine safety level based on intensity
        let safetyLevel: "SAFE" | "WARNING" | "CRITICAL" | "EXTREME_DANGER" = "SAFE";
        if (highestIntensity >= 0.8) safetyLevel = "EXTREME_DANGER";
        else if (highestIntensity >= 0.6) safetyLevel = "CRITICAL";
        else if (highestIntensity >= 0.4) safetyLevel = "WARNING";

        behaviorData = {
          active: activeBehaviors,
          phase: Math.ceil(highestIntensity * 8), // Convert to phase 1-8
          safetyLevel,
          triggers: [], // Could be populated from recent interactions
          intensity: highestIntensity,
        };
      }
    }

    return NextResponse.json({
      emotional: emotionalData,
      behavior: behaviorData,
      relationship: {
        stage: relationship?.stage || 'stranger',
        trust: relationship?.trust ?? 0,
        affinity: relationship?.affinity ?? 0,
        respect: relationship?.respect ?? 0,
        totalInteractions: relationship?.totalInteractions || 0,
      }
    });

  } catch (error) {
    console.error("[API] Error fetching agent state:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent state" },
      { status: 500 }
    );
  }
}
