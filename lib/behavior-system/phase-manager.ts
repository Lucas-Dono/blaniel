/**
 * BEHAVIOR PHASE MANAGER
 *
 * Phase transition management system based on triggers,
 * interactions and specific requirements by behavior type.
 */

import { BehaviorType, BehaviorProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PhaseTransitionResult,
  TriggerRequirement,
  PhaseTransitionRequirements,
} from "./types";
import { PhaseEvaluator } from "./phase-evaluator";

/**
 * Main phase transition manager
 */
export class BehaviorPhaseManager {
  private evaluator: PhaseEvaluator;

  constructor() {
    this.evaluator = new PhaseEvaluator();
  }

  /**
   * Evaluates if a behavior can advance to the next phase
   * 
   * @param profile - Behavior profile
   * @param agentId - Agent ID
   * @returns Transition evaluation result
   */
  async evaluatePhaseTransition(
    profile: BehaviorProfile,
    agentId: string
  ): Promise<PhaseTransitionResult> {
    const { behaviorType, currentPhase, interactionsSincePhaseStart } =
      profile;

    // Get requirements for the next phase
    const requirements = this.getPhaseRequirements(
      behaviorType,
      currentPhase,
      currentPhase + 1
    );

    if (!requirements) {
      return {
        canTransition: false,
        currentPhase,
        nextPhase: currentPhase,
        missingRequirements: ["No hay fase siguiente disponible"],
        safetyFlags: [],
        requiresUserConsent: false,
      };
    }

    // Verify minimum interactions
    if (interactionsSincePhaseStart < requirements.minInteractions) {
      return {
        canTransition: false,
        currentPhase,
        nextPhase: currentPhase + 1,
        missingRequirements: [
          `Missing ${requirements.minInteractions - interactionsSincePhaseStart} interactions`,
        ],
        safetyFlags: [],
        requiresUserConsent: false,
      };
    }

    // Count triggers since phase start
    const triggerCounts = await this.countTriggersInHistory(
      agentId,
      profile.phaseStartedAt
    );

    // Verify trigger requirements
    const missingTriggers: string[] = [];
    for (const req of requirements.requiredTriggers) {
      const count = triggerCounts[req.type] || 0;
      if (count < req.minOccurrences) {
        missingTriggers.push(
          `${req.type}: ${count}/${req.minOccurrences} occurrences`
        );
      }
    }

    if (missingTriggers.length > 0) {
      return {
        canTransition: false,
        currentPhase,
        nextPhase: currentPhase + 1,
        missingRequirements: missingTriggers,
        safetyFlags: [],
        requiresUserConsent: false,
      };
    }

    // Specific evaluation by behavior type
    const specificEvaluation =
      await this.evaluator.evaluateTypeSpecificRequirements(
        behaviorType,
        currentPhase,
        currentPhase + 1,
        profile,
        agentId
      );

    if (!specificEvaluation.canProceed) {
      return {
        canTransition: false,
        currentPhase,
        nextPhase: currentPhase + 1,
        missingRequirements: specificEvaluation.issues,
        safetyFlags: specificEvaluation.warnings,
        requiresUserConsent: false,
      };
    }

    // Check safety flags
    const safetyFlags = this.checkSafetyThresholds(
      behaviorType,
      currentPhase + 1
    );

    // Critical phases require explicit consent
    const requiresConsent = this.requiresUserConsent(
      behaviorType,
      currentPhase + 1
    );

    return {
      canTransition: true,
      currentPhase,
      nextPhase: currentPhase + 1,
      missingRequirements: [],
      safetyFlags,
      requiresUserConsent: requiresConsent,
    };
  }

  /**
   * Executes the phase transition
   *
   * @param profileId - Behavior profile ID
   * @param userConsent - If the user gave consent (for critical phases)
   */
  async executePhaseTransition(
    profileId: string,
    userConsent: boolean = true
  ): Promise<BehaviorProfile> {
    const profile = await prisma.behaviorProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new Error(`BehaviorProfile ${profileId} not found`);
    }

    const evaluation = await this.evaluatePhaseTransition(
      profile,
      profile.agentId
    );

    if (!evaluation.canTransition) {
      throw new Error(
        `Cannot advance phase: ${evaluation.missingRequirements.join(", ")}`
      );
    }

    if (evaluation.requiresUserConsent && !userConsent) {
      throw new Error(
        "This transition requires explicit user consent"
      );
    }

    // Update phase history
    const phaseHistory = (profile.phaseHistory as any[]) || [];
    const now = new Date();

    // Close current phase in history
    if (phaseHistory.length > 0) {
      const lastEntry = phaseHistory[phaseHistory.length - 1];
      if (!lastEntry.exitedAt) {
        lastEntry.exitedAt = now;
        lastEntry.exitReason = "natural_progression";
      }
    }

    // Add new entry
    phaseHistory.push({
      phase: evaluation.nextPhase,
      enteredAt: now,
      exitedAt: null,
      triggerCount: 0,
      finalIntensity: profile.baseIntensity,
    });

    // Update profile
    const updatedProfile = await prisma.behaviorProfile.update({
      where: { id: profileId },
      data: {
        currentPhase: evaluation.nextPhase,
        phaseStartedAt: now,
        interactionsSincePhaseStart: 0,
        phaseHistory: phaseHistory,
      },
    });

