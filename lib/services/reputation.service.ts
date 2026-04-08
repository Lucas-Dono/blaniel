/** Reputation Service - Reputation system and gamification */

import { nanoid } from "nanoid";
import { prisma } from '@/lib/prisma';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  pointsRequired?: number;
  condition?: string;
}

export const BADGES: BadgeDefinition[] = [
  // AI Creator Badges
  { id: 'first_ai', name: 'First AI', description: 'Created your first AI', icon: '🤖', condition: 'aisCreated >= 1' },
  { id: 'ai_master', name: 'AI Master', description: 'Created 10 AIs', icon: '🎯', condition: 'aisCreated >= 10' },
  { id: 'ai_legend', name: 'AI Legend', description: 'Created 50 AIs', icon: '👑', condition: 'aisCreated >= 50' },
  { id: 'voice_master', name: 'Voice Master', description: 'Used voice chat 100 times', icon: '🎤', condition: 'voiceChats >= 100' },
  { id: 'multimodal_expert', name: 'Multimodal Expert', description: 'Used multimodal 50 times', icon: '🎬', condition: 'multimodalChats >= 50' },

  // Engagement Badges
  { id: 'streak_7', name: '7 Day Streak', description: 'Active 7 consecutive days', icon: '🔥', condition: 'currentStreak >= 7' },
  { id: 'streak_30', name: '30 Day Streak', description: 'Active 30 consecutive days', icon: '⚡', condition: 'currentStreak >= 30' },
  { id: 'streak_100', name: '100 Day Streak', description: 'Active 100 consecutive days', icon: '💎', condition: 'currentStreak >= 100' },
  { id: 'early_adopter', name: 'Early Adopter', description: 'Uno de los primeros usuarios', icon: '🌟', condition: 'isEarlyAdopter' },
  { id: 'power_user', name: 'Power User', description: 'Over 1000 messages sent', icon: '⚡', condition: 'messagesSent >= 1000' },

  // Sharer Badges
  { id: 'first_share', name: 'First Share', description: 'Shared your first AI', icon: '🔗', condition: 'sharedAIs >= 1' },
  { id: 'popular_creator', name: 'Popular Creator', description: '100 imports of your AIs', icon: '📈', condition: 'totalImports >= 100' },
  { id: 'liked_creator', name: 'Liked Creator', description: '1000 total likes', icon: '❤️', condition: 'totalLikes >= 1000' },

  // Community Badges
  { id: 'first_post', name: 'First Post', description: 'Created your first post', icon: '📝', condition: 'postCount >= 1' },
  { id: 'discussion_starter', name: 'Discussion Starter', description: 'Created 10 posts', icon: '💭', condition: 'postCount >= 10' },
  { id: 'helpful', name: 'Helpful', description: '10 accepted answers', icon: '🆘', condition: 'acceptedAnswers >= 10' },
  { id: 'award_giver', name: 'Award Giver', description: 'Gave 50 awards', icon: '🎁', condition: 'awardsGiven >= 50' },
  { id: 'event_winner', name: 'Event Winner', description: 'Won a contest', icon: '🏆', condition: 'eventsWon >= 1' },

  // Level-based Badges
  { id: 'bronze', name: 'Bronze', description: '100 reputation points', icon: '🥉', pointsRequired: 100 },
  { id: 'silver', name: 'Silver', description: '500 reputation points', icon: '🥈', pointsRequired: 500 },
  { id: 'gold', name: 'Gold', description: '1000 reputation points', icon: '🥇', pointsRequired: 1000 },
  { id: 'platinum', name: 'Platinum', description: '5000 reputation points', icon: '💍', pointsRequired: 5000 },
  { id: 'diamond', name: 'Diamond', description: '10000 reputation points', icon: '💎', pointsRequired: 10000 },

  // Special Badges
  { id: 'world_builder', name: 'World Builder', description: 'Created a world', icon: '🌍', condition: 'worldsCreated >= 1' },
  { id: 'behavior_expert', name: 'Behavior Expert', description: 'Configuraste 20 behaviors', icon: '🧠', condition: 'behaviorsConfigured >= 20' },
  { id: 'memory_keeper', name: 'Memory Keeper', description: 'Guardaste 100 eventos importantes', icon: '📚', condition: 'importantEvents >= 100' },
];

