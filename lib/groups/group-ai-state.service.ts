/**
 * Group AI State Service
 * 
 * Manages the states of each AI in a group to coordinate responses.
 * 
 * States:
 * - idle: Not doing anything
 * - reading: Active buffer, accumulating messages
 * - typing: Generating response
 * - cooldown: Just responded, waits before speaking again
 */

import { redis, isRedisConfigured } from "@/lib/redis/config";

export type AIState = "idle" | "reading" | "typing" | "cooldown";

export interface AIStateEntry {
  agentId: string;
  groupId: string;
  state: AIState;
  updatedAt: number;
  stateExpiresAt?: number; // When the current state expires
}

// State configuration
const STATE_CONFIG = {
  DEFAULT_TYPING_DURATION_MS: 5000,   // 5 segundos por defecto
  DEFAULT_COOLDOWN_DURATION_MS: 5000, // 5 segundos de cooldown
  STATE_TTL_SECONDS: 60,              // TTL de los estados en Redis
};

class GroupAIStateService {
  private readonly STATE_KEY_PREFIX = "group:ai:state:";
  private readonly TYPING_SET_PREFIX = "group:typing:";

  // In-memory fallback
  private memoryStates: Map<string, AIStateEntry> = new Map();

  /** Get the state of an AI in a group */
  async getState(groupId: string, agentId: string): Promise<AIState> {
    const entry = await this.getStateEntry(groupId, agentId);

    if (!entry) {
      return "idle";
    }

    // Verificar si el estado ha expirado
    if (entry.stateExpiresAt && Date.now() > entry.stateExpiresAt) {
      // Estado expirado, resetear a idle
      await this.setState(groupId, agentId, "idle");
      return "idle";
    }

    return entry.state;
  }

  /** Get full state entry */
  async getStateEntry(groupId: string, agentId: string): Promise<AIStateEntry | null> {
    if (isRedisConfigured() && redis) {
      return this.getStateEntryRedis(groupId, agentId);
    } else {
      return this.getStateEntryMemory(groupId, agentId);
    }
  }

  /**
   * Update state of an AI
   * 
   * @param groupId - Group ID
   * @param agentId - Agent ID
   * @param state - New state
   * @param durationMs - Optional state duration (for typing/cooldown)
   */
  async setState(
    groupId: string,
    agentId: string,
    state: AIState,
    durationMs?: number
  ): Promise<void> {
    const entry: AIStateEntry = {
      agentId,
      groupId,
      state,
      updatedAt: Date.now(),
    };

    // Calculate expiration if it is a temporary state
    if (state === "typing") {
      entry.stateExpiresAt = Date.now() + (durationMs ?? STATE_CONFIG.DEFAULT_TYPING_DURATION_MS);
    } else if (state === "cooldown") {
      entry.stateExpiresAt = Date.now() + (durationMs ?? STATE_CONFIG.DEFAULT_COOLDOWN_DURATION_MS);
    }

    if (isRedisConfigured() && redis) {
      await this.setStateRedis(groupId, agentId, entry);
    } else {
      this.setStateMemory(groupId, agentId, entry);
    }

    // Update el set de IAs typing si es necesario
    if (state === "typing") {
      await this.addToTypingSet(groupId, agentId);
    } else {
      await this.removeFromTypingSet(groupId, agentId);
    }
  }

  /** Get all AIs in "typing" state for a group */
  async getTypingAIs(groupId: string): Promise<string[]> {
    if (isRedisConfigured() && redis) {
      return this.getTypingAIsRedis(groupId);
    } else {
      return this.getTypingAIsMemory(groupId);
    }
  }

  /** Check if an AI can respond (not in cooldown and the group does not have too many typing AIs) */
  async canRespond(groupId: string, agentId: string): Promise<{ canRespond: boolean; reason?: string }> {
    const state = await this.getState(groupId, agentId);

    // Cannot respond if it is in cooldown or already typing
    if (state === "cooldown") {
      return { canRespond: false, reason: "agent_in_cooldown" };
    }

    if (state === "typing") {
      return { canRespond: false, reason: "agent_already_typing" };
    }

    // Check how many AIs are typing
    const typingAIs = await this.getTypingAIs(groupId);
    if (typingAIs.length >= 2) {
      // Maximum 2 AIs typing simultaneously
      return { canRespond: false, reason: "too_many_ais_typing" };
    }

    return { canRespond: true };
  }

  /** Get all AI states in a group */
  async getAllStates(groupId: string): Promise<AIStateEntry[]> {
    if (isRedisConfigured() && redis) {
      return this.getAllStatesRedis(groupId);
    } else {
      return this.getAllStatesMemory(groupId);
    }
  }

  /** Clear states of a group (useful when the group is deactivated) */
  async clearGroupStates(groupId: string): Promise<void> {
    if (isRedisConfigured() && redis) {
      // Get all keys from the group and delete them
      // Note: In production, use SCAN instead of KEYS
      const _stateKey = this.STATE_KEY_PREFIX + groupId + ":*";
      const typingKey = this.TYPING_SET_PREFIX + groupId;

      // Por ahora, solo eliminamos el set de typing
      await redis.del(typingKey);
    } else {
      // Limpiar estados en memoria
      for (const key of this.memoryStates.keys()) {
        if (key.startsWith(`${groupId}:`)) {
          this.memoryStates.delete(key);
        }
      }
    }
  }

