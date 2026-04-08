/**
 * Personal Analytics API
 * Provides comprehensive personal statistics for authenticated users
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
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
 * /api/analytics/me:
 *   get:
 *     summary: Get personal analytics
 *     description: Retrieve comprehensive personal analytics and insights
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: section
 *         schema:
 *           type: string
 *           enum: [overview, messages, emotions, relationships, insights, community, all]
 *           default: all
 *         description: Specific section to retrieve
 *       - in: query
 *         name: days
 *         schema:
 *           type: number
 *           default: 30
 *         description: Number of days for time-based analytics
 *     responses:
 *       200:
 *         description: Personal analytics data
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
    const section = searchParams.get("section") || "all";
    const days = parseInt(searchParams.get("days") || "30");

    const userId = user.id;

    // Handle specific sections for faster loading
    switch (section) {
      case "overview":
        const overview = await getPersonalOverview(userId);
        return NextResponse.json({ overview });

      case "messages":
        const [messagesPerDay, mostUsedAIs] = await Promise.all([
          getMessagesPerDay(userId, days),
          getMostUsedAIs(userId, 10),
        ]);
        return NextResponse.json({ messagesPerDay, mostUsedAIs });

      case "emotions":
        const emotional = await getEmotionalAnalytics(userId, days);
        return NextResponse.json({ emotional });

      case "relationships":
        const relationships = await getRelationshipProgress(userId);
        return NextResponse.json({ relationships });

      case "insights":
        const insights = await getUsageInsights(userId);
        return NextResponse.json({ insights });

      case "community":
        const community = await getCommunityImpact(userId);
        return NextResponse.json({ community });

      case "all":
      default:
        // Fetch all data in parallel
        const [
          overviewData,
          messagesPerDayData,
          mostUsedAIsData,
          emotionalData,
          relationshipsData,
          insightsData,
          communityData,
        ] = await Promise.all([
          getPersonalOverview(userId),
          getMessagesPerDay(userId, days),
          getMostUsedAIs(userId, 10),
          getEmotionalAnalytics(userId, days),
          getRelationshipProgress(userId),
          getUsageInsights(userId),
          getCommunityImpact(userId),
        ]);

        return NextResponse.json({
          overview: overviewData,
          messagesPerDay: messagesPerDayData,
          mostUsedAIs: mostUsedAIsData,
          emotional: emotionalData,
          relationships: relationshipsData,
          insights: insightsData,
          community: communityData,
          generatedAt: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error("Error getting personal analytics:", error);
    return NextResponse.json(
      { error: "Failed to get personal analytics" },
      { status: 500 }
    );
  }
}
