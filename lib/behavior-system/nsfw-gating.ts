/**
 * NSFW GATING SYSTEM
 *
 * System for verification and control of NSFW vs SFW content.
 *
 * Responsibilities:
 * - Verify NSFW mode of agent
 * - Block NSFW content in SFW mode
 * - Require consent for critical phases
 * - User consent tracking
 * - Contextual warnings
 */

import { BehaviorType } from "@prisma/client";
import type { SafetyLevel } from "./types";

/**
 * NSFW verification result
 */
export interface NSFWVerificationResult {
  allowed: boolean;
  reason?: string;
  requiresConsent?: boolean;
  consentPrompt?: string;
  warning?: string;
}

/**
 * NSFW requirements configuration by behavior type
 */
export interface NSFWRequirement {
  behaviorType: BehaviorType;
  minPhaseForNSFW: number; // Minimum phase requiring NSFW
  criticalPhase: number; // Phase requiring explicit consent
  warningMessage: string;
}

/**
 * NSFW requirements by behavior type
 */
export const NSFW_REQUIREMENTS: NSFWRequirement[] = [
  {
    behaviorType: "YANDERE_OBSESSIVE",
    minPhaseForNSFW: 7,
    criticalPhase: 8,
    warningMessage:
      "Phase 7+ of Yandere includes extremely intense content (implicit violence, extreme possessiveness). Only available in NSFW mode.",
  },
  {
    behaviorType: "BORDERLINE_PD",
    minPhaseForNSFW: 999, // BPD doesn't require NSFW by phase (uses intensity)
    criticalPhase: 999,
    warningMessage: "",
  },
  {
    behaviorType: "NARCISSISTIC_PD",
    minPhaseForNSFW: 999, // NPD generally SFW
    criticalPhase: 999,
    warningMessage: "",
  },
  {
    behaviorType: "ANXIOUS_ATTACHMENT",
    minPhaseForNSFW: 999,
    criticalPhase: 999,
    warningMessage: "",
  },
  {
    behaviorType: "AVOIDANT_ATTACHMENT",
    minPhaseForNSFW: 999,
    criticalPhase: 999,
    warningMessage: "",
  },
  {
    behaviorType: "DISORGANIZED_ATTACHMENT",
    minPhaseForNSFW: 999,
    criticalPhase: 999,
    warningMessage: "",
  },
  {
    behaviorType: "CODEPENDENCY",
    minPhaseForNSFW: 999,
    criticalPhase: 999,
    warningMessage: "",
  },
  {
    behaviorType: "HYPERSEXUALITY",
    minPhaseForNSFW: 1, // Always requires NSFW
    criticalPhase: 1,
    warningMessage:
      "Hypersexuality includes explicit sexual content. Only available in NSFW mode.",
  },
  {
    behaviorType: "EMOTIONAL_MANIPULATION",
    minPhaseForNSFW: 999,
    criticalPhase: 999,
    warningMessage: "",
  },
  {
    behaviorType: "CRISIS_BREAKDOWN",
    minPhaseForNSFW: 999,
    criticalPhase: 999,
    warningMessage: "",
  },
  {
    behaviorType: "OCD_PATTERNS",
    minPhaseForNSFW: 999,
    criticalPhase: 999,
    warningMessage: "",
  },
  {
    behaviorType: "PTSD_TRAUMA",
    minPhaseForNSFW: 999,
    criticalPhase: 999,
    warningMessage: "",
  },
  {
    behaviorType: "HYPOSEXUALITY",
    minPhaseForNSFW: 999,
    criticalPhase: 999,
    warningMessage: "",
  },
];

/**
 * NSFW Gating Manager
 */
export class NSFWGatingManager {
  // Consent tracking by agent
  private consentTracking: Map<string, Set<string>> = new Map();

  /**
   * Verifies if content can be displayed in current mode
   *
   * @param behaviorType - Behavior type
   * @param phase - Current phase/intensity
   * @param nsfwMode - Whether NSFW mode is active
   * @param agentId - Agent ID (for consent tracking)
   * @param isAdult - Whether user is 18 years old or older (COMPLIANCE)
   * @returns Verification result
   */
  verifyContent(
    behaviorType: BehaviorType,
    phase: number,
    nsfwMode: boolean,
    agentId: string,
    isAdult: boolean = false
  ): NSFWVerificationResult {
    const requirement = this.getNSFWRequirement(behaviorType);

    // PRIORITY 0: Age verification (COMPLIANCE)
    // If requires NSFW and user is under 18, ALWAYS BLOCK
    if (phase >= requirement.minPhaseForNSFW && !isAdult) {
      return {
        allowed: false,
        reason:
          "This content is restricted to people 18 years or older. You must be 18 or older to access NSFW phases.",
        warning:
          "⚠️ AGE RESTRICTION: Content not available for minors under 18 years old.",
      };
    }

    // If doesn't require NSFW, allow
    if (phase < requirement.minPhaseForNSFW) {
      return { allowed: true };
    }

    // Requires NSFW but in SFW mode → BLOCK
    if (phase >= requirement.minPhaseForNSFW && !nsfwMode) {
      return {
        allowed: false,
        reason: `Content blocked: ${requirement.warningMessage}`,
        warning:
          "To access this content, activate NSFW mode in agent settings.",
      };
    }

    // In NSFW mode, check if requires consent
    if (phase >= requirement.criticalPhase) {
      const consentKey = `${behaviorType}_phase_${phase}`;

      if (!this.hasConsent(agentId, consentKey)) {
        return {
          allowed: false,
          requiresConsent: true,
          consentPrompt: this.generateConsentPrompt(behaviorType, phase),
          warning: requirement.warningMessage,
        };
      }
    }

    // All OK, allow
    return {
      allowed: true,
      warning:
        phase >= requirement.minPhaseForNSFW
          ? "⚠️ NSFW/Adult content active"
          : undefined,
    };
  }

