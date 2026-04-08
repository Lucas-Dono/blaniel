/**
 * BEHAVIOR INTENSITY CALCULATOR
 *
 * Advanced intensity calculations based on multiple factors:
 * - Base intensity (configured)
 * - Phase multiplier (each phase amplifies)
 * - Trigger amplification (recent triggers)
 * - Emotional modulation (current emotional state)
 * - Decay factor (temporal decay)
 * - Inertia factor (resistance to change)
 */

import { BehaviorType, BehaviorProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { BehaviorIntensityResult, BehaviorIntensityParams } from "./types";

/**
 * Behavior intensity calculator
 */
export class IntensityCalculator {
  /**
   * Calculates the final intensity of a behavior
   * 
   * @param profile - Behavior profile
   * @param agentId - Agent ID
   * @param emotionalModulation - Emotional modulation (0-1), default 1.0
   * @returns Result with intensity and components
   */
  async calculateIntensity(
    profile: BehaviorProfile,
    agentId: string,
    emotionalModulation: number = 1.0
  ): Promise<BehaviorIntensityResult> {
    // Components of the calculation
    const baseIntensity = profile.baseIntensity;
    const phaseMultiplier = this.calculatePhaseMultiplier(
      profile.behaviorType,
      profile.currentPhase
    );
    const triggerAmplification = await this.calculateTriggerAmplification(
      agentId,
      profile.behaviorType,
      profile.phaseStartedAt
    );
    const decayFactor = this.calculateDecay(
      profile.phaseStartedAt,
      profile.volatility
    );
    const inertiaFactor = this.calculateInertia(
      profile.phaseStartedAt,
      profile.interactionsSincePhaseStart
    );

    // Final formula:
    // intensity = (base * phaseMultiplier + triggerAmplification) * emotionalModulation * decayFactor * inertiaFactor
    const intensity =
      (baseIntensity * phaseMultiplier + triggerAmplification) *
      emotionalModulation *
      decayFactor *
      inertiaFactor;

    // Clamp entre 0 y 1
    const finalIntensity = Math.max(0, Math.min(1, intensity));

    const components: BehaviorIntensityParams = {
      baseIntensity,
      phaseMultiplier,
      triggerAmplification,
      emotionalModulation,
      decayFactor,
      inertiaFactor,
    };

    return {
      behaviorType: profile.behaviorType,
      finalIntensity,
      components,
      shouldDisplay: finalIntensity >= profile.thresholdForDisplay,
    };
  }

  /**
   * Calculates phase multiplier
   *
   * Each phase increments the base intensity.
   *
   * @param behaviorType - Behavior type
   * @param phase - Current phase
   * @returns Multiplier (e.g: 1.0, 1.2, 1.5, 2.0)
   */
  private calculatePhaseMultiplier(
    behaviorType: BehaviorType,
    phase: number
  ): number {
    if (behaviorType === "YANDERE_OBSESSIVE") {
      // Yandere scales exponentially
      const multipliers = [1.0, 1.15, 1.35, 1.6, 2.0, 2.5, 3.0, 4.0];
      return multipliers[phase - 1] || 1.0;
    }

    if (behaviorType === "ANXIOUS_ATTACHMENT") {
      // Anxious attachment scales linearly
      const multipliers = [1.0, 1.2, 1.5, 1.8, 2.0];
      return multipliers[phase - 1] || 1.0;
    }

    if (behaviorType === "BORDERLINE_PD") {
      // BPD has high intensity in all phases
      return 1.5 + phase * 0.2;
    }

    if (behaviorType === "NARCISSISTIC_PD") {
      // NPD varies depending on the phase (idealization vs devaluation)
      const multipliers = [1.2, 1.8, 2.0, 1.5]; // idealization, devaluation, discard, hoovering
      return multipliers[phase - 1] || 1.0;
    }

    // Default: moderate linear scaling
    return 1.0 + (phase - 1) * 0.15;
  }

  /**
   * Calculates amplification based on recent triggers
   *
   * Triggers in the last 7 days amplify the intensity.
   *
   * @param agentId - Agent ID
   * @param behaviorType - Behavior type
   * @param since - Date from which to search for triggers
   * @returns Amplification (0 to 0.5)
   */
  private async calculateTriggerAmplification(
    agentId: string,
    behaviorType: BehaviorType,
    _since: Date
  ): Promise<number> {
    // Search for recent triggers (last 7 days)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7);

    const triggers = await prisma.behaviorTriggerLog.findMany({
      where: {
        Message: {
          agentId: agentId,
        },
        behaviorType: behaviorType,
        createdAt: {
          gte: recentDate,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20, // Max 20 recent triggers
    });

    if (triggers.length === 0) return 0;

    // Sum weights with temporal decay
    let totalAmplification = 0;
    const now = new Date().getTime();

    for (const trigger of triggers) {
      const ageInHours =
        (now - trigger.createdAt.getTime()) / (1000 * 60 * 60);

      // Exponential decay: more recent = more impact
      const timeFactor = Math.exp(-ageInHours / 48); // Half-life of 48h

      totalAmplification += trigger.weight * timeFactor;
    }

    // Normalize (max 0.5)
    return Math.min(0.5, totalAmplification / 5);
  }

  /**
   * Calculates temporal decay factor
   *
   * Over time, the intensity decays if there are no new triggers.
   *
   * @param phaseStartedAt - Phase start date
   * @param volatility - Volatility (0-1), higher = decays faster
   * @returns Decay factor (0.5 to 1.0)
   */
  private calculateDecay(phaseStartedAt: Date, volatility: number): number {
    const now = new Date().getTime();
    const phaseAgeInHours =
      (now - phaseStartedAt.getTime()) / (1000 * 60 * 60);

    // High volatility = faster decay
    const decayRate = 0.01 + volatility * 0.02;

    // Exponential decay
    const decay = Math.exp(-decayRate * phaseAgeInHours);

    // Minimum 0.5 (never decays completely)
    return Math.max(0.5, decay);
  }

  /**
   * Calculates inertia factor
   *
   * More interactions = more "entrenched" behavior = higher inertia.
   *
   * @param phaseStartedAt - Phase start date
   * @param interactionCount - Number of interactions in this phase
   * @returns Inertia factor (0.8 to 1.2)
   */
  private calculateInertia(
    phaseStartedAt: Date,
    interactionCount: number
  ): number {
    // More interactions = more resistance to change = higher intensity
    // Logarithmic curve to avoid explosion
    const inertia = 0.8 + Math.log10(Math.max(1, interactionCount)) * 0.2;

    // Clamp between 0.8 and 1.2
    return Math.max(0.8, Math.min(1.2, inertia));
  }

  /**
   * Calculates intensities for all behaviors of an agent
   *
   * @param agentId - Agent ID
   * @param emotionalModulation - Optional emotional modulation factor
   * @returns Array of intensity results
   */
  async calculateAllIntensities(
    agentId: string,
    emotionalModulation: number = 1.0
  ): Promise<BehaviorIntensityResult[]> {
    const profiles = await prisma.behaviorProfile.findMany({
      where: { agentId },
    });

    const results: BehaviorIntensityResult[] = [];

    for (const profile of profiles) {
      const result = await this.calculateIntensity(
        profile,
        agentId,
        emotionalModulation
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Gets the dominant behavior (highest intensity)
   *
   * @param agentId - Agent ID
   * @returns Intensity result of dominant behavior or null
   */
  async getDominantBehavior(
    agentId: string
  ): Promise<BehaviorIntensityResult | null> {
    const results = await this.calculateAllIntensities(agentId);

    if (results.length === 0) return null;

    // Filter only those that exceed threshold
    const visible = results.filter((r) => r.shouldDisplay);

    if (visible.length === 0) return null;

    // Return the one with highest intensity
    return visible.reduce((max, current) =>
      current.finalIntensity > max.finalIntensity ? current : max
    );
  }

  /**
   * Updates the intensity cache in BehaviorProgressionState
   *
   * @param agentId - Agent ID
   */
  async updateIntensityCache(agentId: string): Promise<void> {
    const results = await this.calculateAllIntensities(agentId);

    // Convert to object for JSON
    const intensities: Record<string, number> = {};
    for (const result of results) {
      intensities[result.behaviorType] = result.finalIntensity;
    }

    // Update or create cache
    await prisma.behaviorProgressionState.upsert({
      where: { agentId },
      update: {
        currentIntensities: intensities,
        lastCalculatedAt: new Date(),
      },
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        agentId,
        currentIntensities: intensities,
        lastCalculatedAt: new Date(),
      },
    });
  }
}
