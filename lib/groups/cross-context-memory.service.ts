import { prisma } from "@/lib/prisma";
import { generateOpenAIEmbedding, cosineSimilarity } from "@/lib/memory/openai-embeddings";
import { nanoid } from "nanoid";

interface RelevantMemory {
  memory: any;
  score: number;
  relevanceReason: string;
}

interface RetrieveParams {
  agentId: string;
  currentContext: "individual" | "group";
  currentContextId: string;
  query: string;
  limit?: number;
}

interface SaveMemoryParams {
  agentId: string;
  sourceType: "individual_chat" | "group_interaction";
  sourceUserId?: string;
  sourceGroupId?: string;
  summary: string;
  involvedAgents?: { agentId: string; agentName: string }[];
  involvedUsers?: { userId: string; userName: string }[];
  emotionalTone: string;
  importance: number;
}

/**
 * Cross-Context Memory Service
 *
 * Allows AIs to remember group conversations in 1:1 chats and vice versa
 * through semantic search. Implements the concept of "Shared Universe".
 */
export class CrossContextMemoryService {
  /**
   * Retrieve relevant memories from other contexts
   *
   * Uses hybrid semantic search that combines:
   * - Semantic similarity (40%)
   * - Event importance (30%)
   * - Recency (20%)
   * - Intense emotional tone (10%)
   */
  async retrieveRelevantMemories(params: RetrieveParams): Promise<RelevantMemory[]> {
    try {
      // 1. Generate embedding of query
      const queryEmbedding = await generateOpenAIEmbedding(params.query);

      // 2. Search for cross-context memories
      // We search for memories that:
      // - Belong to the current agent
      // - Come from other contexts (groups or 1:1 chats)
      // - Are not from the current context
      const memories = await prisma.crossContextMemory.findMany({
        where: {
          agentId: params.agentId,
          OR: [
            { sourceType: "individual_chat" },
            { sourceType: "group_interaction" },
          ],
          // Exclude current context to avoid redundancy
          ...(params.currentContext === "group"
            ? { sourceGroupId: { not: params.currentContextId } }
            : { sourceUserId: { not: params.currentContextId } }),
        },
        orderBy: [
          { importance: "desc" },
          { happenedAt: "desc" },
        ],
        take: 50, // Pre-filter: Top 50 by importance/recency
      });

      if (memories.length === 0) {
        return [];
      }

      // 3. Calculate semantic similarity for each memory
      const scoredMemories = memories.map((memory) => {
        const memoryEmbedding = memory.embedding as number[];
        const similarity = cosineSimilarity(queryEmbedding, memoryEmbedding);

        // Hybrid scoring formula
        const recencyScore = this.calculateRecencyScore(memory.happenedAt);
        const emotionalBonus = memory.emotionalTone === "intense" ? 0.1 : 0;

        const hybridScore =
          similarity * 0.4 +
          memory.importance * 0.3 +
          recencyScore * 0.2 +
          emotionalBonus;

        return { memory, score: hybridScore };
      });

      // 4. Ordenar por score y tomar top N
      const topMemories = scoredMemories
        .sort((a, b) => b.score - a.score)
        .slice(0, params.limit || 5);

      // 5. Generar razones de relevancia
      return topMemories.map(({ memory, score }) => ({
        memory,
        score,
        relevanceReason: this.generateRelevanceReason(memory, score),
      }));
    } catch (error) {
      console.error("Error retrieving cross-context memories:", error);
      return [];
    }
  }

