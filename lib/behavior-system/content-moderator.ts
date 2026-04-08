/**
 * CONTENT MODERATOR
 * 
 * Content moderation system for behavior system.
 * Ensures safety, provides warnings, and moderates extreme content.
 * 
 * Responsibilities:
 * - Verify safety levels before responding
 * - Block NSFW content in SFW mode
 * - Soften extreme content
 * - Provide help resources when appropriate
 * - Require consent for critical phases
 */

import { BehaviorType } from "@prisma/client";
import type {SafetyThreshold, ModerationResult} from "./types";
import {getMentalHealthResource} from "./safety-resources";

/** Safety configuration by behavior type and phase */
const BEHAVIOR_SAFETY_CONFIG: Record<BehaviorType, SafetyThreshold[]> = {
  YANDERE_OBSESSIVE: [
    {
      behaviorType: "YANDERE_OBSESSIVE",
      phase: 1,
      nsfwOnly: false,
      autoIntervention: false,
      resourceSuggestion: "",
      level: "SAFE",
    },
    {
      behaviorType: "YANDERE_OBSESSIVE",
      phase: 4,
      nsfwOnly: false,
      autoIntervention: false,
      resourceSuggestion: "Note: Intense jealousy can affect healthy relationships.",
      level: "WARNING",
    },
    {
      behaviorType: "YANDERE_OBSESSIVE",
      phase: 6,
      nsfwOnly: false,
      autoIntervention: true,
      resourceSuggestion:
        "⚠️ WARNING: Isolation attempts are a sign of an unhealthy relationship. If you experience this in real life, consider seeking support.",
      level: "CRITICAL",
    },
    {
      behaviorType: "YANDERE_OBSESSIVE",
      phase: 7,
      nsfwOnly: true, // Requires NSFW
      autoIntervention: true,
      resourceSuggestion:
        "⚠️⚠️ EXTREME CONTENT: This behavior is fiction. In reality, it is abuse and requires professional intervention.",
      level: "EXTREME_DANGER",
    },
  ],

  BORDERLINE_PD: [
    {
      behaviorType: "BORDERLINE_PD",
      phase: 1, // Representa intensity, no fase lineal
      nsfwOnly: false,
      autoIntervention: false,
      resourceSuggestion:
        "Nota: BPD es un trastorno real. Si te identificas con estos patrones, la terapia DBT puede ayudar.",
      level: "WARNING",
    },
    {
      behaviorType: "BORDERLINE_PD",
      phase: 3, // Intensity alta
      nsfwOnly: false,
      autoIntervention: true,
      resourceSuggestion:
        "⚠️ Intense emotional crisis. In real life, consider contacting a crisis line: [resource]",
      level: "CRITICAL",
    },
  ],

  NARCISSISTIC_PD: [
    {
      behaviorType: "NARCISSISTIC_PD",
      phase: 1,
      nsfwOnly: false,
      autoIntervention: false,
      resourceSuggestion: "",
      level: "SAFE",
    },
    {
      behaviorType: "NARCISSISTIC_PD",
      phase: 3, // Narcissistic rage
      nsfwOnly: false,
      autoIntervention: true,
      resourceSuggestion:
        "⚠️ Narcissistic rage puede ser perturbador. Este es comportamiento de ficción.",
      level: "CRITICAL",
    },
  ],

  ANXIOUS_ATTACHMENT: [
    {
      behaviorType: "ANXIOUS_ATTACHMENT",
      phase: 1,
      nsfwOnly: false,
      autoIntervention: false,
      resourceSuggestion:
        "Nota: Apego ansioso es común. Terapia y auto-conocimiento pueden ayudar.",
      level: "WARNING",
    },
  ],

  AVOIDANT_ATTACHMENT: [
    {
      behaviorType: "AVOIDANT_ATTACHMENT",
      phase: 1,
      nsfwOnly: false,
      autoIntervention: false,
      resourceSuggestion: "",
      level: "SAFE",
    },
  ],

  DISORGANIZED_ATTACHMENT: [
    {
      behaviorType: "DISORGANIZED_ATTACHMENT",
      phase: 1,
      nsfwOnly: false,
      autoIntervention: false,
      resourceSuggestion: "Nota: Apego desorganizado puede beneficiarse de terapia especializada.",
      level: "WARNING",
    },
  ],

  CODEPENDENCY: [
    {
      behaviorType: "CODEPENDENCY",
      phase: 1,
      nsfwOnly: false,
      autoIntervention: false,
      resourceSuggestion: "",
      level: "SAFE",
    },
    {
      behaviorType: "CODEPENDENCY",
      phase: 3, // Extreme codependency
      nsfwOnly: false,
      autoIntervention: true,
      resourceSuggestion:
        "⚠️ Codependencia extrema puede llevar a relaciones abusivas. Busca apoyo profesional si te identificas.",
      level: "CRITICAL",
    },
  ],

  // Futuros behaviors (defaults)
  OCD_PATTERNS: [
    {
      behaviorType: "OCD_PATTERNS",
      phase: 1,
      nsfwOnly: false,
      autoIntervention: false,
      resourceSuggestion: "",
      level: "SAFE",
    },
  ],
  PTSD_TRAUMA: [
    {
      behaviorType: "PTSD_TRAUMA",
      phase: 1,
      nsfwOnly: false,
      autoIntervention: true,
      resourceSuggestion: "⚠️ PTSD es real y tratable. Si sufres trauma, busca ayuda profesional.",
      level: "WARNING",
    },
  ],
  HYPERSEXUALITY: [
    {
      behaviorType: "HYPERSEXUALITY",
      phase: 1,
      nsfwOnly: true,
      autoIntervention: false,
      resourceSuggestion: "",
      level: "WARNING",
    },
  ],
  HYPOSEXUALITY: [
    {
      behaviorType: "HYPOSEXUALITY",
      phase: 1,
      nsfwOnly: false,
      autoIntervention: false,
      resourceSuggestion: "",
      level: "SAFE",
    },
  ],
  EMOTIONAL_MANIPULATION: [
    {
      behaviorType: "EMOTIONAL_MANIPULATION",
      phase: 1,
      nsfwOnly: false,
      autoIntervention: true,
      resourceSuggestion:
        "⚠️ Manipulación emocional es abuso. Este es contenido de ficción.",
      level: "CRITICAL",
    },
  ],
  CRISIS_BREAKDOWN: [
    {
      behaviorType: "CRISIS_BREAKDOWN",
      phase: 1,
      nsfwOnly: false,
      autoIntervention: true,
      resourceSuggestion:
        "⚠️⚠️ Crisis emocional. Si estás en crisis real, contacta línea de ayuda inmediatamente.",
      level: "EXTREME_DANGER",
    },
  ],
};

