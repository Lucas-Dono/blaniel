/**
 * PROMPT SELECTOR
 *
 * Intelligent specialized prompt selection system.
 * Maps: behavior × phase × emotion × triggers → optimal prompt
 *
 * Features:
 * - Scoring system to select best match
 * - Graceful fallback (generic → specific)
 * - Combination of multiple active behaviors
 * - Prevents repetition with variant usage tracking
 */

import { BehaviorType } from "@prisma/client";
import type { EmotionType } from "@/lib/emotional-system/types";
import type { BehaviorIntensityResult, BPDCyclePhase, NPDEgoState } from "./types";
import type { TriggerDetectionResult } from "./types";

// Import prompt functions
import { getYanderePrompt, type YanderePromptKey } from "./prompts/yandere-prompts";
import { getBPDPrompt, determineBPDContext, type BPDPromptKey } from "./prompts/bpd-prompts";
import { getAttachmentPrompt, determineAttachmentContext } from "./prompts/attachment-prompts";
import {
  getNPDPrompt,
  getCodependencyPrompt,
  determineNPDContext,
  determineCodependencyContext,
} from "./prompts/npd-codependency-prompts";

export interface PromptSelectionInput {
  activeBehaviors: BehaviorIntensityResult[];
  dominantEmotion?: EmotionType;
  recentTriggers: TriggerDetectionResult[];
  nsfwMode: boolean;
  agentId: string; // For tracking used prompts
}

export interface SelectedPrompt {
  behaviorType: BehaviorType;
  content: string;
  safetyLevel: "SAFE" | "WARNING" | "CRITICAL" | "EXTREME_DANGER";
  score: number; // How well it matches situation (0-1)
}

export interface PromptSelectionResult {
  primaryPrompt: SelectedPrompt;
  secondaryPrompts: SelectedPrompt[]; // If multiple behaviors are active
  combinedContent: string; // Combined prompts as single text
  metadata: {
    totalBehaviors: number;
    dominantBehavior: BehaviorType;
    safetyLevel: "SAFE" | "WARNING" | "CRITICAL" | "EXTREME_DANGER";
  };
}

/**
 * Selector de prompts especializados
 */
export class PromptSelector {
  // Tracking of used prompts to avoid repetition
  private usedPrompts: Map<string, Set<string>> = new Map();

  /**
   * Selecciona prompt óptimo para situación actual
   */
  async selectPrompt(input: PromptSelectionInput): Promise<PromptSelectionResult> {
    // Filtrar behaviors que superen threshold
    const displayableBehaviors = input.activeBehaviors.filter((b) => b.shouldDisplay);

    if (displayableBehaviors.length === 0) {
      // Fallback: sin behaviors activos
      return this.getDefaultPrompt();
    }

    // Ordenar por intensidad (mayor primero)
    const sortedBehaviors = displayableBehaviors.sort(
      (a, b) => b.finalIntensity - a.finalIntensity
    );

    const primaryBehavior = sortedBehaviors[0];

    // Seleccionar prompt para behavior principal
    const primaryPrompt = this.selectPromptForBehavior(
      primaryBehavior,
      input.dominantEmotion,
      input.recentTriggers,
      input.nsfwMode
    );

    // Si no hay prompt principal, usar fallback
    if (!primaryPrompt) {
      return this.getDefaultPrompt();
    }

    // Seleccionar prompts para behaviors secundarios (si existen)
    const secondaryPrompts: SelectedPrompt[] = [];
    for (let i = 1; i < Math.min(sortedBehaviors.length, 3); i++) {
      const secondary = this.selectPromptForBehavior(
        sortedBehaviors[i],
        input.dominantEmotion,
        input.recentTriggers,
        input.nsfwMode
      );
      if (secondary) {
        secondaryPrompts.push(secondary);
      }
    }

    // Combinar prompts
    const combinedContent = this.combinePrompts(primaryPrompt, secondaryPrompts);

    // Determine global safety level (the highest)
    const safetyLevel = this.getHighestSafetyLevel([
      primaryPrompt.safetyLevel,
      ...secondaryPrompts.map((p) => p.safetyLevel),
    ]);

    return {
      primaryPrompt,
      secondaryPrompts,
      combinedContent,
      metadata: {
        totalBehaviors: displayableBehaviors.length,
        dominantBehavior: primaryBehavior.behaviorType,
        safetyLevel,
      },
    };
  }