  /**
   * Save a new cross-context memory
   */
  async saveMemory(params: SaveMemoryParams): Promise<any> {
    try {
      // 1. Generar embedding del summary
      const embedding = await generateOpenAIEmbedding(params.summary);

      // 2. Crear memoria
      const memory = await prisma.crossContextMemory.create({
        data: {
          id: nanoid(),
          agentId: params.agentId,
          sourceType: params.sourceType,
          sourceUserId: params.sourceUserId || null,
          sourceGroupId: params.sourceGroupId || null,
          summary: params.summary,
          involvedAgents: params.involvedAgents || [],
          involvedUsers: params.involvedUsers || [],
          emotionalTone: params.emotionalTone,
          importance: params.importance,
          embedding: embedding,
          happenedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return memory;
    } catch (error) {
      console.error("Error saving cross-context memory:", error);
      throw error;
    }
  }

  /**
   * Get memories from a specific context (for debugging/inspection)
   */
  async getMemoriesFromContext(
    agentId: string,
    contextType: "individual_chat" | "group_interaction",
    contextId: string
  ): Promise<any[]> {
    try {
      const whereClause: any = {
        agentId,
        sourceType: contextType,
      };

      if (contextType === "individual_chat") {
        whereClause.sourceUserId = contextId;
      } else {
        whereClause.sourceGroupId = contextId;
      }

      const memories = await prisma.crossContextMemory.findMany({
        where: whereClause,
        orderBy: { happenedAt: "desc" },
        take: 20,
      });

      return memories;
    } catch (error) {
      console.error("Error getting memories from context:", error);
      return [];
    }
  }

  /**
   * Analyze conversation and extract key moments for memory storage
   *
   * Esta función analiza una conversación y determina qué momentos
   * son suficientemente importantes para guardar como memorias cross-contexto
   */
  async analyzeAndExtractMemories(
    agentId: string,
    messages: any[],
    contextType: "individual_chat" | "group_interaction",
    contextId: string
  ): Promise<void> {
    try {
      // Buscar momentos significativos:
      // - Menciones de eventos importantes
      // - Revelaciones personales
      // - Momentos emocionales intensos
      // - Acuerdos o decisiones
      // - Conflictos o resoluciones

      const significantMoments = this.identifySignificantMoments(messages);

      for (const moment of significantMoments) {
        await this.saveMemory({
          agentId,
          sourceType: contextType,
          sourceUserId: contextType === "individual_chat" ? contextId : undefined,
          sourceGroupId: contextType === "group_interaction" ? contextId : undefined,
          summary: moment.summary,
          involvedUsers: moment.involvedUsers,
          involvedAgents: moment.involvedAgents,
          emotionalTone: moment.emotionalTone,
          importance: moment.importance,
        });
      }
    } catch (error) {
      console.error("Error analyzing and extracting memories:", error);
    }
  }

  /**
   * Calculate recency score (exponential decay)
   */
  private calculateRecencyScore(happenedAt: Date): number {
    const ageInDays = (Date.now() - happenedAt.getTime()) / (1000 * 60 * 60 * 24);
    // Exponential decay: memories lose value over time
    // Half-life of ~7 days
    return Math.exp(-0.1 * ageInDays);
  }

  /**
   * Generate human-readable relevance reason
   */
  private generateRelevanceReason(memory: any, score: number): string {
    const reasons: string[] = [];

    // Score-based
    if (score > 0.8) {
      reasons.push("alta relevancia");
    } else if (score > 0.6) {
      reasons.push("relevancia moderada");
    }

    // Importance-based
    if (memory.importance > 0.8) {
      reasons.push("evento muy importante");
    } else if (memory.importance > 0.6) {
      reasons.push("evento importante");
    }

    // Emotional intensity
    if (memory.emotionalTone === "intense") {
      reasons.push("emocionalmente intenso");
    }

    // Recency
    const ageInDays = (Date.now() - new Date(memory.happenedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays < 1) {
      reasons.push("muy reciente");
    } else if (ageInDays < 7) {
      reasons.push("reciente");
    } else if (ageInDays < 30) {
      reasons.push("del último mes");
    }

    // Context
    if (memory.sourceType === "group_interaction") {
      reasons.push("de conversación grupal");
    } else {
      reasons.push("de chat individual");
    }

    return reasons.length > 0 ? reasons.join(", ") : "semánticamente similar";
  }

  /**
   * Identify significant moments in a conversation
   *
   * Esta es una implementación simplificada. En producción, podrías usar
   * un LLM para analizar las conversaciones y extraer momentos significativos.
   */
  private identifySignificantMoments(messages: any[]): any[] {
    const moments: any[] = [];

    // For now, simply take the last messages if they're long
    // o contienen palabras clave emocionales
    const emotionalKeywords = [
      "amor", "odio", "feliz", "triste", "enojado", "miedo",
      "importante", "nunca", "siempre", "prometo", "juro",
      "love", "hate", "happy", "sad", "angry", "afraid",
      "important", "never", "always", "promise", "swear",
    ];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const content = msg.content?.toLowerCase() || "";

      // Check for emotional keywords
      const hasEmotionalContent = emotionalKeywords.some((keyword) =>
        content.includes(keyword)
      );

      // Check for length (detailed messages are often important)
      const isDetailed = content.length > 100;

      if (hasEmotionalContent || isDetailed) {
        // Get context (previous and next message)
        const contextMessages = messages.slice(
          Math.max(0, i - 1),
          Math.min(messages.length, i + 2)
        );

        const summary = this.generateSummary(contextMessages);

        moments.push({
          summary,
          involvedUsers: this.extractInvolvedUsers(contextMessages),
          involvedAgents: this.extractInvolvedAgents(contextMessages),
          emotionalTone: hasEmotionalContent ? "intense" : "neutral",
          importance: hasEmotionalContent ? 0.8 : 0.6,
        });
      }
    }

    return moments;
  }

  /**
   * Generate a summary from messages
   */
  private generateSummary(messages: any[]): string {
    // Simple concatenation for now
    // In production, use an LLM to generate proper summaries
    return messages
      .map((msg) => {
        const author = msg.user?.name || msg.agent?.name || "Unknown";
        return `${author}: ${msg.content}`;
      })
      .join(" | ")
      .substring(0, 500); // Limit length
  }

  /**
   * Extract involved users from messages
   */
  private extractInvolvedUsers(messages: any[]): { userId: string; userName: string }[] {
    const users = new Map<string, string>();

    for (const msg of messages) {
      if (msg.user?.id && msg.user?.name) {
        users.set(msg.user.id, msg.user.name);
      }
    }

    return Array.from(users.entries()).map(([userId, userName]) => ({
      userId,
      userName,
    }));
  }

  /**
   * Extract involved agents from messages
   */
  private extractInvolvedAgents(messages: any[]): { agentId: string; agentName: string }[] {
    const agents = new Map<string, string>();

    for (const msg of messages) {
      if (msg.agent?.id && msg.agent?.name) {
        agents.set(msg.agent.id, msg.agent.name);
      }
    }

    return Array.from(agents.entries()).map(([agentId, agentName]) => ({
      agentId,
      agentName,
    }));
  }

  /**
   * Get statistics about cross-context memories for an agent
   */
  async getMemoryStats(agentId: string): Promise<{
    total: number;
    bySourceType: Record<string, number>;
    averageImportance: number;
    oldestMemory: Date | null;
    newestMemory: Date | null;
  }> {
    try {
      const memories = await prisma.crossContextMemory.findMany({
        where: { agentId },
        select: {
          sourceType: true,
          importance: true,
          happenedAt: true,
        },
      });

      const bySourceType: Record<string, number> = {};
      let totalImportance = 0;

      for (const memory of memories) {
        bySourceType[memory.sourceType] = (bySourceType[memory.sourceType] || 0) + 1;
        totalImportance += memory.importance;
      }

      const sorted = memories.sort(
        (a, b) => a.happenedAt.getTime() - b.happenedAt.getTime()
      );

      return {
        total: memories.length,
        bySourceType,
        averageImportance: memories.length > 0 ? totalImportance / memories.length : 0,
        oldestMemory: sorted.length > 0 ? sorted[0].happenedAt : null,
        newestMemory: sorted.length > 0 ? sorted[sorted.length - 1].happenedAt : null,
      };
    } catch (error) {
      console.error("Error getting memory stats:", error);
      return {
        total: 0,
        bySourceType: {},
        averageImportance: 0,
        oldestMemory: null,
        newestMemory: null,
      };
    }
  }
}

// Export singleton instance
export const crossContextMemoryService = new CrossContextMemoryService();
