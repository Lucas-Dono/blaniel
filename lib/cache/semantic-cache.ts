/**
 * SEMANTIC CACHE SYSTEM
 * Sistema de caché semántico para respuestas de IA
 *
 * Reduce costos de API en ~30% al cachear respuestas similares
 * usando búsqueda por similitud vectorial
 */

import { redis } from '@/lib/redis/config';
import { generateEmbedding } from '@/lib/memory/embeddings';
import { cosineSimilarity } from '@/lib/memory/unified-retrieval';

export interface CachedResponse {
  /** Prompt original */
  prompt: string;
  /** Embedding del prompt */
  embedding: number[];
  /** Respuesta cacheada */
  response: string;
  /** Metadata adicional */
  metadata: {
    agentId: string;
    model: string;
    temperature: number;
    timestamp: number;
    hitCount: number;
  };
  /** TTL en segundos */
  ttl: number;
}

export interface SemanticCacheConfig {
  /** Umbral de similitud (0-1). Por defecto: 0.85 */
  similarityThreshold?: number;
  /** TTL por defecto en segundos. Por defecto: 7 días */
  defaultTtl?: number;
  /** Namespace para las keys de Redis */
  namespace?: string;
  /** Máximo de candidatos a revisar */
  maxCandidates?: number;
}

const DEFAULT_CONFIG: Required<SemanticCacheConfig> = {
  similarityThreshold: 0.85, // 85% de similitud
  defaultTtl: 7 * 24 * 60 * 60, // 7 días
  namespace: 'semantic_cache',
  maxCandidates: 50, // Revisar hasta 50 candidatos
};

/**
 * Clase principal del Semantic Cache
 */
export class SemanticCache {
  private config: Required<SemanticCacheConfig>;

