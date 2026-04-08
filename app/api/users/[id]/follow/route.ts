import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/users/[id]/follow - Follow/unfollow a user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const followerId = session.user.id;
    const { id: followingId } = await params;

    if (followerId === followingId) {
      return NextResponse.json({ error: 'No puedes seguirte a ti mismo' }, { status: 400 });
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({
        where: { id: existingFollow.id },
      });
      return NextResponse.json({ following: false });
    } else {
      // Follow
      await prisma.follow.create({
        data: {
          id: nanoid(),
          followerId,
          followingId,
        },
      });
      return NextResponse.json({ following: true });
    }
  } catch (error: any) {
    console.error('Error toggling follow:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * GET /api/users/[id]/follow - Get follow status and counts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(request);
    const { id: userId } = await params;

    const [followersCount, followingCount, isFollowing] = await Promise.all([
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.follow.count({ where: { followerId: userId } }),
      session?.user?.id
        ? prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: session.user.id,
                followingId: userId,
              },
            },
          })
        : null,
    ]);

    return NextResponse.json({
      followersCount,
      followingCount,
      isFollowing: !!isFollowing,
    });
  } catch (error: any) {
    console.error('Error getting follow info:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
