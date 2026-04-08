/**
 * Personal Analytics Service
 * Comprehensive statistics for individual user progress and insights
 */

import { prisma } from "@/lib/prisma";
import { startOfDay, subDays, differenceInDays, differenceInHours } from "date-fns";

export interface PersonalOverview {
  totalAIsCreated: number;
  totalMessagesSent: number;
  totalTimeSpentHours: number;
  favoriteAI: {
    id: string;
    name: string;
    messageCount: number;
  } | null;
  currentStreak: number;
  longestStreak: number;
}

export interface MessagesPerDay {
  date: string;
  count: number;
}

export interface MostUsedAI {
  id: string;
  name: string;
  messageCount: number;
  lastUsed: Date;
}

export interface EmotionOverTime {
  date: string;
  emotions: Record<string, number>;
  avgValence: number;
  avgArousal: number;
}

export interface ChatSession {
  date: string;
  sessionCount: number;
  avgDuration: number;
}

export interface EmotionalAnalytics {
  emotionFrequency: Record<string, number>;
  emotionalJourney: Array<{
    timestamp: Date;
    event: string;
    emotion: string;
    intensity: number;
  }>;
  moodTrends: {
    valence: Array<{ date: string; value: number }>;
    arousal: Array<{ date: string; value: number }>;
    dominance: Array<{ date: string; value: number }>;
  };
  happiestAI: {
    id: string;
    name: string;
    avgValence: number;
  } | null;
  mostComfortingAI: {
    id: string;
    name: string;
    comfortScore: number;
  } | null;
}

export interface RelationshipProgress {
  relationships: Array<{
    agentId: string;
    agentName: string;
    currentStage: string;
    trust: number;
    affinity: number;
    respect: number;
    progressToNext: number;
    daysSinceCreation: number;
    milestones: string[];
  }>;
}

export interface UsageInsights {
  insights: string[];
  patterns: {
    mostActiveDay: string;
    mostActiveHour: number;
    avgSessionDuration: number;
    preferredConversationType: string;
    emotionalTendency: string;
  };
  comparisons: {
    vsAverage: {
      messagesPerDay: number;
      emotionalIntensity: number;
      sessionDuration: number;
    };
    percentile: number;
  };
}

export interface CommunityImpact {
  postKarma: number;
  commentKarma: number;
  aisShared: number;
  aisImported: number;
  helpfulAnswers: number;
  followersThisMonth: number;
}

/**
 * Get personal overview statistics
 */
