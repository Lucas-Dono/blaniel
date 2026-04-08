import { prisma } from "@/lib/prisma";
import { EmotionalEngine } from "@/lib/relations/engine";
import { getRelevantMemories } from "@/lib/chat/cross-context-memory";
import { getTemporalContext } from "@/lib/chat/cross-context-memory";

import type { UserTier } from "@/lib/chat/types";

/**
 * Enhanced Proactive Messaging Triggers
 * 
 * Significant improvements to the proactive messaging system:
 * - Based on relationship level (closer = more messages)
 * - Energy awareness (do not disturb if tired)
 * - Cross-context awareness (mention group conversations)
 * - Topic fatigue awareness (avoid repetitive topics)
 * - Emotional intelligence (detect when the user needs support)
 */

export interface EnhancedTrigger {
  type: string;
  priority: number;
  context: any;
  reason: string;
}

/**
 * Detect enhanced triggers for proactive messages
 */
export async function detectEnhancedTriggers(
  agentId: string,
  userId: string,
  tier: UserTier
): Promise<EnhancedTrigger[]> {
  const triggers: EnhancedTrigger[] = [];

  // Get relationship
  const relation = await prisma.relation.findFirst({
    where: {
      subjectId: agentId,
      targetId: userId,
      targetType: "user",
    },
  });

  if (!relation) {
    return []; // No hay relación establecida
  }

  // Calculate relationship level
  const relationshipLevel = EmotionalEngine.getRelationshipLevel({
    trust: relation.trust,
    affinity: relation.affinity,
    respect: relation.respect,
    love: (relation.privateState as { love?: number }).love || 0,
    curiosity: (relation.privateState as { curiosity?: number }).curiosity || 0,
    valence: 0.5,
    arousal: 0.5,
    dominance: 0.5,
  });

  // Get contexto temporal
  const temporalContext = await getTemporalContext(agentId, userId);

  // 1. TRIGGER: Inactivity (based on relationship)
  const inactivityTrigger = await checkInactivityTrigger(
    agentId,
    userId,
    relationshipLevel,
    temporalContext
  );
  if (inactivityTrigger) {
    triggers.push(inactivityTrigger);
  }

  // 2. TRIGGER: Emotional Check-in (if last conversation was negative)
  const emotionalTrigger = await checkEmotionalTrigger(agentId, userId, relation);
  if (emotionalTrigger) {
    triggers.push(emotionalTrigger);
  }

  // 3. TRIGGER: Cross-context reference (mencionar algo de grupo)
  const crossContextTrigger = await checkCrossContextTrigger(agentId, userId, tier);
  if (crossContextTrigger) {
    triggers.push(crossContextTrigger);
  }

  // 4. TRIGGER: Shared experience (something in common regarding the weather/routine)
  const sharedExperienceTrigger = await checkSharedExperienceTrigger(agentId);
  if (sharedExperienceTrigger) {
    triggers.push(sharedExperienceTrigger);
  }

  // 5. TRIGGER: Relationship milestone (new relationship level)
  const milestoneTrigger = await checkRelationshipMilestoneTrigger(agentId, userId, relation);
  if (milestoneTrigger) {
    triggers.push(milestoneTrigger);
  }

  // Ordenar por prioridad
  return triggers.sort((a, b) => b.priority - a.priority);
}

/** Improved inactivity trigger (based on relationship) */
async function checkInactivityTrigger(
  agentId: string,
  userId: string,
  relationshipLevel: string,
  temporalContext: any
): Promise<EnhancedTrigger | null> {
  if (!temporalContext?.lastIndividualChatAt) {
    return null;
  }

  const hoursSinceLastChat =
    (Date.now() - temporalContext.lastIndividualChatAt.getTime()) / (1000 * 60 * 60);

  // Threshold based on relationship
  const thresholds: Record<string, number> = {
    stranger: 168, // 7 días
    acquaintance: 72, // 3 días
    friend: 48, // 2 días
    close_friend: 24, // 1 día
    intimate: 12, // 12 horas
  };

  const threshold = thresholds[relationshipLevel] || 72;

  if (hoursSinceLastChat >= threshold) {
    return {
      type: "inactivity",
      priority: relationshipLevel === "intimate" ? 0.9 : 0.6,
      context: {
        hoursSinceLastChat,
        relationshipLevel,
      },
      reason: `Han pasado ${Math.floor(hoursSinceLastChat)} horas sin hablar`,
    };
  }

  return null;
}

/**
 * Trigger de check-in emocional
 */
