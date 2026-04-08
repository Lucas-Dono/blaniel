/**
 * World Access Middleware
 * Verifica si el usuario puede acceder a un mundo específico
 */

import { PLANS } from "@/lib/mercadopago/config";

export interface WorldAccessResult {
  allowed: boolean;
  reason?: string;
  requiresPlan?: string;
}

/**
 * Verifica si el usuario puede acceder a un mundo específico
 */
export function canAccessWorld(
  worldId: string,
  userPlan: string = "free"
): WorldAccessResult {
  const plan = PLANS[userPlan as keyof typeof PLANS] || PLANS.free;

  // Planes pagos tienen acceso a todos los mundos
  if (plan.limits.worldsAllowed.length === 0) {
    return {
      allowed: true,
    };
  }

  // Usuarios free solo pueden acceder a mundos específicos
  const allowedWorlds = plan.limits.worldsAllowed;

  if ((allowedWorlds as readonly string[]).includes(worldId)) {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    reason:
      "Este mundo requiere un plan de pago. Usuarios gratuitos solo pueden acceder a Academia Sakura. Actualiza a Starter o superior para desbloquear todos los mundos.",
    requiresPlan: "starter",
  };
}

/**
 * Verifica si el usuario puede crear un nuevo mundo
 */
export function canCreateWorld(
  currentWorldsCount: number,
  userPlan: string = "free"
): WorldAccessResult {
  const plan = PLANS[userPlan as keyof typeof PLANS] || PLANS.free;
  const limit = plan.limits.worlds;

  if (limit === -1) {
    return {
      allowed: true,
    };
  }

  if (currentWorldsCount < limit) {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    reason: `Has alcanzado el límite de mundos (${limit}). Actualiza tu plan para crear más mundos.`,
    requiresPlan: "starter",
  };
}

/**
 * Lista de mundos predefinidos accesibles gratuitamente
 */
export const FREE_WORLDS = ["academia-sakura"];

/**
 * Verifica si un mundo es gratuito
 */
export function isFreeWorld(worldId: string): boolean {
  return FREE_WORLDS.includes(worldId);
}
