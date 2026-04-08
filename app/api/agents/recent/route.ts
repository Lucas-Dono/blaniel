import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * GET /api/agents/recent
 * Gets characters the user has recently chatted with
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get the latest agents the user has chatted with
    // Search user messages, group by agentId, order by most recent date
    const recentMessages = await prisma.message.findMany({
      where: {
        userId: userId,
        agentId: { not: null },
      },
      orderBy: {
        createdAt: "desc",
      },
      distinct: ["agentId"],
      take: 10, // Limit to the last 10 characters
      select: {
        agentId: true,
        createdAt: true,
        Agent: {
          select: {
            id: true,
            name: true,
            description: true,
            avatar: true,
            kind: true,
            categories: true,
            generationTier: true,
            gender: true,
            visibility: true,
            nsfwMode: true,
            nsfwLevel: true,
          },
        },
      },
    });

    // Filter only valid agents (that exist) and of type companion
    const recentAgents = recentMessages
      .filter((msg) => msg.Agent && msg.Agent.kind === "companion")
      .map((msg) => ({
        ...msg.Agent,
        lastMessageAt: msg.createdAt,
      }));

    return NextResponse.json({
      agents: recentAgents,
      count: recentAgents.length
    });
  } catch (error) {
    console.error("Error fetching recent agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent agents" },
      { status: 500 }
    );
  }
}