export const ReputationService = {
  /** Get user reputation */
  async getUserReputation(userId: string) {
    let reputation = await prisma.userReputation.findUnique({
      where: { userId },
      include: {
        UserBadge: {
          orderBy: { awardedAt: 'desc' },
        },
      },
    });

    if (!reputation) {
      reputation = await prisma.userReputation.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          userId,
        },
        include: { UserBadge: true },
      });
    }

    return reputation;
  },

  /**
   * Calcular nivel basado en puntos
   */
  calculateLevel(points: number): number {
    // Level = square root of (points / 100)
    return Math.floor(Math.sqrt(points / 100)) + 1;
  },

  /** Add reputation points */
  async addPoints(userId: string, points: number, _reason: string) {
    const reputation = await prisma.userReputation.upsert({
      where: { userId },
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        userId,
        totalPoints: points,
        level: this.calculateLevel(points),
      },
      update: {
        totalPoints: { increment: points },
      },
    });

    const newLevel = this.calculateLevel(reputation.totalPoints + points);

    if (newLevel > reputation.level) {
      await prisma.userReputation.update({
        where: { userId },
        data: { level: newLevel },
      });
    }

    // Verificar badges por puntos
    await this.checkAndAwardBadges(userId);

    return reputation;
  },

  /**
   * Verificar y otorgar badges
   */
  async checkAndAwardBadges(userId: string) {
    const reputation = await this.getUserReputation(userId);
    const existingBadges = reputation.UserBadge.map(b => b.badgeName);

    // Get user statistics
    const stats = await this.getUserStats(userId);

    const newBadges: string[] = [];

    for (const badge of BADGES) {
      if (existingBadges.includes(badge.name)) continue;

      let shouldAward = false;

      // Verificar por puntos
      if (badge.pointsRequired && reputation.totalPoints >= badge.pointsRequired) {
        shouldAward = true;
      }

      // Check by condition
      if (badge.condition) {
        shouldAward = this.evaluateCondition(badge.condition, stats);
      }

      if (shouldAward) {
        await prisma.userBadge.create({
          data: {
            id: nanoid(),
            userId,
            reputationId: reputation.id,
            badgeType: 'special',
            badgeName: badge.name,
            badgeLevel: 'bronze',
            description: badge.description,
            iconUrl: badge.icon,
          },
        });
        newBadges.push(badge.name);
      }
    }

    return newBadges;
  },

  /** Evaluate badge condition */
  evaluateCondition(condition: string, stats: any): boolean {
    try {
      // Create safe function to evaluate condition
      const fn = new Function(...Object.keys(stats), `return ${condition}`);
      return fn(...Object.values(stats));
    } catch {
      return false;
    }
  },

  /** Get user statistics */
  async getUserStats(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });

    const isEarlyAdopter = user ?
      user.createdAt < new Date('2025-01-01') : false;

    const [
      aisCreated,
      messagesSent,
      worldsCreated,
      behaviorsConfigured,
      importantEvents,
      postCount,
      commentCount,
      receivedUpvotes,
      acceptedAnswers,
      createdCommunities,
      researchProjects,
      researchContributions,
      publishedThemes,
      maxPostUpvotes,
      maxThemeDownloads,
      moderatorCount,
      sharedAIs,
      totalImports,
      totalLikes,
      reputation,
      userMessagesWithMetadata,
      awardsGiven,
      eventsData,
    ] = await Promise.all([
      prisma.agent.count({ where: { userId } }),
      prisma.directMessage.count({ where: { senderId: userId } }),
      Promise.resolve(0), // prisma.world.count({ where: { userId } }), // World model removed
      prisma.behaviorProfile.count({ where: { Agent: { userId } } }),
      prisma.importantEvent.count({ where: { userId } }),
      prisma.communityPost.count({ where: { authorId: userId, status: 'published' } }),
      prisma.communityComment.count({ where: { authorId: userId, status: 'published' } }),
      prisma.communityPost.aggregate({
        where: { authorId: userId },
        _sum: { upvotes: true },
      }),
      prisma.communityComment.count({ where: { authorId: userId, isAcceptedAnswer: true } }),
      prisma.community.count({ where: { ownerId: userId } }),
      prisma.researchProject.count({ where: { leadAuthorId: userId } }),
      prisma.researchContributor.count({ where: { userId } }),
      prisma.marketplaceTheme.count({ where: { authorId: userId, status: 'approved' } }),
      prisma.communityPost.findFirst({
        where: { authorId: userId },
        orderBy: { upvotes: 'desc' },
        select: { upvotes: true },
      }),
      prisma.marketplaceTheme.findFirst({
        where: { authorId: userId },
        orderBy: { downloadCount: 'desc' },
        select: { downloadCount: true },
      }),
      prisma.communityMember.count({ where: { userId, canModerate: true } }),
      prisma.agent.count({ where: { userId, visibility: "public" } }),
      prisma.agent.aggregate({
        where: { userId, visibility: "public" },
        _sum: { cloneCount: true },
      }),
      prisma.review.count({ where: { Agent: { userId } } }),
      prisma.userReputation.findUnique({
        where: { userId },
        select: { currentStreak: true },
      }),
      // Get all user messages with metadata to check messageType
      prisma.message.findMany({
        where: {
          userId,
          role: 'user', // Only count user's sent messages
        },
        select: { metadata: true },
      }),
      // Awards given to posts
      prisma.postAward.count({
        where: { giverId: userId },
      }),
      // Events won: events where user appears in winners JSON array
      prisma.communityEvent.findMany({
        where: {
          status: 'completed',
        },
        select: { winners: true },
      }),
    ]);

    // Count voice and multimodal chats by filtering metadata (single pass)
    let voiceChats = 0;
    let multimodalChats = 0;

    userMessagesWithMetadata.forEach((msg: any) => {
      const metadata = msg.metadata as any;
      const messageType = metadata?.messageType;

      if (messageType === 'audio') {
        voiceChats++;
      } else if (messageType === 'image' || messageType === 'gif') {
        multimodalChats++;
      }
    });

    // Count events won by checking if userId appears in winners array
    const eventsWon = eventsData.filter((event: any) => {
      const winners = event.winners as any;
      if (!Array.isArray(winners)) return false;
      return winners.some((winner: any) =>
        winner?.userId === userId || winner?.id === userId || winner === userId
      );
    }).length;

    return {
      aisCreated,
      messagesSent,
      voiceChats,
      multimodalChats,
      worldsCreated,
      behaviorsConfigured,
      importantEvents,
      sharedAIs,
      totalImports: totalImports._sum.cloneCount || 0,
      totalLikes,
      currentStreak: reputation?.currentStreak || 0,
      isEarlyAdopter,
      postCount,
      commentCount,
      receivedUpvotes: receivedUpvotes._sum.upvotes || 0,
      acceptedAnswers,
      createdCommunities,
      researchProjects,
      researchContributions,
      publishedThemes,
      maxPostUpvotes: maxPostUpvotes?.upvotes || 0,
      maxThemeDownloads: maxThemeDownloads?.downloadCount || 0,
      isModerator: moderatorCount > 0,
      awardsGiven,
      eventsWon,
    };
  },

  /**
   * Obtener leaderboard
   */
  async getLeaderboard(timeRange: 'day' | 'week' | 'month' | 'all' = 'all', limit = 50) {
    const where: any = {};

    if (timeRange !== 'all') {
      const now = new Date();
      const ranges = { day: 1, week: 7, month: 30 };
      const days = ranges[timeRange];
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      where.updatedAt = { gte: since };
    }

    const leaders = await prisma.userReputation.findMany({
      where,
      orderBy: [
        { totalPoints: 'desc' },
        { level: 'desc' },
      ],
      take: limit,
      include: {
        UserBadge: {
          orderBy: { awardedAt: 'desc' },
          take: 5,
        },
      },
    });

    // Fetch user data separately
    const userIds = leaders.map(l => l.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, image: true },
    });

    const usersMap = new Map(users.map(u => [u.id, u]));

    return leaders.map(leader => ({
      ...leader,
      user: usersMap.get(leader.userId) || null,
    }));
  },

  /**
   * Actualizar streak diario
   */
  async updateDailyStreak(userId: string) {
    const reputation = await this.getUserReputation(userId);
    const now = new Date();
    const lastActive = reputation.lastActiveDate;

    if (!lastActive) {
      // Primera actividad
      await prisma.userReputation.update({
        where: { userId },
        data: {
          currentStreak: 1,
          longestStreak: 1,
          lastActiveDate: now,
        },
      });
      return 1;
    }

    const daysSinceLastActive = Math.floor(
      (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastActive === 0) {
      // Same day
      return reputation.currentStreak;
    } else if (daysSinceLastActive === 1) {
      // Consecutive day
      const newStreak = reputation.currentStreak + 1;
      await prisma.userReputation.update({
        where: { userId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, reputation.longestStreak),
          lastActiveDate: now,
        },
      });
      return newStreak;
    } else {
      // Streak roto
      await prisma.userReputation.update({
        where: { userId },
        data: {
          currentStreak: 1,
          lastActiveDate: now,
        },
      });
      return 1;
    }
  },

  /** Award points for action */
  async awardPoints(userId: string, action: string) {
    const pointsByAction: Record<string, number> = {
      post_created: 5,
      post_upvoted: 2,
      post_viral: 50,
      comment_created: 2,
      comment_upvoted: 1,
      answer_accepted: 15,
      community_created: 20,
      theme_published: 10,
      theme_downloaded: 1,
      research_published: 25,
      event_won: 100,
      daily_login: 1,
    };

    const points = pointsByAction[action] || 0;
    if (points > 0) {
      await this.addPoints(userId, points, action);
    }

    return points;
  },
};
