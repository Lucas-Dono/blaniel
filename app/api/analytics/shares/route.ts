import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logging/logger";
import { getAuthenticatedUser } from "@/lib/auth-server";
/**
 * GET /api/analytics/shares
 * Get global share analytics or user-specific analytics
 *
 * Query params:
 * - days: Number of days to look back (default: 30, max: 365)
 * - userId: Filter by specific user (optional, admin only)
 * - agentId: Filter by specific agent (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const searchParams = request.nextUrl.searchParams;
    const days = Math.min(parseInt(searchParams.get("days") || "30"), 365);
    const filterUserId = searchParams.get("userId");
    const filterAgentId = searchParams.get("agentId");

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where clause
    const where: any = {
      createdAt: {
        gte: startDate,
      },
    };

    // If filtering by agent
    if (filterAgentId) {
      where.agentId = filterAgentId;
    }

    // If filtering by user - only allow if admin or own data
    if (filterUserId) {
      // Check if user is admin or requesting own data
      if (user?.id !== filterUserId) {
        // TODO: Check if user is admin
        // For now, only allow users to see their own data
        return NextResponse.json(
          { error: "No autorizado para ver datos de otros usuarios" },
          { status: 403 }
        );
      }
      where.userId = filterUserId;
    } else if (user?.id && !filterAgentId) {
      // If logged in and no specific filters, show user's own stats
      where.userId = user.id;
    }

    // Get all share events in the date range
    const shareEvents = await prisma.shareEvent.findMany({
      where,
      select: {
        method: true,
        createdAt: true,
        userId: true,
        agentId: true,
        Agent: {
          select: {
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate statistics
    const totalShares = shareEvents.length;
    const sharesByMethod: Record<string, number> = {
      copy_link: 0,
      community: 0,
      twitter: 0,
      facebook: 0,
      linkedin: 0,
      whatsapp: 0,
    };

    const uniqueUsers = new Set<string>();
    const uniqueAgents = new Set<string>();
    const sharesByAgent: Record<string, { count: number; name: string; avatar: string | null }> = {};

    shareEvents.forEach((event) => {
      sharesByMethod[event.method] = (sharesByMethod[event.method] || 0) + 1;
      if (event.userId) {
        uniqueUsers.add(event.userId);
      }
      uniqueAgents.add(event.agentId);

      if (!sharesByAgent[event.agentId]) {
        sharesByAgent[event.agentId] = {
          count: 0,
          name: event.Agent.name,
          avatar: event.Agent.avatar,
        };
      }
      sharesByAgent[event.agentId].count++;
    });

    // Calculate percentage for each method
    const sharesByMethodWithPercentage = Object.entries(sharesByMethod).map(([method, count]) => ({
      method,
      count,
      percentage: totalShares > 0 ? Math.round((count / totalShares) * 100) : 0,
    }));

    // Sort by count descending
    sharesByMethodWithPercentage.sort((a, b) => b.count - a.count);

    // Top agents by shares
    const topAgents = Object.entries(sharesByAgent)
      .map(([agentId, data]) => ({
        agentId,
        agentName: data.name,
        agentAvatar: data.avatar,
        shareCount: data.count,
      }))
      .sort((a, b) => b.shareCount - a.shareCount)
      .slice(0, 10);

    // Calculate shares per day
    const sharesPerDay: Record<string, number> = {};
    shareEvents.forEach((event) => {
      const date = event.createdAt.toISOString().split("T")[0];
      sharesPerDay[date] = (sharesPerDay[date] || 0) + 1;
    });

    const sharesTimeline = Object.entries(sharesPerDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      summary: {
        totalShares,
        uniqueUsers: uniqueUsers.size,
        uniqueAgents: uniqueAgents.size,
        mostPopularMethod: sharesByMethodWithPercentage[0]?.method || null,
      },
      sharesByMethod,
      sharesByMethodWithPercentage,
      topAgents,
      sharesTimeline,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching share analytics");
    return NextResponse.json(
      { error: "Error al obtener analytics" },
      { status: 500 }
    );
  }
}
