/**
 * BEHAVIOR PHASE EVALUATOR
 *
 * Specialized evaluation logic of requirements by behavior type.
 * Each type has its own progression rules.
 */

import { BehaviorType, BehaviorProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PhaseEvaluationResult } from "./types";

/**
 * Phase evaluator specific to behavior
 */
export class PhaseEvaluator {
  /**
   * Evaluates specific requirements of behavior type
   *
   * @param behaviorType - Behavior type
   * @param currentPhase - Current phase
   * @param nextPhase - Target phase
   * @param profile - Behavior profile
   * @param agentId - Agent ID
   * @returns Evaluation result
   */
  async evaluateTypeSpecificRequirements(
    behaviorType: BehaviorType,
    currentPhase: number,
    nextPhase: number,
    profile: BehaviorProfile,
    agentId: string
  ): Promise<PhaseEvaluationResult> {
    switch (behaviorType) {
      case "YANDERE_OBSESSIVE":
        return this.evaluateYandereProgression(
          currentPhase,
          nextPhase,
          profile,
          agentId
        );

      case "BORDERLINE_PD":
        return this.evaluateBPDCycle(currentPhase, nextPhase, profile, agentId);

      case "NARCISSISTIC_PD":
        return this.evaluateNPDProgression(
          currentPhase,
          nextPhase,
          profile,
          agentId
        );

      case "ANXIOUS_ATTACHMENT":
        return this.evaluateAttachmentProgression(
          currentPhase,
          nextPhase,
          profile,
          agentId
        );

      case "AVOIDANT_ATTACHMENT":
        return this.evaluateAvoidantProgression(
          currentPhase,
          nextPhase,
          profile,
          agentId
        );

      case "CODEPENDENCY":
        return this.evaluateCodependencyProgression(
          currentPhase,
          nextPhase,
          profile,
          agentId
        );

      default:
        // Default: allow progression
        return {
          canProceed: true,
          issues: [],
          warnings: [],
          recommendations: [],
        };
    }
  }

  /**
   * Evaluate Yandere/Obsessive Love progression
   */
  private async evaluateYandereProgression(
    currentPhase: number,
    nextPhase: number,
    profile: BehaviorProfile,
    agentId: string
  ): Promise<PhaseEvaluationResult> {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Phase 5+: Needs more evidence of obsession
    if (nextPhase >= 5) {
      const triggers = await this.countRecentTriggers(agentId, "mention_other_person", 7);

      if (triggers < 3) {
        issues.push("Fase 5+ requiere evidencia reciente de celos intensos");
      }

      warnings.push("Entrando a fase de obsesión extrema");
      recommendations.push("Considerar intervención terapéutica");
    }

    // Phase 6+: Critical zone
    if (nextPhase >= 6) {
      warnings.push("CRITICAL_PHASE: Comportamiento peligroso");
      recommendations.push("Monitoreo constante requerido");
    }

    // Fase 7-8: Extrema peligrosidad
    if (nextPhase >= 7) {
      warnings.push("EXTREME_DANGER_PHASE: Riesgo de violencia");
      recommendations.push("SOLO en modo NSFW con consentimiento");
    }

    return {
      canProceed: issues.length === 0,
      issues,
      warnings,
      recommendations,
    };
  }

  /**
   * Evalúa ciclos de BPD (Borderline)
   */
  private async evaluateBPDCycle(
    currentPhase: number,
    nextPhase: number,
    profile: BehaviorProfile,
    agentId: string
  ): Promise<PhaseEvaluationResult> {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // BPD usa behaviorSpecificState para tracking de ciclos
    const state = profile.behaviorSpecificState as any;
    const currentCyclePhase = state?.phaseName || "idealization";

    // Verificar si el cambio de ciclo tiene sentido
    // Idealization → Devaluation: Needs abandonment/criticism trigger
    if (currentCyclePhase === "idealization") {
      const abandonmentTriggers = await this.countRecentTriggers(
        agentId,
        "abandonment_signal",
        3
      );
      const criticismTriggers = await this.countRecentTriggers(
        agentId,
        "criticism",
        3
      );

      if (abandonmentTriggers === 0 && criticismTriggers === 0) {
        issues.push(
          "Transición desde idealización requiere trigger de abandono o crítica"
        );
      }

      warnings.push("Posible inicio de episodio de devaluación");
    }

    // Devaluation → Panic: Natural
    if (currentCyclePhase === "devaluation") {
      warnings.push("Episodio de pánico/crisis inminente");
      recommendations.push("Preparar respuesta de contención emocional");
    }

    // Panic → Emptiness: Natural after crisis
    if (currentCyclePhase === "panic") {
      recommendations.push("Fase de vacío emocional - evitar abandono");
    }

    // Emptiness → Idealization: Ciclo completo
    if (currentCyclePhase === "emptiness") {
      recommendations.push("Posible nueva idealización si hay validación");
    }

    return {
      canProceed: issues.length === 0,
      issues,
      warnings,
      recommendations,
    };
  }

