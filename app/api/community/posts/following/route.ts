import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { prisma } from '@/lib/prisma';

/** GET /api/community/posts/following - Get posts followed by the user with filters */
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

    // Get filter parameters
    const typeFilter = searchParams.get('type');
    const communityId = searchParams.get('communityId');
    const dateFilter = searchParams.get('date');
    const sortBy = searchParams.get('sortBy') || 'recent';

    // Get IDs de posts seguidos
    const followedPosts = await prisma.postFollower.findMany({
      where: { userId },
      select: { postId: true }
    });

    const postIds = followedPosts.map(f => f.postId);

    if (postIds.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    // Construir filtros
    const where: any = {
      id: { in: postIds }
    };

    // Filtro por tipo
    if (typeFilter && typeFilter !== 'all') {
      where.type = typeFilter;
    }

    // Filtro por comunidad
    if (communityId && communityId !== 'all') {
      where.communityId = communityId;
    }

    // Filtro por fecha
    if (dateFilter && dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0);
      }

      where.createdAt = {
        gte: startDate
      };
    }

    // Determinar ordenamiento
    let orderBy: any = { createdAt: 'desc' }; // Por defecto: reciente

    switch (sortBy) {
      case 'active':
        orderBy = { commentCount: 'desc' };
        break;
      case 'upvoted':
        orderBy = { upvotes: 'desc' };
        break;
      case 'commented':
        orderBy = { commentCount: 'desc' };
        break;
      case 'recent':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Get posts filtrados
    const posts = await prisma.communityPost.findMany({
      where,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        Community: {
          select: {
            id: true,
            name: true,
            slug: true,
            primaryColor: true
          }
        }
      },
      orderBy
    });

    // Check user votes for each post
    const postsWithVotes = await Promise.all(
      posts.map(async (post) => {
        const vote = await prisma.postVote.findUnique({
          where: {
            postId_userId: {
              postId: post.id,
              userId: userId
            }
          }
        });

        return {
          ...post,
          userVote: vote ? (vote.voteType as 'upvote' | 'downvote') : null,
          isFollowing: true,
        };
      })
    );

    return NextResponse.json({ posts: postsWithVotes });
  } catch (error: any) {
    console.error('Error fetching followed posts:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener posts seguidos' },
      { status: 400 }
    );
  }
}
