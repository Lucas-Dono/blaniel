/**
 * Followed Posts Email Service
 * Handles sending email notifications when there is activity in followed posts
 */

import { nanoid } from "nanoid";
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { newCommentEmailTemplate, digestEmailTemplate, type NewCommentEmailData, type DigestEmailData } from '@/lib/email/templates/post-follow-templates';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export class PostFollowEmailService {
  /**
   * Send new comment email to post followers
   */
  static async notifyNewComment(
    postId: string,
    commentId: string,
    commentAuthorId: string
  ) {
    try {
      // Get post and comment information
      const [post, comment] = await Promise.all([
        prisma.communityPost.findUnique({
          where: { id: postId },
          include: {
            Community: {
              select: { name: true, slug: true }
            }
          }
        }),
        prisma.communityComment.findUnique({
          where: { id: commentId },
          include: {
            User: {
              select: { name: true }
            }
          }
        })
      ]);

      if (!post || !comment) {
        throw new Error('Post o comentario no encontrado');
      }

      // Get followers with emails enabled
      const followers = await prisma.postFollower.findMany({
        where: {
          postId,
          notificationsEnabled: true,
          userId: { not: commentAuthorId } // No notificar al autor del comentario
        },
        include: {
          User: {
            select: {
              id: true,
              email: true,
              name: true,
              EmailNotificationConfig: true
            }
          }
        }
      });

      // Send emails based on each user's configuration
      const emailPromises = followers.map(async (follower) => {
        const config = follower.User.EmailNotificationConfig;

        // Check if user wants to receive new comment notifications
        if (!config?.newComments) {
          return null;
        }

        // Si la frecuencia es instant, enviar email inmediatamente
        if (config.frequency === 'instant') {
          const unsubscribeUrl = `${APP_URL}/community/post/${postId}?unfollow=true`;
          const postUrl = `${APP_URL}/community/post/${postId}#comment-${commentId}`;

          const emailData: NewCommentEmailData = {
            userName: follower.User.name || 'Usuario',
            postTitle: post.title,
            postUrl,
            commentAuthor: comment.User.name || 'Alguien',
            commentContent: comment.content,
            unsubscribeUrl
          };

          return sendEmail({
            to: follower.User.email,
            subject: `Nuevo comentario en "${post.title}"`,
            html: newCommentEmailTemplate(emailData)
          });
        }

        // For daily/weekly, they will accumulate in the digest
        return null;
      });

      const results = await Promise.allSettled(emailPromises.filter(p => p !== null));

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      return {
        success: true,
        sent: successCount,
        failed: failCount
      };

    } catch (error: any) {
      console.error('Error enviando emails de nuevo comentario:', error);
      throw error;
    }
  }

  /**
   * Generate and send daily digest for a user
   */
  static async sendDailyDigest(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          EmailNotificationConfig: true
        }
      });

      if (!user || !user.email) {
        throw new Error('Usuario no encontrado');
      }

      const config = user.EmailNotificationConfig;

      // Check if user wants to receive digests
      if (!config || config.frequency !== 'daily' || !config.digestSummary) {
        return { success: false, reason: 'User not configured for daily digests' };
      }

      // Get activity from the last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const activity = await this.getPostFollowActivity(userId, yesterday, new Date());

      if (activity.posts.length === 0) {
        return { success: false, reason: 'Sin actividad para reportar' };
      }

      // Enviar digest
      const emailData: DigestEmailData = {
        userName: user.name || 'Usuario',
        periodLabel: 'Hoy',
        posts: activity.posts.map(p => ({
          id: p.id,
          title: p.title,
          url: `${APP_URL}/community/post/${p.id}`,
          newCommentsCount: p.newCommentsCount,
          community: p.Community || undefined
        })),
        totalNewComments: activity.totalNewComments,
        unsubscribeUrl: `${APP_URL}/settings/notifications?unsubscribe=digest`,
        managePreferencesUrl: `${APP_URL}/community/following`
      };

      await sendEmail({
        to: user.email,
        subject: `Tu resumen diario de actividad en Blaniel`,
        html: digestEmailTemplate(emailData)
      });

      // Registrar digest enviado
      await prisma.postFollowDigest.create({
        data: {
          id: nanoid(),
          userId,
          type: 'daily',
          postIds: activity.posts.map(p => p.id),
          totalNewComments: activity.totalNewComments,
          totalNewReplies: 0, // TODO: Implementar tracking de replies
          postsCount: activity.posts.length,
          periodStart: yesterday,
          periodEnd: new Date()
        }
      });

      // Update last digest sent timestamp
      await prisma.emailNotificationConfig.update({
        where: { userId },
        data: { lastDigestSentAt: new Date() }
      });

      return { success: true };

    } catch (error: any) {
      console.error('Error sending daily digest:', error);
      throw error;
    }
  }

  /**
   * Generate and send weekly digest for a user
   */
  static async sendWeeklyDigest(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          EmailNotificationConfig: true
        }
      });

      if (!user || !user.email) {
        throw new Error('Usuario no encontrado');
      }

      const config = user.EmailNotificationConfig;

      // Check if user wants to receive digests
      if (!config || config.frequency !== 'weekly' || !config.digestSummary) {
        return { success: false, reason: 'User not configured for weekly digests' };
      }

      // Get activity from the last 7 days
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const activity = await this.getPostFollowActivity(userId, lastWeek, new Date());

      if (activity.posts.length === 0) {
        return { success: false, reason: 'Sin actividad para reportar' };
      }

      // Send digest
      const emailData: DigestEmailData = {
        userName: user.name || 'Usuario',
        periodLabel: 'This Week',
        posts: activity.posts.map(p => ({
          id: p.id,
          title: p.title,
          url: `${APP_URL}/community/post/${p.id}`,
          newCommentsCount: p.newCommentsCount,
          community: p.Community || undefined
        })),
        totalNewComments: activity.totalNewComments,
        unsubscribeUrl: `${APP_URL}/settings/notifications?unsubscribe=digest`,
        managePreferencesUrl: `${APP_URL}/community/following`
      };

      await sendEmail({
        to: user.email,
        subject: `Tu resumen semanal de actividad en Blaniel`,
        html: digestEmailTemplate(emailData)
      });

      // Record digest sent
      await prisma.postFollowDigest.create({
        data: {
          id: nanoid(),
          userId,
          type: 'weekly',
          postIds: activity.posts.map(p => p.id),
          totalNewComments: activity.totalNewComments,
          totalNewReplies: 0,
          postsCount: activity.posts.length,
          periodStart: lastWeek,
          periodEnd: new Date()
        }
      });

      // Update last digest sent timestamp
      await prisma.emailNotificationConfig.update({
        where: { userId },
        data: { lastDigestSentAt: new Date() }
      });

      return { success: true };

    } catch (error: any) {
      console.error('Error sending weekly digest:', error);
      throw error;
    }
  }

  /**
   * Get followed posts activity within a period
   */
  private static async getPostFollowActivity(
    userId: string,
    startDate: Date,
    endDate: Date
  ) {
    // Get followed posts
    const followedPosts = await prisma.postFollower.findMany({
      where: { userId },
      select: { postId: true }
    });

    const postIds = followedPosts.map(f => f.postId);

    if (postIds.length === 0) {
      return { posts: [], totalNewComments: 0 };
    }

    // Get new comments on these posts
    const newComments = await prisma.communityComment.findMany({
      where: {
        postId: { in: postIds },
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        postId: true
      }
    });

    // Group by post
    const commentsByPost = newComments.reduce((acc, comment) => {
      acc[comment.postId] = (acc[comment.postId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get post information with activity
    const postsWithActivity = await prisma.communityPost.findMany({
      where: {
        id: { in: Object.keys(commentsByPost) }
      },
      select: {
        id: true,
        title: true,
        Community: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    });

    const posts = postsWithActivity.map(post => ({
      ...post,
      newCommentsCount: commentsByPost[post.id] || 0
    }));

    const totalNewComments = Object.values(commentsByPost).reduce((a, b) => a + b, 0);

    return {
      posts,
      totalNewComments
    };
  }

  /**
   * Get or create email configuration for a user
   */
  static async getOrCreateEmailConfig(userId: string) {
    let config = await prisma.emailNotificationConfig.findUnique({
      where: { userId }
    });

    if (!config) {
      config = await prisma.emailNotificationConfig.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          userId,
          frequency: 'instant',
          newComments: true,
          newReplies: true,
          postUpdates: true,
          digestSummary: true
        }
      });
    }

    return config;
  }

  /**
   * Update a user's email configuration
   */
  static async updateEmailConfig(
    userId: string,
    updates: {
      frequency?: 'instant' | 'daily' | 'weekly' | 'disabled';
      newComments?: boolean;
      newReplies?: boolean;
      postUpdates?: boolean;
      digestSummary?: boolean;
      digestDay?: string;
      digestTime?: string;
    }
  ) {
    // Ensure configuration exists
    await this.getOrCreateEmailConfig(userId);

    const updated = await prisma.emailNotificationConfig.update({
      where: { userId },
      data: updates
    });

    return updated;
  }
}
