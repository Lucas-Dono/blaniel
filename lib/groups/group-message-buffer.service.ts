/**
 * Group Message Buffer Service
 *
 * Accumulates messages in a time window before AIs respond.
 * This allows:
 * 1. More coherent responses to multiple consecutive messages
 * 2. Reduction of perceived latency (more realistic typing)
 * 3. Better coordination between multiple AIs
 */

import { redis, isRedisConfigured } from "@/lib/redis/config";
import { enqueueBufferFlush } from "@/lib/queues/group-ai-response-jobs";

export interface BufferedMessage {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
  mentionedAgents: string[];
  replyToId?: string;
}

interface BufferState {
  messages: BufferedMessage[];
  flushScheduled: boolean;
  flushAt: number;
}

// Buffer configuration
const BUFFER_CONFIG = {
  BASE_WINDOW_MS: 2000,    // 2 seconds base
  JITTER_MAX_MS: 2000,     // +0-2 seconds of jitter
  MAX_BUFFER_SIZE: 10,     // Maximum messages before forced flush
  BUFFER_TTL_SECONDS: 30,  // Buffer TTL in Redis
};

class GroupMessageBufferService {
  private readonly BUFFER_KEY_PREFIX = "group:buffer:";
  private readonly FLUSH_KEY_PREFIX = "group:flush:";

  // In-memory fallback when Redis is not available
  private memoryBuffers: Map<string, BufferState> = new Map();
  private flushTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * Añadir mensaje al buffer del grupo
   */
  async addMessage(message: BufferedMessage): Promise<void> {
    const { groupId } = message;

    if (isRedisConfigured() && redis) {
      await this.addMessageRedis(message);
    } else {
      this.addMessageMemory(message);
    }

    // Programar flush si no hay uno pendiente
    await this.scheduleFlush(groupId);
  }

  /**
   * Obtener y vaciar mensajes del buffer
   */
  async flushBuffer(groupId: string): Promise<BufferedMessage[]> {
    if (isRedisConfigured() && redis) {
      return this.flushBufferRedis(groupId);
    } else {
      return this.flushBufferMemory(groupId);
    }
  }

  /**
   * Programar flush con timer (si no hay uno pendiente)
   */
  async scheduleFlush(groupId: string): Promise<void> {
    // Calcular delay con jitter
    const delay = BUFFER_CONFIG.BASE_WINDOW_MS +
      Math.random() * BUFFER_CONFIG.JITTER_MAX_MS;

    if (isRedisConfigured() && redis) {
      await this.scheduleFlushRedis(groupId, delay);
    } else {
      this.scheduleFlushMemory(groupId, delay);
    }
  }

  /**
   * Verificar si hay un flush pendiente
   */
  async isFlushPending(groupId: string): Promise<boolean> {
    if (isRedisConfigured() && redis) {
      const key = this.FLUSH_KEY_PREFIX + groupId;
      const result = await redis.get(key);
      return result !== null;
    } else {
      return this.flushTimers.has(groupId);
    }
  }

  /**
   * Cancelar flush pendiente (útil si el grupo se desactiva)
   */
  async cancelFlush(groupId: string): Promise<void> {
    if (isRedisConfigured() && redis) {
      const key = this.FLUSH_KEY_PREFIX + groupId;
      await redis.del(key);
    } else {
      const timer = this.flushTimers.get(groupId);
      if (timer) {
        clearTimeout(timer);
        this.flushTimers.delete(groupId);
      }
    }
  }

  // ============================================
  // Redis Implementation
  // ============================================

  private async addMessageRedis(message: BufferedMessage): Promise<void> {
    const key = this.BUFFER_KEY_PREFIX + message.groupId;

    // Get buffer actual
    const currentBuffer = await redis.get(key);
    const messages: BufferedMessage[] = currentBuffer
      ? JSON.parse(currentBuffer as string)
      : [];

    // Add new message
    messages.push(message);

    // Guardar con TTL
    await redis.set(key, JSON.stringify(messages), {
      ex: BUFFER_CONFIG.BUFFER_TTL_SECONDS,
    });

    // If we reached the max, force immediate flush
    if (messages.length >= BUFFER_CONFIG.MAX_BUFFER_SIZE) {
      await this.forceFlush(message.groupId);
    }
  }

