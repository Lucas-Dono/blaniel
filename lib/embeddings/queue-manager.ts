/**
 * Sistema de Cola con Prioridades para Embeddings
 *
 * Garantiza que embeddings críticos (personajes en tiempo real) tengan prioridad
 * sobre análisis ML de moderación y otros procesos batch.
 */

import { redis } from '@/lib/redis/config';
import { generateOpenAIEmbedding } from '@/lib/memory/openai-embeddings';
import { createLogger } from '@/lib/logger';

const log = createLogger('EmbeddingQueueManager');

// Priority levels (lower number = higher priority)
export enum EmbeddingPriority {
  CRITICAL = 0,    // Chat en tiempo real, retrieval urgente
  HIGH = 1,        // Character memory, user searches
  NORMAL = 2,      // Indexing new posts
  LOW = 3,         // ML analysis, suggestions
  BACKGROUND = 4,  // Procesamiento batch nocturno
}

// Operation types
export type EmbeddingOperation =
  | 'chat_retrieval'     // Retrieval para respuestas de chat
  | 'memory_storage'     // Almacenar memorias de personajes
  | 'post_indexing'      // Indexar nuevos posts
  | 'ml_analysis'        // ML analysis for moderation
  | 'batch_processing';  // Procesamiento batch

interface EmbeddingJob {
  id: string;
  text: string;
  operation: EmbeddingOperation;
  priority: EmbeddingPriority;
  userId?: string;
  agentId?: string;
  metadata?: any;
  createdAt: number;
  retries?: number;
}

interface QueueStats {
  totalJobs: number;
  byPriority: Record<EmbeddingPriority, number>;
  processing: number;
  completed: number;
  failed: number;
  avgWaitTime: number;
}

// Rate limiting configuration per operation
const RATE_LIMITS = {
  chat_retrieval: { perMinute: 100, perHour: 3000 },
  memory_storage: { perMinute: 50, perHour: 1500 },
  post_indexing: { perMinute: 30, perHour: 1000 },
  ml_analysis: { perMinute: 5, perHour: 100 },    // Limitado!
  batch_processing: { perMinute: 2, perHour: 50 }, // Muy limitado!
};

// Ventanas horarias de carga baja (hora local del servidor)
const LOW_LOAD_HOURS = [0, 1, 2, 3, 4, 5]; // Madrugada

export class EmbeddingQueueManager {
  private static instance: EmbeddingQueueManager;
  private processing = false;
  private processInterval: NodeJS.Timeout | null = null;

  // Redis keys
  private readonly QUEUE_KEY = 'embeddings:queue';
  private readonly PROCESSING_KEY = 'embeddings:processing';
  private readonly STATS_KEY = 'embeddings:stats';
  private readonly CACHE_KEY_PREFIX = 'embeddings:cache';
  private readonly RATE_LIMIT_PREFIX = 'embeddings:ratelimit';

  private constructor() {}

  static getInstance(): EmbeddingQueueManager {
    if (!EmbeddingQueueManager.instance) {
      EmbeddingQueueManager.instance = new EmbeddingQueueManager();
    }
    return EmbeddingQueueManager.instance;
  }

  /**
   * Agregar trabajo a la cola con prioridad
   */
  async enqueue(
    text: string,
    operation: EmbeddingOperation,
    options?: {
      priority?: EmbeddingPriority;
      userId?: string;
      agentId?: string;
      metadata?: any;
    }
  ): Promise<string> {
    // Generate unique ID
    const jobId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Determine priority automatically if not specified
    const priority = options?.priority ?? this.getDefaultPriority(operation);

    const job: EmbeddingJob = {
      id: jobId,
      text: text.substring(0, 5000), // Limit size
      operation,
      priority,
      userId: options?.userId,
      agentId: options?.agentId,
      metadata: options?.metadata,
      createdAt: Date.now(),
      retries: 0,
    };

    // Check cache first
    const cached = await this.getCached(text);
    if (cached) {
      log.debug({ jobId, operation }, 'Embedding encontrado en caché');
      return jobId; // Retornar inmediatamente
    }

    // Check rate limit for this operation
    const canProcess = await this.checkRateLimit(operation);
    if (!canProcess && priority >= EmbeddingPriority.NORMAL) {
      // If not critical/high, defer to low-load time
      await this.scheduleForLowLoad(job);
      log.info({ jobId, operation }, 'Job pospuesto para horario de baja carga');
      return jobId;
    }

    // Agregar a la cola con score = prioridad
    // (menor score = mayor prioridad en sorted set)
    await redis.zadd(this.QUEUE_KEY, {
      score: priority,
      member: JSON.stringify(job),
    });

    log.info({ jobId, operation, priority }, 'Job agregado a la cola');

    // Start processing if not running
    if (!this.processing) {
      this.startProcessing();
    }

    return jobId;
  }