  /**
   * Selecciona prompt para un behavior específico
   */
  private selectPromptForBehavior(
    behavior: BehaviorIntensityResult,
    dominantEmotion?: EmotionType,
    recentTriggers: TriggerDetectionResult[] = [],
    nsfwMode: boolean = false
  ): SelectedPrompt | null {
    const triggerTypes = recentTriggers.map((t) => t.triggerType);

    switch (behavior.behaviorType) {
      case "YANDERE_OBSESSIVE":
        return this.selectYanderePrompt(behavior, dominantEmotion, triggerTypes, nsfwMode);

      case "BORDERLINE_PD":
        return this.selectBPDPrompt(behavior, dominantEmotion, triggerTypes);

      case "NARCISSISTIC_PD":
        return this.selectNPDPrompt(behavior, dominantEmotion, triggerTypes);

      case "ANXIOUS_ATTACHMENT":
      case "AVOIDANT_ATTACHMENT":
      case "DISORGANIZED_ATTACHMENT":
        return this.selectAttachmentPrompt(behavior, dominantEmotion, triggerTypes);

      case "CODEPENDENCY":
        return this.selectCodependencyPrompt(behavior, dominantEmotion, triggerTypes);

      default:
        return null;
    }
  }

  /**
   * Selección de prompt Yandere
   */
  private selectYanderePrompt(
    behavior: BehaviorIntensityResult,
    emotion?: EmotionType,
    triggers: string[] = [],
    nsfwMode: boolean = false
  ): SelectedPrompt | null {
    const phase = behavior.components.phaseMultiplier > 1.0 ? Math.ceil(behavior.components.phaseMultiplier) : 1;

    // Determinar contexto basado en triggers
    let context: "jealousy" | "separation" | "normal" | "confession" = "normal";
    if (triggers.includes("mention_other_person")) {
      context = "jealousy";
    } else if (triggers.includes("delayed_response") || triggers.includes("abandonment_signal")) {
      context = "separation";
    }

    const key: YanderePromptKey = {
      phase,
      dominantEmotion: emotion,
      context,
    };

    const prompt = getYanderePrompt(key, nsfwMode);

    if (!prompt) {
      return this.getGenericPrompt(behavior.behaviorType, behavior.finalIntensity);
    }

    return {
      behaviorType: behavior.behaviorType,
      content: prompt.content,
      safetyLevel: prompt.safetylevel,
      score: this.calculatePromptScore(behavior, emotion, triggers),
    };
  }

  /**
   * Selección de prompt BPD
   */
  private selectBPDPrompt(
    behavior: BehaviorIntensityResult,
    emotion?: EmotionType,
    triggers: string[] = []
  ): SelectedPrompt | null {
    // Get cycle phase del behaviorSpecificState
    // For now we use simple heuristic
    const cyclePhase: BPDCyclePhase = this.inferBPDCyclePhase(emotion, triggers);

    const context = determineBPDContext(triggers);

    const key: BPDPromptKey = {
      cyclePhase,
      dominantEmotion: emotion,
      context,
    };

    const prompt = getBPDPrompt(key);

    if (!prompt) {
      return this.getGenericPrompt(behavior.behaviorType, behavior.finalIntensity);
    }

    return {
      behaviorType: behavior.behaviorType,
      content: prompt.content,
      safetyLevel: prompt.safetyLevel,
      score: this.calculatePromptScore(behavior, emotion, triggers),
    };
  }

