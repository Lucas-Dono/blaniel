/**
 * NSFW Content Middleware
 * Verifica si el usuario tiene acceso a contenido NSFW
 */

import { PLANS } from "@/lib/mercadopago/config";

export interface NSFWCheckResult {
  allowed: boolean;
  reason?: string;
  requiresPlan?: string; // Plan mínimo requerido
}

/**
 * Verifica si el usuario puede acceder a contenido NSFW
 * IMPORTANTE: Verifica EDAD primero (compliance), luego plan
 */
export function canAccessNSFW(
  userPlan: string = "free",
  isAdult: boolean = false
): NSFWCheckResult {
  // PRIORITY 1: Age verification (COMPLIANCE)
  // Usuarios menores de 18 NO pueden acceder a NSFW, incluso con plan de pago
  if (!isAdult) {
    return {
      allowed: false,
      reason:
        "El contenido NSFW está restringido a mayores de 18 años. Debes tener 18 años o más para acceder a este contenido.",
      requiresPlan: undefined, // No es tema de plan, es tema de edad
    };
  }

  // PRIORITY 2: Plan verification
  const plan = PLANS[userPlan as keyof typeof PLANS] || PLANS.free;

  if (plan.limits.nsfwMode) {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    reason:
      "El contenido NSFW requiere un plan de pago. Actualiza a Plus o Ultra para desbloquear contenido sin restricciones.",
    requiresPlan: "plus",
  };
}

/**
 * Verifica si el usuario puede usar comportamientos avanzados (Yandere, BPD, NPD, etc.)
 * IMPORTANTE: Algunos comportamientos requieren ser adulto (18+)
 */
export function canUseAdvancedBehaviors(
  userPlan: string = "free",
  isAdult: boolean = false,
  behaviorType?: string
): NSFWCheckResult {
  // Comportamientos que requieren ser adulto (18+) por contenido maduro
  const adultOnlyBehaviors = ["YANDERE_OBSESSIVE", "HYPERSEXUALITY"];

  // PRIORITY 1: Age verification para comportamientos sensibles
  if (
    behaviorType &&
    adultOnlyBehaviors.includes(behaviorType) &&
    !isAdult
  ) {
    return {
      allowed: false,
      reason:
        "Este comportamiento está restringido a mayores de 18 años debido a su contenido psicológicamente intenso.",
      requiresPlan: undefined,
    };
  }

  // PRIORITY 2: Plan verification
  const plan = PLANS[userPlan as keyof typeof PLANS] || PLANS.free;

  if (plan.limits.advancedBehaviors) {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    reason:
      "Los comportamientos psicológicos avanzados (Yandere, BPD, NPD, etc.) requieren un plan de pago. Actualiza a Plus o Ultra.",
    requiresPlan: "plus",
  };
}

/**
 * Detecta si un mensaje contiene contenido NSFW
 * (Esto es una implementación básica, puedes mejorarla con NLP)
 */
export function detectNSFWContent(text: string): boolean {
  const nsfwKeywords = [
    // Basic keywords (expand as needed)
    "nsfw",
    "explícito",
    "sexual",
    "desnudo",
    "erótico",
    // Add more according to your moderation model
  ];

  const lowerText = text.toLowerCase();
  return nsfwKeywords.some((keyword) => lowerText.includes(keyword));
}

/**
 * Sanitiza el mensaje si el usuario no tiene acceso a NSFW
 */
export function sanitizeNSFWContent(
  text: string,
  userPlan: string = "free",
  isAdult: boolean = false
): {
  sanitized: string;
  wasBlocked: boolean;
  reason?: string;
} {
  const check = canAccessNSFW(userPlan, isAdult);

  if (check.allowed) {
    return {
      sanitized: text,
      wasBlocked: false,
    };
  }

  // Si el contenido es NSFW y el usuario no tiene acceso, bloquearlo
  if (detectNSFWContent(text)) {
    return {
      sanitized: "",
      wasBlocked: true,
      reason: check.reason,
    };
  }

  return {
    sanitized: text,
    wasBlocked: false,
  };
}
