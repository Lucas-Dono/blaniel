/**
 * Notification Service - Notification system
 */

import { nanoid } from "nanoid";
import { prisma } from '@/lib/prisma';
import { PushNotificationServerService } from './push-notification-server.service';

export interface CreateNotificationData {
  recipientId?: string; // For new code
  userId?: string; // Legacy support - maps to recipientId
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: any;
}

export const NotificationService = {
  /**
   * Create notification
   */
  async createNotification(data: CreateNotificationData) {
    // Support both recipientId and userId (legacy)
    const recipientId = data.recipientId || data.userId;
    if (!recipientId) {
      throw new Error('recipientId or userId is required');
    }

    const notification = await prisma.notification.create({
      data: {
        id: nanoid(),
        recipientId: recipientId,
        type: data.type,
        title: data.title,
        message: data.message,
        actionUrl: data.actionUrl,
        relatedId: (data.metadata as any)?.relatedId,
        relatedType: (data.metadata as any)?.relatedType,
        actorId: (data.metadata as any)?.actorId,
        actorName: (data.metadata as any)?.actorName,
        actorAvatar: (data.metadata as any)?.actorAvatar,
      },
    });

    // Send push notification if user has tokens
    try {
      await PushNotificationServerService.sendToUser(recipientId, {
        title: data.title,
        body: data.message,
        data: {
          notificationId: notification.id,
          type: data.type,
          actionUrl: data.actionUrl,
          ...data.metadata,
        },
      });
    } catch (error) {
      console.error('Error enviando push notification:', error);
      // Don't fail if push notification fails
    }

    return notification;
  },

  /**
   * Create bulk notification
   */
  async createBulkNotifications(notifications: CreateNotificationData[]) {
    // Filter out notifications without recipientId/userId
    const validNotifications = notifications.filter(n => n.recipientId || n.userId);

    const created = await prisma.notification.createMany({
      data: validNotifications.map(n => ({
        id: nanoid(),
        recipientId: (n.recipientId || n.userId)!,
        type: n.type,
        title: n.title,
        message: n.message,
        actionUrl: n.actionUrl,
        relatedId: (n.metadata as any)?.relatedId,
        relatedType: (n.metadata as any)?.relatedType,
        actorId: (n.metadata as any)?.actorId,
        actorName: (n.metadata as any)?.actorName,
        actorAvatar: (n.metadata as any)?.actorAvatar,
      })),
    });

    return created;
  },

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, page = 1, limit = 50) {
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where: { recipientId: userId } }),
      prisma.notification.count({ where: { recipientId: userId, isRead: false } }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Mark as read
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.recipientId !== userId) {
      throw new Error('Notification not found');
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return updated;
  },

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: {
        recipientId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return { success: true };
  },

  /**
   * Eliminar notificación
   */
  async deleteNotification(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.recipientId !== userId) {
      throw new Error('Notification not found');
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    return { success: true };
  },

  /**
   * Eliminar todas las notificaciones
   */
  async deleteAllNotifications(userId: string) {
    await prisma.notification.deleteMany({
      where: { recipientId: userId },
    });

    return { success: true };
  },

  /**
   * Obtener conteo de notificaciones no leídas
   */
  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: {
        recipientId: userId,
        isRead: false,
      },
    });

    return { count };
  },

  /**
   * Notificaciones por tipo
   */

  // Nuevo post en comunidad seguida
  async notifyNewPostInCommunity(postId: string, communityId: string, authorId: string) {
    const members = await prisma.communityMember.findMany({
      where: {
        communityId,
        userId: { not: authorId }, // No notificar al autor
      },
      select: { userId: true },
    });

    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { title: true },
    });

    const community = await prisma.community.findUnique({
      where: { id: communityId },
      select: { name: true },
    });

    const notifications = members.map(member => ({
      userId: member.userId,
      type: 'new_post',
      title: 'Nuevo post en ' + community?.name,
      message: post?.title || 'Nuevo post disponible',
      actionUrl: `/community/posts/${postId}`,
      metadata: { postId, communityId },
    }));

    if (notifications.length > 0) {
      await this.createBulkNotifications(notifications);
    }
  },

  // Nueva respuesta a tu post
  async notifyNewComment(commentId: string, postId: string, authorId: string) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { authorId: true, title: true },
    });

    if (!post || post.authorId === authorId) return; // No notificar al autor del comentario

    await this.createNotification({
      userId: post.authorId,
      type: 'new_comment',
      title: 'Nuevo comentario en tu post',
      message: `Alguien comentó en "${post.title}"`,
      actionUrl: `/community/posts/${postId}#comment-${commentId}`,
      metadata: { postId, commentId },
    });
  },

  // Nueva respuesta a tu comentario
  async notifyCommentReply(replyId: string, parentCommentId: string, authorId: string) {
    const parentComment = await prisma.communityComment.findUnique({
      where: { id: parentCommentId },
      select: { authorId: true, postId: true },
    });

    if (!parentComment || parentComment.authorId === authorId) return;

    await this.createNotification({
      userId: parentComment.authorId,
      type: 'comment_reply',
      title: 'Nueva respuesta a tu comentario',
      message: 'Alguien respondió a tu comentario',
      actionUrl: `/community/posts/${parentComment.postId}#comment-${replyId}`,
      metadata: { replyId, parentCommentId },
    });
  },

  // Upvote en tu post
  async notifyPostUpvote(postId: string, voterId: string) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { authorId: true, title: true, upvotes: true },
    });

    if (!post || post.authorId === voterId) return;

    // Solo notificar en milestones (10, 50, 100, 500, 1000)
    const milestones = [10, 50, 100, 500, 1000];
    if (milestones.includes(post.upvotes)) {
      await this.createNotification({
        userId: post.authorId,
        type: 'post_milestone',
        title: `¡${post.upvotes} upvotes!`,
        message: `Tu post "${post.title}" alcanzó ${post.upvotes} upvotes`,
        actionUrl: `/community/posts/${postId}`,
        metadata: { postId, upvotes: post.upvotes },
      });
    }
  },

  // Award recibido
  async notifyAward(postId: string, awardType: string, senderId: string) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { authorId: true, title: true },
    });

    if (!post || post.authorId === senderId) return;

    await this.createNotification({
      userId: post.authorId,
      type: 'award_received',
      title: '¡Recibiste un award!',
      message: `Tu post "${post.title}" recibió un award: ${awardType}`,
      actionUrl: `/community/posts/${postId}`,
      metadata: { postId, awardType },
    });
  },

  // Respuesta aceptada
  async notifyAnswerAccepted(commentId: string, postId: string) {
    const comment = await prisma.communityComment.findUnique({
      where: { id: commentId },
      select: { authorId: true },
    });

    if (!comment) return;

    await this.createNotification({
      userId: comment.authorId,
      type: 'answer_accepted',
      title: '¡Tu respuesta fue aceptada!',
      message: 'El autor aceptó tu respuesta como la solución',
      actionUrl: `/community/posts/${postId}#comment-${commentId}`,
      metadata: { postId, commentId },
    });
  },

  // Nuevo seguidor
  async notifyNewFollower(followedId: string, followerId: string) {
    const follower = await prisma.user.findUnique({
      where: { id: followerId },
      select: { name: true },
    });

    await this.createNotification({
      userId: followedId,
      type: 'new_follower',
      title: 'Nuevo seguidor',
      message: `${follower?.name} comenzó a seguirte`,
      actionUrl: `/profile/${followerId}`,
      metadata: { followerId },
    });
  },

  // Event invitation
  async notifyEventInvitation(eventId: string, userId: string) {
    const event = await prisma.communityEvent.findUnique({
      where: { id: eventId },
      select: { title: true, startDate: true },
    });

    await this.createNotification({
      userId,
      type: 'event_invitation',
      title: 'Invitación a evento',
      message: `Fuiste invitado al evento: ${event?.title}`,
      actionUrl: `/community/events/${eventId}`,
      metadata: { eventId },
    });
  },

  // Recordatorio de evento
  async notifyEventReminder(eventId: string) {
    const event = await prisma.communityEvent.findUnique({
      where: { id: eventId },
      include: {
        EventRegistration: {
          select: { userId: true },
        },
      },
    });

    if (!event) return;

    const notifications = event.EventRegistration.map(reg => ({
      userId: reg.userId,
      type: 'event_reminder',
      title: 'Recordatorio de evento',
      message: `El evento "${event.title}" comienza pronto`,
      actionUrl: `/community/events/${eventId}`,
      metadata: { eventId },
    }));

    if (notifications.length > 0) {
      await this.createBulkNotifications(notifications);
    }
  },

  // Nuevo badge ganado
  async notifyBadgeEarned(userId: string, badgeName: string, badgeIcon: string) {
    await this.createNotification({
      userId,
      type: 'badge_earned',
      title: '¡Nuevo badge desbloqueado!',
      message: `Ganaste el badge: ${badgeIcon} ${badgeName}`,
      actionUrl: '/profile',
      metadata: { badgeName, badgeIcon },
    });
  },

  // Nivel alcanzado
  async notifyLevelUp(userId: string, newLevel: number) {
    await this.createNotification({
      userId,
      type: 'level_up',
      title: '¡Nivel alcanzado!',
      message: `Alcanzaste el nivel ${newLevel}`,
      actionUrl: '/profile',
      metadata: { level: newLevel },
    });
  },

  // Mensaje directo
  async notifyDirectMessage(conversationId: string, senderId: string, recipientId: string, preview: string) {
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true },
    });

    await this.createNotification({
      userId: recipientId,
      type: 'direct_message',
      title: `Mensaje de ${sender?.name}`,
      message: preview,
      actionUrl: `/messages/${conversationId}`,
      metadata: { conversationId, senderId },
    });
  },

  // Proyecto aceptado como colaborador
  async notifyProjectAccepted(projectId: string, userId: string, projectTitle: string) {
    await this.createNotification({
      userId,
      type: 'project_accepted',
      title: '¡Solicitud aceptada!',
      message: `Fuiste aceptado como colaborador en: ${projectTitle}`,
      actionUrl: `/research/projects/${projectId}`,
      metadata: { projectId },
    });
  },

  /**
   * Notificar a followers de un post sobre un nuevo comentario
   */
  async notifyPostFollowers(
    postId: string,
    postTitle: string,
    commentAuthorId: string,
    commentAuthorName: string,
    commentAuthorAvatar: string | null,
    commentContent: string
  ) {
    // Get followers del post
    const followers = await prisma.postFollower.findMany({
      where: {
        postId,
        notificationsEnabled: true,
        userId: { not: commentAuthorId } // Excluir al autor del comentario
      },
      select: {
        userId: true
      }
    });

    if (followers.length === 0) {
      return { count: 0 };
    }

    // Create notificaciones para todos los followers
    const notifications = followers.map(follower => ({
      userId: follower.userId,
      type: 'followed_post_comment',
      title: 'Nuevo comentario en post que sigues',
      message: `${commentAuthorName} comentó en "${postTitle}": "${commentContent.substring(0, 80)}${commentContent.length > 80 ? '...' : ''}"`,
      actionUrl: `/community/post/${postId}`,
      metadata: {
        relatedId: postId,
        relatedType: 'post',
        actorId: commentAuthorId,
        actorName: commentAuthorName,
        actorAvatar: commentAuthorAvatar,
      },
    }));

    const result = await this.createBulkNotifications(notifications);

    return { count: result.count };
  },

  // ============================================
  // Notificaciones de Sistema Social
  // ============================================

  /**
   * Notificar solicitud de amistad recibida
   */
  async notifyFriendRequest(
    addresseeId: string,
    requesterId: string,
    requesterName: string | null,
    requesterAvatar: string | null
  ) {
    await this.createNotification({
      userId: addresseeId,
      type: 'friend_request',
      title: 'Nueva solicitud de amistad',
      message: `${requesterName || 'Alguien'} quiere ser tu amigo`,
      actionUrl: '/friends?tab=requests',
      metadata: {
        actorId: requesterId,
        actorName: requesterName,
        actorAvatar: requesterAvatar,
        relatedType: 'friendship',
      },
    });
  },

  /**
   * Notificar solicitud de amistad aceptada
   */
  async notifyFriendRequestAccepted(
    requesterId: string,
    addresseeId: string,
    addresseeName: string | null,
    addresseeAvatar: string | null
  ) {
    await this.createNotification({
      userId: requesterId,
      type: 'friend_request_accepted',
      title: 'Solicitud aceptada',
      message: `${addresseeName || 'Alguien'} aceptó tu solicitud de amistad`,
      actionUrl: `/profile/${addresseeId}`,
      metadata: {
        actorId: addresseeId,
        actorName: addresseeName,
        actorAvatar: addresseeAvatar,
        relatedType: 'friendship',
      },
    });
  },

  /**
   * Notificar mención en post o comentario
   */
  async notifyMention(
    mentionedId: string,
    mentionerId: string,
    mentionerName: string | null,
    mentionerAvatar: string | null,
    contextType: 'post' | 'comment',
    contextId: string,
    contextTitle: string,
    preview: string
  ) {
    const typeLabel = contextType === 'post' ? 'un post' : 'un comentario';

    await this.createNotification({
      userId: mentionedId,
      type: 'mention',
      title: `Te mencionaron en ${typeLabel}`,
      message: `${mentionerName || 'Alguien'}: "${preview.substring(0, 100)}${preview.length > 100 ? '...' : ''}"`,
      actionUrl: contextType === 'post'
        ? `/community/post/${contextId}`
        : `/community/post/${contextId}#comment-${contextId}`,
      metadata: {
        actorId: mentionerId,
        actorName: mentionerName,
        actorAvatar: mentionerAvatar,
        relatedId: contextId,
        relatedType: contextType,
      },
    });
  },

  /**
   * Notificar múltiples menciones
   */
  async notifyMentions(
    mentionedIds: string[],
    mentionerId: string,
    mentionerName: string | null,
    mentionerAvatar: string | null,
    contextType: 'post' | 'comment',
    contextId: string,
    preview: string
  ) {
    if (mentionedIds.length === 0) return { count: 0 };

    // Filter author if mentions themselves
    const filteredIds = mentionedIds.filter(id => id !== mentionerId);
    if (filteredIds.length === 0) return { count: 0 };

    const typeLabel = contextType === 'post' ? 'un post' : 'un comentario';

    const notifications = filteredIds.map(userId => ({
      userId,
      type: 'mention',
      title: `Te mencionaron en ${typeLabel}`,
      message: `${mentionerName || 'Alguien'}: "${preview.substring(0, 100)}${preview.length > 100 ? '...' : ''}"`,
      actionUrl: contextType === 'post'
        ? `/community/post/${contextId}`
        : `/community/post/${contextId}#comment-${contextId}`,
      metadata: {
        actorId: mentionerId,
        actorName: mentionerName,
        actorAvatar: mentionerAvatar,
        relatedId: contextId,
        relatedType: contextType,
      },
    }));

    const result = await this.createBulkNotifications(notifications);
    return { count: result.count };
  },

  /**
   * Notificar invitación a grupo
   */
  async notifyGroupInvitation(
    inviteeId: string,
    inviterId: string,
    inviterName: string | null,
    inviterAvatar: string | null,
    groupId: string,
    groupName: string,
    inviteCode: string
  ) {
    await this.createNotification({
      userId: inviteeId,
      type: 'group_invitation',
      title: 'Invitación a grupo',
      message: `${inviterName || 'Alguien'} te invitó al grupo "${groupName}"`,
      actionUrl: `/dashboard/grupos/${groupId}?invite=${inviteCode}`,
      metadata: {
        actorId: inviterId,
        actorName: inviterName,
        actorAvatar: inviterAvatar,
        relatedId: groupId,
        relatedType: 'group',
      },
    });
  },
};