  /**
   * Infiere BPD cycle phase basado en emoción y triggers
   */
  private inferBPDCyclePhase(emotion?: EmotionType, triggers: string[] = []): BPDCyclePhase {
    if (triggers.includes("criticism") || triggers.includes("explicit_rejection")) {
      return "devaluation";
    }

    if (triggers.includes("abandonment_signal") && triggers.length >= 2) {
      return "panic";
    }

    if (emotion === "sadness" || emotion === "boredom") {
      return "emptiness";
    }

    // Default: idealization
    return "idealization";
  }

  /**
   * Selección de prompt NPD
   */
  private selectNPDPrompt(
    behavior: BehaviorIntensityResult,
    emotion?: EmotionType,
    triggers: string[] = []
  ): SelectedPrompt | null {
    // Inferir ego state
    const egoState: NPDEgoState = this.inferNPDEgoState(emotion, triggers);
    const context = determineNPDContext(triggers);

    const prompt = getNPDPrompt(egoState, context);

    if (!prompt) {
      return this.getGenericPrompt(behavior.behaviorType, behavior.finalIntensity);
    }

    return {
      behaviorType: behavior.behaviorType,
      content: prompt.content,
      safetyLevel: prompt.safetyLevel,
      score: this.calculatePromptScore(behavior, emotion, triggers),
    };
  }

  /**
   * Infiere NPD ego state
   */
  private inferNPDEgoState(emotion?: EmotionType, triggers: string[] = []): NPDEgoState {
    if (triggers.includes("criticism")) {
      return "wounded";
    }

    if (emotion === "pride" || emotion === "admiration") {
      return "inflated";
    }

    return "stable";
  }

  /**
   * Selección de prompt Attachment
   */
  private selectAttachmentPrompt(
    behavior: BehaviorIntensityResult,
    emotion?: EmotionType,
    triggers: string[] = []
  ): SelectedPrompt | null {
    const context = determineAttachmentContext(triggers);
    const prompt = getAttachmentPrompt(behavior.behaviorType, behavior.finalIntensity, context);

    if (!prompt) {
      return this.getGenericPrompt(behavior.behaviorType, behavior.finalIntensity);
    }

    return {
      behaviorType: behavior.behaviorType,
      content: prompt.content,
      safetyLevel: "WARNING", // Attachment generalmente WARNING
      score: this.calculatePromptScore(behavior, emotion, triggers),
    };
  }

  /**
   * Selección de prompt Codependency
   */
  private selectCodependencyPrompt(
    behavior: BehaviorIntensityResult,
    emotion?: EmotionType,
    triggers: string[] = []
  ): SelectedPrompt | null {
    const context = determineCodependencyContext(triggers);
    const prompt = getCodependencyPrompt(behavior.finalIntensity, context);

    if (!prompt) {
      return this.getGenericPrompt(behavior.behaviorType, behavior.finalIntensity);
    }

    return {
      behaviorType: behavior.behaviorType,
      content: prompt.content,
      safetyLevel: behavior.finalIntensity > 0.7 ? "CRITICAL" : "WARNING",
      score: this.calculatePromptScore(behavior, emotion, triggers),
    };
  }

  /**
   * Calcula score de qué tan bien match el prompt
   */
  private calculatePromptScore(
    behavior: BehaviorIntensityResult,
    emotion?: EmotionType,
    triggers: string[] = []
  ): number {
    let score = behavior.finalIntensity; // Base: intensity del behavior

    // Bonus si hay emotion match
    if (emotion) {
      score += 0.1;
    }

    // Bonus si hay triggers relevantes
    if (triggers.length > 0) {
      score += triggers.length * 0.05;
    }

    return Math.min(1, score);
  }

