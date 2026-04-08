import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { checkFeature } from "@/lib/feature-flags";
import { Feature } from "@/lib/feature-flags/types";

/**
 * GET /api/groups/[id]/analytics
 * Get analytics data for a group (ULTRA tier only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 1. Check ULTRA tier feature access
    const featureCheck = await checkFeature(user.id, Feature.GROUPS_ANALYTICS);
    if (!featureCheck.hasAccess) {
      return NextResponse.json(
        {
          error: "Analytics solo disponibles en tier ULTRA",
          upgradeUrl: "/pricing",
        },
        { status: 403 }
      );
    }

    // 2. Verify membership
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        memberType: "user",
        isActive: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "No eres miembro de este grupo" },
        { status: 403 }
      );
    }

    // 3. Load group data
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        GroupMember: {
          where: { isActive: true },
          include: {
            User: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            Agent: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Grupo no encontrado" },
        { status: 404 }
      );
    }

    // 4. Calculate time range
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get("range") || "7d"; // 7d, 30d, all

    const timeRangeMap: Record<string, Date | undefined> = {
      "7d": new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      "30d": new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      all: undefined,
    };

    const startDate = timeRangeMap[timeRange];

    // 5. Gather analytics data
    const [
      totalMessages,
      messagesByMember,
      messagesByDay,
      avgResponseTime,
      topWords,
      participationTrends,
    ] = await Promise.all([
      // Total messages
      prisma.groupMessage.count({
        where: {
          groupId,
          isSystemMessage: false,
          ...(startDate && { createdAt: { gte: startDate } }),
        },
      }),

      // Messages by member
      getMessagesByMember(groupId, startDate),

      // Messages by day
      getMessagesByDay(groupId, startDate),

      // Average response time
      calculateAvgResponseTime(groupId, startDate),

      // Top words/topics
      getTopWords(groupId, startDate),

      // Participation trends
      getParticipationTrends(groupId, startDate),
    ]);

    // 6. Calculate additional metrics
    const activityScore = calculateActivityScore(totalMessages, group.createdAt);
    const balanceScore = calculateBalanceScore(messagesByMember);
    const engagementRate = calculateEngagementRate(
      group.GroupMember.length,
      totalMessages
    );

    // 7. Relationship insights (based on interactions)
    const relationshipInsights = await analyzeRelationships(groupId, startDate);

    return NextResponse.json({
      overview: {
        totalMessages,
        totalMembers: group.GroupMember.length,
        activityScore,
        balanceScore,
        engagementRate,
        avgResponseTime,
      },
      participation: {
        byMember: messagesByMember,
        byDay: messagesByDay,
        trends: participationTrends,
      },
      content: {
        topWords,
      },
      relationships: relationshipInsights,
      metadata: {
        groupName: group.name,
        createdAt: group.createdAt,
        timeRange,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * Get message count by member
 */
async function getMessagesByMember(groupId: string, startDate?: Date) {
  const messages = await prisma.groupMessage.groupBy({
    by: ["authorType", "userId", "agentId"],
    where: {
      groupId,
      isSystemMessage: false,
      ...(startDate && { createdAt: { gte: startDate } }),
    },
    _count: {
      id: true,
    },
  });

  // Enrich with names
  const enriched = await Promise.all(
    messages.map(async (msg) => {
      if (msg.authorType === "user" && msg.userId) {
        const user = await prisma.user.findUnique({
          where: { id: msg.userId },
          select: { name: true, image: true },
        });

        return {
          type: "user",
          id: msg.userId,
          name: user?.name || "Usuario",
          image: user?.image,
          messageCount: msg._count.id,
        };
      } else if (msg.authorType === "agent" && msg.agentId) {
        const agent = await prisma.agent.findUnique({
          where: { id: msg.agentId },
          select: { name: true, avatar: true },
        });

        return {
          type: "agent",
          id: msg.agentId,
          name: agent?.name || "IA",
          avatar: agent?.avatar,
          messageCount: msg._count.id,
        };
      }

      return null;
    })
  );

  return enriched.filter((e) => e !== null).sort((a, b) => b!.messageCount - a!.messageCount);
}

/**
 * Get messages grouped by day
 */