export async function getPersonalOverview(userId: string): Promise<PersonalOverview> {
  const [agents, messages, _relations, usageRecords] = await Promise.all([
    prisma.agent.count({ where: { userId } }),
    prisma.message.count({ where: { userId, role: "user" } }),
    prisma.relation.findMany({
      where: { targetId: userId, targetType: "user" },
      include: {
        Agent: { select: { id: true, name: true, createdAt: true } },
      },
    }),
    prisma.usage.findMany({
      where: { userId, resourceType: "message" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  // Calculate total time spent (estimate based on message frequency)
  let totalTimeSpentHours = 0;
  if (usageRecords.length > 1) {
    const sessions: Date[][] = [];
    let currentSession: Date[] = [usageRecords[0].createdAt];

    for (let i = 1; i < usageRecords.length; i++) {
      const timeDiff = differenceInHours(usageRecords[i].createdAt, usageRecords[i - 1].createdAt);
      if (timeDiff < 1) {
        currentSession.push(usageRecords[i].createdAt);
      } else {
        sessions.push(currentSession);
        currentSession = [usageRecords[i].createdAt];
      }
    }
    sessions.push(currentSession);

    totalTimeSpentHours = sessions.reduce((total, session) => {
      if (session.length < 2) return total + 0.1; // Estimate 6 minutes per single message
      const sessionDuration = differenceInHours(
        session[session.length - 1],
        session[0]
      );
      return total + Math.max(sessionDuration, 0.1);
    }, 0);
  }

  // Find favorite AI (most messages)
  const agentMessages = await prisma.message.groupBy({
    by: ["agentId"],
    where: { userId, role: "user", agentId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  });

  let favoriteAI = null;
  if (agentMessages.length > 0 && agentMessages[0].agentId) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentMessages[0].agentId },
      select: { id: true, name: true },
    });
    if (agent) {
      favoriteAI = {
        id: agent.id,
        name: agent.name,
        messageCount: agentMessages[0]._count.id,
      };
    }
  }

  // Calculate streak
  const { currentStreak, longestStreak } = calculateStreaks(usageRecords.map(r => r.createdAt));

  return {
    totalAIsCreated: agents,
    totalMessagesSent: messages,
    totalTimeSpentHours: Math.round(totalTimeSpentHours * 10) / 10,
    favoriteAI,
    currentStreak,
    longestStreak,
  };
}

/**
 * Calculate current and longest streaks
 */
function calculateStreaks(dates: Date[]): { currentStreak: number; longestStreak: number } {
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const uniqueDays = [...new Set(dates.map(d => startOfDay(d).toISOString()))];
  uniqueDays.sort();

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  const today = startOfDay(new Date());
  const lastDay = startOfDay(new Date(uniqueDays[uniqueDays.length - 1]));

  // Check if streak is current
  if (differenceInDays(today, lastDay) <= 1) {
    currentStreak = 1;
  }

  for (let i = uniqueDays.length - 2; i >= 0; i--) {
    const current = new Date(uniqueDays[i]);
    const next = new Date(uniqueDays[i + 1]);
    const diff = differenceInDays(next, current);

    if (diff === 1) {
      tempStreak++;
      if (currentStreak > 0) currentStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
      if (currentStreak > 0) break;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak);

  return { currentStreak, longestStreak };
}

/**
 * Get messages per day for the last N days
 */
export async function getMessagesPerDay(userId: string, days: number = 30): Promise<MessagesPerDay[]> {
  const startDate = subDays(new Date(), days);

  // Get all user messages in the period
  const messages = await prisma.message.findMany({
    where: {
      userId,
      role: "user",
      createdAt: { gte: startDate },
    },
    select: {
      createdAt: true,
    },
  });

  // Initialize all days with 0
  const messagesByDay: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const date = subDays(new Date(), days - i - 1);
    const dateStr = startOfDay(date).toISOString().split("T")[0];
    messagesByDay[dateStr] = 0;
  }

  // Count messages per day
  messages.forEach((msg) => {
    const dateStr = startOfDay(msg.createdAt).toISOString().split("T")[0];
    if (messagesByDay[dateStr] !== undefined) {
      messagesByDay[dateStr]++;
    }
  });

  return Object.entries(messagesByDay).map(([date, count]) => ({ date, count }));
}

/**
 * Get most used AIs
 */
export async function getMostUsedAIs(userId: string, limit: number = 5): Promise<MostUsedAI[]> {
  const agentMessages = await prisma.message.groupBy({
    by: ["agentId"],
    where: { userId, role: "user", agentId: { not: null } },
    _count: { id: true },
    _max: { createdAt: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  const agents = await prisma.agent.findMany({
    where: { id: { in: agentMessages.map(am => am.agentId!).filter(Boolean) } },
    select: { id: true, name: true },
  });

  return agentMessages
    .filter(am => am.agentId)
    .map((am) => {
      const agent = agents.find(a => a.id === am.agentId);
      return {
        id: am.agentId!,
        name: agent?.name || "Unknown",
        messageCount: am._count.id,
        lastUsed: am._max.createdAt || new Date(),
      };
    });
}

/**
 * Get emotional analytics
 */
export async function getEmotionalAnalytics(userId: string, days: number = 30): Promise<EmotionalAnalytics> {
  const startDate = subDays(new Date(), days);

  const messages = await prisma.message.findMany({
    where: {
      userId,
      role: "assistant",
      createdAt: { gte: startDate },
    },
    select: {
      createdAt: true,
      content: true,
      metadata: true,
      agentId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const emotionFrequency: Record<string, number> = {};
  const emotionalJourney: Array<{ timestamp: Date; event: string; emotion: string; intensity: number }> = [];
  const valenceTrends: Array<{ date: string; value: number; count: number }> = [];
  const arousalTrends: Array<{ date: string; value: number; count: number }> = [];
  const dominanceTrends: Array<{ date: string; value: number; count: number }> = [];

  const agentEmotions: Record<string, { totalValence: number; count: number }> = {};

  messages.forEach((msg) => {
    const metadata = msg.metadata as any;
    if (metadata && typeof metadata === "object") {
      const emotions = metadata.emotions || metadata.currentEmotions;
      const mood = metadata.mood || {};

      // Track emotion frequency
      if (Array.isArray(emotions)) {
        emotions.forEach((emotion: string) => {
          emotionFrequency[emotion] = (emotionFrequency[emotion] || 0) + 1;
        });
      } else if (typeof emotions === "object") {
        Object.entries(emotions).forEach(([emotion, intensity]) => {
          if (typeof intensity === "number" && intensity > 0.3) {
            emotionFrequency[emotion] = (emotionFrequency[emotion] || 0) + 1;
          }
        });
      }

      // Track mood trends
      const dateStr = startOfDay(msg.createdAt).toISOString().split("T")[0];
      if (typeof mood.moodValence === "number") {
        const existing = valenceTrends.find(t => t.date === dateStr);
        if (existing) {
          existing.value += mood.moodValence;
          existing.count++;
        } else {
          valenceTrends.push({ date: dateStr, value: mood.moodValence, count: 1 });
        }
      }
      if (typeof mood.moodArousal === "number") {
        const existing = arousalTrends.find(t => t.date === dateStr);
        if (existing) {
          existing.value += mood.moodArousal;
          existing.count++;
        } else {
          arousalTrends.push({ date: dateStr, value: mood.moodArousal, count: 1 });
        }
      }
      if (typeof mood.moodDominance === "number") {
        const existing = dominanceTrends.find(t => t.date === dateStr);
        if (existing) {
          existing.value += mood.moodDominance;
          existing.count++;
        } else {
          dominanceTrends.push({ date: dateStr, value: mood.moodDominance, count: 1 });
        }
      }

      // Track per-agent valence
      if (msg.agentId && typeof mood.moodValence === "number") {
        if (!agentEmotions[msg.agentId]) {
          agentEmotions[msg.agentId] = { totalValence: 0, count: 0 };
        }
        agentEmotions[msg.agentId].totalValence += mood.moodValence;
        agentEmotions[msg.agentId].count++;
      }

      // Create emotional journey entries for significant emotions
      if (Array.isArray(emotions) && emotions.length > 0) {
        emotionalJourney.push({
          timestamp: msg.createdAt,
          event: msg.content.slice(0, 100),
          emotion: emotions[0],
          intensity: 0.8,
        });
      }
    }
  });

  // Find happiest AI
  let happiestAI = null;
  if (Object.keys(agentEmotions).length > 0) {
    const happiest = Object.entries(agentEmotions).reduce((max, [id, data]) => {
      const avgValence = data.totalValence / data.count;
      return avgValence > max.avgValence ? { id, avgValence } : max;
    }, { id: "", avgValence: -Infinity });

    if (happiest.id) {
      const agent = await prisma.agent.findUnique({
        where: { id: happiest.id },
        select: { id: true, name: true },
      });
      if (agent) {
        happiestAI = {
          id: agent.id,
          name: agent.name,
          avgValence: happiest.avgValence,
        };
      }
    }
  }

  // Calculate most comforting AI
  // An AI is "comforting" if it helps stabilize/reduce arousal (calming effect)
  // and maintains positive valence (soothing, not depressing)
  let mostComfortingAI = null;
  const agentComfortScores: Record<string, { arousalReduction: number; positiveValence: number; count: number }> = {};

  messages.forEach((msg) => {
    const metadata = msg.metadata as any;
    if (metadata && typeof metadata === "object" && msg.agentId) {
      const mood = metadata.mood || {};

      // Track arousal (lower arousal = more calming) and positive valence
      if (typeof mood.moodArousal === "number" && typeof mood.moodValence === "number") {
        if (!agentComfortScores[msg.agentId]) {
          agentComfortScores[msg.agentId] = { arousalReduction: 0, positiveValence: 0, count: 0 };
        }

        // Lower arousal is better for comfort (invert the score: 1 - arousal gives higher score for lower arousal)
        agentComfortScores[msg.agentId].arousalReduction += (1 - Math.abs(mood.moodArousal));
        agentComfortScores[msg.agentId].positiveValence += mood.moodValence;
        agentComfortScores[msg.agentId].count++;
      }
    }
  });

  if (Object.keys(agentComfortScores).length > 0) {
    const mostComforting = Object.entries(agentComfortScores).reduce((max, [id, data]) => {
      // Comfort score: combination of calming effect (low arousal) and positive emotions
      // Weight: 60% calming effect, 40% positive valence
      const avgArousalReduction = data.arousalReduction / data.count;
      const avgPositiveValence = data.positiveValence / data.count;
      const comfortScore = (avgArousalReduction * 0.6) + (avgPositiveValence * 0.4);

      return comfortScore > max.comfortScore ? { id, comfortScore } : max;
    }, { id: "", comfortScore: -Infinity });

    if (mostComforting.id && mostComforting.comfortScore > 0) {
      const agent = await prisma.agent.findUnique({
        where: { id: mostComforting.id },
        select: { id: true, name: true },
      });
      if (agent) {
        mostComfortingAI = {
          id: agent.id,
          name: agent.name,
          comfortScore: mostComforting.comfortScore,
        };
      }
    }
  }

  return {
    emotionFrequency,
    emotionalJourney: emotionalJourney.slice(-20), // Last 20 significant events
    moodTrends: {
      valence: valenceTrends.map(t => ({ date: t.date, value: t.value / t.count })),
      arousal: arousalTrends.map(t => ({ date: t.date, value: t.value / t.count })),
      dominance: dominanceTrends.map(t => ({ date: t.date, value: t.value / t.count })),
    },
    happiestAI,
    mostComfortingAI,
  };
}

/**
 * Get relationship progress
 */
export async function getRelationshipProgress(userId: string): Promise<RelationshipProgress> {
  const relations = await prisma.relation.findMany({
    where: { targetId: userId, targetType: "user" },
    include: {
      Agent: {
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      },
    },
  });

  const relationships = relations.map((rel) => {
    const trust = rel.trust;
    const affinity = rel.affinity;
    const respect = rel.respect;

    // Calculate relationship stage based on metrics
    const avgScore = (trust + affinity + respect) / 3;
    let currentStage = "stranger";
    let progressToNext = 0;

    if (avgScore < 0.2) {
      currentStage = "stranger";
      progressToNext = (avgScore / 0.2) * 100;
    } else if (avgScore < 0.4) {
      currentStage = "acquaintance";
      progressToNext = ((avgScore - 0.2) / 0.2) * 100;
    } else if (avgScore < 0.6) {
      currentStage = "friend";
      progressToNext = ((avgScore - 0.4) / 0.2) * 100;
    } else if (avgScore < 0.8) {
      currentStage = "close";
      progressToNext = ((avgScore - 0.6) / 0.2) * 100;
    } else {
      currentStage = "intimate";
      progressToNext = 100;
    }

    const daysSinceCreation = rel.Agent ? differenceInDays(new Date(), rel.Agent.createdAt) : 0;

    // Generate milestones
    const milestones: string[] = [];
    if (trust > 0.3) milestones.push("First Trust");
    if (affinity > 0.5) milestones.push("Strong Bond");
    if (respect > 0.6) milestones.push("Deep Respect");
    if (avgScore > 0.7) milestones.push("Close Relationship");

    return {
      agentId: rel.Agent?.id || rel.subjectId,
      agentName: rel.Agent?.name || "Unknown",
      currentStage,
      trust,
      affinity,
      respect,
      progressToNext,
      daysSinceCreation,
      milestones,
    };
  });

  return { relationships };
}

/**
 * Get usage insights using AI-like pattern detection
 */
export async function getUsageInsights(userId: string): Promise<UsageInsights> {
  const [messages, overview, emotional] = await Promise.all([
    prisma.message.findMany({
      where: { userId, role: "user" },
      select: { createdAt: true, content: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    getPersonalOverview(userId),
    getEmotionalAnalytics(userId),
  ]);

  const insights: string[] = [];

  // Analyze activity patterns
  const hourCounts: Record<number, number> = {};
  const dayCounts: Record<string, number> = {};

  messages.forEach((msg) => {
    const hour = msg.createdAt.getHours();
    const day = msg.createdAt.toLocaleDateString("en-US", { weekday: "long" });
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });

  const mostActiveHour = Object.entries(hourCounts).reduce((max, [hour, count]) =>
    count > max.count ? { hour: parseInt(hour), count } : max, { hour: 0, count: 0 }
  ).hour;

  const mostActiveDay = Object.entries(dayCounts).reduce((max, [day, count]) =>
    count > max.count ? { day, count } : max, { day: "Unknown", count: 0 }
  ).day;

  // Generate insights
  if (dayCounts["Saturday"] || dayCounts["Sunday"]) {
    const weekendTotal = (dayCounts["Saturday"] || 0) + (dayCounts["Sunday"] || 0);
    const weekdayTotal = messages.length - weekendTotal;
    if (weekendTotal > weekdayTotal * 0.5) {
      insights.push("You're most active on weekends");
    }
  }

  if (mostActiveHour >= 22 || mostActiveHour <= 5) {
    insights.push("You prefer late-night conversations");
  } else if (mostActiveHour >= 6 && mostActiveHour <= 10) {
    insights.push("You're an early morning conversationalist");
  }

  if (overview.currentStreak >= 7) {
    insights.push(`Impressive ${overview.currentStreak}-day streak!`);
  }

  const avgMessageLength = messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length;
  if (avgMessageLength > 100) {
    insights.push("You prefer deep, detailed conversations");
  } else if (avgMessageLength < 30) {
    insights.push("You enjoy quick, casual chats");
  }

  const topEmotion = Object.entries(emotional.emotionFrequency).reduce((max, [emotion, count]) =>
    count > max.count ? { emotion, count } : max, { emotion: "curiosity", count: 0 }
  ).emotion;

  insights.push(`Your most common emotion is ${topEmotion}`);

  if (overview.totalTimeSpentHours > 50) {
    insights.push(`You've spent ${overview.totalTimeSpentHours} hours in meaningful conversations`);
  }

  return {
    insights,
    patterns: {
      mostActiveDay,
      mostActiveHour,
      avgSessionDuration: overview.totalTimeSpentHours / Math.max(messages.length / 10, 1),
      preferredConversationType: avgMessageLength > 100 ? "deep" : "casual",
      emotionalTendency: topEmotion,
    },
    comparisons: {
      vsAverage: {
        messagesPerDay: overview.totalMessagesSent / Math.max(differenceInDays(new Date(), new Date(messages[messages.length - 1]?.createdAt || new Date())), 1),
        emotionalIntensity: 1.0,
        sessionDuration: 1.0,
      },
      percentile: 75, // Placeholder
    },
  };
}

/**
 * Get community impact statistics
 */
export async function getCommunityImpact(userId: string): Promise<CommunityImpact> {
  const _startOfMonth = subDays(new Date(), 30);

  const [posts, comments, sharedAgents] = await Promise.all([
    prisma.communityPost.findMany({
      where: { authorId: userId },
      select: { upvotes: true, downvotes: true },
    }),
    prisma.communityComment.findMany({
      where: { authorId: userId },
      select: { upvotes: true, downvotes: true },
    }),
    prisma.agent.count({
      where: { userId, visibility: "public" },
    }),
  ]);

  const postKarma = posts.reduce((sum, post) => {
    return sum + (post.upvotes - post.downvotes);
  }, 0);

  const commentKarma = comments.reduce((sum, comment) => {
    return sum + (comment.upvotes - comment.downvotes);
  }, 0);

  return {
    postKarma,
    commentKarma,
    aisShared: sharedAgents,
    aisImported: 0, // Would need to track clones
    helpfulAnswers: comments.filter(c => c.upvotes > 0).length,
    followersThisMonth: 0, // Would need followers system
  };
}