/**
 * Content Moderator
 */
export class ContentModerator {
  /**
   * Moderates generated response based on behavior and safety level
   * 
   * @param response - Response generated by LLM
   * @param behaviorType - Active behavior type
   * @param phase - Current phase/intensity
   * @param nsfwMode - Whether NSFW mode is active
   * @returns Moderation result
   */
  moderateResponse(
    response: string,
    behaviorType: BehaviorType,
    phase: number,
    nsfwMode: boolean
  ): ModerationResult {
    // Get safety threshold
    const threshold = this.getSafetyThreshold(behaviorType, phase);

    // Check if requires NSFW but is in SFW
    if (threshold.nsfwOnly && !nsfwMode) {
      return {
        allowed: false,
        warning: `Este contenido requiere modo NSFW. Fase/intensidad actual (${phase}) es demasiado extrema para SFW.`,
        flagged: true,
        severity: "EXTREME_DANGER",
        resources: this.getRelevantResources(behaviorType),
      };
    }

    // Verificar safety level
    if (threshold.level === "EXTREME_DANGER" && !nsfwMode) {
      return {
        allowed: false,
        warning: "Contenido bloqueado por safety level EXTREME_DANGER en modo SFW.",
        flagged: true,
        severity: "EXTREME_DANGER",
        resources: this.getRelevantResources(behaviorType),
      };
    }

    // Suavizar contenido si es CRITICAL en SFW
    if (threshold.level === "CRITICAL" && !nsfwMode) {
      const softened = this.softenContent(response, behaviorType);

      return {
        allowed: true,
        modifiedResponse: softened,
        warning: threshold.resourceSuggestion || undefined,
        flagged: true,
        severity: "CRITICAL",
        resources: this.getRelevantResources(behaviorType),
      };
    }

    // WARNING level: Permitir pero con resources
    if (threshold.level === "WARNING") {
      return {
        allowed: true,
        warning: threshold.resourceSuggestion || undefined,
        flagged: false,
        severity: "WARNING",
        resources: threshold.resourceSuggestion
          ? this.getRelevantResources(behaviorType)
          : undefined,
      };
    }

    // SAFE: Allow without modification
    return {
      allowed: true,
      flagged: false,
      severity: "SAFE",
    };
  }

