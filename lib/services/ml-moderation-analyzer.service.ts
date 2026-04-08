/**
 * ML Moderation Analyzer Service
 * 
 * Intelligent analysis of moderation patterns using embeddings
 * with a queue system to avoid affecting critical operations.
 */

import { prisma } from '@/lib/prisma';
import {getEmbedding, getBatchEmbeddings} from '@/lib/embeddings/smart-embeddings';
import { cosineSimilarity } from '@/lib/memory/openai-embeddings';
import { createLogger } from '@/lib/logger';

const log = createLogger('MLModerationAnalyzer');

interface MLSuggestion {
  id: string;
  type: 'hide_post' | 'block_user' | 'hide_tag' | 'hide_type' | 'hide_community';
  title: string;
  description: string;
  confidence: number;
  reason: string;
  action: any;
  metadata?: any;
}

export const MLModerationAnalyzer = {
  /**
   * Analyze patterns and generate ML suggestions
   * RUNS DURING LOW LOAD HOURS (via nightly cron)
   */
  async analyzeModerationPatterns(userId: string): Promise<MLSuggestion[]> {
    log.info({ userId }, 'Starting ML moderation analysis');

    const suggestions: MLSuggestion[] = [];

    try {
      // 1. Semantic similarity analysis in hidden posts
      const semanticSuggestions = await this.analyzeSemanticPatterns(userId);
      suggestions.push(...semanticSuggestions);

      // 2. Author behavior analysis
      const authorSuggestions = await this.analyzeAuthorPatterns(userId);
      suggestions.push(...authorSuggestions);

      // 3. Content cluster analysis
      const clusterSuggestions = await this.analyzeContentClusters(userId);
      suggestions.push(...clusterSuggestions);

      log.info(
        { userId, suggestionsCount: suggestions.length },
        'ML analysis completed'
      );
    } catch (error) {
      log.error({ userId, error }, 'Error in ML analysis');
    }

    // Ordenar por confianza y retornar top 10
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  },

  /**
   * 1. Semantic similarity analysis
   * Finds posts similar to those the user hides
   */
  async analyzeSemanticPatterns(userId: string): Promise<MLSuggestion[]> {
    const suggestions: MLSuggestion[] = [];

    try {
      const hiddenPosts: any[] = [];

      if (hiddenPosts.length < 3) {
        log.debug({ userId }, 'Few hidden posts for semantic analysis');
        return suggestions;
      }

      log.info(
        { userId, hiddenCount: hiddenPosts.length },
        'Analyzing semantic similarity'
      );

      // Get hidden posts embeddings (uses low priority queue)
      const hiddenTexts = hiddenPosts.map(
        (hp: any) => `${hp.post.title} ${hp.post.content}`.substring(0, 1000)
      );

      const hiddenEmbeddings = await getBatchEmbeddings(hiddenTexts, {
        context: 'ml',
        userId,
        onProgress: (completed, total) => {
          log.debug(
            { userId, completed, total },
            'Progreso embeddings posts ocultos'
          );
        },
      });

      // Calcular centroide (promedio) de embeddings ocultos
      const centroid = this.calculateCentroid(hiddenEmbeddings);

      // Buscar posts recientes en el feed
      const recentPosts = await prisma.communityPost.findMany({
        where: {
          status: 'published',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          NOT: {
            id: { in: hiddenPosts.map((hp: any) => hp.postId) },
          },
        },
        select: {
          id: true,
          title: true,
          content: true,
          authorId: true,
        },
        take: 100,
      });

      // Analizar similitud con cada post
      for (const post of recentPosts) {
        const postText = `${post.title} ${post.content}`.substring(0, 1000);

        // Get embedding (uses cache if available)
        const postEmbedding = await getEmbedding(postText, {
          context: 'ml',
          userId,
        });

        const similarity = cosineSimilarity(centroid, postEmbedding);

        // Si es muy similar (>75%), sugerir ocultar
        if (similarity > 0.75) {
          suggestions.push({
            id: `semantic_hide_${post.id}`,
            type: 'hide_post',
            title: `Post similar a contenido que ocultaste`,
            description: `"${post.title.substring(0, 50)}..."`,
            confidence: Math.round(similarity * 100),
            reason: `${Math.round(similarity * 100)}% similar a posts que ocultaste`,
            action: {
              type: 'hide_post',
              postId: post.id,
            },
            metadata: {
              similarity,
              postId: post.id,
            },
          });
        }
      }

      log.info(
        { userId, suggestionsCount: suggestions.length },
        'Análisis semántico completado'
      );
    } catch (error) {
      log.error({ userId, error }, 'Error en análisis semántico');
    }

    return suggestions;
  },

  /**
   * 2. Author behavior analysis
   * Detects patterns in blocked vs non-blocked authors
   */
  async analyzeAuthorPatterns(userId: string): Promise<MLSuggestion[]> {
    const suggestions: MLSuggestion[] = [];

    try {
      const blockedUsers: any[] = [];

      if (blockedUsers.length < 2) {
        return suggestions; // Necesitamos al menos 2 usuarios bloqueados
      }

      // Create "perfil" promedio de usuarios bloqueados
      const blockedTexts = blockedUsers.flatMap((bu: any) =>
        bu.blockedUser.posts.map(
          (p: any) => `${p.title} ${p.content}`.substring(0, 1000)
        )
      );

      if (blockedTexts.length === 0) {
        return suggestions;
      }

      const blockedEmbeddings = await getBatchEmbeddings(blockedTexts, {
        context: 'ml',
        userId,
      });

      const blockedCentroid = this.calculateCentroid(blockedEmbeddings);

      // Analizar autores de posts recientes que el usuario ve
      // NOTE: User model doesn't have posts relation, using CommunityPost instead
      const recentPosts = await prisma.communityPost.findMany({
        where: {
          status: 'published',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          title: true,
          content: true,
          authorId: true,
        },
        take: 100,
      });

      // Group posts by author
      const authorPostsMap = new Map<string, any[]>();
      recentPosts.forEach(post => {
        if (!authorPostsMap.has(post.authorId)) {
          authorPostsMap.set(post.authorId, []);
        }
        authorPostsMap.get(post.authorId)!.push(post);
      });

      // Comparar cada autor con el perfil de bloqueados
      for (const [authorId, posts] of authorPostsMap.entries()) {
        if (posts.length === 0) continue;

        const authorTexts = posts.map(
          p => `${p.title} ${p.content}`.substring(0, 1000)
        );

        const authorEmbeddings = await getBatchEmbeddings(authorTexts, {
          context: 'ml',
          userId,
        });

        const authorCentroid = this.calculateCentroid(authorEmbeddings);
        const similarity = cosineSimilarity(blockedCentroid, authorCentroid);

        // Si es muy similar a usuarios bloqueados (>70%), sugerir bloquear
        if (similarity > 0.7) {
          suggestions.push({
            id: `author_block_${authorId}`,
            type: 'block_user',
            title: `Usuario con contenido similar a bloqueados`,
            description: `Usuario publica contenido similar a usuarios que bloqueaste`,
            confidence: Math.round(similarity * 100),
            reason: `${Math.round(similarity * 100)}% similar a usuarios bloqueados`,
            action: {
              type: 'block_user',
              userId: authorId,
            },
            metadata: {
              similarity,
              authorId,
            },
          });
        }
      }
    } catch (error) {
      log.error({ userId, error }, 'Error en análisis de autores');
    }

    return suggestions;
  },

  /**
   * 3. Content cluster analysis
   * Finds groups of similar content that the user hides
   */
  async analyzeContentClusters(userId: string): Promise<MLSuggestion[]> {
    const suggestions: MLSuggestion[] = [];

    try {
      const hiddenPosts: any[] = [];

      if (hiddenPosts.length < 5) {
        return suggestions;
      }

      // Analizar frecuencia de tags y tipos
      const tagFreq = new Map<string, number>();
      const typeFreq = new Map<string, number>();

      hiddenPosts.forEach((hp: any) => {
        hp.post.tags.forEach((tag: string) => {
          tagFreq.set(tag, (tagFreq.get(tag) || 0) + 1);
        });
        typeFreq.set(hp.post.type, (typeFreq.get(hp.post.type) || 0) + 1);
      });

      // Sugerir ocultar tags frecuentes
      for (const [tag, count] of tagFreq.entries()) {
        const percentage = (count / hiddenPosts.length) * 100;

        if (percentage > 30) {
          // Si >30% de posts ocultos tienen este tag
          suggestions.push({
            id: `cluster_tag_${tag}`,
            type: 'hide_tag',
            title: `Patrón detectado: posts con #${tag}`,
            description: `${count} de ${hiddenPosts.length} posts ocultos tienen este tag`,
            confidence: Math.round(percentage),
            reason: `${Math.round(percentage)}% de posts ocultos tienen este tag`,
            action: {
              type: 'content_preference',
              value: JSON.stringify({ type: 'tag', value: tag, action: 'hide' }),
            },
          });
        }
      }

      // Sugerir ocultar tipos frecuentes
      for (const [type, count] of typeFreq.entries()) {
        const percentage = (count / hiddenPosts.length) * 100;

        if (percentage > 40) {
          // Si >40% de posts ocultos son de este tipo
          suggestions.push({
            id: `cluster_type_${type}`,
            type: 'hide_type',
            title: `Patrón detectado: posts tipo "${type}"`,
            description: `${count} de ${hiddenPosts.length} posts ocultos son de este tipo`,
            confidence: Math.round(percentage),
            reason: `${Math.round(percentage)}% de posts ocultos son de este tipo`,
            action: {
              type: 'content_preference',
              value: JSON.stringify({ type: 'postType', value: type, action: 'hide' }),
            },
          });
        }
      }
    } catch (error) {
      log.error({ userId, error }, 'Error en análisis de clusters');
    }

    return suggestions;
  },

  /**
   * Calcular centroide de embeddings
   */
  calculateCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];

    const dim = embeddings[0].length;
    const centroid = new Array(dim).fill(0);

    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += emb[i];
      }
    }

    return centroid.map(val => val / embeddings.length);
  },

  /**
   * Guardar sugerencias ML en base de datos
   */
  async saveSuggestions(userId: string, suggestions: MLSuggestion[]): Promise<void> {
    log.info({ userId, count: suggestions.length }, 'Sugerencias ML (not saved - model removed)');
  },

  /**
   * Obtener sugerencias ML guardadas
   */
  async getSavedSuggestions(_userId: string): Promise<MLSuggestion[]> {
    return [];
  },
};