  private async flushBufferRedis(groupId: string): Promise<BufferedMessage[]> {
    const bufferKey = this.BUFFER_KEY_PREFIX + groupId;
    const flushKey = this.FLUSH_KEY_PREFIX + groupId;

    // Get and delete atomically
    const currentBuffer = await redis.get(bufferKey);
    await Promise.all([
      redis.del(bufferKey),
      redis.del(flushKey),
    ]);

    if (!currentBuffer) {
      return [];
    }

    const messages: BufferedMessage[] = JSON.parse(currentBuffer as string);
    return messages;
  }

  private async scheduleFlushRedis(groupId: string, delayMs: number): Promise<void> {
    const flushKey = this.FLUSH_KEY_PREFIX + groupId;

    // Verificar si ya hay un flush pendiente
    const existing = await redis.get(flushKey);
    if (existing) {
      // Ya hay un flush programado, no crear otro
      return;
    }

    // Marcar que hay un flush pendiente
    const flushAt = Date.now() + delayMs;
    await redis.set(flushKey, flushAt.toString(), {
      ex: Math.ceil(delayMs / 1000) + 5, // TTL = delay + 5s de margen
    });

    // Encolar job en BullMQ
    await enqueueBufferFlush(groupId, delayMs);
  }

  private async forceFlush(groupId: string): Promise<void> {
    // Cancelar cualquier flush pendiente
    await this.cancelFlush(groupId);

    // Encolar flush inmediato
    await enqueueBufferFlush(groupId, 0);
  }

  // ============================================
  // In-Memory Implementation (Fallback)
  // ============================================

  private addMessageMemory(message: BufferedMessage): void {
    const { groupId } = message;

    let state = this.memoryBuffers.get(groupId);
    if (!state) {
      state = {
        messages: [],
        flushScheduled: false,
        flushAt: 0,
      };
      this.memoryBuffers.set(groupId, state);
    }

    state.messages.push(message);

    // If we reached the max, force immediate flush
    if (state.messages.length >= BUFFER_CONFIG.MAX_BUFFER_SIZE) {
      this.forceFlushMemory(groupId);
    }
  }

  private flushBufferMemory(groupId: string): BufferedMessage[] {
    const state = this.memoryBuffers.get(groupId);
    if (!state) {
      return [];
    }

    const messages = [...state.messages];

    // Limpiar estado
    this.memoryBuffers.delete(groupId);

    // Cancelar timer si existe
    const timer = this.flushTimers.get(groupId);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(groupId);
    }

    return messages;
  }

  private scheduleFlushMemory(groupId: string, delayMs: number): void {
    // Verificar si ya hay un flush pendiente
    if (this.flushTimers.has(groupId)) {
      return;
    }

    const state = this.memoryBuffers.get(groupId);
    if (state) {
      state.flushScheduled = true;
      state.flushAt = Date.now() + delayMs;
    }

    // Programar timer
    const timer = setTimeout(async () => {
      this.flushTimers.delete(groupId);

      // Llamar al job de flush directamente (sin BullMQ en modo memory)
      const { handleBufferFlush } = await import("@/lib/queues/group-ai-response-worker");
      await handleBufferFlush({ groupId });
    }, delayMs);

    this.flushTimers.set(groupId, timer);
  }

  private forceFlushMemory(groupId: string): void {
    // Cancelar timer existente
    const timer = this.flushTimers.get(groupId);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(groupId);
    }

    // Flush inmediato
    setTimeout(async () => {
      const { handleBufferFlush } = await import("@/lib/queues/group-ai-response-worker");
      await handleBufferFlush({ groupId });
    }, 0);
  }
}

// Export singleton instance
export const groupMessageBufferService = new GroupMessageBufferService();

// Export helper para extraer menciones de un mensaje
export function extractMentions(
  content: string,
  members: Array<{ memberType: string; agent?: { id: string; name: string } | null }>
): string[] {
  const mentionedAgents: string[] = [];
  const lowerContent = content.toLowerCase();

  for (const member of members) {
    if (member.memberType === "agent" && member.agent) {
      const agentName = member.agent.name.toLowerCase();

      // Buscar menciones directas: @nombre o solo nombre
      if (
        lowerContent.includes(`@${agentName}`) ||
        lowerContent.includes(agentName)
      ) {
        mentionedAgents.push(member.agent.id);
      }
    }
  }

  return mentionedAgents;
}
