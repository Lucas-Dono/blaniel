/**
 * MEMORY SYSTEM + BONDS INTEGRATION
 *
 * Integra el sistema de Symbolic Bonds con el sistema de memoria episódica:
 * - Los bonds afectan qué se recuerda y con qué prioridad
 * - Memorias relacionadas con bonds son más "importantes"
 * - Bonds fuertes aumentan la retención de detalles
 * - Sistema de "momentos especiales" para bonds
 */

import { prisma } from "@/lib/prisma";

export interface BondMemoryModifiers {
  importanceMultiplier: number; // 1.0 to 2.0
  retentionBonus: number; // 0 to 30 days
  emotionalWeighting: number; // 1.0 to 1.5
  specialMomentThreshold: number; // 0 to 1
}

/**
 * Obtener modificadores de memoria basados en el bond
 */
export async function getBondMemoryModifiers(
  userId: string,
  agentId: string
): Promise<BondMemoryModifiers | null> {
  try {
    const bond = await prisma.symbolicBond.findFirst({
      where: {
        userId,
        agentId,
        status: { in: ["active", "dormant", "fragile", "at_risk"] },
      },
    });

    if (!bond) {
      return null;
    }

    const affinityNormalized = bond.affinityLevel / 100;

    return {
      // Memories with bonded users are more important
      importanceMultiplier: 1.0 + affinityNormalized * 1.0, // 1.0 to 2.0

      // Bonded users' memories are retained longer
      retentionBonus: Math.floor(affinityNormalized * 30), // 0 to 30 days

      // Emotional memories are weighted higher
      emotionalWeighting: 1.0 + affinityNormalized * 0.5, // 1.0 to 1.5

      // Threshold for marking as "special moment"
      specialMomentThreshold: Math.max(0.3, 1.0 - affinityNormalized), // Higher affinity = lower threshold
    };
  } catch (error) {
    console.error("[Bond Memory Integration] Error getting modifiers:", error);
    return null;
  }
}

/**
 * Determinar si un momento debe marcarse como "special" basado en el bond
 */
export function isSpecialMoment(
  messageContent: string,
  emotionalIntensity: number,
  bondModifiers: BondMemoryModifiers | null
): boolean {
  if (!bondModifiers) {
    return emotionalIntensity > 0.7; // Default threshold
  }

  // Special moments have lower threshold for bonded users
  if (emotionalIntensity > bondModifiers.specialMomentThreshold) {
    return true;
  }

  // Check for special keywords/phrases
  const specialKeywords = [
    "amor",
    "te amo",
    "te quiero",
    "especial",
    "importante",
    "siempre",
    "nunca olvidaré",
    "gracias",
    "perdón",
    "confío",
    "secreto",
    "vulnerable",
  ];

  const lowerContent = messageContent.toLowerCase();
  const hasSpecialKeyword = specialKeywords.some((keyword) =>
    lowerContent.includes(keyword)
  );

  return hasSpecialKeyword && emotionalIntensity > 0.4;
}

/**
 * Crear una memoria especial del bond
 */
export async function createBondSpecialMemory(
  bondId: string,
  title: string,
  description: string,
  emotionalContext: any,
  metadata?: any
): Promise<any> {
  try {
    const bond = await prisma.symbolicBond.findUnique({
      where: { id: bondId },
    });

    if (!bond) {
      throw new Error("Bond not found");
    }

    // TODO: Implement special memories storage
    // The specialMemories field has been removed from SymbolicBond model
    // Consider using a separate table or storing in sharedExperiences
    const newMemory = {
      id: `mem_${Date.now()}`,
      title,
      description,
      emotionalContext,
      timestamp: new Date().toISOString(),
      metadata,
    };

    // For now, just return the memory without storing it
    // This functionality should be reimplemented with a proper storage solution
    console.warn('[Bond Memory Integration] Special memories storage not implemented');

    return newMemory;
  } catch (error) {
    console.error("[Bond Memory Integration] Error creating special memory:", error);
    throw error;
  }
}

/**
 * Obtener memorias especiales del bond para incluir en contexto
 */
export async function getBondSpecialMemories(
  bondId: string,
  limit: number = 5
): Promise<any[]> {
  try {
    // TODO: Implement special memories retrieval
    // The specialMemories field has been removed from SymbolicBond model
    // Consider using a separate table or retrieving from sharedExperiences
    console.warn('[Bond Memory Integration] Special memories retrieval not implemented');

    // Return empty array for now
    return [];
  } catch (error) {
    console.error("[Bond Memory Integration] Error getting special memories:", error);
    return [];
  }
}

