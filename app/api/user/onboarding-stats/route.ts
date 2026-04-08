/**
 * Onboarding Stats API
 * Returns user statistics needed for experience level calculation
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { differenceInDays } from "date-fns";
import type { UserStats } from "@/lib/onboarding/experience-levels";

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);

    if (!authUser?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = authUser.id;

    // Fetch all required data in parallel
    const [user, agentCount, groupCount, messageCount, communityActivity] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true },
      }),
      prisma.agent.count({
        where: { userId },
      }),
      prisma.group.count({
        where: { creatorId: userId },
      }),
      prisma.message.count({
        where: { userId, role: "user" },
      }),
      prisma.communityPost.count({
        where: { authorId: userId },
      }),
    ]);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const daysSinceSignup = differenceInDays(new Date(), user.createdAt);
    const hasVisitedCommunity = communityActivity > 0;

    // Calculate time since login (estimate based on current session)
    // For now, we'll use a default value since lastLogin may not be in session
    const timeSinceLogin = 0;

    const stats: UserStats = {
      agentCount,
      groupCount,
      messageCount,
      totalMessages: messageCount, // Same as messageCount for now
      daysSinceSignup: Math.max(daysSinceSignup, 0),
      hasVisitedCommunity,
      timeSinceLogin,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching onboarding stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
