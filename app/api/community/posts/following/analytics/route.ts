import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/community/posts/following/analytics - Obtener analytics de posts seguidos
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get('range') || '30days';

    // Calculate start date based on the range
    const now = new Date();
    let startDate: Date;
    switch (range) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get posts seguidos
    const followedPosts = await prisma.postFollower.findMany({
      where: { userId },
      include: {
        CommunityPost: {
          include: {
            Community: {
              select: { name: true }
            }
          }
        }
      }
    });

    const totalFollowedPosts = followedPosts.length;
    const postIds = followedPosts.map(f => f.postId);

    if (postIds.length === 0) {
      return NextResponse.json({
        totalFollowedPosts: 0,
        activePostsLast7Days: 0,
        totalNewComments: 0,
        totalEngagement: 0,
        engagementByType: [],
        engagementByCommunity: [],
        engagementByTag: [],
        activityTimeline: [],
        recentActions: []
      });
    }

    // Get active posts in the last 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const activePostsLast7Days = await prisma.communityPost.count({
      where: {
        id: { in: postIds },
        OR: [
          { createdAt: { gte: sevenDaysAgo } },
          { updatedAt: { gte: sevenDaysAgo } }
        ]
      }
    });

    // Get new comments in the period
    const newComments = await prisma.communityComment.findMany({
      where: {
        postId: { in: postIds },
        createdAt: { gte: startDate }
      }
    });

    const totalNewComments = newComments.length;

    // Engagement por tipo de post
    const engagementByTypeMap: Record<string, number> = {};
    followedPosts.forEach(follow => {
      const type = follow.CommunityPost.type;
      engagementByTypeMap[type] = (engagementByTypeMap[type] || 0) + 1;
    });

    const engagementByType = Object.entries(engagementByTypeMap).map(([type, count]) => ({
      type,
      count
    }));

    // Engagement por comunidad
    const engagementByCommunityMap: Record<string, number> = {};
    followedPosts.forEach(follow => {
      const communityName = follow.CommunityPost.Community?.name || 'Sin comunidad';
      engagementByCommunityMap[communityName] = (engagementByCommunityMap[communityName] || 0) + 1;
    });

    const engagementByCommunity = Object.entries(engagementByCommunityMap)
      .map(([community, count]) => ({ community, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Engagement por tag
    const engagementByTagMap: Record<string, number> = {};
    followedPosts.forEach(follow => {
      const tags = Array.isArray(follow.CommunityPost.tags) ? follow.CommunityPost.tags : [];
      tags.forEach((tag) => {
        if (typeof tag === 'string') {
          engagementByTagMap[tag] = (engagementByTagMap[tag] || 0) + 1;
        }
      });
    });

    const engagementByTag = Object.entries(engagementByTagMap)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Activity Timeline
    const activityTimeline = await generateActivityTimeline(userId, startDate, now, range);

    // Acciones recientes
    const recentActions = await prisma.userActionHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const totalEngagement = followedPosts.reduce((sum, follow) => {
      return sum + follow.CommunityPost.upvotes + follow.CommunityPost.commentCount;
    }, 0);

    return NextResponse.json({
      totalFollowedPosts,
      activePostsLast7Days,
      totalNewComments,
      totalEngagement,
      engagementByType,
      engagementByCommunity,
      engagementByTag,
      activityTimeline,
      recentActions: recentActions.map(action => ({
        id: action.id,
        action: action.action,
        targetType: action.targetType || 'unknown',
        targetTitle: (action.metadata as any)?.title,
        createdAt: action.createdAt.toISOString()
      }))
    });

  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener analytics' },
      { status: 400 }
    );
  }
}

async function generateActivityTimeline(
  userId: string,
  startDate: Date,
  endDate: Date,
  _range: string
) {
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const timeline = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

    // Count comments on posts followed that day
    const commentsCount = await prisma.communityComment.count({
      where: {
        createdAt: {
          gte: date,
          lt: nextDate
        },
        CommunityPost: {
          PostFollower: {
            some: { userId }
          }
        }
      }
    });

    // Count new follows that day
    const followsCount = await prisma.postFollower.count({
      where: {
        userId,
        createdAt: {
          gte: date,
          lt: nextDate
        }
      }
    });

    timeline.push({
      date: date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      comments: commentsCount,
      follows: followsCount
    });
  }

  return timeline;
}