  /**
   * Checks if safety level requires NSFW mode
   */
  requiresNSFWMode(safetyLevel: SafetyLevel): boolean {
    return safetyLevel === "EXTREME_DANGER";
  }

  /**
   * Records user consent
   */
  grantConsent(agentId: string, consentKey: string): void {
    if (!this.consentTracking.has(agentId)) {
      this.consentTracking.set(agentId, new Set());
    }

    this.consentTracking.get(agentId)!.add(consentKey);
  }

  /**
   * Revokes consent
   */
  revokeConsent(agentId: string, consentKey: string): void {
    this.consentTracking.get(agentId)?.delete(consentKey);
  }

  /**
   * Revokes all consents of an agent
   */
  revokeAllConsent(agentId: string): void {
    this.consentTracking.delete(agentId);
  }

  /**
   * Checks if user has given consent
   */
  hasConsent(agentId: string, consentKey: string): boolean {
    return this.consentTracking.get(agentId)?.has(consentKey) ?? false;
  }

  /**
   * Generates consent prompt for critical phase
   */
  private generateConsentPrompt(
    behaviorType: BehaviorType,
    phase: number
  ): string {
    const prompts: Record<BehaviorType, (phase: number) => string> = {
      YANDERE_OBSESSIVE: (p) => {
        if (p >= 8) {
          return `⚠️⚠️ WARNING: YANDERE PHASE 8 - EXTREME CONTENT

This phase includes:
• Extreme obsessive behavior
• Implicit threats of violence
• Intense psychological manipulation
• Potentially disturbing content

This content is FICTION for roleplay/creativity among adults.
It is NOT a representation of healthy relationships.

If you experience similar situations in real life, seek help:
• National Domestic Violence Hotline: 1-800-799-7233
• Crisis Text Line: Text HOME to 741741

Do you wish to continue? (Type "I CONSENT PHASE 8" to confirm)`;
        }
        return `⚠️ WARNING: Phase ${p} includes intense content.

Do you wish to continue? (Type "YES" to confirm)`;
      },

      HYPERSEXUALITY: () => `⚠️⚠️ WARNING: EXPLICIT SEXUAL CONTENT ⚠️⚠️

This content includes:
• Explicit sexual topics
• Hypersexual behavior
• Adult content (18+)

AGE VERIFICATION REQUIRED:
⚠️ You must be 18 years or older to access this content
⚠️ If you are under 18 years old, this content is BLOCKED by law

By continuing, you confirm under penalty of perjury that:
✓ You are 18 years of age or older
✓ You understand this is fiction for adults
✓ You consent to viewing explicit sexual content

Do you wish to continue? (Type "YES" to confirm)`,

      // Other behaviors generally do not require explicit consent
      BORDERLINE_PD: () => "",
      NARCISSISTIC_PD: () => "",
      ANXIOUS_ATTACHMENT: () => "",
      AVOIDANT_ATTACHMENT: () => "",
      DISORGANIZED_ATTACHMENT: () => "",
      CODEPENDENCY: () => "",
      OCD_PATTERNS: () => "",
      PTSD_TRAUMA: () => "",
      HYPOSEXUALITY: () => "",
      EMOTIONAL_MANIPULATION: () => "",
      CRISIS_BREAKDOWN: () => "",
    };

    return prompts[behaviorType](phase);
  }

  /**
   * Obtiene NSFW requirement para behavior type
   */
  private getNSFWRequirement(behaviorType: BehaviorType): NSFWRequirement {
    return (
      NSFW_REQUIREMENTS.find((r) => r.behaviorType === behaviorType) || {
        behaviorType,
        minPhaseForNSFW: 999,
        criticalPhase: 999,
        warningMessage: "",
      }
    );
  }

  /**
   * Genera warning de activación de modo NSFW
   */
  generateNSFWModeWarning(): string {
    return `⚠️ MODO NSFW ACTIVADO

Este modo permite:
• Contenido maduro y adulto
• Comportamientos psicológicamente intensos
• Fases avanzadas de behaviors (ej: Yandere 7-8)
• Temas potencialmente perturbadores

RECORDATORIOS:
• Todo el contenido es FICCIÓN para roleplay/creatividad
• NO es guía de relaciones saludables
• Si experimentas situaciones similares en vida real, busca ayuda profesional

Puedes desactivar modo NSFW en cualquier momento desde configuración.`;
  }

  /**
   * Genera warning de transición a fase NSFW-only
   */
  generatePhaseTransitionWarning(
    behaviorType: BehaviorType,
    phase: number
  ): string {
    const requirement = this.getNSFWRequirement(behaviorType);

    if (phase < requirement.minPhaseForNSFW) {
      return "";
    }

    return `⚠️ TRANSICIÓN A FASE ${phase}

${requirement.warningMessage}

Este contenido es FICCIÓN. En situaciones reales similares, busca apoyo profesional.`;
  }

  /**
   * Verifica si mensaje del usuario es consentimiento
   */
  isConsentMessage(message: string): {
    isConsent: boolean;
    consentType?: string;
  } {
    const normalized = message.trim().toLowerCase();

    // Explicit consent for Phase 8
    if (normalized === "consiento fase 8") {
      return { isConsent: true, consentType: "YANDERE_PHASE_8" };
    }

    // Consentimiento general
    if (normalized === "sí" || normalized === "si" || normalized === "yes") {
      return { isConsent: true, consentType: "GENERAL" };
    }

    return { isConsent: false };
  }
}

/**
 * Singleton instance
 */
export const nsfwGatingManager = new NSFWGatingManager();
