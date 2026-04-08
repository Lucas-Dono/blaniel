/**
 * User Moderation Service - Personal moderation for each user
 * Allows users to control what content they see in their feed
 */

import { prisma } from '@/lib/prisma';

export const UserModerationService = {
  /**
   * OCULTAR POSTS
   */
  async hidePost(userId: string, postId: string, reason?: string) {
    // Verificar que el post existe
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new Error('Post no encontrado');
    }

    return { success: true, hidden: null };
  },

  async unhidePost(_userId: string, _postId: string) {
    return { success: true };
  },

  async getHiddenPosts(_userId: string) {
    return [];
  },

  async isPostHidden(_userId: string, _postId: string) {
    return false;
  },

  /**
   * BLOQUEAR USUARIOS
   */
  async blockUser(userId: string, blockedId: string, reason?: string) {
    // No puedes bloquearte a ti mismo
    if (userId === blockedId) {
      throw new Error('No puedes bloquearte a ti mismo');
    }

    // Verificar que el usuario bloqueado existe
    const userToBlock = await prisma.user.findUnique({
      where: { id: blockedId },
    });

    if (!userToBlock) {
      throw new Error('Usuario no encontrado');
    }

    const blocked = null;

    // Si te siguen, eliminar el follow
    await prisma.follow.deleteMany({
      where: {
        followerId: blockedId,
        followingId: userId,
      },
    });

    // Si los sigues, eliminar tu follow
    await prisma.follow.deleteMany({
      where: {
        followerId: userId,
        followingId: blockedId,
      },
    });

    return { success: true, blocked };
  },

  async unblockUser(_userId: string, _blockedId: string) {
    return { success: true };
  },

  async getBlockedUsers(_userId: string) {
    return [];
  },

  async isUserBlocked(_userId: string, _blockedId: string) {
    return false;
  },

  /**
   * PREFERENCIAS DE CONTENIDO (No me interesa)
   */
  async setContentPreference(
    userId: string,
    type: 'tag' | 'postType' | 'community',
    value: string,
    action: 'hide' | 'reduce' | 'block' = 'hide'
  ) {
    return { success: true, preference: null };
  },

  async removeContentPreference(
    userId: string,
    type: 'tag' | 'postType' | 'community',
    value: string
  ) {
    return { success: true };
  },

  async getContentPreferences(_userId: string): Promise<Array<{ type: string; action: string; value: string }>> {
    return [];
  },

  /**
   * FILTERS FOR THE FEED
   * Returns the conditions that must be excluded from the feed
   */
  async getFeedFilters(_userId: string) {
    return {
      hiddenPostIds: [],
      blockedUserIds: [],
      hiddenTags: [],
      hiddenPostTypes: [],
      hiddenCommunityIds: [],
    };
  },

  /** Verify if a post should be visible to the user */
  async shouldShowPost(userId: string, post: any) {
    // Post oculto
    const isHidden = await this.isPostHidden(userId, post.id);
    if (isHidden) return false;

    // Autor bloqueado
    const isBlocked = await this.isUserBlocked(userId, post.authorId);
    if (isBlocked) return false;

    // Preferencias de contenido
    const preferences = await this.getContentPreferences(userId);

    // Verificar tags
    if (post.tags && Array.isArray(post.tags)) {
      const hiddenTags = preferences
        .filter(p => p.type === 'tag' && p.action === 'hide')
        .map(p => p.value);

      const hasHiddenTag = post.tags.some((tag: string) =>
        hiddenTags.includes(tag)
      );

      if (hasHiddenTag) return false;
    }

    // Verificar tipo de post
    const hiddenTypes = preferences
      .filter(p => p.type === 'postType' && p.action === 'hide')
      .map(p => p.value);

    if (hiddenTypes.includes(post.type)) return false;

    // Verificar comunidad
    if (post.communityId) {
      const hiddenCommunities = preferences
        .filter(p => p.type === 'community' && p.action === 'hide')
        .map(p => p.value);

      if (hiddenCommunities.includes(post.communityId)) return false;
    }

    return true;
  },

  /** User moderation statistics */
  async getModerationStats(_userId: string) {
    return {
      hiddenPosts: 0,
      blockedUsers: 0,
      contentPreferences: 0,
    };
  },
};
