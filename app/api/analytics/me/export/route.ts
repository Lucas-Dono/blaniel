/**
 * Export Personal Analytics API
 * GDPR-compliant data export endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import {
  getPersonalOverview,
  getMessagesPerDay,
  getMostUsedAIs,
  getEmotionalAnalytics,
  getRelationshipProgress,
  getUsageInsights,
  getCommunityImpact,
} from "@/lib/analytics/personal-stats.service";

/**
 * @swagger
 * /api/analytics/me/export:
 *   get:
 *     summary: Export personal analytics
 *     description: Export all personal data in JSON or CSV format (GDPR compliant)
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format
 *     responses:
 *       200:
 *         description: Analytics data exported
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";
    const userId = user.id;

    // Fetch all analytics data
    const [overview, messagesPerDay, mostUsedAIs, emotional, relationships, insights, community] =
      await Promise.all([
        getPersonalOverview(userId),
        getMessagesPerDay(userId, 90),
        getMostUsedAIs(userId, 20),
        getEmotionalAnalytics(userId, 90),
        getRelationshipProgress(userId),
        getUsageInsights(userId),
        getCommunityImpact(userId),
      ]);

    // Get user profile data
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        createdAt: true,
      },
    });

    const exportData = {
      user: dbUser,
      overview,
      messagesPerDay,
      mostUsedAIs,
      emotional,
      relationships,
      insights,
      community,
      exportedAt: new Date().toISOString(),
    };

    if (format === "csv") {
      // Generate CSV format
      const csv = [
        "PERSONAL ANALYTICS EXPORT",
        `Exported At: ${exportData.exportedAt}`,
        "",
        "USER INFORMATION",
        `Email,${dbUser?.email}`,
        `Name,${dbUser?.name || "N/A"}`,
        `Plan,${dbUser?.plan}`,
        `Member Since,${dbUser?.createdAt}`,
        "",
        "OVERVIEW",
        `Total AIs Created,${overview.totalAIsCreated}`,
        `Total Messages Sent,${overview.totalMessagesSent}`,
        `Total Time Spent (hours),${overview.totalTimeSpentHours}`,
        `Current Streak (days),${overview.currentStreak}`,
        `Longest Streak (days),${overview.longestStreak}`,
        `Favorite AI,${overview.favoriteAI?.name || "N/A"}`,
        "",
        "MESSAGES PER DAY",
        "Date,Count",
        ...messagesPerDay.map((m) => `${m.date},${m.count}`),
        "",
        "MOST USED AIS",
        "Name,Message Count,Last Used",
        ...mostUsedAIs.map((ai) => `${ai.name},${ai.messageCount},${ai.lastUsed}`),
        "",
        "EMOTIONAL FREQUENCY",
        "Emotion,Count",
        ...Object.entries(emotional.emotionFrequency).map(([emotion, count]) => `${emotion},${count}`),
        "",
        "RELATIONSHIPS",
        "AI Name,Stage,Trust,Affinity,Respect,Days Together,Milestones",
        ...relationships.relationships.map(
          (rel) =>
            `${rel.agentName},${rel.currentStage},${rel.trust},${rel.affinity},${rel.respect},${rel.daysSinceCreation},"${rel.milestones.join(", ")}"`
        ),
        "",
        "INSIGHTS",
        ...insights.insights,
        "",
        "COMMUNITY IMPACT",
        `Post Karma,${community.postKarma}`,
        `Comment Karma,${community.commentKarma}`,
        `AIs Shared,${community.aisShared}`,
        `Helpful Answers,${community.helpfulAnswers}`,
      ].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="my-analytics-${Date.now()}.csv"`,
        },
      });
    }

    // JSON format
    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="my-analytics-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error("Error exporting analytics:", error);
    return NextResponse.json({ error: "Failed to export analytics" }, { status: 500 });
  }
}
