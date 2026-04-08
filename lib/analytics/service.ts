/**
 * Analytics Service
 * Aggregates and analyzes usage data for comprehensive insights
 */

import { prisma } from "@/lib/prisma";
import {startOfDay, subDays} from "date-fns";

export type TimeRange = "24h" | "7d" | "30d" | "90d" | "1y" | "all";
export type MetricType = "messages" | "tokens" | "agents" | "users" | "revenue";

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  label: string;
}

export interface AgentStats {
  agentId: string;
  agentName: string;
  messageCount: number;
  tokenCount: number;
  avgResponseLength: number;
  avgSentiment: number;
  uniqueUsers: number;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  churnRate: number;
  avgMessagesPerUser: number;
}

export interface UsageStats {
  totalMessages: number;
  totalTokens: number;
  totalAgents: number;
  avgMessagesPerDay: number;
  peakHour: number;
  peakDay: string;
}

export interface RevenueStats {
  totalRevenue: number;
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  avgRevenuePerUser: number;
  lifetimeValue: number;
  subscriptionsByPlan: Record<string, number>;
}

export interface EmotionalStats {
  avgTrust: number;
  avgAffinity: number;
  avgRespect: number;
  emotionDistribution: Record<string, number>;
  relationshipLevels: Record<string, number>;
}

export interface DashboardStats {
  overview: {
    totalMessages: number;
    totalAgents: number;
    totalUsers: number;
    activeToday: number;
  };
  usage: UsageStats;
  users: UserStats;
  revenue: RevenueStats;
  emotional: EmotionalStats;
  topAgents: AgentStats[];
  timeSeries: {
    messages: TimeSeriesPoint[];
    tokens: TimeSeriesPoint[];
    users: TimeSeriesPoint[];
  };
}

/**
 * Get date range for analysis
 */
function getDateRange(range: TimeRange): { start: Date; end: Date } {
  const end = new Date();
  let start: Date;

  switch (range) {
    case "24h":
      start = subDays(end, 1);
      break;
    case "7d":
      start = subDays(end, 7);
      break;
    case "30d":
      start = subDays(end, 30);
      break;
    case "90d":
      start = subDays(end, 90);
      break;
    case "1y":
      start = subDays(end, 365);
      break;
    case "all":
      start = new Date(0); // Beginning of time
      break;
    default:
      start = subDays(end, 30);
  }

  return { start, end };
}

/**
 * Get usage statistics
 */
export async function getUsageStats(
  userId: string,
  range: TimeRange = "30d"
): Promise<UsageStats> {
  const { start, end } = getDateRange(range);

  const [messages, tokens, agents] = await Promise.all([
    prisma.usage.count({
      where: {
        userId,
        resourceType: "message",
        createdAt: { gte: start, lte: end },
      },
    }),
    prisma.usage.aggregate({
      where: {
        userId,
        resourceType: "tokens",
        createdAt: { gte: start, lte: end },
      },
      _sum: { quantity: true },
    }),
    prisma.agent.count({
      where: { userId },
    }),
  ]);

  const days = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const avgMessagesPerDay = messages / days;

  // Get peak hour
  const messagesByHour = await prisma.usage.groupBy({
    by: ["createdAt"],
    where: {
      userId,
      resourceType: "message",
      createdAt: { gte: start, lte: end },
    },
  });

  const hourCounts = new Array(24).fill(0);
  messagesByHour.forEach((item) => {
    const hour = new Date(item.createdAt).getHours();
    hourCounts[hour]++;
  });

  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

  // Get peak day
  const messagesByDay = await prisma.usage.groupBy({
    by: ["createdAt"],
    where: {
      userId,
      resourceType: "message",
      createdAt: { gte: start, lte: end },
    },
  });

  const dayCounts: Record<string, number> = {};
  messagesByDay.forEach((item) => {
    const day = new Date(item.createdAt).toLocaleDateString();
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });

  const peakDay =
    Object.keys(dayCounts).reduce((a, b) => (dayCounts[a] > dayCounts[b] ? a : b), "") ||
    "N/A";

  return {
    totalMessages: messages,
    totalTokens: tokens._sum.quantity || 0,
    totalAgents: agents,
    avgMessagesPerDay,
    peakHour,
    peakDay,
  };
}

/**
 * Get user statistics
 */
export async function getUserStats(
  userId: string,
  range: TimeRange = "30d"
): Promise<UserStats> {
  const { start, end } = getDateRange(range);

  // For single user, just return their stats
  const totalUsers = 1;
  const activeUsers = 1;

  const messages = await prisma.usage.count({
    where: {
      userId,
      resourceType: "message",
      createdAt: { gte: start, lte: end },
    },
  });

  return {
    totalUsers,
    activeUsers,
    newUsers: 0,
    churnRate: 0,
    avgMessagesPerUser: messages,
  };
}

