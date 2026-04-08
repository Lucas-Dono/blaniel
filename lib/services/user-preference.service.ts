import { nanoid } from "nanoid";
import { prisma } from '@/lib/prisma';

interface PreferenceUpdate {
  postType?: string;
  tags?: string[];
  communityId?: string;
}

export class UserPreferenceService {
  /**
   * Increment user preferences based on an action (follow, like, comment, etc.)
   */
  static async incrementPreference(
    userId: string,
    data: PreferenceUpdate,
    weight: number = 1
  ) {
    // Get o crear preferencias del usuario
    let preferences = await prisma.userContentPreference.findUnique({
      where: { userId }
    });

    if (!preferences) {
      preferences = await prisma.userContentPreference.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          userId,
          preferredPostTypes: {},
          preferredTags: {},
          preferredCommunities: {}
        }
      });
    }

    // Parsear JSON actual
    const postTypes = (preferences.preferredPostTypes as any) || {};
    const tags = (preferences.preferredTags as any) || {};
    const communities = (preferences.preferredCommunities as any) || {};

    // Incrementar tipo de post
    if (data.postType) {
      postTypes[data.postType] = (postTypes[data.postType] || 0) + weight;
    }

    // Incrementar tags
    if (data.tags && data.tags.length > 0) {
      data.tags.forEach(tag => {
        tags[tag] = (tags[tag] || 0) + weight;
      });
    }

    // Incrementar comunidad
    if (data.communityId) {
      communities[data.communityId] = (communities[data.communityId] || 0) + weight;
    }

    // Update en DB
    const updated = await prisma.userContentPreference.update({
      where: { userId },
      data: {
        preferredPostTypes: postTypes,
        preferredTags: tags,
        preferredCommunities: communities
      }
    });

    return updated;
  }

  /**
   * Obtener preferencias del usuario
   */
  static async getUserPreferences(userId: string) {
    let preferences = await prisma.userContentPreference.findUnique({
      where: { userId }
    });

    if (!preferences) {
      // Create empty preferences if they don't exist
      preferences = await prisma.userContentPreference.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          userId,
          preferredPostTypes: {},
          preferredTags: {},
          preferredCommunities: {}
        }
      });
    }

    return {
      postTypes: (preferences.preferredPostTypes as any) || {},
      tags: (preferences.preferredTags as any) || {},
      communities: (preferences.preferredCommunities as any) || {}
    };
  }

  /**
   * Calcular score personalizado para un post
   */
  static calculatePersonalizedScore(
    post: {
      upvotes: number;
      downvotes: number;
      type: string;
      tags: any;
      communityId: string | null;
    },
    preferences: {
      postTypes: Record<string, number>;
      tags: Record<string, number>;
      communities: Record<string, number>;
    }
  ): number {
    // Score base (engagement)
    let score = post.upvotes - post.downvotes;

    // Bonus por tipo de post
    const typeBonus = preferences.postTypes[post.type] || 0;
    score += typeBonus * 2;

    // Bonus por tags
    const postTags = Array.isArray(post.tags) ? post.tags : [];
    postTags.forEach((tag: string) => {
      const tagBonus = preferences.tags[tag] || 0;
      score += tagBonus * 1.5;
    });

    // Bonus por comunidad
    if (post.communityId) {
      const communityBonus = preferences.communities[post.communityId] || 0;
      score += communityBonus * 3;
    }

    return score;
  }

  /**
   * Register user action (to update preferences)
   * Diferentes acciones tienen diferentes pesos
   */
  static async trackAction(
    userId: string,
    action: 'follow' | 'upvote' | 'comment' | 'save' | 'view',
    postData: PreferenceUpdate
  ) {
    // Map action to weight
    const weights = {
      follow: 3,   // Strong signal of interest
      save: 2,     // Saves for later
      comment: 2,  // Active engagement
      upvote: 1,   // Likes
      view: 0.5    // Just viewed the post
    };

    const weight = weights[action];

    return await this.incrementPreference(userId, postData, weight);
  }

  /**
   * Resetear preferencias de un usuario
   */
  static async resetPreferences(userId: string) {
    return await prisma.userContentPreference.update({
      where: { userId },
      data: {
        preferredPostTypes: {},
        preferredTags: {},
        preferredCommunities: {}
      }
    });
  }
}