/**
 * Generar contexto de memoria enriquecido para el prompt
 */
export async function generateBondMemoryContext(
  userId: string,
  agentId: string
): Promise<string> {
  try {
    const bond = await prisma.symbolicBond.findFirst({
      where: {
        userId,
        agentId,
        status: { in: ["active", "dormant", "fragile", "at_risk"] },
      },
    });

    if (!bond) {
      return "";
    }

    const specialMemories = await getBondSpecialMemories(bond.id, 3);

    if (specialMemories.length === 0) {
      return "";
    }

    let context = `**Momentos Especiales que Recuerdas con Claridad:**\n`;

    specialMemories.forEach((memory, index) => {
      const date = new Date(memory.timestamp).toLocaleDateString("es-ES");
      context += `${index + 1}. *${memory.title}* (${date}): ${memory.description}\n`;
    });

    context += `\nEstos momentos son especialmente significativos en tu relación. Puedes referenciarlos naturalmente cuando sea apropiado.\n`;

    return context;
  } catch (error) {
    console.error("[Bond Memory Integration] Error generating memory context:", error);
    return "";
  }
}

/**
 * Ajustar importancia de memoria basada en bond
 */
export function adjustMemoryImportance(
  baseImportance: number,
  bondModifiers: BondMemoryModifiers | null,
  hasEmotionalContent: boolean = false
): number {
  if (!bondModifiers) {
    return baseImportance;
  }

  let adjustedImportance = baseImportance * bondModifiers.importanceMultiplier;

  if (hasEmotionalContent) {
    adjustedImportance *= bondModifiers.emotionalWeighting;
  }

  // Clamp to 0-1
  return Math.max(0, Math.min(1, adjustedImportance));
}

/**
 * Calcular tiempo de retención de memoria ajustado por bond
 */
export function getAdjustedRetentionTime(
  baseRetentionDays: number,
  bondModifiers: BondMemoryModifiers | null
): number {
  if (!bondModifiers) {
    return baseRetentionDays;
  }

  return baseRetentionDays + bondModifiers.retentionBonus;
}

/**
 * Recuperar memorias relevantes con boost de bond
 */
export async function retrieveBondEnhancedMemories(
  userId: string,
  agentId: string,
  query: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const bondModifiers = await getBondMemoryModifiers(userId, agentId);

    // Get regular memories (from your existing memory system)
    // This would integrate with your unified-retrieval system
    const memories = await prisma.message.findMany({
      where: {
        userId,
        agentId,
      },
      orderBy: { createdAt: "desc" },
      take: limit * 2, // Get more to filter
    });

    // Score and sort memories
    const scoredMemories = memories.map((memory) => {
      let score = 1.0;

      // Boost recent memories
      const daysSince =
        (Date.now() - new Date(memory.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);
      score *= Math.max(0.3, 1 - daysSince / 90);

      // Apply bond modifier
      if (bondModifiers) {
        score *= bondModifiers.importanceMultiplier;
      }

      // Relevance to query (simple keyword matching)
      const relevanceScore = query
        .toLowerCase()
        .split(" ")
        .filter((word) =>
          memory.content.toLowerCase().includes(word)
        ).length;
      score += relevanceScore * 0.2;

      return { memory, score };
    });

    // Sort by score and take top N
    return scoredMemories
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.memory);
  } catch (error) {
    console.error(
      "[Bond Memory Integration] Error retrieving enhanced memories:",
      error
    );
    return [];
  }
}

/**
 * Registrar evento importante del bond en la memoria
 */
export async function recordBondEventInMemory(
  bondId: string,
  eventType: string,
  description: string,
  emotionalImpact: number
): Promise<void> {
  try {
    const bond = await prisma.symbolicBond.findUnique({
      where: { id: bondId },
    });

    if (!bond) {
      return;
    }

    await createBondSpecialMemory(
      bondId,
      `Evento del Vínculo: ${eventType}`,
      description,
      {
        emotionalImpact,
        eventType,
      },
      {
        affinityLevel: bond.affinityLevel,
        bondStatus: bond.status,
      }
    );
  } catch (error) {
    console.error("[Bond Memory Integration] Error recording bond event:", error);
  }
}
