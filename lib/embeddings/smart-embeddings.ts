/**
 * Smart Embeddings Wrapper
 *
 * Interfaz inteligente que decide automáticamente:
 * - ¿Usar caché o generar nuevo?
 * - ¿Procesar inmediato o agregar a cola?
 * - ¿Qué prioridad asignar?
 *
 * USO:
 * - Para chat/memoria de personajes: usa getEmbedding() con context='chat'
 * - Para análisis ML: usa getEmbedding() con context='ml'
 */

import { generateOpenAIEmbedding, cosineSimilarity } from '@/lib/memory/openai-embeddings';
import { embeddingQueue, EmbeddingOperation, EmbeddingPriority } from './queue-manager';
import { createLogger } from '@/lib/logger';

const log = createLogger('SmartEmbeddings');

export type EmbeddingContext =
  | 'chat'          // Chat en tiempo real con personajes
  | 'memory'        // Memoria de personajes
  | 'search'        // Búsquedas de usuario
  | 'indexing'      // Indexación de contenido nuevo
  | 'ml'            // Análisis ML
  | 'batch';        // Procesamiento batch

// Mapeo de contexto a operación
const CONTEXT_TO_OPERATION: Record<EmbeddingContext, EmbeddingOperation> = {
  chat: 'chat_retrieval',
  memory: 'memory_storage',
  search: 'chat_retrieval',
  indexing: 'post_indexing',
  ml: 'ml_analysis',
  batch: 'batch_processing',
};

/**
 * Obtener embedding inteligentemente
 *
 * Esta función decide automáticamente si:
 * - Usar caché
 * - Procesar inmediato (bypass queue)
 * - Agregar a cola
 */
export async function getEmbedding(
  text: string,
  options?: {
    context?: EmbeddingContext;
    userId?: string;
    agentId?: string;
    timeout?: number; // ms to wait for result
  }
): Promise<number[]> {
  const context = options?.context || 'search';
  const operation = CONTEXT_TO_OPERATION[context];

  // Para contextos críticos (chat, memoria), procesar inmediato
  if (context === 'chat' || context === 'memory') {
    log.debug({ context, textLength: text.length }, 'Procesando embedding crítico inmediato');
    return await embeddingQueue.processImmediate(text, operation);
  }

  // Para otros contextos, agregar a cola
  log.debug({ context, textLength: text.length }, 'Agregando embedding a cola');

  // Agregar a cola y esperar resultado
  const jobId = await embeddingQueue.enqueue(text, operation, {
    userId: options?.userId,
    agentId: options?.agentId,
  });

  // Esperar resultado con timeout
  const timeout = options?.timeout || 30000; // 30 segundos por defecto
  const result = await waitForEmbedding(text, timeout);

  if (!result) {
    // Si timeout, procesar inmediato como fallback
    log.warn({ jobId, context }, 'Timeout esperando embedding, procesando inmediato');
    return await generateOpenAIEmbedding(text);
  }

  return result;
}

/**
 * Batch de embeddings con rate limiting automático
 *
 * Ideal para indexar muchos documentos sin saturar el sistema
 */
export async function getBatchEmbeddings(
  texts: string[],
  options?: {
    context?: EmbeddingContext;
    userId?: string;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<number[][]> {
  const context = options?.context || 'batch';
  const operation = CONTEXT_TO_OPERATION[context];

  log.info({ count: texts.length, context }, 'Iniciando batch de embeddings');

  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];

    // Agregar a cola
    await embeddingQueue.enqueue(text, operation, {
      userId: options?.userId,
      priority: EmbeddingPriority.BACKGROUND,
    });

    // Esperar resultado
    const embedding = await waitForEmbedding(text, 60000); // 1 minuto timeout por item

    if (embedding) {
      embeddings.push(embedding);
    } else {
      log.warn({ index: i }, 'No se pudo obtener embedding para item');
      // Usar embedding vacío como placeholder
      embeddings.push([]);
    }

    // Notificar progreso
    if (options?.onProgress) {
      options.onProgress(i + 1, texts.length);
    }
  }

  log.info({ count: embeddings.length, context }, 'Batch de embeddings completado');
  return embeddings;
}

/**
 * Buscar items similares usando embeddings
 *
 * Optimizado para búsquedas de usuario (alta prioridad)
 */
export async function findSimilar(
  queryText: string,
  candidates: Array<{ text: string; metadata?: any }>,
  options?: {
    topK?: number;
    threshold?: number;
    userId?: string;
  }
): Promise<Array<{ text: string; similarity: number; metadata?: any }>> {
  const topK = options?.topK || 5;
  const threshold = options?.threshold || 0.5;

  // Get embedding del query (alta prioridad)
  const queryEmbedding = await getEmbedding(queryText, {
    context: 'search',
    userId: options?.userId,
  });

  // Get embeddings de candidatos (baja prioridad)
  const candidateEmbeddings = await Promise.all(
    candidates.map(c =>
      getEmbedding(c.text, {
        context: 'ml',
        userId: options?.userId,
      })
    )
  );

  // Calcular similitudes
  const results = candidates.map((candidate, i) => ({
    text: candidate.text,
    similarity: cosineSimilarity(queryEmbedding, candidateEmbeddings[i]),
    metadata: candidate.metadata,
  }));

  // Filtrar y ordenar
  return results
    .filter(r => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * Esperar a que un embedding esté disponible en caché
 */
async function waitForEmbedding(
  text: string,
  timeout: number
): Promise<number[] | null> {
  const startTime = Date.now();
  const checkInterval = 100; // Verificar cada 100ms

  while (Date.now() - startTime < timeout) {
    // Try to get from cache
    const cached = await embeddingQueue['getCached'](text);
    if (cached) {
      return cached;
    }

    // Esperar antes de reintentar
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  return null; // Timeout
}

/**
 * Pre-calentar embeddings para textos que se usarán pronto
 *
 * Útil para pre-cargar embeddings de posts populares, etc.
 */
export async function prefetchEmbeddings(
  texts: string[],
  options?: {
    context?: EmbeddingContext;
    userId?: string;
  }
): Promise<void> {
  const context = options?.context || 'batch';
  const operation = CONTEXT_TO_OPERATION[context];

  log.info({ count: texts.length, context }, 'Pre-cargando embeddings');

  for (const text of texts) {
    await embeddingQueue.enqueue(text, operation, {
      userId: options?.userId,
      priority: EmbeddingPriority.BACKGROUND,
    });
  }
}

/**
 * Obtener estadísticas del sistema de embeddings
 */
export async function getEmbeddingSystemStats() {
  return await embeddingQueue.getStats();
}

/**
 * Helper: Verificar si el sistema está sobrecargado
 */
export async function isSystemOverloaded(): Promise<boolean> {
  const stats = await embeddingQueue.getStats();

  // Consideramos sobrecarga si:
  // - More than 100 jobs in queue
  // - More than 50 high-priority jobs waiting
  return (
    stats.totalJobs > 100 ||
    stats.byPriority[EmbeddingPriority.CRITICAL] +
      stats.byPriority[EmbeddingPriority.HIGH] >
      50
  );
}
