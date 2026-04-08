import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/agents/[id]/rating - Get agent rating
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // Get agent with reviews
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
        rating: true,
        Review: {
          select: {
            rating: true,
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const totalReviews = agent.Review.length;
    const averageRating = agent.rating || 0;

    // Calculate rating distribution
    const ratingDistribution = {
      5: agent.Review.filter((r) => r.rating === 5).length,
      4: agent.Review.filter((r) => r.rating === 4).length,
      3: agent.Review.filter((r) => r.rating === 3).length,
      2: agent.Review.filter((r) => r.rating === 2).length,
      1: agent.Review.filter((r) => r.rating === 1).length,
    };

    return NextResponse.json({
      agentId: agent.id,
      agentName: agent.name,
      averageRating: Number(averageRating.toFixed(2)),
      totalReviews,
      ratingDistribution,
    });
  } catch (error) {
    console.error("Error fetching rating:", error);
    return NextResponse.json(
      { error: "Error getting rating" },
      { status: 500 }
    );
  }
}