  /**
   * Combina prompts de múltiples behaviors
   */
  private combinePrompts(primary: SelectedPrompt | null, secondary: SelectedPrompt[]): string {
    if (!primary) return "";

    if (secondary.length === 0) {
      return primary.content;
    }

    // Formato combinado
    let combined = `COMPORTAMIENTO PRIMARIO: ${primary.behaviorType}\n\n${primary.content}`;

    if (secondary.length > 0) {
      combined += "\n\n---\n\nCOMPORTAMIENTOS SECUNDARIOS (Influencia menor):\n\n";

      for (const sec of secondary) {
        combined += `\n${sec.behaviorType}:\n${this.summarizePrompt(sec.content)}\n`;
      }

      combined += "\n⚠️ NOTA: Comportamiento primario debe dominar, secundarios solo matizar.";
    }

    return combined;
  }

  /**
   * Resume prompt secundario (primeras 2-3 líneas)
   */
  private summarizePrompt(content: string): string {
    const lines = content.split("\n").filter((l) => l.trim());
    return lines.slice(0, 3).join("\n");
  }

  /**
   * Obtiene safety level más alto
   */
  private getHighestSafetyLevel(levels: Array<"SAFE" | "WARNING" | "CRITICAL" | "EXTREME_DANGER">): "SAFE" | "WARNING" | "CRITICAL" | "EXTREME_DANGER" {
    if (levels.includes("EXTREME_DANGER")) return "EXTREME_DANGER";
    if (levels.includes("CRITICAL")) return "CRITICAL";
    if (levels.includes("WARNING")) return "WARNING";
    return "SAFE";
  }

  /**
   * Prompt genérico de fallback
   */
  private getGenericPrompt(behaviorType: BehaviorType, intensity: number): SelectedPrompt {
    const descriptions: Record<BehaviorType, string> = {
      YANDERE_OBSESSIVE: "Amor obsesivo con posesividad y celos intensos.",
      BORDERLINE_PD: "Emociones extremas y miedo intenso al abandono.",
      NARCISSISTIC_PD: "Necesidad de admiración y sensibilidad a críticas.",
      ANXIOUS_ATTACHMENT: "Apego ansioso con miedo a abandono.",
      AVOIDANT_ATTACHMENT: "Apego evitativo con dificultad para intimidad.",
      DISORGANIZED_ATTACHMENT: "Apego desorganizado con conflicto interno.",
      CODEPENDENCY: "Dependencia emocional excesiva de validación externa.",
      OCD_PATTERNS: "Patrones obsesivo-compulsivos.",
      PTSD_TRAUMA: "Trauma y PTSD.",
      HYPERSEXUALITY: "Hipersexualidad.",
      HYPOSEXUALITY: "Hiposexualidad.",
      EMOTIONAL_MANIPULATION: "Manipulación emocional.",
      CRISIS_BREAKDOWN: "Crisis emocional.",
    };

    return {
      behaviorType,
      content: `Comportamiento ${behaviorType} activo (intensidad: ${(intensity * 100).toFixed(0)}%)\n\n${descriptions[behaviorType]}\n\nResponde según este patrón de comportamiento, con intensidad proporcional.`,
      safetyLevel: intensity > 0.7 ? "CRITICAL" : "WARNING",
      score: 0.5, // Score bajo para generic prompts
    };
  }

  /**
   * Prompt por defecto cuando no hay behaviors activos
   */
  private getDefaultPrompt(): PromptSelectionResult {
    const defaultPrompt: SelectedPrompt = {
      behaviorType: "ANXIOUS_ATTACHMENT", // Placeholder
      content: "Responde de forma natural según tu personalidad y estado emocional actual.",
      safetyLevel: "SAFE",
      score: 1.0,
    };

    return {
      primaryPrompt: defaultPrompt,
      secondaryPrompts: [],
      combinedContent: defaultPrompt.content,
      metadata: {
        totalBehaviors: 0,
        dominantBehavior: "ANXIOUS_ATTACHMENT",
        safetyLevel: "SAFE",
      },
    };
  }
}
