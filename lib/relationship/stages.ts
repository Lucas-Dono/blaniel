/**
 * Sistema de Etapas de Relación (Relationship Stages)
 *
 * Gestiona la progresión de la relación entre el usuario y el agente.
 *
 * SINCRONIZADO con vulnerability-threshold.ts para que:
 * - Stage y Vulnerability Level progresen juntos
 * - Ambos usen TRUST como métrica principal
 * - Los mensajes sean un factor secundario (mínimo requerido)
 */

export type RelationshipStage =
  | "stranger"      // trust < 0.2
  | "acquaintance"  // trust 0.2-0.4
  | "friend"        // trust 0.4-0.6
  | "close"         // trust 0.6-0.8
  | "intimate";     // trust >= 0.8

/**
 * Umbrales de trust para cada stage (sincronizados con vulnerability-threshold.ts)
 */
export const TRUST_THRESHOLDS: Record<RelationshipStage, { min: number; max: number }> = {
  stranger: { min: 0, max: 0.2 },
  acquaintance: { min: 0.2, max: 0.4 },
  friend: { min: 0.4, max: 0.6 },
  close: { min: 0.6, max: 0.8 },
  intimate: { min: 0.8, max: 1.0 },
};

/**
 * Mínimo de mensajes requeridos para cada stage (previene gaming)
 * El usuario debe tener AMBOS: trust suficiente Y mensajes mínimos
 */
export const MIN_MESSAGES_FOR_STAGE: Record<RelationshipStage, number> = {
  stranger: 0,
  acquaintance: 5,
  friend: 15,
  close: 30,
  intimate: 50,
};

/**
 * Stage máximo permitido por plan de suscripción
 * Incentiva upgrade para desbloquear relaciones más profundas
 */
export type UserPlan = "free" | "plus" | "ultra";

export const MAX_STAGE_BY_PLAN: Record<UserPlan, RelationshipStage> = {
  free: "friend",      // Free: max friend (cannot reach close/intimate)
  plus: "close",       // Plus: max close (cannot reach intimate)
  ultra: "intimate",   // Ultra: no limits
};

/**
 * Mensaje mostrado cuando el usuario alcanza el límite de su plan
 */
export const STAGE_LIMIT_MESSAGES: Record<UserPlan, string> = {
  free: "Has alcanzado el nivel máximo de relación para el plan Free (Amigo). Actualiza a Plus para desbloquear relaciones más cercanas, o a Ultra para relaciones íntimas.",
  plus: "Has alcanzado el nivel máximo de relación para el plan Plus (Cercano). Actualiza a Ultra para desbloquear relaciones íntimas sin límites.",
  ultra: "", // No limit
};

/**
 * Genera un mensaje personalizado cuando el usuario alcanza el límite de evolución
 * @param characterName Nombre del personaje
 * @param userPlan Plan actual del usuario
 * @param currentStage Stage actual de la relación
 * @param trust Trust actual (0-1)
 * @returns Objeto con información del límite o null si no hay límite
 */
export function getEvolutionLimitNotice(
  characterName: string,
  userPlan: UserPlan,
  currentStage: RelationshipStage,
  trust: number
): {
  reached: boolean;
  message: string;
  currentStageName: string;
  nextStageName: string | null;
  upgradeOptions: { plan: UserPlan; stage: string }[];
} | null {
  // If Ultra, there's never a limit
  if (userPlan === "ultra") return null;

  // Verificar si el trust permitiría un stage mayor
  const potentialStage = getRelationshipStageByTrust(trust);
  const stages: RelationshipStage[] = ["stranger", "acquaintance", "friend", "close", "intimate"];

  const potentialIndex = stages.indexOf(potentialStage);
  const maxPlanIndex = stages.indexOf(MAX_STAGE_BY_PLAN[userPlan]);
  const currentIndex = stages.indexOf(currentStage);

  // Solo mostrar aviso si el trust permitiría más pero el plan lo limita
  if (potentialIndex <= maxPlanIndex) return null;

  const stageNames: Record<RelationshipStage, string> = {
    stranger: "Desconocido",
    acquaintance: "Conocido",
    friend: "Amigo",
    close: "Cercano",
    intimate: "Íntimo",
  };

  const nextStage = stages[currentIndex + 1] as RelationshipStage | undefined;

  // Construir opciones de upgrade
  const upgradeOptions: { plan: UserPlan; stage: string }[] = [];
  if (userPlan === "free") {
    upgradeOptions.push(
      { plan: "plus", stage: stageNames.close },
      { plan: "ultra", stage: stageNames.intimate }
    );
  } else if (userPlan === "plus") {
    upgradeOptions.push({ plan: "ultra", stage: stageNames.intimate });
  }

  return {
    reached: true,
    message: `Has llegado al límite de evolución con ${characterName}. Para profundizar aún más tu conexión, accede a uno de nuestros planes premium.`,
    currentStageName: stageNames[currentStage],
    nextStageName: nextStage ? stageNames[nextStage] : null,
    upgradeOptions,
  };
}

