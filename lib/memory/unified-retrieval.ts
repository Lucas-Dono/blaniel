/**
 * UNIFIED MEMORY RETRIEVAL
 *
 * Sistema unificado de retrieval de memorias que integra:
 * 1. RAG (Retrieval-Augmented Generation) - Vector search
 * 2. Episodic Memory - Memorias estructuradas de eventos
 * 3. Temporal Weighting - Recency + Importance
 *
 * Esto permite que la IA tenga contexto completo de:
 * - Conversaciones pasadas relevantes (RAG)
 * - Eventos importantes (Episodic)
 * - Datos personales del usuario (Knowledge)
 *
 * USO:
 * import { unifiedMemoryRetrieval } from "@/lib/memory/unified-retrieval";
 *
 * const context = await unifiedMemoryRetrieval.retrieveContext(
 *   agentId,
 *   userId,
 *   userMessage
 * );
 */

import { prisma } from "@/lib/prisma";
import { optimizedVectorSearch, cosineSimilarity } from "@/lib/memory/optimized-vector-search";

// Re-export for convenience
export { cosineSimilarity };

export interface MemoryChunk {
  id: string;
  content: string;
  source: "rag" | "episodic" | "knowledge";
  score: number; // 0-1 (relevance)
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface UnifiedMemoryContext {
  chunks: MemoryChunk[];
  summary: string;
  totalScore: number;
  sources: {
    rag: number;
    episodic: number;
    knowledge: number;
  };
}

/**
 * Configuración de retrieval
 */
interface RetrievalConfig {
  maxChunks: number;
  ragWeight: number; // 0-1
  episodicWeight: number; // 0-1
  knowledgeWeight: number; // 0-1
  recencyBoost: number; // Factor de boost por recency (0-1)
  minScore: number; // Minimum score to include (0-1)
}

const DEFAULT_CONFIG: RetrievalConfig = {
  maxChunks: 10,
  ragWeight: 0.4,
  episodicWeight: 0.4,
  knowledgeWeight: 0.2,
  recencyBoost: 0.3,
  minScore: 0.3,
};

export class UnifiedMemoryRetrieval {
  /**
   * Retrieve contexto unificado de todas las fuentes de memoria
   */
  async retrieveContext(
    agentId: string,
    userId: string,
    query: string,
    config: Partial<RetrievalConfig> = {}
  ): Promise<UnifiedMemoryContext> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    // Run retrievals in parallel
    const [ragChunks, episodicChunks, knowledgeChunks] = await Promise.all([
      this.retrieveFromRAG(agentId, userId, query, finalConfig),
      this.retrieveFromEpisodicMemory(agentId, userId, query, finalConfig),
      this.retrieveFromKnowledge(agentId, query, finalConfig),
    ]);

    // Combine and rank
    const allChunks = [...ragChunks, ...episodicChunks, ...knowledgeChunks];

    // Apply recency boost
    const boostedChunks = this.applyRecencyBoost(allChunks, finalConfig);

    // Ordenar por score
    boostedChunks.sort((a, b) => b.score - a.score);

    // Filter by minimum score and limit quantity
    const filteredChunks = boostedChunks
      .filter((chunk) => chunk.score >= finalConfig.minScore)
      .slice(0, finalConfig.maxChunks);

    // Generate summary
    const summary = this.generateSummary(filteredChunks);

    // Calcular stats
    const sources = {
      rag: filteredChunks.filter((c) => c.source === "rag").length,
      episodic: filteredChunks.filter((c) => c.source === "episodic").length,
      knowledge: filteredChunks.filter((c) => c.source === "knowledge").length,
    };

    const totalScore = filteredChunks.reduce((sum, c) => sum + c.score, 0);

    console.log(
      `[UnifiedMemoryRetrieval] Retrieved ${filteredChunks.length} chunks (RAG: ${sources.rag}, Episodic: ${sources.episodic}, Knowledge: ${sources.knowledge})`
    );

    return {
      chunks: filteredChunks,
      summary,
      totalScore,
      sources,
    };
  }

  /**
   * Retrieve desde RAG (vector similarity search)
   * OPTIMIZADO: Usa vector embeddings y cosine similarity
   */
  private async retrieveFromRAG(
    agentId: string,
    userId: string,
    query: string,
    config: RetrievalConfig
  ): Promise<MemoryChunk[]> {
    try {
      // Usar búsqueda vectorial optimizada
      const results = await optimizedVectorSearch.searchMessages(
        agentId,
        userId,
        query,
        {
          topK: 5,
          minScore: 0.3,
          useCache: true,
          maxAgeDays: 365,
        }
      );

      // Convertir a MemoryChunk con peso de RAG
      return results.map((result) => ({
        id: result.id,
        content: result.content,
        source: "rag" as const,
        score: result.score * config.ragWeight,
        timestamp: result.timestamp,
        metadata: result.metadata,
      }));
    } catch (error) {
      console.error("[UnifiedMemoryRetrieval] Error en RAG:", error);
      return [];
    }
  }

  /**
   * Retrieve desde Episodic Memory
   * OPTIMIZADO: Usa vector embeddings y cosine similarity
   */
  private async retrieveFromEpisodicMemory(
    agentId: string,
    userId: string,
    query: string,
    config: RetrievalConfig
  ): Promise<MemoryChunk[]> {
    try {
      // Usar búsqueda vectorial optimizada
      const results = await optimizedVectorSearch.searchEpisodicMemories(
        agentId,
        query,
        {
          topK: 5,
          minScore: 0.3,
          useCache: true,
          maxAgeDays: 365,
        }
      );

      // Convertir a MemoryChunk con peso episódico
      return results.map((result) => ({
        id: result.id,
        content: result.content,
        source: "episodic" as const,
        score: result.score * config.episodicWeight,
        timestamp: result.timestamp,
        metadata: result.metadata,
      }));
    } catch (error) {
      console.error("[UnifiedMemoryRetrieval] Error en Episodic:", error);
      return [];
    }
  }