/**
 * Get revenue statistics
 */
export async function getRevenueStats(
  userId: string,
  range: TimeRange = "30d"
): Promise<RevenueStats> {
  const { start, end } = getDateRange(range);

  const [subscriptions, invoices, user] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        userId,
        status: "active",
      },
    }),
    prisma.invoice.findMany({
      where: {
        userId,
        status: "paid",
        paidAt: { gte: start, lte: end },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, createdAt: true },
    }),
  ]);

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount, 0) / 100; // Convert from cents

  // Calculate MRR (Monthly Recurring Revenue)
  let mrr = 0;
  if (user?.plan === "plus") mrr = 5;
  if (user?.plan === "ultra") mrr = 15;

  const arr = mrr * 12;

  const subscriptionsByPlan: Record<string, number> = {
    free: user?.plan === "free" ? 1 : 0,
    plus: user?.plan === "plus" ? 1 : 0,
    ultra: user?.plan === "ultra" ? 1 : 0,
  };

  // Calculate lifetime value (simplified)
  const accountAge = user?.createdAt
    ? (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
    : 1;
  const lifetimeValue = mrr * accountAge;

  return {
    totalRevenue,
    mrr,
    arr,
    avgRevenuePerUser: totalRevenue,
    lifetimeValue,
    subscriptionsByPlan,
  };
}

/**
 * Get emotional statistics
 */
export async function getEmotionalStats(
  userId: string,
  range: TimeRange = "30d"
): Promise<EmotionalStats> {
  const { start, end } = getDateRange(range);

  const relations = await prisma.relation.findMany({
    where: {
      targetId: userId,
      targetType: "user",
      updatedAt: { gte: start, lte: end },
    },
  });

  if (relations.length === 0) {
    return {
      avgTrust: 0.5,
      avgAffinity: 0.5,
      avgRespect: 0.5,
      emotionDistribution: {},
      relationshipLevels: {},
    };
  }

  const avgTrust = relations.reduce((sum, r) => sum + r.trust, 0) / relations.length;
  const avgAffinity = relations.reduce((sum, r) => sum + r.affinity, 0) / relations.length;
  const avgRespect = relations.reduce((sum, r) => sum + r.respect, 0) / relations.length;

  // Get emotion distribution from messages
  const messages = await prisma.message.findMany({
    where: {
      userId,
      role: "assistant",
      createdAt: { gte: start, lte: end },
    },
    select: { metadata: true },
  });

  const emotionDistribution: Record<string, number> = {};
  const relationshipLevels: Record<string, number> = {};

  messages.forEach((msg) => {
    const metadata = msg.metadata as any;
    if (metadata && typeof metadata === 'object') {
      if (metadata.emotions) {
        metadata.emotions.forEach((emotion: string) => {
          emotionDistribution[emotion] = (emotionDistribution[emotion] || 0) + 1;
        });
      }
      if (metadata.relationLevel) {
        const level = metadata.relationLevel;
        relationshipLevels[level] = (relationshipLevels[level] || 0) + 1;
      }
    }
  });

  return {
    avgTrust,
    avgAffinity,
    avgRespect,
    emotionDistribution,
    relationshipLevels,
  };
}

/**
 * Get agent statistics
 */
export async function getAgentStats(
  userId: string,
  range: TimeRange = "30d",
  limit: number = 10
): Promise<AgentStats[]> {
  const { start, end } = getDateRange(range);

  const agents = await prisma.agent.findMany({
    where: { userId },
    include: {
      Message: {
        where: { createdAt: { gte: start, lte: end } },
        select: {
          role: true,
          content: true,
          metadata: true,
          userId: true,
        },
      },
      Relation: {
        where: { updatedAt: { gte: start, lte: end } },
      },
    },
  });

  const stats: AgentStats[] = agents.map((agent) => {
    const messages = agent.Message;
    const assistantMessages = messages.filter((m: { role: string }) => m.role === "assistant");

    const messageCount = messages.length;
    const tokenCount = assistantMessages.reduce((sum: number, m: { metadata: any }) => {
      const metadata = m.metadata as any;
      return sum + (metadata?.tokensUsed || 0);
    }, 0);

    const avgResponseLength =
      assistantMessages.length > 0
        ? assistantMessages.reduce((sum: number, m: { content: string }) => sum + m.content.length, 0) /
          assistantMessages.length
        : 0;

    // Calculate avg sentiment from relations
    const relations = agent.Relation;
    const avgSentiment =
      relations.length > 0
        ? relations.reduce(
            (sum: number, r: { trust: number; affinity: number; respect: number }) => sum + (r.trust + r.affinity + r.respect) / 3,
            0
          ) / relations.length
        : 0.5;

    const uniqueUsers = new Set(messages.map((m: { userId: string | null }) => m.userId).filter(Boolean)).size;

    return {
      agentId: agent.id,
      agentName: agent.name,
      messageCount,
      tokenCount,
      avgResponseLength,
      avgSentiment,
      uniqueUsers,
    };
  });

  // Sort by message count and limit
  return stats.sort((a, b) => b.messageCount - a.messageCount).slice(0, limit);
}