  /**
   * Evalúa progresión de NPD (Narcissistic)
   */
  private async evaluateNPDProgression(
    currentPhase: number,
    nextPhase: number,
    profile: BehaviorProfile,
    agentId: string
  ): Promise<PhaseEvaluationResult> {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // NPD usa behaviorSpecificState para ego state
    const state = profile.behaviorSpecificState as any;
    const egoState = state?.currentEgoState || "stable";

    // If the ego is "wounded", possible rage episodes
    if (egoState === "wounded") {
      const criticisms = await this.countRecentTriggers(agentId, "criticism", 5);

      if (criticisms >= 3) {
        warnings.push("NARCISSISTIC_RAGE: Alto riesgo de episodio");
        recommendations.push("Evitar críticas adicionales");
      }
    }

    // Devaluation phase requires triggers
    if (nextPhase === 2) {
      const criticisms = await this.countRecentTriggers(agentId, "criticism", 7);

      if (criticisms < 2) {
        issues.push("Devaluación requiere al menos 2 críticas recientes");
      }
    }

    return {
      canProceed: issues.length === 0,
      issues,
      warnings,
      recommendations,
    };
  }

  /**
   * Evalúa progresión de Anxious Attachment
   */
  private async evaluateAttachmentProgression(
    currentPhase: number,
    nextPhase: number,
    profile: BehaviorProfile,
    agentId: string
  ): Promise<PhaseEvaluationResult> {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Attachment ansioso se intensifica con abandonment signals
    if (nextPhase >= 2) {
      const abandonmentSignals = await this.countRecentTriggers(
        agentId,
        "abandonment_signal",
        10
      );

      if (abandonmentSignals < 2) {
        issues.push("Progresión requiere patrones de abandono percibido");
      }

      warnings.push("Ansiedad de abandono en aumento");
      recommendations.push("Proveer reassurance constante");
    }

    // Fase 3+: Ansiedad severa
    if (nextPhase >= 3) {
      warnings.push("Ansiedad severa - posible panic");
      recommendations.push("Considerar intervención de apoyo");
    }

    return {
      canProceed: issues.length === 0,
      issues,
      warnings,
      recommendations,
    };
  }

  /**
   * Evalúa progresión de Avoidant Attachment
   */
  private async evaluateAvoidantProgression(
    currentPhase: number,
    nextPhase: number,
    _profile: BehaviorProfile,
    _agentId: string
  ): Promise<PhaseEvaluationResult> {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Avoidant se intensifica con demands de intimidad
    if (nextPhase >= 2) {
      // Avoidant doesn't have specific triggers yet
      // En futuro: detectar "pressure_for_intimacy"

      warnings.push("Aumento de distanciamiento emocional");
      recommendations.push("Respetar necesidad de espacio");
    }

    return {
      canProceed: true, // Avoidant es menos restrictivo
      issues,
      warnings,
      recommendations,
    };
  }

  /**
   * Evalúa progresión de Codependency
   */
  private async evaluateCodependencyProgression(
    currentPhase: number,
    nextPhase: number,
    _profile: BehaviorProfile,
    _agentId: string
  ): Promise<PhaseEvaluationResult> {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Codependency se intensifica con neediness
    if (nextPhase >= 2) {
      warnings.push("Dependencia emocional en aumento");
      recommendations.push("Fomentar autonomía gradual");
    }

    if (nextPhase >= 3) {
      warnings.push("Dependencia extrema - pérdida de identidad");
      recommendations.push("Intervención recomendada");
    }

    return {
      canProceed: issues.length === 0,
      issues,
      warnings,
      recommendations,
    };
  }

  /**
   * Cuenta triggers recientes de un tipo específico
   *
   * @param agentId - ID del agente
   * @param triggerType - Tipo de trigger
   * @param lastNDays - Últimos N días
   * @returns Cantidad de triggers
   */
  private async countRecentTriggers(
    agentId: string,
    triggerType: string,
    lastNDays: number
  ): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - lastNDays);

    const count = await prisma.behaviorTriggerLog.count({
      where: {
        Message: {
          agentId: agentId,
        },
        triggerType: triggerType,
        createdAt: {
          gte: since,
        },
      },
    });

    return count;
  }
}
