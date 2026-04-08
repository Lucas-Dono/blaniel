/** Feed Service - Simple algorithmic feed (without ML) */

import { prisma } from '@/lib/prisma';
import { UserModerationService } from './user-moderation.service';

/**
 * Helper: Builds WHERE clause to filter posts based on privacy
 * - Posts without community (global): always visible
 * - Posts from public communities: always visible
 * - Posts from private/restricted communities: only if user is member
 */
async function buildPrivacyFilter(userId?: string) {
  // Get public community IDs
  const publicCommunities = await prisma.community.findMany({
    where: { type: 'public' },
    select: { id: true },
  });
  const publicCommunityIds = publicCommunities.map(c => c.id);

  const privacyConditions: any[] = [
    // Global posts (no community) - always visible
    { communityId: null },
    // Posts from public communities - always visible
    { communityId: { in: publicCommunityIds } },
  ];

  // If user authenticated, include posts from their private communities
  if (userId) {
    // Get private/restricted communities where user is member
    const userPrivateCommunities = await prisma.communityMember.findMany({
      where: {
        userId,
        Community: {
          type: { in: ['private', 'restricted'] },
        },
      },
      select: { communityId: true },
    });
    const userPrivateCommunityIds = userPrivateCommunities.map(m => m.communityId);

    if (userPrivateCommunityIds.length > 0) {
      privacyConditions.push({ communityId: { in: userPrivateCommunityIds } });
    }
  }

  return { OR: privacyConditions };
}

/** Helper: Builds WHERE condition to filter blocked/hidden content */
async function buildModerationFilters(userId?: string) {
  if (!userId) {
    return {}; // No filters if no user
  }

  const filters = await UserModerationService.getFeedFilters(userId);

  const conditions: any[] = [];

  // Exclude hidden posts
  if (filters.hiddenPostIds.length > 0) {
    conditions.push({
      id: { notIn: filters.hiddenPostIds },
    });
  }

  // Exclude posts from blocked users
  if (filters.blockedUserIds.length > 0) {
    conditions.push({
      authorId: { notIn: filters.blockedUserIds },
    });
  }

  // Exclude posts with unwanted tags
  if (filters.hiddenTags.length > 0) {
    conditions.push({
      NOT: {
        tags: {
          hasSome: filters.hiddenTags,
        },
      },
    });
  }

  // Excluir tipos de post no deseados
  if (filters.hiddenPostTypes.length > 0) {
    conditions.push({
      type: { notIn: filters.hiddenPostTypes },
    });
  }

  // Excluir comunidades no deseadas
  if (filters.hiddenCommunityIds.length > 0) {
    conditions.push({
      OR: [
        { communityId: null }, // Permitir posts globales
        { communityId: { notIn: filters.hiddenCommunityIds } },
      ],
    });
  }

  if (conditions.length === 0) {
    return {};
  }

  return { AND: conditions };
}

