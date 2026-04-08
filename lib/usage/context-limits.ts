/**
 * Context Limits by User Tier
 *
 * Sistema dinámico que ajusta el límite de mensajes de contexto
 * según el tier del usuario, permitiendo conversaciones más largas
 * y coherentes para usuarios premium.
 *
 * TIERS:
 * - Free: 10 mensajes de contexto
 * - Plus: 30 mensajes de contexto
 * - Ultra: 100 mensajes de contexto
 *
 * @module context-limits
 */

import type { PlanId } from "@/lib/mercadopago/config";

/**
 * Mapeo de tiers a límites de contexto
 */
const CONTEXT_LIMITS: Record<PlanId, number> = {
  free: 10,   // Free: 10 messages (basic)
  plus: 30,   // Plus: 30 messages (3x more context)
  ultra: 100, // Ultra: 100 messages (10x more context, very long conversations)
};

/**
 * Límite por defecto si no se especifica tier o es inválido
 */
const DEFAULT_CONTEXT_LIMIT = 10;

/**
 * Obtiene el límite de mensajes de contexto según el tier del usuario
 *
 * @param userPlan - Plan del usuario ('free' | 'plus' | 'ultra')
 * @returns Número de mensajes que se incluyen en el contexto
 *
 * @example
 * ```typescript
 * const limit = getContextLimit('plus');
 * console.log(limit); // 30
 *
 * const messages = await prisma.message.findMany({
 *   where: { agentId },
 *   orderBy: { createdAt: 'desc' },
 *   take: limit,
 * });
 * ```
 */
export function getContextLimit(userPlan: string = 'free'): number {
  const planId = userPlan.toLowerCase() as PlanId;

  // Validate que el plan exista, sino usar default
  if (planId in CONTEXT_LIMITS) {
    return CONTEXT_LIMITS[planId];
  }

  return DEFAULT_CONTEXT_LIMIT;
}

/**
 * Obtiene todos los límites de contexto disponibles
 * Útil para mostrar en UI o documentación
 *
 * @returns Objeto con todos los límites por tier
 *
 * @example
 * ```typescript
 * const limits = getAllContextLimits();
 * // { free: 10, plus: 30, ultra: 100 }
 * ```
 */
export function getAllContextLimits(): Record<PlanId, number> {
  return { ...CONTEXT_LIMITS };
}

/**
 * Calcula cuántos mensajes más obtiene el usuario comparado con free tier
 *
 * @param userPlan - Plan del usuario
 * @returns Multiplicador de contexto (ej: 3x, 10x)
 *
 * @example
 * ```typescript
 * const multiplier = getContextMultiplier('plus');
 * console.log(multiplier); // 3
 * ```
 */
export function getContextMultiplier(userPlan: string = 'free'): number {
  const limit = getContextLimit(userPlan);
  const freeLimit = CONTEXT_LIMITS.free;

  return Math.round(limit / freeLimit);
}

/**
 * Verifica si un plan tiene contexto extendido
 * (más que el tier free)
 *
 * @param userPlan - Plan del usuario
 * @returns true si tiene más contexto que free tier
 */
export function hasExtendedContext(userPlan: string = 'free'): boolean {
  const limit = getContextLimit(userPlan);
  return limit > CONTEXT_LIMITS.free;
}