  constructor(config: SemanticCacheConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Genera una key de Redis para el cache
   */
  private getCacheKey(agentId: string, promptHash: string): string {
    return `${this.config.namespace}:${agentId}:${promptHash}`;
  }

  /**
   * Genera una key de índice para búsqueda
   */
  private getIndexKey(agentId: string): string {
    return `${this.config.namespace}:index:${agentId}`;
  }

  /**
   * Hash simple para usar como ID
   */
  private hashPrompt(prompt: string): string {
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Busca una respuesta cacheada similar
   */
  async get(
    prompt: string,
    agentId: string,
    options?: {
      model?: string;
      temperature?: number;
    }
  ): Promise<string | null> {
    try {
      // 1. Generar embedding del prompt
      const embedding = await generateEmbedding(prompt);

      // 2. Get candidates from index
      const indexKey = this.getIndexKey(agentId);
      const candidates = await redis.zrange(indexKey, 0, this.config.maxCandidates - 1);

      if (!candidates || candidates.length === 0) {
        return null;
      }

      // 3. Calcular similitud con cada candidato
      let bestMatch: {
        key: string;
        similarity: number;
        cached: CachedResponse;
      } | null = null;

      for (const candidateKey of candidates) {
        const cachedData = await redis.get(candidateKey);
        if (!cachedData) {
          // Limpiar del índice si ya no existe
          await redis.zrem(indexKey, candidateKey);
          continue;
        }

        const cached: CachedResponse = JSON.parse(cachedData);

        // Filtrar por modelo y temperatura si se especifican
        if (options?.model && cached.metadata.model !== options.model) {
          continue;
        }
        if (
          options?.temperature !== undefined &&
          Math.abs(cached.metadata.temperature - options.temperature) > 0.1
        ) {
          continue;
        }

        // Calcular similitud
        const similarity = cosineSimilarity(embedding, cached.embedding);

        if (
          similarity >= this.config.similarityThreshold &&
          (!bestMatch || similarity > bestMatch.similarity)
        ) {
          bestMatch = {
            key: candidateKey,
            similarity,
            cached,
          };
        }
      }

      // 4. Retornar mejor match si existe
      if (bestMatch) {
        // Incrementar hit count
        bestMatch.cached.metadata.hitCount++;
        await redis.set(
          bestMatch.key,
          JSON.stringify(bestMatch.cached),
          'EX',
          bestMatch.cached.ttl
        );

        // Update score en el índice (más hits = mayor prioridad)
        await redis.zadd(
          indexKey,
          bestMatch.cached.metadata.hitCount,
          bestMatch.key
        );

        console.log(
          `[SemanticCache] HIT - Similarity: ${(bestMatch.similarity * 100).toFixed(1)}% - Hits: ${bestMatch.cached.metadata.hitCount}`
        );

        return bestMatch.cached.response;
      }

      return null;
    } catch (error) {
      console.error('[SemanticCache] Error getting cached response:', error);
      return null;
    }
  }

  /**
   * Guarda una respuesta en el cache
   */
  async set(
    prompt: string,
    response: string,
    agentId: string,
    options?: {
      model?: string;
      temperature?: number;
      ttl?: number;
    }
  ): Promise<void> {
    try {
      // 1. Generar embedding del prompt
      const embedding = await generateEmbedding(prompt);

      // 2. Crear entrada de cache
      const promptHash = this.hashPrompt(prompt);
      const cacheKey = this.getCacheKey(agentId, promptHash);

      const cached: CachedResponse = {
        prompt,
        embedding,
        response,
        metadata: {
          agentId,
          model: options?.model || 'unknown',
          temperature: options?.temperature ?? 0.7,
          timestamp: Date.now(),
          hitCount: 0,
        },
        ttl: options?.ttl || this.config.defaultTtl,
      };

      // 3. Guardar en Redis
      await redis.set(cacheKey, JSON.stringify(cached), 'EX', cached.ttl);

      // 4. Add to index (initial score = 0)
      const indexKey = this.getIndexKey(agentId);
      await redis.zadd(indexKey, 0, cacheKey);

      console.log(`[SemanticCache] SET - Agent: ${agentId} - TTL: ${cached.ttl}s`);
    } catch (error) {
      console.error('[SemanticCache] Error setting cache:', error);
    }
  }

  /**
   * Invalida el cache de un agente específico
   */
  async invalidate(agentId: string): Promise<void> {
    try {
      const indexKey = this.getIndexKey(agentId);
      const keys = await redis.zrange(indexKey, 0, -1);

      if (keys && keys.length > 0) {
        // Delete todas las entradas
        await redis.del(...keys);
        // Delete the index
        await redis.del(indexKey);

        console.log(
          `[SemanticCache] INVALIDATE - Agent: ${agentId} - Deleted: ${keys.length} entries`
        );
      }
    } catch (error) {
      console.error('[SemanticCache] Error invalidating cache:', error);
    }
  }

  /**
   * Invalida entradas antiguas (limpieza)
   */
  async cleanup(agentId?: string): Promise<void> {
    try {
      const pattern = agentId
        ? `${this.config.namespace}:index:${agentId}`
        : `${this.config.namespace}:index:*`;

      // Get all indexes
      const indices = await redis.keys(pattern);

      let totalCleaned = 0;

      for (const indexKey of indices) {
        const keys = await redis.zrange(indexKey, 0, -1);

        for (const key of keys) {
          const exists = await redis.exists(key);
          if (!exists) {
            // Delete from index if no longer exists
            await redis.zrem(indexKey, key);
            totalCleaned++;
          }
        }
      }

      if (totalCleaned > 0) {
        console.log(`[SemanticCache] CLEANUP - Removed ${totalCleaned} stale entries`);
      }
    } catch (error) {
      console.error('[SemanticCache] Error during cleanup:', error);
    }
  }

  /**
   * Obtiene estadísticas del cache
   */
  async getStats(agentId: string): Promise<{
    totalEntries: number;
    totalHits: number;
    avgHitCount: number;
    oldestEntry: number;
    newestEntry: number;
  }> {
    try {
      const indexKey = this.getIndexKey(agentId);
      const keys = await redis.zrange(indexKey, 0, -1);

      if (!keys || keys.length === 0) {
        return {
          totalEntries: 0,
          totalHits: 0,
          avgHitCount: 0,
          oldestEntry: 0,
          newestEntry: 0,
        };
      }

      let totalHits = 0;
      let oldestEntry = Infinity;
      let newestEntry = 0;

      for (const key of keys) {
        const cachedData = await redis.get(key);
        if (cachedData) {
          const cached: CachedResponse = JSON.parse(cachedData);
          totalHits += cached.metadata.hitCount;
          oldestEntry = Math.min(oldestEntry, cached.metadata.timestamp);
          newestEntry = Math.max(newestEntry, cached.metadata.timestamp);
        }
      }

      return {
        totalEntries: keys.length,
        totalHits,
        avgHitCount: totalHits / keys.length,
        oldestEntry: oldestEntry === Infinity ? 0 : oldestEntry,
        newestEntry,
      };
    } catch (error) {
      console.error('[SemanticCache] Error getting stats:', error);
      return {
        totalEntries: 0,
        totalHits: 0,
        avgHitCount: 0,
        oldestEntry: 0,
        newestEntry: 0,
      };
    }
  }
}

/**
 * Instancia global del cache
 */
export const semanticCache = new SemanticCache();

/**
 * Helper: Wrapper para cachear llamadas de IA
 */
export async function withSemanticCache<T extends string>(
  prompt: string,
  agentId: string,
  generator: () => Promise<T>,
  options?: {
    model?: string;
    temperature?: number;
    ttl?: number;
    enabled?: boolean;
  }
): Promise<T> {
  // Si el cache está deshabilitado, ejecutar directamente
  if (options?.enabled === false) {
    return generator();
  }

  try {
    // 1. Intentar obtener del cache
    const cached = await semanticCache.get(prompt, agentId, {
      model: options?.model,
      temperature: options?.temperature,
    });

    if (cached) {
      return cached as T;
    }

    // 2. Generar nueva respuesta
    const response = await generator();

    // 3. Guardar en cache
    await semanticCache.set(prompt, response, agentId, {
      model: options?.model,
      temperature: options?.temperature,
      ttl: options?.ttl,
    });

    return response;
  } catch (error) {
    console.error('[SemanticCache] Error in withSemanticCache:', error);
    // En caso de error, ejecutar el generador directamente
    return generator();
  }
}
