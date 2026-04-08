/**
 * Shared Knowledge Service
 *
 * Permite a las IAs compartir conocimiento sobre usuarios y temas
 * entre el contexto de grupos y chats privados.
 */

import { prisma } from "@/lib/prisma";
import { generateOpenAIEmbedding, cosineSimilarity } from "@/lib/memory/openai-embeddings";
import { nanoid } from "nanoid";

export interface SharedKnowledgeInput {
  groupId?: string;
  agentId: string;
  userId: string;
  knowledgeType: "fact" | "opinion" | "experience" | "preference";
  topic: string;
  content: string;
  importance?: number;
  confidence?: number;
  sourceMessageId?: string;
  contextType?: "group" | "private" | "global";
  learnedFrom?: string;
}

export interface RetrieveKnowledgeParams {
  agentId: string;
  userId?: string;
  groupId?: string;
  topic?: string;
  query?: string;
  limit?: number;
  includeGroupKnowledge?: boolean;
}

class SharedKnowledgeService {
  /**
   * Guardar nuevo conocimiento compartido
   */
  async saveKnowledge(input: SharedKnowledgeInput): Promise<any> {
    try {
      // Generate embedding del contenido
      const embedding = await generateOpenAIEmbedding(input.content);

      // Verificar si ya existe conocimiento similar
      const existing = await prisma.sharedKnowledge.findFirst({
        where: {
          agentId: input.agentId,
          userId: input.userId,
          topic: input.topic,
          isActive: true,
        },
      });

      if (existing) {
        // Reforzar conocimiento existente
        return await prisma.sharedKnowledge.update({
          where: { id: existing.id },
          data: {
            content: input.content,
            validationCount: { increment: 1 },
            confidence: Math.min(1, (existing.confidence || 0.7) + 0.05),
            importance: Math.max(existing.importance, input.importance || 0.5),
            embedding,
            updatedAt: new Date(),
          },
        });
      }

      // Create nuevo conocimiento
      return await prisma.sharedKnowledge.create({
        data: {
          id: nanoid(),
          groupId: input.groupId,
          agentId: input.agentId,
          userId: input.userId,
          knowledgeType: input.knowledgeType,
          topic: input.topic,
          content: input.content,
          importance: input.importance ?? 0.5,
          confidence: input.confidence ?? 0.7,
          sourceMessageId: input.sourceMessageId,
          contextType: input.contextType ?? "group",
          learnedFrom: input.learnedFrom,
          embedding,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Error saving shared knowledge:", error);
      throw error;
    }
  }

  /**
   * Recuperar conocimiento relevante
   */
  async retrieveKnowledge(params: RetrieveKnowledgeParams): Promise<any[]> {
    try {
      const whereClause: any = {
        agentId: params.agentId,
        isActive: true,
      };

      if (params.userId) {
        whereClause.userId = params.userId;
      }

      if (params.groupId && params.includeGroupKnowledge) {
        whereClause.OR = [
          { groupId: params.groupId },
          { contextType: "global" },
        ];
      }

      if (params.topic) {
        whereClause.topic = { contains: params.topic, mode: "insensitive" };
      }

      let knowledge = await prisma.sharedKnowledge.findMany({
        where: whereClause,
        orderBy: [
          { importance: "desc" },
          { confidence: "desc" },
          { updatedAt: "desc" },
        ],
        take: params.limit ?? 10,
      });

      // Si hay query, aplicar busqueda semantica
      if (params.query && knowledge.length > 0) {
        const queryEmbedding = await generateOpenAIEmbedding(params.query);

        const scored = knowledge.map((k) => {
          const embedding = k.embedding as number[] | null;
          const similarity = embedding
            ? cosineSimilarity(queryEmbedding, embedding)
            : 0;

          return {
            knowledge: k,
            score: similarity * 0.5 + k.importance * 0.3 + k.confidence * 0.2,
          };
        });

        knowledge = scored
          .sort((a, b) => b.score - a.score)
          .slice(0, params.limit ?? 10)
          .map((s) => s.knowledge);
      }

      return knowledge;
    } catch (error) {
      console.error("Error retrieving shared knowledge:", error);
      return [];
    }
  }

  /** Share knowledge with other AIs in the group */
  async shareWithGroupAIs(
    groupId: string,
    sourceAgentId: string,
    userId: string,
    topic: string,
    content: string,
    importance: number = 0.5
  ): Promise<void> {
    try {
      // Get other AIs in the group
      const groupMembers = await prisma.groupMember.findMany({
        where: {
          groupId,
          memberType: "agent",
          isActive: true,
          agentId: { not: sourceAgentId },
        },
        select: { agentId: true },
      });

      // Create conocimiento para cada IA
      for (const member of groupMembers) {
        if (!member.agentId) continue;

        await this.saveKnowledge({
          groupId,
          agentId: member.agentId,
          userId,
          knowledgeType: "fact",
          topic,
          content,
          importance: importance * 0.8, // Reducir importancia para conocimiento compartido
          confidence: 0.6, // Menor confianza para conocimiento de segunda mano
          contextType: "group",
          learnedFrom: sourceAgentId,
        });
      }
    } catch (error) {
      console.error("Error sharing knowledge with group AIs:", error);
    }
  }

  /** Get knowledge to inject into prompt */
  async getKnowledgeForPrompt(
    agentId: string,
    userId: string,
    groupId?: string,
    query?: string
  ): Promise<string> {
    const knowledge = await this.retrieveKnowledge({
      agentId,
      userId,
      groupId,
      query,
      limit: 5,
      includeGroupKnowledge: !!groupId,
    });

    if (knowledge.length === 0) {
      return "";
    }

    let prompt = "\n=== CONOCIMIENTO SOBRE ESTE USUARIO ===\n";
    for (const k of knowledge) {
      const source = k.learnedFrom ? ` (aprendido de otro)` : "";
      prompt += `- [${k.knowledgeType}] ${k.topic}: ${k.content}${source}\n`;
    }

    return prompt;
  }

  /**
   * Extraer conocimiento de un mensaje
   */
  async extractFromMessage(
    agentId: string,
    userId: string,
    messageContent: string,
    groupId?: string
  ): Promise<void> {
    // Palabras clave para detectar hechos
    const factPatterns = [
      { pattern: /(?:me llamo|soy|mi nombre es)\s+(\w+)/i, type: "fact" as const, topic: "nombre" },
      { pattern: /(?:tengo|cumplo)\s+(\d+)\s+a[nñ]os/i, type: "fact" as const, topic: "edad" },
      { pattern: /(?:trabajo en|soy)\s+(.+?)(?:\.|,|$)/i, type: "fact" as const, topic: "trabajo" },
      { pattern: /(?:me gusta|amo|adoro)\s+(.+?)(?:\.|,|$)/i, type: "preference" as const, topic: "gustos" },
      { pattern: /(?:odio|detesto|no me gusta)\s+(.+?)(?:\.|,|$)/i, type: "preference" as const, topic: "disgustos" },
    ];

    for (const { pattern, type, topic } of factPatterns) {
      const match = messageContent.match(pattern);
      if (match && match[1]) {
        await this.saveKnowledge({
          groupId,
          agentId,
          userId,
          knowledgeType: type,
          topic,
          content: match[0],
          importance: 0.7,
          contextType: groupId ? "group" : "private",
        });
      }
    }
  }
}

export const sharedKnowledgeService = new SharedKnowledgeService();