  /**
   * Retrieve desde Knowledge (SemanticMemory)
   * Busca en userFacts y userPreferences del modelo SemanticMemory
   */
  private async retrieveFromKnowledge(
    agentId: string,
    query: string,
    config: RetrievalConfig
  ): Promise<MemoryChunk[]> {
    try {
      // Buscar SemanticMemory del agente
      const semanticMemory = await prisma.semanticMemory.findUnique({
        where: { agentId },
      });

      if (!semanticMemory) {
        return [];
      }

      const chunks: MemoryChunk[] = [];
      const queryWords = query.toLowerCase().split(/\s+/);

      // Extraer userFacts del JSON
      const userFacts = semanticMemory.userFacts as Record<string, any>;
      if (userFacts && typeof userFacts === "object") {
        for (const [key, value] of Object.entries(userFacts)) {
          // Convertir valor a string para buscar
          const valueStr = JSON.stringify(value).toLowerCase();
          let matches = 0;

          for (const word of queryWords) {
            if (word.length > 3 && (key.toLowerCase().includes(word) || valueStr.includes(word))) {
              matches++;
            }
          }

          if (matches > 0) {
            const score = (matches / queryWords.length) * config.knowledgeWeight;
            const content = `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`;

            chunks.push({
              id: `fact-${key}`,
              content,
              source: "knowledge",
              score,
              timestamp: semanticMemory.lastUpdated,
              metadata: {
                type: "userFact",
                key,
                value,
              },
            });
          }
        }
      }

      // Extraer userPreferences del JSON
      const userPreferences = semanticMemory.userPreferences as Record<string, any>;
      if (userPreferences && typeof userPreferences === "object") {
        for (const [key, value] of Object.entries(userPreferences)) {
          const valueStr = JSON.stringify(value).toLowerCase();
          let matches = 0;

          for (const word of queryWords) {
            if (word.length > 3 && (key.toLowerCase().includes(word) || valueStr.includes(word))) {
              matches++;
            }
          }

          if (matches > 0) {
            const score = (matches / queryWords.length) * config.knowledgeWeight;
            const content = `Preferencia - ${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`;

            chunks.push({
              id: `pref-${key}`,
              content,
              source: "knowledge",
              score,
              timestamp: semanticMemory.lastUpdated,
              metadata: {
                type: "userPreference",
                key,
                value,
              },
            });
          }
        }
      }

      return chunks.slice(0, 5); // Top 5 knowledge results
    } catch (error) {
      console.error("[UnifiedMemoryRetrieval] Error en Knowledge:", error);
      return [];
    }
  }

  /**
   * Aplica boost por recency (más reciente = más score)
   */
  private applyRecencyBoost(
    chunks: MemoryChunk[],
    config: RetrievalConfig
  ): MemoryChunk[] {
    const now = Date.now();
    const maxAgeMs = 365 * 24 * 60 * 60 * 1000; // 1 año

    return chunks.map((chunk) => {
      const ageMs = now - chunk.timestamp.getTime();
      const recencyFactor = Math.max(0, 1 - ageMs / maxAgeMs);
      const boost = recencyFactor * config.recencyBoost;

      return {
        ...chunk,
        score: Math.min(1.0, chunk.score + boost),
      };
    });
  }

  /**
   * Genera un summary textual del contexto recuperado
   */
  private generateSummary(chunks: MemoryChunk[]): string {
    if (chunks.length === 0) {
      return "No hay contexto relevante disponible.";
    }

    const parts: string[] = [];

    // Agrupar por source
    const bySource = {
      rag: chunks.filter((c) => c.source === "rag"),
      episodic: chunks.filter((c) => c.source === "episodic"),
      knowledge: chunks.filter((c) => c.source === "knowledge"),
    };

    if (bySource.episodic.length > 0) {
      parts.push(
        `Memorias importantes: ${bySource.episodic.map((c) => c.content).join("; ")}`
      );
    }

    if (bySource.knowledge.length > 0) {
      parts.push(`Knowledge relevante: ${bySource.knowledge.length} grupos`);
    }

    if (bySource.rag.length > 0) {
      parts.push(
        `Conversaciones pasadas relacionadas: ${bySource.rag.length} mensajes`
      );
    }

    return parts.join("\n");
  }

  /**
   * API conveniente: Retorna contexto formateado para prompt
   */
  async getPromptContext(
    agentId: string,
    userId: string,
    query: string,
    maxTokens: number = 2000
  ): Promise<string> {
    const context = await this.retrieveContext(agentId, userId, query);

    if (context.chunks.length === 0) {
      return "";
    }

    const promptParts: string[] = [];
    let currentTokens = 0;

    // Estimar ~4 caracteres por token
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);

    for (const chunk of context.chunks) {
      const chunkText = `[${chunk.source.toUpperCase()}] ${chunk.content}`;
      const chunkTokens = estimateTokens(chunkText);

      if (currentTokens + chunkTokens > maxTokens) {
        break;
      }

      promptParts.push(chunkText);
      currentTokens += chunkTokens;
    }

    return `## Contexto Relevante:\n${promptParts.join("\n\n")}`;
  }
}

/**
 * Singleton instance
 */
export const unifiedMemoryRetrieval = new UnifiedMemoryRetrieval();