  /**
   * Procesar embeddings en tiempo real (sin cola)
   * Solo para operaciones CRÍTICAS que no pueden esperar
   */
  async processImmediate(
    text: string,
    operation: EmbeddingOperation
  ): Promise<number[]> {
    if (!this.isCriticalOperation(operation)) {
      throw new Error('processImmediate solo para operaciones críticas');
    }

    // Check cache
    const cached = await this.getCached(text);
    if (cached) {
      return cached;
    }

    // Generate embedding inmediatamente
    log.info({ operation }, 'Procesando embedding inmediato (bypass queue)');
    const embedding = await generateOpenAIEmbedding(text);

    // Save to cache
    await this.cache(text, embedding);

    return embedding;
  }

  /**
   * Iniciar procesamiento continuo de la cola
   */
  private startProcessing() {
    if (this.processing) return;

    this.processing = true;
    log.info('Iniciando procesamiento de cola de embeddings');

    // Procesar cada 500ms
    this.processInterval = setInterval(async () => {
      try {
        await this.processNext();
      } catch (error) {
        log.error({ error }, 'Error en procesamiento de cola');
      }
    }, 500) as unknown as NodeJS.Timeout;
  }

  /**
   * Detener procesamiento
   */
  stopProcessing() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    this.processing = false;
    log.info('Procesamiento de cola detenido');
  }

  /**
   * Procesar siguiente job en la cola
   */
  private async processNext(): Promise<void> {
    // Verificar si estamos en horario de baja carga
    const isLowLoad = this.isLowLoadHour();

    // Get siguiente job con mayor prioridad
    const jobs = await redis.zrange(this.QUEUE_KEY, 0, 0, { withScores: true });

    if (!jobs || jobs.length === 0) {
      return; // Queue empty
    }

    const jobData = jobs[0].member;
    const job: EmbeddingJob = JSON.parse(jobData as string);

    // Si no es horario de baja carga y el job es de baja prioridad, saltar
    if (!isLowLoad && job.priority >= EmbeddingPriority.LOW) {
      return;
    }

    // Verificar rate limit
    const canProcess = await this.checkRateLimit(job.operation);
    if (!canProcess) {
      // Si no podemos procesar, esperar
      return;
    }

    // Mover a "processing"
    await redis.zrem(this.QUEUE_KEY, jobData);
    await redis.sadd(this.PROCESSING_KEY, jobData);

    try {
      // Check cache once more
      const cached = await this.getCached(job.text);
      if (cached) {
        log.debug({ jobId: job.id }, 'Embedding en caché, omitiendo generación');
      } else {
        // Generate embedding
        log.debug({ jobId: job.id, operation: job.operation }, 'Generando embedding');
        const embedding = await generateOpenAIEmbedding(job.text);

        // Save to cache
        await this.cache(job.text, embedding);
      }

      // Update statistics
      await this.incrementStat('completed');

      // Remover de processing
      await redis.srem(this.PROCESSING_KEY, jobData);

      log.info({ jobId: job.id, operation: job.operation }, 'Embedding procesado exitosamente');
    } catch (error) {
      log.error({ jobId: job.id, error }, 'Error procesando embedding');

      // Reintentar si es posible
      if ((job.retries || 0) < 3) {
        job.retries = (job.retries || 0) + 1;
        await redis.zadd(this.QUEUE_KEY, {
          score: job.priority + 10, // Bajar prioridad en retry
          member: JSON.stringify(job),
        });
      } else {
        await this.incrementStat('failed');
      }

      await redis.srem(this.PROCESSING_KEY, jobData);
    }
  }

  /**
   * Verificar si estamos en horario de baja carga
   */
  private isLowLoadHour(): boolean {
    const hour = new Date().getHours();
    return LOW_LOAD_HOURS.includes(hour);
  }

  /**
   * Verificar si una operación es crítica
   */
  private isCriticalOperation(operation: EmbeddingOperation): boolean {
    return operation === 'chat_retrieval' || operation === 'memory_storage';
  }

  /**
   * Obtener prioridad por defecto según operación
   */
  private getDefaultPriority(operation: EmbeddingOperation): EmbeddingPriority {
    switch (operation) {
      case 'chat_retrieval':
        return EmbeddingPriority.CRITICAL;
      case 'memory_storage':
        return EmbeddingPriority.HIGH;
      case 'post_indexing':
        return EmbeddingPriority.NORMAL;
      case 'ml_analysis':
        return EmbeddingPriority.LOW;
      case 'batch_processing':
        return EmbeddingPriority.BACKGROUND;
    }
  }

  /**
   * Verificar rate limit para una operación
   */
  private async checkRateLimit(operation: EmbeddingOperation): Promise<boolean> {
    const limits = RATE_LIMITS[operation];
    const now = Date.now();

    // Verificar límite por minuto
    const minuteKey = `${this.RATE_LIMIT_PREFIX}:${operation}:minute:${Math.floor(now / 60000)}`;
    const minuteCount = await redis.incr(minuteKey);
    await redis.expire(minuteKey, 60);

    if (minuteCount > limits.perMinute) {
      log.warn({ operation, count: minuteCount, limit: limits.perMinute }, 'Rate limit por minuto excedido');
      return false;
    }

    // Verificar límite por hora
    const hourKey = `${this.RATE_LIMIT_PREFIX}:${operation}:hour:${Math.floor(now / 3600000)}`;
    const hourCount = await redis.incr(hourKey);
    await redis.expire(hourKey, 3600);

    if (hourCount > limits.perHour) {
      log.warn({ operation, count: hourCount, limit: limits.perHour }, 'Rate limit por hora excedido');
      return false;
    }

    return true;
  }

  /**
   * Programar job para horario de baja carga
   */
  private async scheduleForLowLoad(job: EmbeddingJob): Promise<void> {
    // Calcular próximo horario de baja carga
    const now = new Date();
    const currentHour = now.getHours();

    let nextLowLoadHour = LOW_LOAD_HOURS.find(h => h > currentHour);
    if (!nextLowLoadHour) {
      nextLowLoadHour = LOW_LOAD_HOURS[0]; // Siguiente día
    }

    // Agregar a cola scheduled
    const scheduledKey = 'embeddings:scheduled';
    await redis.zadd(scheduledKey, {
      score: nextLowLoadHour,
      member: JSON.stringify(job),
    });
  }

  /**
   * Obtener embedding desde caché
   */
  private async getCached(text: string): Promise<number[] | null> {
    const hash = this.hashText(text);
    const key = `${this.CACHE_KEY_PREFIX}:${hash}`;

    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached as string);
    }

    return null;
  }

  /**
   * Guardar embedding en caché
   */
  private async cache(text: string, embedding: number[]): Promise<void> {
    const hash = this.hashText(text);
    const key = `${this.CACHE_KEY_PREFIX}:${hash}`;

    // Save for 7 days
    await redis.setex(key, 7 * 24 * 60 * 60, JSON.stringify(embedding));
  }

  /**
   * Hash simple para texto (para keys de caché)
   */
  private hashText(text: string): string {
    // Simple hash (puedes usar crypto.createHash para algo más robusto)
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Incrementar estadística
   */
  private async incrementStat(stat: 'completed' | 'failed'): Promise<void> {
    const key = `${this.STATS_KEY}:${stat}`;
    await redis.incr(key);
  }

  /**
   * Obtener estadísticas de la cola
   */
  async getStats(): Promise<QueueStats> {
    const [queueJobs, processingJobs, completed, failed] = await Promise.all([
      redis.zrange(this.QUEUE_KEY, 0, -1, { withScores: true }),
      redis.smembers(this.PROCESSING_KEY),
      redis.get(`${this.STATS_KEY}:completed`),
      redis.get(`${this.STATS_KEY}:failed`),
    ]);

    // Contar por prioridad
    const byPriority: Record<EmbeddingPriority, number> = {
      [EmbeddingPriority.CRITICAL]: 0,
      [EmbeddingPriority.HIGH]: 0,
      [EmbeddingPriority.NORMAL]: 0,
      [EmbeddingPriority.LOW]: 0,
      [EmbeddingPriority.BACKGROUND]: 0,
    };

    if (queueJobs) {
      for (const item of queueJobs) {
        const job: EmbeddingJob = JSON.parse(item.member as string);
        byPriority[job.priority]++;
      }
    }

    return {
      totalJobs: queueJobs?.length || 0,
      byPriority,
      processing: processingJobs?.length || 0,
      completed: parseInt(completed as string || '0'),
      failed: parseInt(failed as string || '0'),
      avgWaitTime: 0, // TODO: calcular promedio real
    };
  }

  /**
   * Limpiar cola (útil para mantenimiento)
   */
  async clear(): Promise<void> {
    await redis.del(this.QUEUE_KEY);
    await redis.del(this.PROCESSING_KEY);
    log.info('Cola de embeddings limpiada');
  }
}

// Exportar instancia singleton
export const embeddingQueue = EmbeddingQueueManager.getInstance();

// Simplified helper function for external use
export async function queueEmbedding(
  text: string,
  operation: EmbeddingOperation,
  options?: {
    userId?: string;
    agentId?: string;
    immediate?: boolean;
  }
): Promise<number[] | string> {
  const queue = EmbeddingQueueManager.getInstance();

  // Si es inmediato y crítico, procesar sin cola
  if (options?.immediate && queue['isCriticalOperation'](operation)) {
    return await queue.processImmediate(text, operation);
  }

  // Sino, agregar a cola
  return await queue.enqueue(text, operation, {
    userId: options?.userId,
    agentId: options?.agentId,
  });
}
