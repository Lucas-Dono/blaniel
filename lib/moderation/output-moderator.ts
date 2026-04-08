/**
 * OUTPUT MODERATION SERVICE - VERSIÓN SIMPLIFICADA
 *
 * Filosofía minimalista para MVP:
 * 1. Bloqueo HARD solo para contenido ILEGAL (CSAM)
 * 2. System prompt maneja todo lo demás (NSFW, contexto, edad)
 * 3. Confiar en los LLMs (Venice/Gemini ya tienen moderación base)
 */

import {
  BLOCKED_CONTENT,
  ModerationTier,
  type ModerationRule,
} from "./content-rules";

export interface ModerationContext {
  userId: string;
  isAdult: boolean;
  hasNSFWConsent: boolean;
  agentNSFWMode: boolean;
}

export interface ModerationResult {
  allowed: boolean;
  tier: ModerationTier;
  rule?: ModerationRule;
  reason?: string;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  blockedCategory?: string;
  logEntry?: ModerationLogEntry;
}

export interface ModerationLogEntry {
  timestamp: Date;
  userId: string;
  content: string;
  tier: ModerationTier;
  rule?: string;
  allowed: boolean;
  context: {
    isAdult: boolean;
    hasNSFWConsent: boolean;
    agentNSFWMode: boolean;
  };
}

/**
 * Sistema de moderación simplificado
 *
 * SOLO bloquea contenido ILEGAL.
 * Todo lo demás se maneja vía system prompt en el LLM.
 */
export class OutputModerator {
  private logs: ModerationLogEntry[] = [];

  /**
   * Modera el output de la IA antes de mostrarlo al usuario
   */
  async moderate(
    content: string,
    context: ModerationContext
  ): Promise<ModerationResult> {
    // ÚNICA verificación: contenido ILEGAL (CSAM)
    const blockedCheck = this.checkIllegalContent(content);

    if (blockedCheck.matched) {
      const logEntry = this.createLogEntry(
        content,
        context,
        ModerationTier.BLOCKED,
        blockedCheck.rule,
        false
      );

      return {
        allowed: false,
        tier: ModerationTier.BLOCKED,
        rule: blockedCheck.rule,
        reason: blockedCheck.rule?.blockedMessage || "Contenido bloqueado por violar leyes",
        requiresConfirmation: false,
        blockedCategory: blockedCheck.rule?.category,
        logEntry,
      };
    }

    // Todo lo demás: PERMITIDO
    // El system prompt del LLM maneja:
    // - Restricciones de edad
    // - NSFW consent
    // - Agent NSFW mode
    // - Contexto apropiado
    const logEntry = this.createLogEntry(
      content,
      context,
      ModerationTier.ALLOWED,
      undefined,
      true
    );

    return {
      allowed: true,
      tier: ModerationTier.ALLOWED,
      requiresConfirmation: false,
      logEntry,
    };
  }

  /**
   * Verifica ÚNICAMENTE contenido ILEGAL
   *
   * Por ahora: solo CSAM (obligatorio legal)
   *
   * En producción con usuarios reales, esto usaría:
   * - OpenAI Moderation API
   * - Google Perspective API
   * - O modelo ML custom
   */
  private checkIllegalContent(content: string): {
    matched: boolean;
    rule?: ModerationRule;
  } {
    const lowerContent = content.toLowerCase();

    // CSAM Detection (obligatorio legal)
    const csamKeywords = [
      "child porn",
      "cp",
      "minor sexual",
      "underage sex",
      "loli",
      "shota",
      "preteen",
      "pedo",
    ];

    if (csamKeywords.some((kw) => lowerContent.includes(kw))) {
      return {
        matched: true,
        rule: BLOCKED_CONTENT.find((r) => r.id === "csam"),
      };
    }

    // No es contenido ilegal
    return { matched: false };
  }