async function getMessagesByDay(groupId: string, startDate?: Date) {
  const messages = await prisma.groupMessage.findMany({
    where: {
      groupId,
      isSystemMessage: false,
      ...(startDate && { createdAt: { gte: startDate } }),
    },
    select: {
      createdAt: true,
    },
  });

  // Group by day
  const byDay = new Map<string, number>();

  messages.forEach((msg) => {
    const day = msg.createdAt.toISOString().split("T")[0];
    byDay.set(day, (byDay.get(day) || 0) + 1);
  });

  // Convert to array and sort
  return Array.from(byDay.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate average response time (minutes)
 */
async function calculateAvgResponseTime(
  groupId: string,
  startDate?: Date
): Promise<number> {
  const messages = await prisma.groupMessage.findMany({
    where: {
      groupId,
      isSystemMessage: false,
      ...(startDate && { createdAt: { gte: startDate } }),
    },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      authorType: true,
    },
  });

  if (messages.length < 2) return 0;

  const responseTimes: number[] = [];

  for (let i = 1; i < messages.length; i++) {
    const prevMsg = messages[i - 1];
    const currMsg = messages[i];

    // Only count AI responses to user messages
    if (prevMsg.authorType === "user" && currMsg.authorType === "agent") {
      const diffMs =
        currMsg.createdAt.getTime() - prevMsg.createdAt.getTime();
      const diffMinutes = diffMs / (1000 * 60);
      responseTimes.push(diffMinutes);
    }
  }

  if (responseTimes.length === 0) return 0;

  const avg =
    responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  return Math.round(avg * 10) / 10; // Round to 1 decimal
}

/**
 * Get top words/topics
 */
async function getTopWords(groupId: string, startDate?: Date) {
  const messages = await prisma.groupMessage.findMany({
    where: {
      groupId,
      isSystemMessage: false,
      ...(startDate && { createdAt: { gte: startDate } }),
    },
    select: {
      content: true,
    },
  });

  // Simple word frequency analysis
  const wordCounts = new Map<string, number>();
  const stopWords = new Set([
    "el",
    "la",
    "de",
    "que",
    "y",
    "a",
    "en",
    "un",
    "ser",
    "se",
    "no",
    "haber",
    "por",
    "con",
    "su",
    "para",
    "como",
    "estar",
    "tener",
    "le",
    "lo",
    "todo",
    "pero",
    "más",
    "hacer",
    "o",
    "poder",
    "decir",
    "este",
    "ir",
    "otro",
    "ese",
    "the",
    "is",
    "at",
    "which",
    "on",
    "are",
    "as",
    "be",
    "was",
    "an",
    "have",
    "in",
    "it",
    "to",
    "for",
  ]);

  messages.forEach((msg) => {
    const words = msg.content
      .toLowerCase()
      .replace(/[^\w\sáéíóúñü]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

    words.forEach((word) => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
  });

  // Get top 20
  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Get participation trends
 */
async function getParticipationTrends(groupId: string, _startDate?: Date) {
  const members = await prisma.groupMember.findMany({
    where: {
      groupId,
      isActive: true,
    },
    select: {
      userId: true,
      agentId: true,
      memberType: true,
      totalMessages: true,
      lastMessageAt: true,
    },
  });

  return members.map((member) => ({
    id: member.userId || member.agentId,
    type: member.memberType,
    totalMessages: member.totalMessages,
    lastActive: member.lastMessageAt,
  }));
}

/**
 * Calculate activity score (0-100)
 */
function calculateActivityScore(totalMessages: number, createdAt: Date): number {
  const daysSinceCreation =
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceCreation === 0) return 50;

  const messagesPerDay = totalMessages / daysSinceCreation;

  // Score based on messages per day
  // 0-5: low, 5-20: medium, 20+: high
  const score = Math.min(messagesPerDay * 5, 100);

  return Math.round(score);
}

/**
 * Calculate balance score (0-1)
 */
function calculateBalanceScore(messagesByMember: any[]): number {
  if (messagesByMember.length === 0) return 1;

  const counts = messagesByMember.map((m) => m.messageCount);
  const avg = counts.reduce((sum, c) => sum + c, 0) / counts.length;

  // Calculate standard deviation
  const variance =
    counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation
  const cv = stdDev / (avg || 1);

  // Convert to 0-1 score (lower variation = higher score)
  const score = Math.exp(-cv);

  return Math.round(score * 100) / 100;
}

/**
 * Calculate engagement rate
 */
function calculateEngagementRate(
  totalMembers: number,
  totalMessages: number
): number {
  if (totalMembers === 0) return 0;

  const messagesPerMember = totalMessages / totalMembers;

  // Engagement score based on messages per member
  // 0-10: low, 10-50: medium, 50+: high
  const rate = Math.min(messagesPerMember / 50, 1);

  return Math.round(rate * 100) / 100;
}

/**
 * Analyze relationships between members
 */
async function analyzeRelationships(groupId: string, startDate?: Date) {
  // Get all messages with replies
  const messages = await prisma.groupMessage.findMany({
    where: {
      groupId,
      isSystemMessage: false,
      replyToId: { not: null },
      ...(startDate && { createdAt: { gte: startDate } }),
    },
    select: {
      authorType: true,
      userId: true,
      agentId: true,
      GroupMessage: {
        select: {
          authorType: true,
          userId: true,
          agentId: true,
        },
      },
    },
  });

  // Build interaction matrix
  const interactions = new Map<string, Map<string, number>>();

  messages.forEach((msg) => {
    if (!msg.GroupMessage) return;

    const fromId = msg.userId || msg.agentId;
    const toId = msg.GroupMessage.userId || msg.GroupMessage.agentId;

    if (!fromId || !toId) return;

    if (!interactions.has(fromId)) {
      interactions.set(fromId, new Map());
    }

    const fromMap = interactions.get(fromId)!;
    fromMap.set(toId, (fromMap.get(toId) || 0) + 1);
  });

  // Convert to array format
  const relationships = [];
  for (const [fromId, toMap] of interactions.entries()) {
    for (const [toId, count] of toMap.entries()) {
      relationships.push({
        from: fromId,
        to: toId,
        interactions: count,
      });
    }
  }

  return relationships.sort((a, b) => b.interactions - a.interactions).slice(0, 20);
}
