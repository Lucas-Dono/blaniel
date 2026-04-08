/**
 * AI Relation Service
 *
 * Manages dynamic relationships between AIs within a group.
 * Tracks affinity, dynamics, tension and shared moments.
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import type { AIRelation, UpdateRelationInput } from "./types";

class AIRelationService {
  /**
   * Get or create a relationship between two AIs
   */
  async getOrCreate(
    groupId: string,
    agentAId: string,
    agentBId: string
  ): Promise<AIRelation> {
    try {
      // Ensure consistent order (A always less than B alphabetically)
      const [firstId, secondId] = [agentAId, agentBId].sort();

      let relation = await prisma.aIRelation.findUnique({
        where: {
          groupId_agentAId_agentBId: {
            groupId,
            agentAId: firstId,
            agentBId: secondId,
          },
        },
      });

      if (!relation) {
        relation = await prisma.aIRelation.create({
          data: {
            id: nanoid(),
            updatedAt: new Date(),
            groupId,
            agentAId: firstId,
            agentBId: secondId,
            affinity: 0,
            relationType: "neutral",
            dynamics: [],
            tensionLevel: 0,
            interactionCount: 0,
            sharedMoments: [],
          },
        });

        console.log(
          `[AIRelation] New relationship created between ${firstId} and ${secondId}`
        );
      }

      return relation as AIRelation;
    } catch (error) {
      console.error("[AIRelation] Error getting/creating relationship:", error);
      throw error;
    }
  }

  /**
   * Update a relationship between two AIs
   */
  async updateRelation(
    groupId: string,
    agentAId: string,
    agentBId: string,
    update: UpdateRelationInput
  ): Promise<AIRelation> {
    try {
      const relation = await this.getOrCreate(groupId, agentAId, agentBId);

      const updateData: any = {
        lastInteraction: new Date(),
        interactionCount: { increment: 1 },
      };

      // Affinity change
      if (update.affinityChange !== undefined) {
        const newAffinity = Math.max(
          -10,
          Math.min(10, relation.affinity + update.affinityChange)
        );
        updateData.affinity = newAffinity;

        // Update relationship type based on affinity
        if (newAffinity >= 7) {
          updateData.relationType = "friends";
        } else if (newAffinity >= 4) {
          updateData.relationType = "allies";
        } else if (newAffinity <= -7) {
          updateData.relationType = "rivals";
        } else if (newAffinity <= -4) {
          updateData.relationType = "tense";
        } else {
          updateData.relationType = "neutral";
        }
      }

      // Add dynamic
      if (update.dynamicToAdd) {
        const currentDynamics = relation.dynamics || [];
        if (!currentDynamics.includes(update.dynamicToAdd)) {
          updateData.dynamics = [...currentDynamics, update.dynamicToAdd];
        }
      }

      // Remove dynamic
      if (update.dynamicToRemove) {
        const currentDynamics = relation.dynamics || [];
        updateData.dynamics = currentDynamics.filter(
          (d) => d !== update.dynamicToRemove
        );
      }

      // Change relationship type directly
      if (update.newRelationType) {
        updateData.relationType = update.newRelationType;
      }

      // Agregar momento compartido
      if (update.addSharedMoment) {
        const currentMoments = Array.isArray(relation.sharedMoments)
          ? relation.sharedMoments
          : JSON.parse(relation.sharedMoments as any);
        updateData.sharedMoments = [...currentMoments, update.addSharedMoment];

        // Limit to last 10 moments
        if (updateData.sharedMoments.length > 10) {
          updateData.sharedMoments = updateData.sharedMoments.slice(-10);
        }
      }

      const updated = await prisma.aIRelation.update({
        where: { id: relation.id },
        data: updateData,
      });

      console.log(
        `[AIRelation] Relación actualizada: ${agentAId} <-> ${agentBId} (afinidad: ${updated.affinity})`
      );

      return updated as AIRelation;
    } catch (error) {
      console.error("[AIRelation] Error actualizando relación:", error);
      throw error;
    }
  }

  /**
   * Obtiene todas las relaciones de un grupo
   */
  async getGroupRelations(groupId: string): Promise<AIRelation[]> {
    try {
      const relations = await prisma.aIRelation.findMany({
        where: { groupId },
        orderBy: { lastInteraction: "desc" },
      });

      return relations as AIRelation[];
    } catch (error) {
      console.error("[AIRelation] Error obteniendo relaciones:", error);
      return [];
    }
  }

  /**
   * Obtiene relaciones de una IA específica
   */
  async getAgentRelations(
    groupId: string,
    agentId: string
  ): Promise<AIRelation[]> {
    try {
      const relations = await prisma.aIRelation.findMany({
        where: {
          groupId,
          OR: [{ agentAId: agentId }, { agentBId: agentId }],
        },
        orderBy: { affinity: "desc" },
      });

      return relations as AIRelation[];
    } catch (error) {
      console.error("[AIRelation] Error obteniendo relaciones del agente:", error);
      return [];
    }
  }

  /**
   * Obtiene relaciones por tipo
   */
  async getRelationsByType(
    groupId: string,
    relationType: string
  ): Promise<AIRelation[]> {
    try {
      const relations = await prisma.aIRelation.findMany({
        where: { groupId, relationType },
      });

      return relations as AIRelation[];
    } catch (error) {
      console.error("[AIRelation] Error obteniendo relaciones por tipo:", error);
      return [];
    }
  }

  /**
   * Obtiene relaciones con alta tensión
   */
  async getHighTensionRelations(groupId: string): Promise<AIRelation[]> {
    try {
      const relations = await prisma.aIRelation.findMany({
        where: {
          groupId,
          tensionLevel: { gte: 0.6 },
        },
        orderBy: { tensionLevel: "desc" },
      });

      return relations as AIRelation[];
    } catch (error) {
      console.error("[AIRelation] Error obteniendo relaciones tensas:", error);
      return [];
    }
  }

  /**
   * Ajusta la tensión entre dos IAs
   */
  async adjustTension(
    groupId: string,
    agentAId: string,
    agentBId: string,
    tensionChange: number
  ): Promise<void> {
    try {
      const relation = await this.getOrCreate(groupId, agentAId, agentBId);

      const newTension = Math.max(
        0,
        Math.min(1, relation.tensionLevel + tensionChange)
      );

      await prisma.aIRelation.update({
        where: { id: relation.id },
        data: { tensionLevel: newTension },
      });

      console.log(
        `[AIRelation] Tensión ajustada a ${newTension.toFixed(2)} entre ${agentAId} y ${agentBId}`
      );
    } catch (error) {
      console.error("[AIRelation] Error ajustando tensión:", error);
    }
  }

  /**
   * Decae la tensión de todas las relaciones con el tiempo
   */
  async decayTension(groupId: string, decayRate = 0.1): Promise<void> {
    try {
      const relations = await prisma.aIRelation.findMany({
        where: {
          groupId,
          tensionLevel: { gt: 0 },
        },
      });

      for (const relation of relations) {
        const newTension = Math.max(0, relation.tensionLevel - decayRate);

        await prisma.aIRelation.update({
          where: { id: relation.id },
          data: { tensionLevel: newTension },
        });
      }

      console.log(
        `[AIRelation] Tensión decaída en ${relations.length} relaciones`
      );
    } catch (error) {
      console.error("[AIRelation] Error decayendo tensión:", error);
    }
  }

  /**
   * Busca pares de IAs con buena química (para escenas románticas o de amistad)
   */
  async findGoodChemistry(groupId: string): Promise<AIRelation[]> {
    try {
      const relations = await prisma.aIRelation.findMany({
        where: {
          groupId,
          affinity: { gte: 5 },
          interactionCount: { gte: 3 },
        },
        orderBy: { affinity: "desc" },
      });

      return relations as AIRelation[];
    } catch (error) {
      console.error("[AIRelation] Error buscando química:", error);
      return [];
    }
  }

  /**
   * Busca pares con rivalidad (para escenas de conflicto)
   */
  async findRivalries(groupId: string): Promise<AIRelation[]> {
    try {
      const relations = await prisma.aIRelation.findMany({
        where: {
          groupId,
          affinity: { lte: -4 },
          interactionCount: { gte: 2 },
        },
        orderBy: { affinity: "asc" },
      });

      return relations as AIRelation[];
    } catch (error) {
      console.error("[AIRelation] Error buscando rivalidades:", error);
      return [];
    }
  }

  /**
   * Obtiene el agente con mejor relación con un agente dado
   */
  async getBestFriend(groupId: string, agentId: string): Promise<string | null> {
    try {
      const relations = await this.getAgentRelations(groupId, agentId);

      if (relations.length === 0) return null;

      // Ordenar por afinidad
      const sorted = relations.sort((a, b) => b.affinity - a.affinity);
      const best = sorted[0];

      // Return the other agent in the relationship
      return best.agentAId === agentId ? best.agentBId : best.agentAId;
    } catch (error) {
      console.error("[AIRelation] Error obteniendo mejor amigo:", error);
      return null;
    }
  }

  /**
   * Obtiene estadísticas de relaciones del grupo
   */
  async getStats(groupId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    avgAffinity: number;
    avgTension: number;
    avgInteractions: number;
  }> {
    try {
      const relations = await prisma.aIRelation.findMany({
        where: { groupId },
      });

      const byType: Record<string, number> = {};
      let totalAffinity = 0;
      let totalTension = 0;
      let totalInteractions = 0;

      for (const rel of relations) {
        byType[rel.relationType] = (byType[rel.relationType] || 0) + 1;
        totalAffinity += rel.affinity;
        totalTension += rel.tensionLevel;
        totalInteractions += rel.interactionCount;
      }

      return {
        total: relations.length,
        byType,
        avgAffinity: relations.length > 0 ? totalAffinity / relations.length : 0,
        avgTension: relations.length > 0 ? totalTension / relations.length : 0,
        avgInteractions:
          relations.length > 0 ? totalInteractions / relations.length : 0,
      };
    } catch (error) {
      console.error("[AIRelation] Error obteniendo estadísticas:", error);
      return {
        total: 0,
        byType: {},
        avgAffinity: 0,
        avgTension: 0,
        avgInteractions: 0,
      };
    }
  }
}

// Singleton
export const aiRelationService = new AIRelationService();
