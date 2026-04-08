/**
 * Conversation Tracking Service
 * Manages conversation tracking for "Your Circle"
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from "nanoid";

export interface ConversationTrackingData {
  userId: string;
  agentId: string;
  lastMessageAt?: Date;
  lastSeenAt?: Date;
  unreadCount?: number;
  totalMessages?: number;
  isPinned?: boolean;
}

export interface ConversationWithAgent {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar: string | null;
  staticDescription: string;
  unreadCount: number;
  lastMessageAt: Date;
  isPinned: boolean;
  totalMessages: number;
}

export class ConversationTrackingService {
  /**
   * Get or create conversation tracking
   */
  static async getOrCreate(userId: string, agentId: string) {
    return await prisma.conversationTracking.upsert({
      where: {
        userId_agentId: {
          userId,
          agentId
        }
      },
      update: {},
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        userId,
        agentId,
        lastMessageAt: new Date(),
        lastSeenAt: new Date(),
        unreadCount: 0,
        totalMessages: 0,
        isPinned: false
      }
    });
  }

  /**
   * Update tracking when message is sent
   */
  static async trackMessage(userId: string, agentId: string, role: string) {
    const tracking = await this.getOrCreate(userId, agentId);

    // If message is from agent, increment unreadCount
    // If message is from user, reset unreadCount and update lastSeenAt
    const updates: any = {
      lastMessageAt: new Date(),
      totalMessages: { increment: 1 }
    };

    if (role === 'assistant') {
      updates.unreadCount = { increment: 1 };
    } else if (role === 'user') {
      updates.unreadCount = 0;
      updates.lastSeenAt = new Date();
    }

    return await prisma.conversationTracking.update({
      where: { id: tracking.id },
      data: updates
    });
  }

  /**
   * Mark conversation as read
   */
  static async markAsRead(userId: string, agentId: string) {
    return await prisma.conversationTracking.updateMany({
      where: {
        userId,
        agentId
      },
      data: {
        unreadCount: 0,
        lastSeenAt: new Date()
      }
    });
  }

  /**
   * Obtener conversaciones recientes del usuario
   */
  static async getRecentConversations(
    userId: string,
    limit = 10
  ): Promise<ConversationWithAgent[]> {
    const conversations = await prisma.conversationTracking.findMany({
      where: { userId },
      orderBy: [
        { isPinned: 'desc' },
        { lastMessageAt: 'desc' }
      ],
      take: limit,
      include: {
        Agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
            description: true,
            aiGeneratedFields: true
          }
        }
      }
    });

    return conversations.map(conv => {
      const aiFields = conv.Agent.aiGeneratedFields as any;
      const staticDescription = aiFields?.staticDescription || conv.Agent.description || `Chat con ${conv.Agent.name}`;

      return {
        id: conv.id,
        agentId: conv.Agent.id,
        agentName: conv.Agent.name,
        agentAvatar: conv.Agent.avatar,
        staticDescription,
        unreadCount: conv.unreadCount,
        lastMessageAt: conv.lastMessageAt,
        isPinned: conv.isPinned,
        totalMessages: conv.totalMessages
      };
    });
  }

  /**
   * Obtener conteo total de mensajes sin leer
   */
  static async getTotalUnreadCount(userId: string): Promise<number> {
    const result = await prisma.conversationTracking.aggregate({
      where: { userId },
      _sum: {
        unreadCount: true
      }
    });

    return result._sum.unreadCount || 0;
  }

  /**
   * Fijar/desfijar conversación
   */
  static async togglePin(userId: string, agentId: string) {
    const tracking = await prisma.conversationTracking.findUnique({
      where: {
        userId_agentId: {
          userId,
          agentId
        }
      }
    });

    if (!tracking) {
      throw new Error('Conversation tracking not found');
    }

    return await prisma.conversationTracking.update({
      where: { id: tracking.id },
      data: {
        isPinned: !tracking.isPinned
      }
    });
  }

  /**
   * Limpiar conversaciones antiguas (útil para mantenimiento)
   */
  static async cleanupOldConversations(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await prisma.conversationTracking.deleteMany({
      where: {
        lastMessageAt: {
          lt: cutoffDate
        },
        isPinned: false,
        unreadCount: 0
      }
    });
  }
}
