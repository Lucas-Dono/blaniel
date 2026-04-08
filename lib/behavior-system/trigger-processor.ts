/**
 * TRIGGER PROCESSOR - BEHAVIOR PROGRESSION SYSTEM
 *
 * Processing pipeline for detected triggers.
 * Updates BehaviorProfiles, calculates impact on intensity, logs to DB.
 *
 * FLOW:
 * 1. Receive detected triggers
 * 2. Calculate impact by behavior type
 * 3. Update baseIntensity in BehaviorProfile
 * 4. Create BehaviorTriggerLog entries
 * 5. Increment interactionsSincePhaseStart
 *
 * @module trigger-processor
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { BehaviorType } from "@prisma/client";
import type { TriggerDetectionResult, BehaviorProfile } from "./types";

/**
 * PROCESS DETECTED TRIGGERS
 *
 * Main function that processes all triggers and updates BehaviorProfiles.
 *
 * @param triggers - Array of triggers detected by TriggerDetector
 * @param behaviorProfiles - Active profiles of the agent
 * @param messageId - ID of message that generated triggers
 * @param agentId - Agent ID
 */
export async function processTriggers(
  triggers: TriggerDetectionResult[],
  behaviorProfiles: BehaviorProfile[],
  messageId: string,
  agentId: string
): Promise<void> {
  if (triggers.length === 0) return;

  try {
    // 1. Log all triggers to DB
    await logTriggers(triggers, messageId);

    // 2. Process each behavior profile
    for (const profile of behaviorProfiles) {
      // Calculate total impact for this behavior
      const impact = calculateTriggerImpact(triggers, profile.behaviorType);

      if (impact === 0) continue; // No relevant triggers

      // Calculate new intensity
      const newIntensity = calculateNewIntensity(
        profile.baseIntensity,
        impact,
        profile.escalationRate,
        profile.deEscalationRate
      );

      // Update profile in DB
      await prisma.behaviorProfile.update({
        where: { id: profile.id },
        data: {
          baseIntensity: newIntensity,
          interactionsSincePhaseStart: {
            increment: 1, // Each message counts as an interaction
          },
          updatedAt: new Date(),
        },
      });

      console.log(
        `[TriggerProcessor] Updated ${profile.behaviorType}: ${profile.baseIntensity.toFixed(3)} → ${newIntensity.toFixed(3)} (impact: ${impact >= 0 ? "+" : ""}${impact.toFixed(3)})`
      );
    }

    // 3. Update global progression state
    await updateProgressionState(agentId, triggers);
  } catch (error) {
    console.error("[TriggerProcessor] Error processing triggers:", error);
    throw error;
  }
}

/**
 * CALCULATE TRIGGER IMPACT ON INTENSITY
 *
 * Sum the weights of all triggers that affect a specific behavior type.
 * Positive triggers (reassurance) reduce intensity (negative weight).
 *
 * @param triggers - Detected triggers
 * @param behaviorType - Behavior type to evaluate
 * @returns Total impact (can be negative)
 */
export function calculateTriggerImpact(
  triggers: TriggerDetectionResult[],
  behaviorType: BehaviorType
): number {
  let totalImpact = 0;

  for (const trigger of triggers) {
    // Verificar si este trigger afecta al behavior type
    if (trigger.behaviorTypes.includes(behaviorType)) {
      // Aplicar weight × confidence
      const impact = trigger.weight * trigger.confidence;
      totalImpact += impact;
    }
  }

  return totalImpact;
}

/**
 * CALCULAR NUEVA INTENSIDAD
 *
 * Aplica el impacto de triggers a la intensidad base usando escalation/de-escalation rates.
 *
 * Formula:
 * - Si impact > 0: newIntensity = baseIntensity + (impact × escalationRate)
 * - Si impact < 0: newIntensity = baseIntensity + (impact × deEscalationRate)
 *
 * @param baseIntensity - Intensidad actual (0-1)
 * @param impact - Impacto calculado (puede ser negativo)
 * @param escalationRate - Tasa de escalación (típicamente 0.1)
 * @param deEscalationRate - Tasa de de-escalación (típicamente 0.05)
 * @returns Nueva intensidad clamped entre 0-1
 */
export function calculateNewIntensity(
  baseIntensity: number,
  impact: number,
  escalationRate: number,
  deEscalationRate: number
): number {
  let newIntensity = baseIntensity;

  if (impact > 0) {
    // Escalation (negative triggers)
    newIntensity += impact * escalationRate;
  } else if (impact < 0) {
    // De-escalation (positive triggers like reassurance)
    newIntensity += impact * deEscalationRate; // impact ya es negativo
  }

  // Clamp entre 0-1
  return Math.min(1.0, Math.max(0.0, newIntensity));
}

/**
 * LOGUEAR TRIGGERS EN DATABASE
 *
 * Crea entries en BehaviorTriggerLog para analytics y debugging.
 *
 * @param triggers - Triggers detectados
 * @param messageId - ID del mensaje que generó los triggers
 */
export async function logTriggers(
  triggers: TriggerDetectionResult[],
  messageId: string
): Promise<void> {
  if (triggers.length === 0) return;

  try {
    // Create un log entry por cada behavior type afectado por cada trigger
    const logEntries = triggers.flatMap((trigger) =>
      trigger.behaviorTypes.map((behaviorType) => ({
        id: nanoid(),
        updatedAt: new Date(),
        messageId: messageId,
        behaviorType: behaviorType,
        triggerType: trigger.triggerType,
        weight: trigger.weight * trigger.confidence, // Weight ajustado por confidence
        detectedText: trigger.detectedIn.substring(0, 500), // Limitar a 500 chars
      }))
    );

    // Bulk create
    await prisma.behaviorTriggerLog.createMany({
      data: logEntries,
      skipDuplicates: true,
    });

    console.log(`[TriggerProcessor] Logged ${logEntries.length} trigger entries`);
  } catch (error) {
    console.error("[TriggerProcessor] Error logging triggers:", error);
    // No throw - logging no debe bloquear el flujo principal
  }
}

