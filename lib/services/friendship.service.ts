/**
 * Friendship Service - Close friends system
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from "nanoid";
import { FriendshipStatus } from '@prisma/client';
import { NotificationService } from './notification.service';

export interface FriendshipWithUser {
  id: string;
  status: FriendshipStatus;
  createdAt: Date;
  respondedAt: Date | null;
  friend: {
    id: string;
    name: string | null;
    image: string | null;
    email: string;
  };
}

export const FriendshipService = {
  /**
   * Check if two users are friends
   */
  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId1, addresseeId: userId2, status: 'ACCEPTED' },
          { requesterId: userId2, addresseeId: userId1, status: 'ACCEPTED' },
        ],
      },
    });
    return !!friendship;
  },

  /**
   * Get friendship status between two users
   */
  async getFriendshipStatus(
    currentUserId: string,
    targetUserId: string
  ): Promise<{
    status: 'none' | 'friends' | 'pending_sent' | 'pending_received' | 'blocked' | 'blocked_by';
    friendshipId: string | null;
  }> {
    // Check if current user sent a request
    const sentRequest = await prisma.friendship.findUnique({
      where: {
        requesterId_addresseeId: {
          requesterId: currentUserId,
          addresseeId: targetUserId,
        },
      },
    });

    if (sentRequest) {
      if (sentRequest.status === 'ACCEPTED') {
        return { status: 'friends', friendshipId: sentRequest.id };
      }
      if (sentRequest.status === 'PENDING') {
        return { status: 'pending_sent', friendshipId: sentRequest.id };
      }
      if (sentRequest.status === 'BLOCKED') {
        return { status: 'blocked', friendshipId: sentRequest.id };
      }
    }

    // Check if current user received a request
    const receivedRequest = await prisma.friendship.findUnique({
      where: {
        requesterId_addresseeId: {
          requesterId: targetUserId,
          addresseeId: currentUserId,
        },
      },
    });

    if (receivedRequest) {
      if (receivedRequest.status === 'ACCEPTED') {
        return { status: 'friends', friendshipId: receivedRequest.id };
      }
      if (receivedRequest.status === 'PENDING') {
        return { status: 'pending_received', friendshipId: receivedRequest.id };
      }
      if (receivedRequest.status === 'BLOCKED') {
        return { status: 'blocked_by', friendshipId: receivedRequest.id };
      }
    }

    return { status: 'none', friendshipId: null };
  },

  /**
   * Send friend request
   */
  async sendFriendRequest(requesterId: string, addresseeId: string): Promise<{
    success: boolean;
    error?: string;
    friendship?: any;
  }> {
    // Check that it's not a self-request
    if (requesterId === addresseeId) {
      return { success: false, error: 'No puedes enviarte una solicitud a ti mismo' };
    }

    // Verify if relationship already exists
    const existingStatus = await this.getFriendshipStatus(requesterId, addresseeId);

    if (existingStatus.status === 'friends') {
      return { success: false, error: 'Ya son amigos' };
    }
    if (existingStatus.status === 'pending_sent') {
      return { success: false, error: 'Ya enviaste una solicitud' };
    }
    if (existingStatus.status === 'pending_received') {
      return { success: false, error: 'Ya tienes una solicitud pendiente de este usuario' };
    }
    if (existingStatus.status === 'blocked' || existingStatus.status === 'blocked_by') {
      return { success: false, error: 'No se puede enviar solicitud' };
    }

    // Check that user exists
    const addressee = await prisma.user.findUnique({
      where: { id: addresseeId },
      select: { id: true, name: true },
    });

    if (!addressee) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    // Create request
    const friendship = await prisma.friendship.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        requesterId,
        addresseeId,
        status: 'PENDING',
      },
      include: {
        User_Friendship_requesterIdToUser: {
          select: { id: true, name: true, image: true },
        },
        User_Friendship_addresseeIdToUser: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    // Send notification
    try {
      await NotificationService.createNotification({
        userId: addresseeId,
        type: 'friend_request',
        title: 'Nueva solicitud de amistad',
        message: `${friendship.User_Friendship_requesterIdToUser.name || 'Alguien'} quiere ser tu amigo`,
        actionUrl: '/friends?tab=requests',
        metadata: {
          actorId: requesterId,
          actorName: friendship.User_Friendship_requesterIdToUser.name,
          actorAvatar: friendship.User_Friendship_requesterIdToUser.image,
          relatedId: friendship.id,
          relatedType: 'friendship',
        },
      });
    } catch (error) {
      console.error('Error sending request notification:', error);
    }

    return { success: true, friendship };
  },

  /**
   * Accept friend request
   */
  async acceptFriendRequest(friendshipId: string, userId: string): Promise<{
    success: boolean;
    error?: string;
    friendship?: any;
  }> {
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
      include: {
        User_Friendship_requesterIdToUser: { select: { id: true, name: true, image: true } },
        User_Friendship_addresseeIdToUser: { select: { id: true, name: true, image: true } },
      },
    });

    if (!friendship) {
      return { success: false, error: 'Solicitud no encontrada' };
    }

    // Only the recipient can accept
    if (friendship.addresseeId !== userId) {
      return { success: false, error: 'No tienes permiso para aceptar esta solicitud' };
    }

    if (friendship.status !== 'PENDING') {
      return { success: false, error: 'Esta solicitud ya fue procesada' };
    }

    const updated = await prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
      include: {
        User_Friendship_requesterIdToUser: { select: { id: true, name: true, image: true } },
        User_Friendship_addresseeIdToUser: { select: { id: true, name: true, image: true } },
      },
    });

    // Notify the requester
    try {
      await NotificationService.createNotification({
        userId: friendship.requesterId,
        type: 'friend_request_accepted',
        title: 'Solicitud aceptada',
        message: `${friendship.User_Friendship_addresseeIdToUser.name || 'Someone'} accepted your friendship request`,
        actionUrl: `/profile/${friendship.addresseeId}`,
        metadata: {
          actorId: friendship.addresseeId,
          actorName: friendship.User_Friendship_addresseeIdToUser.name,
          actorAvatar: friendship.User_Friendship_addresseeIdToUser.image,
          relatedId: friendship.id,
          relatedType: 'friendship',
        },
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }

    return { success: true, friendship: updated };
  },

  /**
   * Decline friend request
   */
  async declineFriendRequest(friendshipId: string, userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      return { success: false, error: 'Solicitud no encontrada' };
    }

    // Only the recipient can decline
    if (friendship.addresseeId !== userId) {
      return { success: false, error: 'No tienes permiso para rechazar esta solicitud' };
    }

    if (friendship.status !== 'PENDING') {
      return { success: false, error: 'Esta solicitud ya fue procesada' };
    }

    await prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status: 'DECLINED',
        respondedAt: new Date(),
      },
    });

    return { success: true };
  },

  /**
   * Cancel friend request (sent by me)
   */
  async cancelFriendRequest(friendshipId: string, userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      return { success: false, error: 'Solicitud no encontrada' };
    }

    // Only the requester can cancel
    if (friendship.requesterId !== userId) {
      return { success: false, error: 'No tienes permiso para cancelar esta solicitud' };
    }

    if (friendship.status !== 'PENDING') {
      return { success: false, error: 'Esta solicitud ya fue procesada' };
    }

    await prisma.friendship.delete({
      where: { id: friendshipId },
    });

    return { success: true };
  },

  /**
   * Remove friendship
   */
  async removeFriend(friendshipId: string, userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      return { success: false, error: 'Amistad no encontrada' };
    }

    // Either user can remove the friendship
    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
      return { success: false, error: 'No tienes permiso para eliminar esta amistad' };
    }

    if (friendship.status !== 'ACCEPTED') {
      return { success: false, error: 'No son amigos' };
    }

    await prisma.friendship.delete({
      where: { id: friendshipId },
    });

    return { success: true };
  },

  /**
   * Block user
   */
  async blockUser(blockerId: string, blockedId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (blockerId === blockedId) {
      return { success: false, error: 'No puedes bloquearte a ti mismo' };
    }

    // Search for any existing relationship
    const existingSent = await prisma.friendship.findUnique({
      where: {
        requesterId_addresseeId: {
          requesterId: blockerId,
          addresseeId: blockedId,
        },
      },
    });

    const existingReceived = await prisma.friendship.findUnique({
      where: {
        requesterId_addresseeId: {
          requesterId: blockedId,
          addresseeId: blockerId,
        },
      },
    });

    // Delete existing relationship if any
    if (existingReceived) {
      await prisma.friendship.delete({
        where: { id: existingReceived.id },
      });
    }

    if (existingSent) {
      // Update to blocked
      await prisma.friendship.update({
        where: { id: existingSent.id },
        data: { status: 'BLOCKED' },
      });
    } else {
      // Create new block relationship
      await prisma.friendship.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          requesterId: blockerId,
          addresseeId: blockedId,
          status: 'BLOCKED',
        },
      });
    }

    return { success: true };
  },

  /**
   * Unblock user
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const block = await prisma.friendship.findUnique({
      where: {
        requesterId_addresseeId: {
          requesterId: blockerId,
          addresseeId: blockedId,
        },
      },
    });

    if (!block || block.status !== 'BLOCKED') {
      return { success: false, error: 'Usuario no bloqueado' };
    }

    await prisma.friendship.delete({
      where: { id: block.id },
    });

    return { success: true };
  },

  /**
   * Get friends list
   */
  async getFriends(
    userId: string,
    options: { page?: number; limit?: number; search?: string } = {}
  ): Promise<{
    friends: FriendshipWithUser[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, search } = options;

    const where = {
      OR: [
        { requesterId: userId, status: 'ACCEPTED' as FriendshipStatus },
        { addresseeId: userId, status: 'ACCEPTED' as FriendshipStatus },
      ],
    };

    const [friendships, total] = await Promise.all([
      prisma.friendship.findMany({
        where,
        include: {
          User_Friendship_requesterIdToUser: { select: { id: true, name: true, image: true, email: true } },
          User_Friendship_addresseeIdToUser: { select: { id: true, name: true, image: true, email: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { respondedAt: 'desc' },
      }),
      prisma.friendship.count({ where }),
    ]);

    // Map to get the friend (the other user)
    let friends = friendships.map((f) => {
      const friend = f.requesterId === userId ? f.User_Friendship_addresseeIdToUser : f.User_Friendship_requesterIdToUser;
      return {
        id: f.id,
        status: f.status,
        createdAt: f.createdAt,
        respondedAt: f.respondedAt,
        friend,
      };
    });

    // Filter by search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      friends = friends.filter(
        (f) =>
          f.friend.name?.toLowerCase().includes(searchLower) ||
          f.friend.email.toLowerCase().includes(searchLower)
      );
    }

    return {
      friends,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get pending received requests
   */
  async getPendingRequests(
    userId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{
    requests: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20 } = options;

    const where = {
      addresseeId: userId,
      status: 'PENDING' as FriendshipStatus,
    };

    const [requests, total] = await Promise.all([
      prisma.friendship.findMany({
        where,
        include: {
          User_Friendship_requesterIdToUser: { select: { id: true, name: true, image: true, email: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendship.count({ where }),
    ]);

    return {
      requests: requests.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        user: r.User_Friendship_requesterIdToUser,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get pending sent requests
   */
  async getSentRequests(
    userId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{
    requests: any[];
    total: number;
  }> {
    const { page = 1, limit = 20 } = options;

    const where = {
      requesterId: userId,
      status: 'PENDING' as FriendshipStatus,
    };

    const [requests, total] = await Promise.all([
      prisma.friendship.findMany({
        where,
        include: {
          User_Friendship_addresseeIdToUser: { select: { id: true, name: true, image: true, email: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendship.count({ where }),
    ]);

    return {
      requests: requests.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        user: r.User_Friendship_addresseeIdToUser,
      })),
      total,
    };
  },

  /**
   * Get blocked users
   */
  async getBlockedUsers(userId: string): Promise<any[]> {
    const blocked = await prisma.friendship.findMany({
      where: {
        requesterId: userId,
        status: 'BLOCKED',
      },
      include: {
        User_Friendship_addresseeIdToUser: { select: { id: true, name: true, image: true } },
      },
    });

    return blocked.map((b) => ({
      id: b.id,
      user: b.User_Friendship_addresseeIdToUser,
      blockedAt: b.updatedAt,
    }));
  },

  /**
   * Count pending requests (for badge)
   */
  async getPendingRequestsCount(userId: string): Promise<number> {
    return prisma.friendship.count({
      where: {
        addresseeId: userId,
        status: 'PENDING',
      },
    });
  },
};