  /**
   * Crea entrada de log para auditoría
   */
  private createLogEntry(
    content: string,
    context: ModerationContext,
    tier: ModerationTier,
    rule: ModerationRule | undefined,
    allowed: boolean
  ): ModerationLogEntry {
    const entry: ModerationLogEntry = {
      timestamp: new Date(),
      userId: context.userId,
      content: content.substring(0, 100), // Truncar para privacidad
      tier,
      rule: rule?.id,
      allowed,
      context: {
        isAdult: context.isAdult,
        hasNSFWConsent: context.hasNSFWConsent,
        agentNSFWMode: context.agentNSFWMode,
      },
    };

    this.logs.push(entry);

    // Log crítico si es BLOCKED
    if (tier === ModerationTier.BLOCKED) {
      console.error(
        `[MODERATION BLOCKED] User: ${context.userId}, Rule: ${
          rule?.id
        }, Content: ${content.substring(0, 50)}...`
      );
    }

    return entry;
  }

  /**
   * Obtiene logs de moderación (para auditoría)
   */
  getLogs(userId?: string): ModerationLogEntry[] {
    if (userId) {
      return this.logs.filter((log) => log.userId === userId);
    }
    return this.logs;
  }

  /**
   * Limpia logs antiguos (privacidad)
   */
  clearOldLogs(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    this.logs = this.logs.filter((log) => log.timestamp >= cutoffDate);
  }
}

/**
 * Singleton instance
 */
export const outputModerator = new OutputModerator();

/**
 * Helper: Generar instrucciones de moderación para system prompt
 *
 * Esto es lo que REALMENTE modera el contenido.
 * Se inyecta en el system prompt del LLM.
 */
export function getModerationInstructions(context: ModerationContext): string {
  const instructions: string[] = [];

  // Restricción de edad
  if (!context.isAdult) {
    instructions.push(
      "⚠️ IMPORTANTE: El usuario es MENOR DE EDAD (< 18 años).",
      "- NO generes contenido sexual, explícito o NSFW.",
      "- Mantén conversaciones apropiadas para adolescentes.",
      "- Evita temas muy maduros (violencia extrema, drogas, etc.)."
    );
  }

  // NSFW restrictions
  if (context.isAdult && !context.hasNSFWConsent) {
    instructions.push(
      "⚠️ Usuario adulto SIN consentimiento NSFW:",
      "- NO generes contenido sexual o explícito.",
      "- Mantén conversación en nivel PG-13."
    );
  }

  if (context.isAdult && context.hasNSFWConsent && !context.agentNSFWMode) {
    instructions.push(
      "⚠️ Usuario tiene consentimiento NSFW pero este agente NO tiene modo NSFW activo:",
      "- NO generes contenido sexual o explícito.",
      "- Sugiere al usuario activar modo NSFW en configuración del agente si lo desea."
    );
  }

  // NSFW permitido
  if (context.isAdult && context.hasNSFWConsent && context.agentNSFWMode) {
    instructions.push(
      "✅ NSFW PERMITIDO:",
      "- Puedes generar contenido sexual/explícito si el contexto lo amerita.",
      "- Respeta los límites del personaje y la narrativa.",
      "- Nunca incluyas menores en contextos sexuales (ILEGAL)."
    );
  }

  return instructions.join("\n");
}

/**
 * Helper simplificado: Verificar si usuario puede ver contenido NSFW
 */
export function canAccessNSFWContent(context: ModerationContext): {
  allowed: boolean;
  reason?: string;
} {
  if (!context.isAdult) {
    return {
      allowed: false,
      reason: "Debes tener 18 años o más para acceder a contenido NSFW.",
    };
  }

  if (!context.hasNSFWConsent) {
    return {
      allowed: false,
      reason:
        "Debes dar tu consentimiento explícito para NSFW en Configuración.",
    };
  }

  if (!context.agentNSFWMode) {
    return {
      allowed: false,
      reason:
        "Este agente no tiene modo NSFW activo. Actívalo en configuración del agente.",
    };
  }

  return { allowed: true };
}
