import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-server";

/**
 * DELETE /api/agents/:id/conversation/reset
 *
 * Deletes all conversation with an agent and resets the relationship to initial state.
 * Useful for testing and starting from scratch.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // Get authenticated user
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Check that agent exists and belongs to user
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log(`[Reset] Deleting conversation for agent ${agentId} and user ${userId}`);

    // Execute operations in parallel
    const [deletedMessages, resetRelation] = await Promise.all([
      // 1. Delete only this user's messages with the agent
      prisma.message.deleteMany({
        where: {
          agentId,
          userId, // Important: Only delete this user's messages
        },
      }),

      // 2. Reset or delete the relationship
      prisma.relation.deleteMany({
        where: {
          subjectId: agentId,
          targetId: userId,
          targetType: "user",
        },
      }),
    ]);

    // Note: We DON'T reset InternalState because it's shared across all users
    // and represents the agent's global emotional state

    console.log(`[Reset] Results:`);
    console.log(`  - Messages deleted: ${deletedMessages.count}`);
    console.log(`  - Relations deleted: ${resetRelation.count}`);

    return NextResponse.json({
      success: true,
      deleted: {
        messages: deletedMessages.count,
        relations: resetRelation.count,
      },
      message: "Conversation reset successfully",
    });

  } catch (error) {
    console.error("[Reset] Error:", error);
    return NextResponse.json(
      { error: "Failed to reset conversation" },
      { status: 500 }
    );
  }
}