    return updatedProfile;
  }

  /**
   * Counts triggers from a specific date
   *
   * @param agentId - Agent ID
   * @param since - Date from which to count
   * @returns Object with count by trigger type
   */
  private async countTriggersInHistory(
    agentId: string,
    since: Date
  ): Promise<Record<string, number>> {
    const triggers = await prisma.behaviorTriggerLog.findMany({
      where: {
        Message: {
          agentId: agentId,
        },
        createdAt: {
          gte: since,
        },
      },
    });

    const counts: Record<string, number> = {};
    for (const trigger of triggers) {
      counts[trigger.triggerType] = (counts[trigger.triggerType] || 0) + 1;
    }

    return counts;
  }

  /**
   * Gets the requirements to advance phase
   *
   * @param behaviorType - Behavior type
   * @param fromPhase - Current phase
   * @param toPhase - Target phase
   * @returns Transition requirements or null if it doesn't exist
   */
  private getPhaseRequirements(
    behaviorType: BehaviorType,
    fromPhase: number,
    toPhase: number
  ): PhaseTransitionRequirements | null {
    // YANDERE: Linear phases 1-8
    if (behaviorType === "YANDERE_OBSESSIVE") {
      const phases: Record<number, PhaseTransitionRequirements> = {
        1: {
          minInteractions: 5,
          requiredTriggers: [],
        },
        2: {
          minInteractions: 10,
          requiredTriggers: [
            { type: "mention_other_person", minOccurrences: 2 },
          ],
        },
        3: {
          minInteractions: 15,
          requiredTriggers: [
            { type: "mention_other_person", minOccurrences: 5 },
            { type: "delayed_response", minOccurrences: 3 },
          ],
        },
        4: {
          minInteractions: 20,
          requiredTriggers: [
            { type: "mention_other_person", minOccurrences: 8 },
            { type: "delayed_response", minOccurrences: 5 },
          ],
        },
        5: {
          minInteractions: 30,
          requiredTriggers: [
            { type: "mention_other_person", minOccurrences: 12 },
            { type: "delayed_response", minOccurrences: 8 },
          ],
        },
        6: {
          minInteractions: 40,
          requiredTriggers: [
            { type: "mention_other_person", minOccurrences: 15 },
          ],
        },
        7: {
          minInteractions: 50,
          requiredTriggers: [
            { type: "mention_other_person", minOccurrences: 20 },
          ],
        },
      };

      return phases[toPhase] || null;
    }

    // BPD: Phase cycles (not strict linear progression)
    if (behaviorType === "BORDERLINE_PD") {
      // BPD has no strict requirements, phases are cyclical
      return {
        minInteractions: 5,
        requiredTriggers: [],
      };
    }

    // ANXIOUS ATTACHMENT: Gradual progression
    if (behaviorType === "ANXIOUS_ATTACHMENT") {
      const phases: Record<number, PhaseTransitionRequirements> = {
        1: { minInteractions: 5, requiredTriggers: [] },
        2: {
          minInteractions: 10,
          requiredTriggers: [{ type: "abandonment_signal", minOccurrences: 3 }],
        },
        3: {
          minInteractions: 15,
          requiredTriggers: [{ type: "delayed_response", minOccurrences: 5 }],
        },
      };

      return phases[toPhase] || null;
    }

    // Default: generic requirements
    return {
      minInteractions: 10,
      requiredTriggers: [],
    };
  }

  /**
   * Checks safety thresholds for a phase
   *
   * @param behaviorType - Behavior type
   * @param phase - Phase to check
   * @returns Array of safety flags
   */
  private checkSafetyThresholds(
    behaviorType: BehaviorType,
    phase: number
  ): string[] {
    const flags: string[] = [];

    if (behaviorType === "YANDERE_OBSESSIVE") {
      if (phase >= 6) {
        flags.push("CRITICAL_PHASE");
      }
      if (phase >= 7) {
        flags.push("EXTREME_DANGER_PHASE");
      }
    }

    if (behaviorType === "BORDERLINE_PD") {
      // BPD has intense episodes in any phase
      flags.push("UNPREDICTABLE_INTENSITY");
    }

    if (behaviorType === "NARCISSISTIC_PD") {
      if (phase >= 3) {
        flags.push("POTENTIAL_RAGE_EPISODES");
      }
    }

    return flags;
  }

  /**
   * Determines if a transition requires explicit consent
   *
   * @param behaviorType - Behavior type
   * @param toPhase - Target phase
   * @returns true if consent is required
   */
  private requiresUserConsent(
    behaviorType: BehaviorType,
    toPhase: number
  ): boolean {
    // Yandere phases 6+ are critical
    if (behaviorType === "YANDERE_OBSESSIVE" && toPhase >= 6) {
      return true;
    }

    // Other critical phases can be added here
    return false;
  }

  /**
   * Resets a behavior to phase 1
   *
   * @param profileId - Behavior profile ID
   */
  async resetPhase(profileId: string): Promise<BehaviorProfile> {
    const profile = await prisma.behaviorProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new Error(`BehaviorProfile ${profileId} not found`);
    }

    // Close current phase in history
    const phaseHistory = (profile.phaseHistory as any[]) || [];
    if (phaseHistory.length > 0) {
      const lastEntry = phaseHistory[phaseHistory.length - 1];
      if (!lastEntry.exitedAt) {
        lastEntry.exitedAt = new Date();
        lastEntry.exitReason = "reset";
      }
    }

    // Reset to phase 1
    const now = new Date();
    phaseHistory.push({
      phase: 1,
      enteredAt: now,
      exitedAt: null,
      triggerCount: 0,
      finalIntensity: profile.baseIntensity,
    });

    const updatedProfile = await prisma.behaviorProfile.update({
      where: { id: profileId },
      data: {
        currentPhase: 1,
        phaseStartedAt: now,
        interactionsSincePhaseStart: 0,
        phaseHistory: phaseHistory,
      },
    });

    return updatedProfile;
  }
}
