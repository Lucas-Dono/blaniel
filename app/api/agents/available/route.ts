import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";

/**
 * GET /api/agents/available
 * Get user's available agents (not currently in any group or available to add)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Get all available agents (user's own agents + public agents)
    const agents = await prisma.agent.findMany({
      where: {
        OR: [
          { userId: user.id }, // User's own agents
          { visibility: "public" }, // Public agents
        ],
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        description: true,
        userId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit to 50 agents for performance
    });

    return NextResponse.json({
      agents,
      total: agents.length,
    });
  } catch (error) {
    console.error("Error fetching available agents:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