  // ============================================
  // Redis Implementation
  // ============================================

  private async getStateEntryRedis(groupId: string, agentId: string): Promise<AIStateEntry | null> {
    const key = `${this.STATE_KEY_PREFIX}${groupId}:${agentId}`;
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data as string) as AIStateEntry;
  }

  private async setStateRedis(groupId: string, agentId: string, entry: AIStateEntry): Promise<void> {
    const key = `${this.STATE_KEY_PREFIX}${groupId}:${agentId}`;
    await redis.set(key, JSON.stringify(entry), {
      ex: STATE_CONFIG.STATE_TTL_SECONDS,
    });
  }

  private async getTypingAIsRedis(groupId: string): Promise<string[]> {
    const key = this.TYPING_SET_PREFIX + groupId;

    // Usamos un set para trackear IAs typing
    // Con IORedis, usamos SMEMBERS
    try {
      const members = await redis.zrange(key, 0, -1);
      if (!members) return [];

      // Filtrar IAs cuyo typing ha expirado
      const now = Date.now();
      const activeTyping: string[] = [];

      for (let i = 0; i < members.length; i += 2) {
        const agentId = members[i];
        const expiresAt = parseInt(members[i + 1] || "0", 10);

        if (expiresAt > now) {
          activeTyping.push(agentId);
        }
      }

      return activeTyping;
    } catch (error) {
      console.error("[GroupAIState] Error getting typing AIs:", error);
      return [];
    }
  }

  private async addToTypingSet(groupId: string, agentId: string): Promise<void> {
    if (!isRedisConfigured() || !redis) {
      this.addToTypingSetMemory(groupId, agentId);
      return;
    }

    const key = this.TYPING_SET_PREFIX + groupId;
    const expiresAt = Date.now() + STATE_CONFIG.DEFAULT_TYPING_DURATION_MS;

    // Usar sorted set con score = expiresAt
    try {
      await redis.zincrby(key, expiresAt, agentId);
      // Establecer TTL en el set
      await redis.expire(key, STATE_CONFIG.STATE_TTL_SECONDS);
    } catch (error) {
      console.error("[GroupAIState] Error adding to typing set:", error);
    }
  }

  private async removeFromTypingSet(groupId: string, agentId: string): Promise<void> {
    if (!isRedisConfigured() || !redis) {
      this.removeFromTypingSetMemory(groupId, agentId);
      return;
    }

    const key = this.TYPING_SET_PREFIX + groupId;

    try {
      // Delete del sorted set usando ZREM
      // Como no tenemos ZREM directo, usamos un truco: set score a 0 (pasado)
      // It will be filtered on the next read
      await redis.zincrby(key, -Date.now() * 2, agentId);
    } catch (error) {
      console.error("[GroupAIState] Error removing from typing set:", error);
    }
  }

  private async getAllStatesRedis(_groupId: string): Promise<AIStateEntry[]> {
    // In Redis we would need SCAN, for now we return an empty array
    // Individual states are queried by agentId
    console.warn("[GroupAIState] getAllStates not fully implemented for Redis");
    return [];
  }

  // ============================================
  // In-Memory Implementation (Fallback)
  // ============================================

  private getStateEntryMemory(groupId: string, agentId: string): AIStateEntry | null {
    const key = `${groupId}:${agentId}`;
    return this.memoryStates.get(key) || null;
  }

  private setStateMemory(groupId: string, agentId: string, entry: AIStateEntry): void {
    const key = `${groupId}:${agentId}`;
    this.memoryStates.set(key, entry);

    // Schedule cleanup if there is expiration
    if (entry.stateExpiresAt) {
      const delay = entry.stateExpiresAt - Date.now();
      setTimeout(() => {
        const current = this.memoryStates.get(key);
        if (current && current.updatedAt === entry.updatedAt) {
          // No ha cambiado, resetear a idle
          this.memoryStates.set(key, {
            ...current,
            state: "idle",
            stateExpiresAt: undefined,
          });
        }
      }, Math.max(0, delay));
    }
  }

  private getTypingAIsMemory(groupId: string): string[] {
    const now = Date.now();
    const typingAIs: string[] = [];

    for (const [key, entry] of this.memoryStates) {
      if (
        key.startsWith(`${groupId}:`) &&
        entry.state === "typing" &&
        (!entry.stateExpiresAt || entry.stateExpiresAt > now)
      ) {
        typingAIs.push(entry.agentId);
      }
    }

    return typingAIs;
  }

  private addToTypingSetMemory(_groupId: string, _agentId: string): void {
    // Ya se maneja en setStateMemory
  }

  private removeFromTypingSetMemory(_groupId: string, _agentId: string): void {
    // Ya se maneja en setStateMemory
  }

  private getAllStatesMemory(groupId: string): AIStateEntry[] {
    const states: AIStateEntry[] = [];

    for (const [key, entry] of this.memoryStates) {
      if (key.startsWith(`${groupId}:`)) {
        states.push(entry);
      }
    }

    return states;
  }
}

// Export singleton instance
export const groupAIStateService = new GroupAIStateService();