async function checkEmotionalTrigger(
  agentId: string,
  userId: string,
  relation: any
): Promise<EnhancedTrigger | null> {
  // Check if the last conversation was negative
  const lastMessage = await prisma.message.findFirst({
    where: {
      agentId,
      role: "user",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!lastMessage) {
    return null;
  }

  const hoursSinceLastMessage =
    (Date.now() - lastMessage.createdAt.getTime()) / (1000 * 60 * 60);

  // If the last interaction was more than 12 hours ago and less than 48 hours ago
  // and the relationship has low emotional valence, do a check-in
  const emotionalValence = (relation.privateState as { emotionalValence?: number })
    .emotionalValence;

  if (
    hoursSinceLastMessage >= 12 &&
    hoursSinceLastMessage <= 48 &&
    emotionalValence !== undefined &&
    emotionalValence < 0
  ) {
    return {
      type: "emotional_checkin",
      priority: 0.85,
      context: {
        lastMessageTime: lastMessage.createdAt,
        emotionalValence,
      },
      reason: "Última conversación tuvo tono negativo",
    };
  }

  return null;
}

/**
 * Trigger de referencia cross-context
 */
async function checkCrossContextTrigger(
  agentId: string,
  userId: string,
  tier: UserTier
): Promise<EnhancedTrigger | null> {
  // Solo para Plus y Ultra (Free no tiene acceso)
  if (tier === "free") {
    return null;
  }

  // Get memorias recientes de grupos
  const memories = await getRelevantMemories(agentId, tier, "individual", 3);

  if (memories.length > 0) {
    // Check if they recently had an interesting group conversation
    const recentMemory = memories[0];
    const hoursSinceMemory =
      (Date.now() - recentMemory.happenedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceMemory <= 48 && hoursSinceMemory >= 6) {
      // Entre 6 y 48 horas
      return {
        type: "cross_context_reference",
        priority: 0.75,
        context: {
          memory: recentMemory,
        },
        reason: "Conversación grupal reciente interesante",
      };
    }
  }

  return null;
}

/**
 * Trigger de experiencia compartida (clima/rutina)
 * NOTE: routine feature has been deprecated/removed
 */
async function checkSharedExperienceTrigger(_agentId: string): Promise<EnhancedTrigger | null> {
  // Feature deprecated - routine table no longer exists
  return null;

  /* DEPRECATED CODE - routine feature removed
  // Verificar si el agente tiene una rutina actual interesante
  const routine = await prisma.routine.findFirst({
    where: {
      agentId,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!routine) {
    return null;
  }

  // Parsear la rutina para encontrar actividades actuales
  const now = new Date();
  const currentHour = now.getHours();

  // This is simplified - in production use complete routine logic
  // Por ahora, solo verificar si hay algo interesante en la rutina
  const routineData = routine.schedule as any;

  // Si hay una actividad especial ahora, compartir experiencia
  if (routineData && routineData.specialActivities) {
    return {
      type: "shared_experience",
      priority: 0.65,
      context: {
        routineActivity: routineData.specialActivities[0],
      },
      reason: "Actividad especial en rutina actual",
    };
  }

  return null;
  */
}

/** Relationship milestone trigger */
async function checkRelationshipMilestoneTrigger(
  agentId: string,
  userId: string,
  relation: any
): Promise<EnhancedTrigger | null> {
  // Check if there was a significant change in the relationship recently
  const previousRelation = await prisma.relation.findFirst({
    where: {
      subjectId: agentId,
      targetId: userId,
      targetType: "user",
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!previousRelation) {
    return null;
  }

  // Calculate levels before and after
  const currentLevel = EmotionalEngine.getRelationshipLevel({
    trust: relation.trust,
    affinity: relation.affinity,
    respect: relation.respect,
    love: (relation.privateState as { love?: number }).love || 0,
    curiosity: (relation.privateState as { curiosity?: number }).curiosity || 0,
    valence: 0.5,
    arousal: 0.5,
    dominance: 0.5,
  });

  // If there is a recent milestone (last update in 24 hours)
  const hoursSinceUpdate =
    (Date.now() - relation.updatedAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceUpdate <= 24 && currentLevel !== "stranger") {
    return {
      type: "relationship_milestone",
      priority: 0.8,
      context: {
        currentLevel,
        trust: relation.trust,
        affinity: relation.affinity,
      },
      reason: `Relación evolucionó a ${currentLevel}`,
    };
  }

  return null;
}

/**
 * Verifica si es buen momento para enviar mensaje proactivo
 */
export async function isSuitableTimeForProactive(
  agentId: string,
  userId: string
): Promise<boolean> {
  // 1. Verify agent energy
  const energyState = await prisma.agentEnergyState.findUnique({
    where: { agentId },
  });

  if (energyState && energyState.current < 30) {
    return false; // Muy cansado para mensajes proactivos
  }

  // 2. Verificar disponibilidad
  const availability = await prisma.agentAvailability.findUnique({
    where: { agentId },
  });

  if (availability && !availability.available) {
    return false; // No disponible
  }

  // 3. Verificar horario silencioso
  const config = await prisma.proactiveConfig.findUnique({
    where: { agentId },
  });

  if (config?.quietHoursStart && config?.quietHoursEnd) {
    const now = new Date();
    const hour = now.getHours();

    const start = config.quietHoursStart;
    const end = config.quietHoursEnd;

    // Manejar quiet hours que cruzan medianoche
    if (start > end) {
      if (hour >= start || hour < end) {
        return false;
      }
    } else {
      if (hour >= start && hour < end) {
        return false;
      }
    }
  }

  return true;
}
