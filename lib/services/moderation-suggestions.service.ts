/**
 * Moderation Suggestions Service
 * 
 * Intelligent system that analyzes user moderation patterns
 * and automatically suggests filters and blocks based on their behavior.
 */

import { prisma } from '@/lib/prisma';

interface Suggestion {
  id: string;
  type: 'block_user' | 'hide_tag' | 'hide_post_type' | 'hide_community';
  title: string;
  description: string;
  action: {
    type: string;
    value: string;
    metadata?: any;
  };
  confidence: number; // 0-100
  reason: string;
}

export const ModerationSuggestionsService = {
  /** Get intelligent suggestions for the user */
  async getSuggestions(_userId: string): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Get recent moderation data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const hiddenPosts: any[] = [];
    const blockedUsers: any[] = [];
    const contentPreferences: any[] = [];

    const blockedUserIds = new Set(blockedUsers.map((b: any) => b.blockedId));
    const existingPreferences = new Set(
      contentPreferences.map((p: any) => `${p.type}:${p.value}`)
    );

    // 1. Analizar autores de posts ocultos frecuentemente
    const authorFrequency = new Map<string, number>();
    hiddenPosts.forEach((hp: any) => {
      if (hp.post?.authorId) {
        const count = authorFrequency.get(hp.post.authorId) || 0;
        authorFrequency.set(hp.post.authorId, count + 1);
      }
    });

    // Sugerir bloquear autores con 3+ posts ocultos
    for (const [authorId, count] of authorFrequency.entries()) {
      if (count >= 3 && !blockedUserIds.has(authorId)) {
        const author = await prisma.user.findUnique({
          where: { id: authorId },
          select: { name: true },
        });

        suggestions.push({
          id: `block-${authorId}`,
          type: 'block_user',
          title: `Bloquear a ${author?.name || 'este usuario'}`,
          description: `You have hidden ${count} posts from this user in the last month`,
          action: {
            type: 'block_user',
            value: authorId,
            metadata: { userName: author?.name },
          },
          confidence: Math.min(100, count * 25),
          reason: `Ocultaste ${count} posts de este autor`,
        });
      }
    }

    // 2. Analizar tags frecuentes en posts ocultos
    const tagFrequency = new Map<string, number>();
    hiddenPosts.forEach((hp: any) => {
      if (hp.post?.tags) {
        hp.post.tags.forEach((tag: string) => {
          const count = tagFrequency.get(tag) || 0;
          tagFrequency.set(tag, count + 1);
        });
      }
    });

    // Sugerir ocultar tags con 4+ ocurrencias
    for (const [tag, count] of tagFrequency.entries()) {
      const prefKey = `tag:${tag}`;
      if (count >= 4 && !existingPreferences.has(prefKey)) {
        suggestions.push({
          id: `hide-tag-${tag}`,
          type: 'hide_tag',
          title: `No me interesa #${tag}`,
          description: `Has ocultado ${count} posts con esta etiqueta`,
          action: {
            type: 'content_preference',
            value: JSON.stringify({ type: 'tag', value: tag, action: 'hide' }),
          },
          confidence: Math.min(100, count * 20),
          reason: `Ocultaste ${count} posts con esta etiqueta`,
        });
      }
    }

    // 3. Analizar tipos de posts ocultos frecuentemente
    const typeFrequency = new Map<string, number>();
    hiddenPosts.forEach((hp: any) => {
      if (hp.post?.type) {
        const count = typeFrequency.get(hp.post.type) || 0;
        typeFrequency.set(hp.post.type, count + 1);
      }
    });

    // Sugerir ocultar tipos con 5+ ocurrencias
    for (const [type, count] of typeFrequency.entries()) {
      const prefKey = `postType:${type}`;
      if (count >= 5 && !existingPreferences.has(prefKey)) {
        const typeLabels: Record<string, string> = {
          question: 'Preguntas',
          discussion: 'Discusiones',
          showcase: 'Showcases',
          guide: 'Guides',
          news: 'Noticias',
        };

        suggestions.push({
          id: `hide-type-${type}`,
          type: 'hide_post_type',
          title: `No me interesan los posts de tipo "${typeLabels[type] || type}"`,
          description: `Has ocultado ${count} posts de este tipo`,
          action: {
            type: 'content_preference',
            value: JSON.stringify({ type: 'postType', value: type, action: 'hide' }),
          },
          confidence: Math.min(100, count * 15),
          reason: `Ocultaste ${count} posts de este tipo`,
        });
      }
    }

    // 4. Analizar comunidades frecuentes en posts ocultos
    const communityFrequency = new Map<string, number>();
    hiddenPosts.forEach((hp: any) => {
      if (hp.post?.communityId) {
        const count = communityFrequency.get(hp.post.communityId) || 0;
        communityFrequency.set(hp.post.communityId, count + 1);
      }
    });

    // Sugerir ocultar comunidades con 3+ posts ocultos
    for (const [communityId, count] of communityFrequency.entries()) {
      const prefKey = `community:${communityId}`;
      if (count >= 3 && !existingPreferences.has(prefKey)) {
        const community = await prisma.community.findUnique({
          where: { id: communityId },
          select: { name: true },
        });

        suggestions.push({
          id: `hide-community-${communityId}`,
          type: 'hide_community',
          title: `No me interesa la comunidad "${community?.name || 'esta comunidad'}"`,
          description: `Has ocultado ${count} posts de esta comunidad`,
          action: {
            type: 'content_preference',
            value: JSON.stringify({ type: 'community', value: communityId, action: 'hide' }),
            metadata: { communityName: community?.name },
          },
          confidence: Math.min(100, count * 25),
          reason: `Ocultaste ${count} posts de esta comunidad`,
        });
      }
    }

    // Ordenar sugerencias por confianza (mayor a menor)
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  },

  /** Apply a suggestion automatically */
  async applySuggestion(userId: string, suggestionId: string): Promise<boolean> {
    const suggestions = await this.getSuggestions(userId);
    const suggestion = suggestions.find(s => s.id === suggestionId);

    if (!suggestion) {
      throw new Error('Sugerencia no encontrada');
    }

    throw new Error('Suggestion application disabled - models removed');

    return true;
  },

  /**
   * Dismiss a suggestion (so it's not shown again)
   * This could be saved in a separate table if you wanted to track dismissals
   */
  async dismissSuggestion(_userId: string, _suggestionId: string): Promise<boolean> {
    // Por ahora solo retornamos true
    // In the future, you could save this in a DismissedSuggestions table
    return true;
  },

  /** Get a summary of recent moderation actions */
  async getModerationSummary(userId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const recentHides = 0;
    const recentBlocks = 0;
    const recentPreferences = 0;

    return {
      recentHides,
      recentBlocks,
      recentPreferences,
      totalActions: recentHides + recentBlocks + recentPreferences,
      period: `${days} days`,
    };
  },
};