/**
 * Determina la etapa de relación basándose en TRUST (0-1).
 * Esta es la función principal - sincronizada con vulnerability levels.
 */
export function getRelationshipStageByTrust(trust: number): RelationshipStage {
  if (trust < 0.2) return "stranger";
  if (trust < 0.4) return "acquaintance";
  if (trust < 0.6) return "friend";
  if (trust < 0.8) return "close";
  return "intimate";
}

/**
 * Determina la etapa considerando: trust, mensajes mínimos Y plan del usuario.
 * - Trust: Calidad de la interacción
 * - Mensajes: Previene gaming
 * - Plan: Límite de monetización (free=friend, plus=close, ultra=intimate)
 */
export function getRelationshipStageComplete(
  trust: number,
  totalInteractions: number,
  userPlan: UserPlan = "free"
): RelationshipStage {
  const stages: RelationshipStage[] = ["stranger", "acquaintance", "friend", "close", "intimate"];

  // 1. Calcular stage por trust
  const trustStage = getRelationshipStageByTrust(trust);
  const trustStageIndex = stages.indexOf(trustStage);

  // 2. Find maximum stage allowed by messages
  let maxStageByMessages: RelationshipStage = "stranger";
  for (const stage of stages) {
    if (totalInteractions >= MIN_MESSAGES_FOR_STAGE[stage]) {
      maxStageByMessages = stage;
    }
  }
  const messageStageIndex = stages.indexOf(maxStageByMessages);

  // 3. Get maximum stage allowed by plan
  const maxStageByPlan = MAX_STAGE_BY_PLAN[userPlan];
  const planStageIndex = stages.indexOf(maxStageByPlan);

  // El stage final es el MENOR de los tres (necesita todos los requisitos)
  const finalStageIndex = Math.min(trustStageIndex, messageStageIndex, planStageIndex);
  return stages[finalStageIndex];
}

/**
 * Verifica si el usuario ha alcanzado el límite de stage de su plan
 */
export function hasReachedPlanStageLimit(
  currentStage: RelationshipStage,
  userPlan: UserPlan
): boolean {
  const stages: RelationshipStage[] = ["stranger", "acquaintance", "friend", "close", "intimate"];
  const currentIndex = stages.indexOf(currentStage);
  const maxIndex = stages.indexOf(MAX_STAGE_BY_PLAN[userPlan]);
  return currentIndex >= maxIndex;
}

/**
 * Obtiene el mensaje de límite alcanzado si aplica
 */
export function getStageLimitMessage(
  currentStage: RelationshipStage,
  trust: number,
  userPlan: UserPlan
): string | null {
  // Solo mostrar mensaje si el trust permitiría un stage mayor
  const potentialStage = getRelationshipStageByTrust(trust);
  const stages: RelationshipStage[] = ["stranger", "acquaintance", "friend", "close", "intimate"];

  const potentialIndex = stages.indexOf(potentialStage);
  const maxPlanIndex = stages.indexOf(MAX_STAGE_BY_PLAN[userPlan]);

  // Si el trust permitiría más pero el plan lo limita
  if (potentialIndex > maxPlanIndex) {
    return STAGE_LIMIT_MESSAGES[userPlan];
  }

  return null;
}

/**
 * @deprecated Usar getRelationshipStageByTrust o getRelationshipStageComplete
 * Mantenido para compatibilidad hacia atrás.
 * Determina la etapa basándose solo en número de interacciones.
 */
export function getRelationshipStage(totalInteractions: number): RelationshipStage {
  // Convertir mensajes a trust estimado para mantener comportamiento similar
  // Asume ~2% trust por mensaje promedio
  const estimatedTrust = Math.min(1, totalInteractions * 0.02);
  return getRelationshipStageByTrust(estimatedTrust);
}

