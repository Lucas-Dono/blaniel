/**
 * Relation Sync Service
 *
 * Sincroniza el estado de relacion y emocional entre contextos
 * de grupo y chat privado.
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

export interface SyncInput {
  agentId: string;
  userId: string;
  groupId?: string;
  sentiment?: "positive" | "negative" | "neutral";
  interactionType: "group" | "private";
}

interface AdjustmentValues {
  trust: number;
  affinity: number;
  respect: number;
}

class RelationSyncService {
  /**
   * Sincronizar estado despues de una interaccion
   */
  async syncAfterInteraction(input: SyncInput): Promise<void> {
    const { agentId, userId, sentiment, interactionType, groupId } = input;

    try {
      // 1. Obtener o crear relacion
      let relation = await prisma.relation.findFirst({
        where: {
          subjectId: agentId,
          targetId: userId,
          targetType: "user",
        },
      });

      if (!relation) {
        // Create relacion si no existe
        relation = await prisma.relation.create({
          data: {
            id: nanoid(),
            updatedAt: new Date(),
            subjectId: agentId,
            targetId: userId,
            targetType: "user",
            trust: 0.5,
            affinity: 0.5,
            respect: 0.5,
            stage: "stranger",
            totalInteractions: 0,
            privateState: {},
            visibleState: {},
          },
        });
      }

      // 2. Calcular ajustes basados en sentimiento
      const adjustments = this.calculateAdjustments(sentiment);

      // 3. Actualizar relacion
      await prisma.relation.update({
        where: { id: relation.id },
        data: {
          trust: Math.max(0, Math.min(1, relation.trust + adjustments.trust)),
          affinity: Math.max(
            0,
            Math.min(1, relation.affinity + adjustments.affinity)
          ),
          respect: Math.max(
            0,
            Math.min(1, relation.respect + adjustments.respect)
          ),
          totalInteractions: { increment: 1 },
          lastInteractionAt: new Date(),
        },
      });

      // 4. Actualizar InternalState del agente
      await this.updateInternalState(agentId, sentiment);

      // 5. Actualizar TemporalContext
      await this.updateTemporalContext(agentId, userId, interactionType, groupId);

      console.log(
        `[RelationSync] Synced ${agentId} <-> ${userId} after ${interactionType} interaction`
      );
    } catch (error) {
      console.error("[RelationSync] Error syncing relation:", error);
    }
  }

  /**
   * Calcular ajustes basados en sentimiento
   */
  private calculateAdjustments(
    sentiment?: "positive" | "negative" | "neutral"
  ): AdjustmentValues {
    switch (sentiment) {
      case "positive":
        return { trust: 0.02, affinity: 0.03, respect: 0.01 };
      case "negative":
        return { trust: -0.02, affinity: -0.03, respect: -0.01 };
      case "neutral":
      default:
        return { trust: 0.005, affinity: 0.005, respect: 0.005 };
    }
  }

  /**
   * Actualizar InternalState del agente
   */
  private async updateInternalState(
    agentId: string,
    sentiment?: "positive" | "negative" | "neutral"
  ): Promise<void> {
    const state = await prisma.internalState.findUnique({
      where: { agentId },
    });

    if (!state) return;

    // Ajustar mood basado en sentimiento de interaccion
    let valenceAdjust = 0;
    let arousalAdjust = 0;

    switch (sentiment) {
      case "positive":
        valenceAdjust = 0.05;
        arousalAdjust = 0.03;
        break;
      case "negative":
        valenceAdjust = -0.05;
        arousalAdjust = 0.05; // Aumenta arousal por estres
        break;
      case "neutral":
        // Decay hacia baseline
        valenceAdjust = (0 - state.moodValence) * 0.02;
        arousalAdjust = (0.3 - state.moodArousal) * 0.02;
        break;
    }

    await prisma.internalState.update({
      where: { agentId },
      data: {
        moodValence: Math.max(
          -1,
          Math.min(1, state.moodValence + valenceAdjust)
        ),
        moodArousal: Math.max(0, Math.min(1, state.moodArousal + arousalAdjust)),
      },
    });
  }

  /**
   * Actualizar TemporalContext
   */
  private async updateTemporalContext(
    agentId: string,
    userId: string,
    interactionType: "group" | "private",
    groupId?: string
  ): Promise<void> {
    // Build base update data
    const baseUpdateData: Record<string, unknown> = {
      lastSeenAt: new Date(),
    };

    if (interactionType === "group") {
      baseUpdateData.lastGroupInteractionAt = new Date();
      baseUpdateData.groupInteractionCount = { increment: 1 };
      if (groupId) {
        baseUpdateData.lastGroupId = groupId;
      }
    } else {
      baseUpdateData.lastIndividualChatAt = new Date();
      baseUpdateData.individualChatCount = { increment: 1 };
    }

    // Build create data (cannot use increment in create)
    const createData: Record<string, unknown> = {
      id: nanoid(),
      updatedAt: new Date(),
      agentId,
      userId,
      lastSeenAt: new Date(),
    };

    if (interactionType === "group") {
      createData.lastGroupInteractionAt = new Date();
      createData.groupInteractionCount = 1;
      if (groupId) {
        createData.lastGroupId = groupId;
      }
    } else {
      createData.lastIndividualChatAt = new Date();
      createData.individualChatCount = 1;
    }

    await prisma.temporalContext.upsert({
      where: {
        agentId_userId: { agentId, userId },
      },
      create: createData as {
        id: string;
        updatedAt: Date;
        agentId: string;
        userId: string;
        lastSeenAt: Date;
        lastGroupInteractionAt?: Date;
        groupInteractionCount?: number;
        lastGroupId?: string;
        lastIndividualChatAt?: Date;
        individualChatCount?: number;
      },
      update: baseUpdateData,
    });
  }

  /**
   * Detectar sentimiento simple de un mensaje
   */
  detectSentiment(content: string): "positive" | "negative" | "neutral" {
    const lowerContent = content.toLowerCase();

    const positiveWords = [
      "gracias",
      "genial",
      "increible",
      "amor",
      "feliz",
      "bien",
      "excelente",
      "thanks",
      "great",
      "amazing",
      "love",
      "happy",
      "good",
      "excellent",
      "jaja",
      "haha",
      "lol",
      "bueno",
      "perfecto",
      "fantastico",
      "maravilloso",
    ];

    const negativeWords = [
      "mal",
      "horrible",
      "odio",
      "triste",
      "enojado",
      "furioso",
      "terrible",
      "bad",
      "horrible",
      "hate",
      "sad",
      "angry",
      "furious",
      "terrible",
      "pesimo",
      "feo",
      "molesto",
      "aburrido",
    ];

    const positiveCount = positiveWords.filter((w) =>
      lowerContent.includes(w)
    ).length;
    const negativeCount = negativeWords.filter((w) =>
      lowerContent.includes(w)
    ).length;

    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  }

  /** Get synchronization context for prompt */
  async getSyncContextForPrompt(
    agentId: string,
    userId: string,
    currentContext: "group" | "private"
  ): Promise<string> {
    const temporalContext = await prisma.temporalContext.findUnique({
      where: {
        agentId_userId: { agentId, userId },
      },
    });

    if (!temporalContext) return "";

    let context = "";

    if (
      currentContext === "private" &&
      temporalContext.lastGroupInteractionAt
    ) {
      const daysSinceGroup = Math.floor(
        (Date.now() - temporalContext.lastGroupInteractionAt.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysSinceGroup < 7) {
        context += `\n[CONTEXTO: Interactuaste con este usuario en un grupo hace ${daysSinceGroup} dias. `;
        context += `Han tenido ${temporalContext.groupInteractionCount} interacciones en grupos.]`;
      }
    }

    if (
      currentContext === "group" &&
      temporalContext.lastIndividualChatAt
    ) {
      const daysSincePrivate = Math.floor(
        (Date.now() - temporalContext.lastIndividualChatAt.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysSincePrivate < 7) {
        context += `\n[CONTEXTO: Has chateado en privado con este usuario hace ${daysSincePrivate} dias. `;
        context += `Han tenido ${temporalContext.individualChatCount} chats privados.]`;
      }
    }

    return context;
  }

  /** Get relationship between agent and user */
  async getRelation(agentId: string, userId: string) {
    return prisma.relation.findFirst({
      where: {
        subjectId: agentId,
        targetId: userId,
        targetType: "user",
      },
    });
  }

  /**
   * Calcular stage de relacion basado en totalInteractions
   */
  calculateRelationshipStage(
    totalInteractions: number
  ): "stranger" | "acquaintance" | "friend" | "close" | "intimate" {
    if (totalInteractions < 5) return "stranger";
    if (totalInteractions < 20) return "acquaintance";
    if (totalInteractions < 50) return "friend";
    if (totalInteractions < 100) return "close";
    return "intimate";
  }

  /**
   * Actualizar stage de relacion si corresponde
   */
  async updateRelationshipStage(
    agentId: string,
    userId: string
  ): Promise<void> {
    const relation = await this.getRelation(agentId, userId);
    if (!relation) return;

    const newStage = this.calculateRelationshipStage(relation.totalInteractions);

    if (newStage !== relation.stage) {
      await prisma.relation.update({
        where: { id: relation.id },
        data: { stage: newStage },
      });

      console.log(
        `[RelationSync] Relationship ${agentId} <-> ${userId} evolved to ${newStage}`
      );
    }
  }
}

export const relationSyncService = new RelationSyncService();
