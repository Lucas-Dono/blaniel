/**
 * Tension Seed Service
 *
 * Gestiona las semillas de tensión: eventos pendientes que generan
 * oportunidades narrativas futuras.
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { SeedStatus } from "@prisma/client";
import type { CreateSeedInput, TensionSeed } from "./types";

class TensionSeedService {
  private readonly MAX_SEEDS = 5;
  private readonly MAX_LATENCY_TURNS = 20;

  /**
   * Crea una nueva semilla de tensión
   */
  async create(data: CreateSeedInput): Promise<TensionSeed | null> {
    try {
      // Check active seed limit
      const activeCount = await prisma.tensionSeed.count({
        where: {
          groupId: data.groupId,
          status: { in: ["LATENT", "ACTIVE", "ESCALATING"] },
        },
      });

      if (activeCount >= this.MAX_SEEDS) {
        console.log(
          `[TensionSeed] Límite de semillas alcanzado en grupo ${data.groupId}`
        );
        return null;
      }

      const seed = await prisma.tensionSeed.create({
        data: {
          id: nanoid(),
          groupId: data.groupId,
          type: data.type,
          title: data.title,
          content: data.content,
          involvedAgents: data.involvedAgents,
          originAgentId: data.originAgentId,
          latencyTurns: data.latencyTurns ?? 5,
          maxTurns: this.MAX_LATENCY_TURNS,
          status: "LATENT",
          currentTurn: 0,
          escalationLevel: 0,
        },
      });

      console.log(
        `[TensionSeed] Semilla creada: ${seed.title} (${seed.id})`
      );

      return seed as TensionSeed;
    } catch (error) {
      console.error("[TensionSeed] Error creando semilla:", error);
      return null;
    }
  }

  /**
   * Avanza el turno de todas las semillas de un grupo
   */
  async advanceTurn(groupId: string): Promise<void> {
    try {
      const seeds = await prisma.tensionSeed.findMany({
        where: {
          groupId,
          status: { in: ["LATENT", "ACTIVE", "ESCALATING"] },
        },
      });

      for (const seed of seeds) {
        const newTurn = seed.currentTurn + 1;
        let newStatus = seed.status;
        let escalationLevel = seed.escalationLevel;

        // Transiciones de estado
        if (seed.status === "LATENT" && newTurn >= seed.latencyTurns) {
          newStatus = "ACTIVE";
          console.log(
            `[TensionSeed] Semilla "${seed.title}" ahora ACTIVE`
          );
        } else if (newTurn >= seed.maxTurns * 0.7) {
          newStatus = "ESCALATING";
          escalationLevel = Math.min(3, escalationLevel + 1);
          console.log(
            `[TensionSeed] Semilla "${seed.title}" ahora ESCALATING (nivel ${escalationLevel})`
          );
        } else if (newTurn >= seed.maxTurns) {
          newStatus = "EXPIRED";
          console.log(
            `[TensionSeed] Semilla "${seed.title}" EXPIRÓ`
          );
        }

        await prisma.tensionSeed.update({
          where: { id: seed.id },
          data: {
            currentTurn: newTurn,
            status: newStatus,
            escalationLevel,
          },
        });
      }
    } catch (error) {
      console.error("[TensionSeed] Error avanzando turnos:", error);
    }
  }

  /**
   * Obtiene semillas que pueden ser referenciadas
   */
  async getReferenceable(groupId: string): Promise<TensionSeed[]> {
    try {
      const seeds = await prisma.tensionSeed.findMany({
        where: {
          groupId,
          status: { in: ["ACTIVE", "ESCALATING"] },
        },
        orderBy: [
          { escalationLevel: "desc" },
          { currentTurn: "desc" },
        ],
      });

      return seeds as TensionSeed[];
    } catch (error) {
      console.error("[TensionSeed] Error obteniendo semillas:", error);
      return [];
    }
  }

  /**
   * Obtiene todas las semillas activas de un grupo
   */
  async getActive(groupId: string): Promise<TensionSeed[]> {
    try {
      const seeds = await prisma.tensionSeed.findMany({
        where: {
          groupId,
          status: { in: ["LATENT", "ACTIVE", "ESCALATING", "RESOLVING"] },
        },
        orderBy: { createdAt: "desc" },
      });

      return seeds as TensionSeed[];
    } catch (error) {
      console.error("[TensionSeed] Error obteniendo semillas activas:", error);
      return [];
    }
  }

  /**
   * Registra una referencia a una semilla
   */
  async recordReference(seedId: string): Promise<void> {
    try {
      await prisma.tensionSeed.update({
        where: { id: seedId },
        data: {
          lastReference: new Date(),
          referenceCount: { increment: 1 },
        },
      });

      console.log(`[TensionSeed] Referencia registrada para ${seedId}`);
    } catch (error) {
      console.error("[TensionSeed] Error registrando referencia:", error);
    }
  }

  /**
   * Marca una semilla como en resolución
   */
  async startResolving(seedId: string): Promise<void> {
    try {
      await prisma.tensionSeed.update({
        where: { id: seedId },
        data: { status: "RESOLVING" },
      });

      console.log(`[TensionSeed] Semilla ${seedId} ahora en RESOLVING`);
    } catch (error) {
      console.error("[TensionSeed] Error iniciando resolución:", error);
    }
  }

  /**
   * Resuelve una semilla
   */
  async resolve(
    seedId: string,
    resolution: string,
    resolutionType: "natural" | "forced" | "abandoned"
  ): Promise<void> {
    try {
      await prisma.tensionSeed.update({
        where: { id: seedId },
        data: {
          status: "RESOLVED",
          resolution,
          resolutionType,
          resolvedAt: new Date(),
        },
      });

      console.log(
        `[TensionSeed] Semilla ${seedId} RESUELTA (${resolutionType})`
      );
    } catch (error) {
      console.error("[TensionSeed] Error resolviendo semilla:", error);
    }
  }

  /**
   * Obtiene semillas que necesitan resolución forzada
   */
  async getNeedingResolution(groupId: string): Promise<TensionSeed[]> {
    try {
      const seeds = await prisma.tensionSeed.findMany({
        where: {
          groupId,
          status: { in: ["ESCALATING"] },
          escalationLevel: { gte: 2 },
        },
        orderBy: [
          { escalationLevel: "desc" },
          { currentTurn: "desc" },
        ],
      });

      return seeds as TensionSeed[];
    } catch (error) {
      console.error(
        "[TensionSeed] Error obteniendo semillas para resolución:",
        error
      );
      return [];
    }
  }

  /**
   * Obtiene semillas por tipo
   */
  async getByType(groupId: string, type: string): Promise<TensionSeed[]> {
    try {
      const seeds = await prisma.tensionSeed.findMany({
        where: {
          groupId,
          type,
          status: { in: ["ACTIVE", "ESCALATING"] },
        },
      });

      return seeds as TensionSeed[];
    } catch (error) {
      console.error("[TensionSeed] Error obteniendo semillas por tipo:", error);
      return [];
    }
  }

  /**
   * Obtiene semillas que involucran a un agente específico
   */
  async getByAgent(groupId: string, agentId: string): Promise<TensionSeed[]> {
    try {
      const seeds = await prisma.tensionSeed.findMany({
        where: {
          groupId,
          involvedAgents: { has: agentId },
          status: { in: ["ACTIVE", "ESCALATING", "RESOLVING"] },
        },
      });

      return seeds as TensionSeed[];
    } catch (error) {
      console.error("[TensionSeed] Error obteniendo semillas por agente:", error);
      return [];
    }
  }

  /**
   * Escala manualmente una semilla
   */
  async escalate(seedId: string, notes?: string): Promise<void> {
    try {
      const seed = await prisma.tensionSeed.findUnique({
        where: { id: seedId },
      });

      if (!seed) return;

      const newLevel = Math.min(3, seed.escalationLevel + 1);

      await prisma.tensionSeed.update({
        where: { id: seedId },
        data: {
          escalationLevel: newLevel,
          status: newLevel >= 2 ? "ESCALATING" : seed.status,
          escalationNotes: notes,
        },
      });

      console.log(`[TensionSeed] Semilla ${seedId} escalada a nivel ${newLevel}`);
    } catch (error) {
      console.error("[TensionSeed] Error escalando semilla:", error);
    }
  }

  /**
   * Elimina semillas expiradas
   */
  async cleanupExpired(groupId: string): Promise<number> {
    try {
      const result = await prisma.tensionSeed.deleteMany({
        where: {
          groupId,
          status: "EXPIRED",
          createdAt: {
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // More than 7 days
          },
        },
      });

      if (result.count > 0) {
        console.log(
          `[TensionSeed] Limpiadas ${result.count} semillas expiradas`
        );
      }

      return result.count;
    } catch (error) {
      console.error("[TensionSeed] Error limpiando semillas:", error);
      return 0;
    }
  }

  /**
   * Obtiene estadísticas de semillas de un grupo
   */
  async getStats(groupId: string): Promise<{
    total: number;
    byStatus: Record<SeedStatus, number>;
    byType: Record<string, number>;
    avgEscalationLevel: number;
    avgTurnsSinceCreated: number;
  }> {
    try {
      const seeds = await prisma.tensionSeed.findMany({
        where: { groupId },
      });

      const byStatus: Record<SeedStatus, number> = {
        LATENT: 0,
        ACTIVE: 0,
        ESCALATING: 0,
        RESOLVING: 0,
        RESOLVED: 0,
        EXPIRED: 0,
      };

      const byType: Record<string, number> = {};
      let totalEscalation = 0;
      let totalTurns = 0;

      for (const seed of seeds) {
        byStatus[seed.status]++;
        byType[seed.type] = (byType[seed.type] || 0) + 1;
        totalEscalation += seed.escalationLevel;
        totalTurns += seed.currentTurn;
      }

      return {
        total: seeds.length,
        byStatus,
        byType,
        avgEscalationLevel: seeds.length > 0 ? totalEscalation / seeds.length : 0,
        avgTurnsSinceCreated: seeds.length > 0 ? totalTurns / seeds.length : 0,
      };
    } catch (error) {
      console.error("[TensionSeed] Error obteniendo estadísticas:", error);
      return {
        total: 0,
        byStatus: {
          LATENT: 0,
          ACTIVE: 0,
          ESCALATING: 0,
          RESOLVING: 0,
          RESOLVED: 0,
          EXPIRED: 0,
        },
        byType: {},
        avgEscalationLevel: 0,
        avgTurnsSinceCreated: 0,
      };
    }
  }
}

// Singleton
export const tensionSeedService = new TensionSeedService();
