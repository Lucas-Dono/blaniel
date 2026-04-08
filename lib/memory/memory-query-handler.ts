/**
 * MEMORY QUERY HANDLER
 *
 * Orchestrates memory search and retrieval when a past-related query is detected.
 *
 * FLOW:
 * 1. Detects memory query with detector
 * 2. Extracts keywords and context
 * 3. Semantic search in:
 *    - Episodic Memory (important events)
 *    - RAG Messages (past conversations)
 *    - Semantic Memory (facts/preferences)
 * 4. Ranks and filters results
 * 5. Formats context to include in prompt
 *
 * PERFORMANCE:
 * - Detection: <15ms
 * - Semantic search: <500ms (with embeddings)
 * - Total: <600ms overhead
 *
 * LIMITS:
 * - Max 5 memories per query (configurable)
 * - Min similarity: 0.5 (configurable)
 * - Max tokens: 1000 (to not saturate prompt)
 */

import { memoryQueryDetector, MemoryQueryDetection } from './memory-query-detector';
import { MemoryRetrievalSystem } from '@/lib/emotional-system/modules/memory/retrieval';
import { unifiedMemoryRetrieval, MemoryChunk } from './unified-retrieval';
import { createLogger } from '@/lib/logger';

const log = createLogger('MemoryQueryHandler');

export interface MemoryQueryResult {
  detected: boolean;
  detection: MemoryQueryDetection;
  memories: MemoryChunk[];
  contextPrompt: string;
  metadata: {
    searchTimeMs: number;
    memoriesFound: number;
    avgSimilarity: number;
    sources: {
      episodic: number;
      rag: number;
      knowledge: number;
    };
  };
}

export interface MemoryQueryConfig {
  maxMemories?: number;
  minSimilarity?: number;
  maxTokens?: number;
  useSemanticSearch?: boolean;
}

const DEFAULT_CONFIG: Required<MemoryQueryConfig> = {
  maxMemories: 5,
  minSimilarity: 0.5,
  maxTokens: 1000,
  useSemanticSearch: true,
};

export class MemoryQueryHandler {
  private memoryRetrieval: MemoryRetrievalSystem;

  constructor() {
    this.memoryRetrieval = new MemoryRetrievalSystem();
  }

  /**
   * Process a message and return relevant memories if it's a query
   */
  async handleQuery(
    message: string,
    agentId: string,
    userId: string,
    config: MemoryQueryConfig = {}
  ): Promise<MemoryQueryResult> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const startTime = Date.now();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: DETECT MEMORY QUERY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const detection = memoryQueryDetector.detectMemoryQuery(message);

    if (!detection.isMemoryQuery || detection.confidence < 0.4) {
      log.debug({ message: message.substring(0, 100), confidence: detection.confidence }, 'Not a memory query');

      return {
        detected: false,
        detection,
        memories: [],
        contextPrompt: '',
        metadata: {
          searchTimeMs: Date.now() - startTime,
          memoriesFound: 0,
          avgSimilarity: 0,
          sources: { episodic: 0, rag: 0, knowledge: 0 },
        },
      };
    }