/**
 * Get time series data for a metric
 */
export async function getTimeSeriesData(
  userId: string,
  metric: MetricType,
  range: TimeRange = "30d"
): Promise<TimeSeriesPoint[]> {
  const { start, end } = getDateRange(range);

  let resourceType: string;
  switch (metric) {
    case "messages":
      resourceType = "message";
      break;
    case "tokens":
      resourceType = "tokens";
      break;
    default:
      resourceType = "message";
  }

  const usage = await prisma.usage.findMany({
    where: {
      userId,
      resourceType,
      createdAt: { gte: start, lte: end },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by day
  const pointsByDay: Record<string, number> = {};

  usage.forEach((item) => {
    const day = startOfDay(item.createdAt).toISOString();
    pointsByDay[day] = (pointsByDay[day] || 0) + item.quantity;
  });

  return Object.entries(pointsByDay).map(([timestamp, value]) => ({
    timestamp: new Date(timestamp),
    value,
    label: new Date(timestamp).toLocaleDateString(),
  }));
}

/**
 * Get complete dashboard statistics
 */
export async function getDashboardStats(
  userId: string,
  range: TimeRange = "30d"
): Promise<DashboardStats> {
  const [usage, users, revenue, emotional, topAgents] = await Promise.all([
    getUsageStats(userId, range),
    getUserStats(userId, range),
    getRevenueStats(userId, range),
    getEmotionalStats(userId, range),
    getAgentStats(userId, range, 5),
  ]);

  const [messagesTimeSeries, tokensTimeSeries, usersTimeSeries] = await Promise.all([
    getTimeSeriesData(userId, "messages", range),
    getTimeSeriesData(userId, "tokens", range),
    getTimeSeriesData(userId, "users", range),
  ]);

  // Get today's active count
  const activeToday = await prisma.usage.count({
    where: {
      userId,
      resourceType: "message",
      createdAt: { gte: startOfDay(new Date()) },
    },
  });

  return {
    overview: {
      totalMessages: usage.totalMessages,
      totalAgents: usage.totalAgents,
      totalUsers: users.totalUsers,
      activeToday,
    },
    usage,
    users,
    revenue,
    emotional,
    topAgents,
    timeSeries: {
      messages: messagesTimeSeries,
      tokens: tokensTimeSeries,
      users: usersTimeSeries,
    },
  };
}

/**
 * Export analytics data to CSV
 */
export async function exportAnalyticsCSV(
  userId: string,
  range: TimeRange = "30d"
): Promise<string> {
  const stats = await getDashboardStats(userId, range);

  const csv = [
    "Metric,Value",
    `Total Messages,${stats.overview.totalMessages}`,
    `Total Agents,${stats.overview.totalAgents}`,
    `Total Tokens,${stats.usage.totalTokens}`,
    `Average Messages Per Day,${stats.usage.avgMessagesPerDay.toFixed(2)}`,
    `Peak Hour,${stats.usage.peakHour}:00`,
    `Peak Day,${stats.usage.peakDay}`,
    `MRR,$${stats.revenue.mrr}`,
    `ARR,$${stats.revenue.arr}`,
    `Average Trust,${(stats.emotional.avgTrust * 100).toFixed(1)}%`,
    `Average Affinity,${(stats.emotional.avgAffinity * 100).toFixed(1)}%`,
    `Average Respect,${(stats.emotional.avgRespect * 100).toFixed(1)}%`,
    "",
    "Top Agents",
    "Agent Name,Messages,Tokens,Avg Response Length,Sentiment,Unique Users",
    ...stats.topAgents.map(
      (agent) =>
        `${agent.agentName},${agent.messageCount},${agent.tokenCount},${agent.avgResponseLength.toFixed(0)},${(agent.avgSentiment * 100).toFixed(1)}%,${agent.uniqueUsers}`
    ),
  ].join("\n");

  return csv;
}
