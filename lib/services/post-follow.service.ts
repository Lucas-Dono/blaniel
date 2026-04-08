import { nanoid } from "nanoid";
import { prisma } from '@/lib/prisma';

export class PostFollowService {
  /**
   * Seguir un post
   */
  static async followPost(userId: string, postId: string) {
    // Verificar que el post existe
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      include: { Community: true }
    });

    if (!post) {
      throw new Error('Post no encontrado');
    }

    // Check if already following
    const existing = await prisma.postFollower.findUnique({
      where: {
        userId_postId: {
          userId,
          postId
        }
      }
    });

    if (existing) {
      return existing; // Already following
    }

    // Create el follow
    const follow = await prisma.postFollower.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        userId,
        postId,
        notificationsEnabled: true
      }
    });

    return follow;
  }

  /**
   * Dejar de seguir un post
   */
  static async unfollowPost(userId: string, postId: string) {
    const deleted = await prisma.postFollower.deleteMany({
      where: {
        userId,
        postId
      }
    });

    return deleted.count > 0;
  }

  /**
   * Check if a user is following a post
   */
  static async isFollowing(userId: string, postId: string): Promise<boolean> {
    const follow = await prisma.postFollower.findUnique({
      where: {
        userId_postId: {
          userId,
          postId
        }
      }
    });

    return !!follow;
  }

  /**
   * Obtener todos los seguidores de un post
   */
  static async getFollowers(postId: string) {
    const followers = await prisma.postFollower.findMany({
      where: { postId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    });

    return followers;
  }

  /**
   * Obtener todos los posts que sigue un usuario
   */
  static async getFollowedPosts(userId: string) {
    const follows = await prisma.postFollower.findMany({
      where: { userId },
      include: {
        CommunityPost: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                image: true
              }
            },
            Community: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return follows.map(f => f.CommunityPost);
  }

  /**
   * Alternar estado de notificaciones para un follow
   */
  static async toggleNotifications(userId: string, postId: string) {
    const follow = await prisma.postFollower.findUnique({
      where: {
        userId_postId: {
          userId,
          postId
        }
      }
    });

    if (!follow) {
      throw new Error('You are not following this post');
    }

    const updated = await prisma.postFollower.update({
      where: {
        userId_postId: {
          userId,
          postId
        }
      },
      data: {
        notificationsEnabled: !follow.notificationsEnabled
      }
    });

    return updated;
  }

  /**
   * Obtener conteo de seguidores de un post
   */
  static async getFollowerCount(postId: string): Promise<number> {
    const count = await prisma.postFollower.count({
      where: { postId }
    });

    return count;
  }
}