    log.info(
      {
        message: message.substring(0, 100),
        queryType: detection.queryType,
        confidence: detection.confidence,
        keywords: detection.keywords,
      },
      'Memory query detected - starting search'
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: EXTRACT SEARCH QUERY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const topic = memoryQueryDetector.extractTopic(message, detection);
    const searchQuery = this.buildSearchQuery(topic, detection);

    log.debug({ topic, searchQuery }, 'Search query built');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: SEMANTIC SEARCH
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let memories: MemoryChunk[] = [];

    try {
      if (finalConfig.useSemanticSearch) {
        // BÚSQUEDA SEMÁNTICA CON EMBEDDINGS
        const unifiedContext = await unifiedMemoryRetrieval.retrieveContext(
          agentId,
          userId,
          searchQuery,
          {
            maxChunks: finalConfig.maxMemories,
            minScore: finalConfig.minSimilarity,
            // Priorizar episodic y rag sobre knowledge para queries de memoria
            episodicWeight: 0.5,
            ragWeight: 0.4,
            knowledgeWeight: 0.1,
            recencyBoost: 0.2, // Menos peso a recency en memory queries
          }
        );

        memories = unifiedContext.chunks;

        log.info(
          {
            found: memories.length,
            sources: unifiedContext.sources,
            avgScore: (unifiedContext.totalScore / memories.length).toFixed(2),
          },
          'Semantic search completed'
        );
      } else {
        // FALLBACK: BÚSQUEDA BÁSICA (sin embeddings)
        const episodicResults = await this.memoryRetrieval.retrieveSimilarMemories(
          agentId,
          searchQuery,
          finalConfig.maxMemories,
          finalConfig.minSimilarity
        );

        // Convertir a MemoryChunk format
        memories = episodicResults.map(result => ({
          id: result.memory.id,
          content: result.memory.event,
          source: 'episodic' as const,
          score: result.similarity,
          timestamp: result.memory.createdAt,
          metadata: {
            importance: result.memory.importance,
            emotionalValence: result.memory.emotionalValence,
          },
        }));

        log.info({ found: memories.length }, 'Basic search completed (no embeddings)');
      }
    } catch (error) {
      log.error({ error }, 'Error during memory search');
      // Continuar sin memorias en caso de error
      memories = [];
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: BUILD CONTEXT PROMPT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const contextPrompt = this.buildContextPrompt(memories, detection, finalConfig.maxTokens);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 5: METADATA
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const searchTimeMs = Date.now() - startTime;
    const sources = {
      episodic: memories.filter(m => m.source === 'episodic').length,
      rag: memories.filter(m => m.source === 'rag').length,
      knowledge: memories.filter(m => m.source === 'knowledge').length,
    };
    const avgSimilarity = memories.length > 0
      ? memories.reduce((sum, m) => sum + m.score, 0) / memories.length
      : 0;

    log.info(
      {
        searchTimeMs,
        memoriesFound: memories.length,
        avgSimilarity: avgSimilarity.toFixed(2),
        sources,
      },
      'Memory query processing complete'
    );

    return {
      detected: true,
      detection,
      memories,
      contextPrompt,
      metadata: {
        searchTimeMs,
        memoriesFound: memories.length,
        avgSimilarity,
        sources,
      },
    };
  }

  /**
   * Construye query optimizado para búsqueda semántica
   */
  private buildSearchQuery(topic: string, detection: MemoryQueryDetection): string {
    const parts: string[] = [];

    // Agregar keywords principales
    if (detection.keywords.length > 0) {
      parts.push(detection.keywords.slice(0, 5).join(' '));
    }

    // Agregar topic si es diferente de keywords
    if (topic && !parts.some(part => part.includes(topic))) {
      parts.push(topic);
    }

    // Construir query
    const query = parts.join(' ').trim();

    return query || 'memoria recuerdos pasado';
  }

  /**
   * Formatea memorias encontradas en contexto para el prompt
   */
  private buildContextPrompt(
    memories: MemoryChunk[],
    detection: MemoryQueryDetection,
    maxTokens: number
  ): string {
    if (memories.length === 0) {
      return `## Consulta sobre Memoria

El usuario pregunta sobre eventos o conversaciones pasadas, pero no se encontraron memorias relevantes.
Tipo de consulta: ${detection.queryType}
Keywords: ${detection.keywords.join(', ')}

Responde de manera empática indicando que no recuerdas ese detalle específico, pero mantén la conversación fluida.`;
    }

    const contextParts: string[] = [];
    contextParts.push('## Memorias Relevantes Recuperadas');
    contextParts.push('');
    contextParts.push(`El usuario pregunta sobre: "${detection.rawMatch || 'eventos pasados'}"`);
    contextParts.push(`Tipo de consulta: ${detection.queryType}`);
    contextParts.push('');
    contextParts.push('### Memorias encontradas:');
    contextParts.push('');

    let currentTokens = 0;
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);

    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];

      // Format according to source
      let memoryText = '';
      if (memory.source === 'episodic') {
        memoryText = `[EVENTO IMPORTANTE] ${memory.content}`;
        if (memory.metadata?.importance) {
          memoryText += ` (importancia: ${(memory.metadata.importance * 100).toFixed(0)}%)`;
        }
      } else if (memory.source === 'rag') {
        memoryText = `[CONVERSACIÓN PASADA] ${memory.content}`;
      } else if (memory.source === 'knowledge') {
        memoryText = `[DATO CONOCIDO] ${memory.content}`;
      }

      // Agregar fecha si disponible
      if (memory.timestamp) {
        const date = new Date(memory.timestamp);
        const timeAgo = this.getTimeAgo(date);
        memoryText += ` [${timeAgo}]`;
      }

      const memoryTokens = estimateTokens(memoryText);

      // Check token limit
      if (currentTokens + memoryTokens > maxTokens) {
        contextParts.push('');
        contextParts.push(`... (${memories.length - i} memorias adicionales omitidas por límite de tokens)`);
        break;
      }

      contextParts.push(`${i + 1}. ${memoryText}`);
      contextParts.push('');
      currentTokens += memoryTokens;
    }

    contextParts.push('');
    contextParts.push('**INSTRUCCIÓN**: Usa estas memorias para responder la pregunta del usuario de manera natural y conversacional. Refiere a los recuerdos como si los tuvieras presentes en tu mente.');

    return contextParts.join('\n');
  }

  /**
   * Calcula tiempo transcurrido en formato legible
   */
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMinutes < 60) {
      return `hace ${diffMinutes} minutos`;
    } else if (diffHours < 24) {
      return `hace ${diffHours} horas`;
    } else if (diffDays === 1) {
      return 'ayer';
    } else if (diffDays < 7) {
      return `hace ${diffDays} días`;
    } else if (diffWeeks < 4) {
      return `hace ${diffWeeks} semanas`;
    } else if (diffMonths < 12) {
      return `hace ${diffMonths} meses`;
    } else {
      const years = Math.floor(diffMonths / 12);
      return `hace ${years} ${years === 1 ? 'año' : 'años'}`;
    }
  }

  /**
   * Quick check: ¿Es este mensaje una memory query?
   * Útil para decisiones rápidas sin hacer búsqueda completa
   */
  isMemoryQuery(message: string, minConfidence: number = 0.5): boolean {
    const detection = memoryQueryDetector.detectMemoryQuery(message);
    return detection.isMemoryQuery && detection.confidence >= minConfidence;
  }
}

/**
 * Singleton instance
 */
export const memoryQueryHandler = new MemoryQueryHandler();

/**
 * Helper function para uso rápido
 */
export async function handleMemoryQuery(
  message: string,
  agentId: string,
  userId: string,
  config?: MemoryQueryConfig
): Promise<MemoryQueryResult> {
  return memoryQueryHandler.handleQuery(message, agentId, userId, config);
}