export const FeedService = {
  async getPersonalizedFeed(userId: string, page = 1, limit = 25) {
    // Limit pagination to prevent abuse
    const safePage = Math.max(1, Math.min(page, 1000)); // Maximum 1000 pages
    const safeLimit = Math.max(1, Math.min(limit, 100)); // Maximum 100 items per page
    const skip = (safePage - 1) * safeLimit;

    // Get user communities
    const userCommunities = await prisma.communityMember.findMany({
      where: { userId },
      select: { communityId: true },
    });

    const communityIds = userCommunities.map(m => m.communityId);

    // Get users being followed
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map(f => f.followingId);

    // Get personal moderation and privacy filters
    const [moderationFilters, privacyFilter] = await Promise.all([
      buildModerationFilters(userId),
      buildPrivacyFilter(userId),
    ]);

    // Personalized feed: posts from communities + posts from followed users + trending
    const posts = await prisma.communityPost.findMany({
      where: {
        status: 'published',
        AND: [
          {
            OR: [
              { communityId: { in: communityIds } },
              { authorId: { in: followingIds } },
              {
                AND: [
                  { score: { gte: 5 } },
                  {
                    createdAt: {
                      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                  },
                ],
              },
            ],
          },
          privacyFilter,
          moderationFilters,
        ],
      },
      orderBy: [
        { isPinned: 'desc' },
        { lastActivityAt: 'desc' },
      ],
      skip,
      take: safeLimit,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        Community: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
        _count: {
          select: {
            CommunityComment: true,
            PostVote: true,
            PostAward: true,
          },
        },
      },
    });

    return posts;
  },

  async getHotFeed(page = 1, limit = 25, userId?: string) {
    const safePage = Math.max(1, Math.min(page, 1000));
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const skip = (safePage - 1) * safeLimit;

    // Get personal moderation and privacy filters
    const [moderationFilters, privacyFilter] = await Promise.all([
      buildModerationFilters(userId),
      buildPrivacyFilter(userId),
    ]);

    // Hot = score alto + reciente
    const posts = await prisma.communityPost.findMany({
      where: {
        status: 'published',
        ...privacyFilter,
        ...moderationFilters,
      },
      orderBy: [
        { isPinned: 'desc' },
        { score: 'desc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: safeLimit,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        Community: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
        _count: {
          select: {
            CommunityComment: true,
            PostVote: true,
            PostAward: true,
          },
        },
      },
    });

    return posts;
  },

  async getNewFeed(page = 1, limit = 25, userId?: string) {
    const safePage = Math.max(1, Math.min(page, 1000));
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const skip = (safePage - 1) * safeLimit;

    // Get personal moderation and privacy filters
    const [moderationFilters, privacyFilter] = await Promise.all([
      buildModerationFilters(userId),
      buildPrivacyFilter(userId),
    ]);

    const posts = await prisma.communityPost.findMany({
      where: {
        status: 'published',
        ...privacyFilter,
        ...moderationFilters,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        Community: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
        _count: {
          select: {
            CommunityComment: true,
            PostVote: true,
            PostAward: true,
          },
        },
      },
    });

    return posts;
  },

  async getTopFeed(timeRange: 'day' | 'week' | 'month' | 'year' | 'all' = 'week', page = 1, limit = 25, userId?: string) {
    const safePage = Math.max(1, Math.min(page, 1000));
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const skip = (safePage - 1) * safeLimit;

    const ranges: Record<string, number> = {
      day: 1,
      week: 7,
      month: 30,
      year: 365,
    };

    // Get personal moderation and privacy filters
    const [moderationFilters, privacyFilter] = await Promise.all([
      buildModerationFilters(userId),
      buildPrivacyFilter(userId),
    ]);

    const where: any = {
      status: 'published',
      ...privacyFilter,
      ...moderationFilters,
    };

    if (timeRange !== 'all') {
      const days = ranges[timeRange];
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      where.createdAt = { gte: since };
    }

    const posts = await prisma.communityPost.findMany({
      where,
      orderBy: { score: 'desc' },
      skip,
      take: safeLimit,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        Community: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
        _count: {
          select: {
            CommunityComment: true,
            PostVote: true,
            PostAward: true,
          },
        },
      },
    });

    return posts;
  },

  async getFollowingFeed(userId: string, page = 1, limit = 25) {
    const safePage = Math.max(1, Math.min(page, 1000));
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const skip = (safePage - 1) * safeLimit;

    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map(f => f.followingId);

    if (followingIds.length === 0) {
      return [];
    }

    // Get personal moderation and privacy filters
    const [moderationFilters, privacyFilter] = await Promise.all([
      buildModerationFilters(userId),
      buildPrivacyFilter(userId),
    ]);

    const posts = await prisma.communityPost.findMany({
      where: {
        status: 'published',
        authorId: { in: followingIds },
        ...privacyFilter,
        ...moderationFilters,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        Community: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
        _count: {
          select: {
            CommunityComment: true,
            PostVote: true,
            PostAward: true,
          },
        },
      },
    });

    return posts;
  },

  /**
   * "Home" Feed - Posts from communities the user is subscribed to
   * Similar to the Reddit Home feed
   */
  async getHomeFeed(userId: string, page = 1, limit = 25) {
    const safePage = Math.max(1, Math.min(page, 1000));
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const skip = (safePage - 1) * safeLimit;

    // Get user communities
    const userCommunities = await prisma.communityMember.findMany({
      where: { userId },
      select: { communityId: true },
    });

    const communityIds = userCommunities.map(m => m.communityId);

    // If not in any community, return an empty array
    // (or you could return trending posts as fallback)
    if (communityIds.length === 0) {
      return [];
    }

    // Get personal moderation filters
    const moderationFilters = await buildModerationFilters(userId);

    // Posts de las comunidades suscritas
    const posts = await prisma.communityPost.findMany({
      where: {
        status: 'published',
        communityId: { in: communityIds },
        ...moderationFilters,
      },
      orderBy: [
        { isPinned: 'desc' },
        { lastActivityAt: 'desc' },
      ],
      skip,
      take: safeLimit,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        Community: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            primaryColor: true,
          },
        },
        _count: {
          select: {
            CommunityComment: true,
            PostVote: true,
            PostAward: true,
          },
        },
      },
    });

    return posts;
  },

  /**
   * Trending Communities - Communities with the most recent activity
   * Calculates based on posts and comments from the last 7 days
   */
  async getTrendingCommunities(limit = 10) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get public communities with recent activity
    const communities = await prisma.community.findMany({
      where: {
        type: 'public',
        CommunityPost: {
          some: {
            createdAt: { gte: sevenDaysAgo },
          },
        },
      },
      include: {
        _count: {
          select: {
            CommunityMember: true,
            CommunityPost: true,
          },
        },
        CommunityPost: {
          where: {
            createdAt: { gte: sevenDaysAgo },
          },
          select: {
            id: true,
            score: true,
            commentCount: true,
          },
        },
      },
      take: 50, // Get más para calcular
    });

    // Calcular score de trending para cada comunidad
    const communitiesWithScore = communities.map(community => {
      // Score = posts recientes * 2 + suma de scores + suma de comentarios
      const recentPostCount = community.CommunityPost.length;
      const totalScore = community.CommunityPost.reduce((sum: number, post: any) => sum + post.score, 0);
      const totalComments = community.CommunityPost.reduce((sum: number, post: any) => sum + post.commentCount, 0);

      const trendingScore = (recentPostCount * 2) + totalScore + (totalComments * 0.5);

      return {
        id: community.id,
        name: community.name,
        slug: community.slug,
        description: community.description,
        icon: community.icon,
        primaryColor: community.primaryColor,
        memberCount: community._count.CommunityMember,
        postCount: community._count.CommunityPost,
        recentActivity: recentPostCount,
        trendingScore,
      };
    });

    // Ordenar por trending score y retornar top N
    return communitiesWithScore
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);
  },
};