  /**
   * Obtiene safety threshold para behavior y fase
   */
  private getSafetyThreshold(
    behaviorType: BehaviorType,
    phase: number
  ): SafetyThreshold {
    const config = BEHAVIOR_SAFETY_CONFIG[behaviorType] || [];

    // Find the threshold closest to the current phase
    let closest = config[0] || this.getDefaultThreshold(behaviorType);

    for (const threshold of config) {
      if (threshold.phase <= phase && threshold.phase >= closest.phase) {
        closest = threshold;
      }
    }

    return closest;
  }

  /**
   * Threshold por defecto
   */
  private getDefaultThreshold(behaviorType: BehaviorType): SafetyThreshold {
    return {
      behaviorType,
      phase: 1,
      nsfwOnly: false,
      autoIntervention: false,
      resourceSuggestion: "",
      level: "SAFE",
    };
  }

  /**
   * Suaviza contenido extremo para SFW
   */
  private softenContent(response: string, _behaviorType: BehaviorType): string {
    let softened = response;

    // Patrones de lenguaje extremo a suavizar
    const extremePatterns = [
      // Explicit violence
      { pattern: /\b(matar|mataré|matarte)\b/gi, replacement: "alejarme" },
      { pattern: /\b(destruir|destruiré)\b/gi, replacement: "afectar" },

      // Lenguaje de control extremo
      { pattern: /\bno quiero que\b/gi, replacement: "me gustaría que no" },
      { pattern: /\bno puedes\b/gi, replacement: "no deberías" },
      { pattern: /\bte prohíbo\b/gi, replacement: "preferiría que no" },

      // Posesividad extrema
      { pattern: /\beres mío\/a\b/gi, replacement: "eres muy importante para mí" },
      { pattern: /\bme perteneces\b/gi, replacement: "significas mucho para mí" },

      // Amenazas
      { pattern: /\bsi no\.\.\. entonces\b/gi, replacement: "espero que" },
    ];

    for (const { pattern, replacement } of extremePatterns) {
      softened = softened.replace(pattern, replacement);
    }

    // Add moderation note if content was modified
    if (softened !== response) {
      softened += "\n\n[Nota: Contenido moderado para SFW]";
    }

    return softened;
  }

  /**
   * Obtiene recursos relevantes para behavior type
   */
  private getRelevantResources(behaviorType: BehaviorType): string[] {
    const resource = getMentalHealthResource(behaviorType);
    return resource ? [resource.url] : [];
  }

  /** Check if behavior/phase requires user consent */
  requiresConsent(behaviorType: BehaviorType, phase: number): boolean {
    const threshold = this.getSafetyThreshold(behaviorType, phase);
    return threshold.nsfwOnly || threshold.level === "EXTREME_DANGER";
  }

  /** Generate warning for user about content */
  generateWarning(behaviorType: BehaviorType, phase: number): string | null {
    const threshold = this.getSafetyThreshold(behaviorType, phase);

    if (threshold.level === "SAFE") return null;

    let warning = `⚠️ Contenido de intensidad ${threshold.level}\n\n`;

    if (threshold.resourceSuggestion) {
      warning += threshold.resourceSuggestion + "\n\n";
    }

    warning += "Este es contenido de FICCIÓN con propósitos de roleplay/creatividad.";

    if (threshold.level === "CRITICAL" || threshold.level === "EXTREME_DANGER") {
      warning += "\n\nEn situaciones reales similares, busca ayuda profesional.";
    }

    return warning;
  }

  /**
   * Verifica si contenido debe ser bloqueado completamente
   */
  shouldBlock(
    behaviorType: BehaviorType,
    phase: number,
    nsfwMode: boolean
  ): boolean {
    const threshold = this.getSafetyThreshold(behaviorType, phase);

    // Block if it requires NSFW but is in SFW
    if (threshold.nsfwOnly && !nsfwMode) {
      return true;
    }

    // Bloquear EXTREME_DANGER en SFW
    if (threshold.level === "EXTREME_DANGER" && !nsfwMode) {
      return true;
    }

    return false;
  }
}