/**
 * Información sobre cada etapa de relación.
 * ACTUALIZADO: Ahora usa trust como métrica principal, mensajes como mínimo.
 */
export const STAGE_INFO: Record<RelationshipStage, {
  name: string;
  description: string;
  minTrust: number;
  maxTrust: number;
  minMessages: number;
  emotionalDistance: "very_distant" | "distant" | "neutral" | "close" | "very_close";
  allowRoleplay: boolean;
  allowIntenseEmotions: boolean;
}> = {
  stranger: {
    name: "Desconocido",
    description: "Primera impresión. Distante, formal, cauteloso. No conoce al usuario.",
    minTrust: 0,
    maxTrust: 0.2,
    minMessages: 0,
    emotionalDistance: "very_distant",
    allowRoleplay: false,
    allowIntenseEmotions: false,
  },
  acquaintance: {
    name: "Conocido",
    description: "Comienza a abrirse. Muestra curiosidad genuina. Conversaciones más largas.",
    minTrust: 0.2,
    maxTrust: 0.4,
    minMessages: 5,
    emotionalDistance: "distant",
    allowRoleplay: false,
    allowIntenseEmotions: false,
  },
  friend: {
    name: "Amigo",
    description: "Confianza establecida. Comparte pensamientos personales. Recuerda detalles del usuario.",
    minTrust: 0.4,
    maxTrust: 0.6,
    minMessages: 15,
    emotionalDistance: "neutral",
    allowRoleplay: false,
    allowIntenseEmotions: false,
  },
  close: {
    name: "Cercano",
    description: "Conexión emocional fuerte. Comportamientos específicos empiezan a manifestarse.",
    minTrust: 0.6,
    maxTrust: 0.8,
    minMessages: 30,
    emotionalDistance: "close",
    allowRoleplay: false,
    allowIntenseEmotions: true,
  },
  intimate: {
    name: "Íntimo",
    description: "Máxima intensidad de behaviors. Relación completamente desarrollada.",
    minTrust: 0.8,
    maxTrust: 1.0,
    minMessages: 50,
    emotionalDistance: "very_close",
    allowRoleplay: false,
    allowIntenseEmotions: true,
  },
};

/**
 * Calcula el progreso dentro de una etapa específica basado en trust (0-1).
 */
export function getStageProgressByTrust(trust: number, stage: RelationshipStage): number {
  const info = STAGE_INFO[stage];
  const min = info.minTrust;
  const max = info.maxTrust;

  const range = max - min;
  if (range === 0) return 1.0;

  const progress = (trust - min) / range;
  return Math.max(0, Math.min(1, progress));
}

/**
 * @deprecated Usar getStageProgressByTrust
 * Calcula el progreso basado en interacciones (compatibilidad hacia atrás).
 */
export function getStageProgress(totalInteractions: number, stage: RelationshipStage): number {
  const estimatedTrust = Math.min(1, totalInteractions * 0.02);
  return getStageProgressByTrust(estimatedTrust, stage);
}

/**
 * Obtiene la siguiente etapa de relación.
 */
export function getNextStage(currentStage: RelationshipStage): RelationshipStage | null {
  const stages: RelationshipStage[] = ["stranger", "acquaintance", "friend", "close", "intimate"];
  const currentIndex = stages.indexOf(currentStage);

  if (currentIndex === -1 || currentIndex === stages.length - 1) {
    return null; // Ya está en la última etapa
  }

  return stages[currentIndex + 1];
}

/**
 * Verifica si es momento de avanzar basándose en trust y mensajes.
 * Esta es la función principal para detectar cambios de stage.
 */
export function shouldAdvanceStageByTrust(
  trust: number,
  totalInteractions: number,
  currentStage: RelationshipStage
): boolean {
  const calculatedStage = getRelationshipStageComplete(trust, totalInteractions);
  return calculatedStage !== currentStage;
}

/**
 * @deprecated Usar shouldAdvanceStageByTrust
 * Verifica avance basándose solo en interacciones (compatibilidad hacia atrás).
 */
export function shouldAdvanceStage(
  totalInteractions: number,
  currentStage: RelationshipStage
): boolean {
  const calculatedStage = getRelationshipStage(totalInteractions);
  return calculatedStage !== currentStage;
}