/**
 * ACTUALIZAR PROGRESSION STATE GLOBAL
 *
 * Actualiza el estado de progresión global del agente con contadores de interacciones.
 *
 * @param agentId - ID del agente
 * @param triggers - Triggers detectados (para clasificar como positiva/negativa)
 */
async function updateProgressionState(
  agentId: string,
  triggers: TriggerDetectionResult[]
): Promise<void> {
  try {
    // Classify interaction as positive/negative/neutral
    const hasNegativeTrigger = triggers.some((t) => t.weight > 0);
    const hasPositiveTrigger = triggers.some((t) => t.weight < 0);

    const updateData: any = {
      totalInteractions: { increment: 1 },
      lastCalculatedAt: new Date(),
    };

    if (hasPositiveTrigger && !hasNegativeTrigger) {
      updateData.positiveInteractions = { increment: 1 };
    } else if (hasNegativeTrigger && !hasPositiveTrigger) {
      updateData.negativeInteractions = { increment: 1 };
    }

    // Upsert (crear si no existe, actualizar si existe)
    await prisma.behaviorProgressionState.upsert({
      where: { agentId: agentId },
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        agentId: agentId,
        totalInteractions: 1,
        positiveInteractions: hasPositiveTrigger && !hasNegativeTrigger ? 1 : 0,
        negativeInteractions: hasNegativeTrigger && !hasPositiveTrigger ? 1 : 0,
        currentIntensities: {},
        lastCalculatedAt: new Date(),
      },
      update: updateData,
    });
  } catch (error) {
    console.error("[TriggerProcessor] Error updating progression state:", error);
    // No throw - no bloquear flujo principal
  }
}

/**
 * OBTENER TRIGGERS RECIENTES
 *
 * Utility function para obtener triggers recientes de un agente (para analytics).
 *
 * @param agentId - ID del agente
 * @param limit - Número máximo de triggers a retornar
 * @returns Array de trigger logs
 */
export async function getRecentTriggers(agentId: string, limit: number = 50) {
  try {
    const triggers = await prisma.behaviorTriggerLog.findMany({
      where: {
        Message: {
          agentId: agentId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      include: {
        Message: {
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    return triggers;
  } catch (error) {
    console.error("[TriggerProcessor] Error fetching recent triggers:", error);
    return [];
  }
}

/**
 * OBTENER CONTEO DE TRIGGERS POR TIPO
 *
 * Analytics: Conteo de triggers detectados agrupados por tipo.
 *
 * @param agentId - ID del agente
 * @param since - Fecha desde la cual contar (opcional)
 * @returns Object con conteos por trigger type
 */
export async function getTriggerCountsByType(
  agentId: string,
  since?: Date
): Promise<Record<string, number>> {
  try {
    const whereClause: any = {
      message: {
        agentId: agentId,
      },
    };

    if (since) {
      whereClause.createdAt = {
        gte: since,
      };
    }

    const triggers = await prisma.behaviorTriggerLog.findMany({
      where: whereClause,
      select: {
        triggerType: true,
      },
    });

    // Agrupar por tipo
    const counts: Record<string, number> = {};
    for (const trigger of triggers) {
      counts[trigger.triggerType] = (counts[trigger.triggerType] || 0) + 1;
    }

    return counts;
  } catch (error) {
    console.error("[TriggerProcessor] Error fetching trigger counts:", error);
    return {};
  }
}

/**
 * APLICAR DECAY TEMPORAL
 *
 * Reduce gradualmente la intensidad de behaviors si no hay triggers recientes.
 * Se debe llamar periódicamente (ej: cada mensaje o cada 24 horas).
 *
 * @param profile - BehaviorProfile a evaluar
 * @param hoursSinceLastTrigger - Horas desde el último trigger relevante
 * @returns Nueva intensidad con decay aplicado
 */
export function applyDecay(
  profile: BehaviorProfile,
  hoursSinceLastTrigger: number
): number {
  // Only apply decay after 24 hours without triggers
  if (hoursSinceLastTrigger < 24) {
    return profile.baseIntensity;
  }

  // Decay factor: Max 50% reduction in 1 week (168 hours)
  const decayFactor = Math.min(hoursSinceLastTrigger / 168, 0.5);

  // Aplicar decay usando deEscalationRate
  const decayAmount = decayFactor * profile.deEscalationRate;
  const newIntensity = profile.baseIntensity * (1 - decayAmount);

  // Clamp entre 0-1
  return Math.min(1.0, Math.max(0.0, newIntensity));
}

/**
 * BATCH PROCESS TRIGGERS
 *
 * Procesar múltiples mensajes a la vez (útil para migraciones o reprocesamiento).
 *
 * @param agentId - ID del agente
 * @param messageIds - IDs de mensajes a procesar
 */
export async function batchProcessTriggers(
  agentId: string,
  messageIds: string[]
): Promise<void> {
  console.log(
    `[TriggerProcessor] Batch processing ${messageIds.length} messages for agent ${agentId}`
  );

  // TODO: Implementar cuando sea necesario para migraciones
  // Por ahora, solo placeholder
}
