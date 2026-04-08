/**
 * User Analytics Service - Estadísticas completas del usuario
 */

import { prisma } from '@/lib/prisma';
import { UserModerationService } from './user-moderation.service';

export const UserAnalyticsService = {
  /**
   * Get complete user statistics for their profile
   */
  async getUserStats(userId: string) {
    const [
      // Social Stats
      followersCount,
      followingCount,

      // Content Stats
      postsCount,
      commentsCount,

      // Engagement Stats
      totalUpvotes,
      totalAwards,

      // Community Stats
      communitiesCount,

      // Moderation Stats
      moderationStats,

      // Saved Content
      savedPostsCount,
    ] = await Promise.all([
      // Seguidores
      prisma.follow.count({
        where: { followingId: userId },
      }),

      // Siguiendo
      prisma.follow.count({
        where: { followerId: userId },
      }),

      // Posts publicados
      prisma.communityPost.count({
        where: {
          authorId: userId,
          status: 'published',
        },
      }),

      // Comentarios
      prisma.communityComment.count({
        where: {
          authorId: userId,
          status: 'published',
        },
      }),

      // Total de upvotes recibidos en posts
      prisma.communityPost.aggregate({
        where: {
          authorId: userId,
          status: 'published',
        },
        _sum: {
          upvotes: true,
        },
      }),

      // Total de awards recibidos
      prisma.postAward.count({
        where: {
          CommunityPost: {
            authorId: userId,
          },
        },
      }),

      // Comunidades a las que pertenece
      prisma.communityMember.count({
        where: {
          userId,
          isBanned: false,
        },
      }),

      // Personal moderation statistics
      UserModerationService.getModerationStats(userId),

      // Posts guardados
      // TODO: El modelo SavedPost no existe en el schema actual
      Promise.resolve(0),
    ]);

    // Calcular engagement rate (aproximado)
    const totalLikes = totalUpvotes._sum.upvotes || 0;
    const engagementRate = postsCount > 0
      ? Math.round((totalLikes / postsCount) * 100) / 100
      : 0;

    return {
      social: {
        followers: followersCount,
        following: followingCount,
      },
      content: {
        posts: postsCount,
        comments: commentsCount,
      },
      engagement: {
        totalLikes: totalLikes,
        totalAwards: totalAwards,
        averageLikesPerPost: engagementRate,
      },
      communities: {
        joined: communitiesCount,
      },
      moderation: {
        hiddenPosts: moderationStats.hiddenPosts,
        blockedUsers: moderationStats.blockedUsers,
        contentPreferences: moderationStats.contentPreferences,
        totalFiltered:
          moderationStats.hiddenPosts +
          moderationStats.blockedUsers +
          moderationStats.contentPreferences,
      },
      saved: {
        posts: savedPostsCount,
      },
    };
  },

  /**
   * Get user's most popular posts
   */
  async getTopPosts(userId: string, limit = 5) {
    return await prisma.communityPost.findMany({
      where: {
        authorId: userId,
        status: 'published',
      },
      orderBy: {
        upvotes: 'desc',
      },
      take: limit,
      select: {
        id: true,
        title: true,
        upvotes: true,
        commentCount: true,
        createdAt: true,
      },
    });
  },

  /**
   * Obtener actividad reciente del usuario
   */
  async getRecentActivity(userId: string, limit = 10) {
    const [recentPosts, recentComments] = await Promise.all([
      prisma.communityPost.findMany({
        where: {
          authorId: userId,
          status: 'published',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        select: {
          id: true,
          title: true,
          type: true,
          createdAt: true,
        },
      }),

      prisma.communityComment.findMany({
        where: {
          authorId: userId,
          status: 'published',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        select: {
          id: true,
          content: true,
          createdAt: true,
          postId: true,
        },
      }),
    ]);

    // Combinar y ordenar por fecha
    const activity = [
      ...recentPosts.map(p => ({ type: 'post' as const, data: p, date: p.createdAt })),
      ...recentComments.map(c => ({ type: 'comment' as const, data: c, date: c.createdAt })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    return activity;
  },

  /**
   * Obtener tendencias del usuario (mes actual vs mes anterior)
   */
  async getUserTrends(userId: string) {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [currentMonthPosts, lastMonthPosts, currentMonthComments, lastMonthComments] =
      await Promise.all([
        // Posts este mes
        prisma.communityPost.count({
          where: {
            authorId: userId,
            status: 'published',
            createdAt: { gte: currentMonthStart },
          },
        }),

        // Posts mes pasado
        prisma.communityPost.count({
          where: {
            authorId: userId,
            status: 'published',
            createdAt: {
              gte: lastMonthStart,
              lt: currentMonthStart,
            },
          },
        }),

        // Comentarios este mes
        prisma.communityComment.count({
          where: {
            authorId: userId,
            status: 'published',
            createdAt: { gte: currentMonthStart },
          },
        }),

        // Comentarios mes pasado
        prisma.communityComment.count({
          where: {
            authorId: userId,
            status: 'published',
            createdAt: {
              gte: lastMonthStart,
              lt: currentMonthStart,
            },
          },
        }),
      ]);

    const postsChange =
      lastMonthPosts > 0
        ? Math.round(((currentMonthPosts - lastMonthPosts) / lastMonthPosts) * 100)
        : 100;

    const commentsChange =
      lastMonthComments > 0
        ? Math.round(((currentMonthComments - lastMonthComments) / lastMonthComments) * 100)
        : 100;

    return {
      posts: {
        current: currentMonthPosts,
        previous: lastMonthPosts,
        change: postsChange,
      },
      comments: {
        current: currentMonthComments,
        previous: lastMonthComments,
        change: commentsChange,
      },
    };
  },
};
