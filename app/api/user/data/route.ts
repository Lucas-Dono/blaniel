import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/user/data - Clear all user data but keep account active
 *
 * This endpoint removes all user-generated content while maintaining:
 * - User account (email, password, authentication)
 * - Subscription/billing information
 * - Account settings
 *
 * What gets deleted:
 * - All agents created by the user
 * - All messages and conversation histories
 * - All achievements and progress
 * - All gamification data (XP, levels, badges)
 * - Content preferences
 * - API keys
 * - Community posts and comments
 *
 * The user can continue using the platform with a "clean slate"
 */
export async function DELETE(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Execute all deletions in a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Delete all agents (this cascades to messages, memories, behaviors, etc.)
      const agentsDeleted = await tx.agent.deleteMany({
        where: { userId },
      });

      // 2. Delete all messages (in case there are orphaned messages)
      const messagesDeleted = await tx.message.deleteMany({
        where: { userId },
      });

      // 3. Delete gamification data
      await tx.userBadge.deleteMany({
        where: { userId },
      });

      await tx.userRewards.deleteMany({
        where: { userId },
      });

      // 4. Reset content preferences
      await tx.userContentPreference.deleteMany({
        where: { userId },
      });

      // 5. Delete API keys
      await tx.user.update({
        where: { id: userId },
        data: { apiKey: null },
      });

      // 6. Delete community-related data
      await tx.communityPost.deleteMany({
        where: { authorId: userId },
      });

      await tx.communityComment.deleteMany({
        where: { authorId: userId },
      });

      await tx.postVote.deleteMany({
        where: { userId },
      });

      await tx.postFollower.deleteMany({
        where: { userId },
      });

      await tx.communityMember.deleteMany({
        where: { userId },
      });

      // 7. Delete notifications (recipientId is the user receiving the notification)
      await tx.notification.deleteMany({
        where: { recipientId: userId },
      });

      // 8. Delete direct messages sent by the user
      // Note: DirectConversation uses a 'participants' JSON field, not user1Id/user2Id
      // So we only delete messages, not conversations (conversations remain but empty)
      await tx.directMessage.deleteMany({
        where: { senderId: userId },
      });

      console.log(`[ClearUserData] Data cleared for user ${userId}:`, {
        agents: agentsDeleted.count,
        messages: messagesDeleted.count,
      });
    });

    return NextResponse.json({
      success: true,
      message: "Todos tus datos han sido eliminados exitosamente. Tu cuenta sigue activa.",
    });
  } catch (error) {
    console.error("[ClearUserData] Error clearing user data:", error);
    return NextResponse.json(
      {
        error: "Error al limpiar los datos",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
