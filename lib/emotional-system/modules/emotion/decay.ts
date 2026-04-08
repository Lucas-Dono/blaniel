/**
 * EMOTION DECAY & MOOD INERTIA
 *
 * Implements natural emotional changes:
 * - Decay: Emotions gradually decay toward baseline
 * - Inertia: Resistance to sudden emotional change
 * - Mood persistence: Mood changes more slowly than specific emotions
 */

import { EmotionState, PADMood, EmotionDynamics, BigFiveTraits } from "../../types";

export class EmotionDecaySystem {
  /**
   * Apply decay to current emotions
   * Emotions decay toward their baseline values
   */
  applyDecay(
    currentEmotions: EmotionState,
    baselineEmotions: EmotionState,
    decayRate: number,
    deltaTimeMinutes: number = 1
  ): EmotionState {
    const decayedEmotions: EmotionState = {};

    // Apply decay to each emotion
    for (const [emotion, intensity] of Object.entries(currentEmotions)) {
      const baseline = baselineEmotions[emotion as keyof EmotionState] || 0;

      // Exponential decay toward baseline
      const decayFactor = Math.exp(-decayRate * deltaTimeMinutes);
      const newIntensity = intensity * decayFactor + baseline * (1 - decayFactor);

      // Only keep if intensity is significant
      if (newIntensity > 0.05) {
        decayedEmotions[emotion as keyof EmotionState] = newIntensity;
      }
    }

    // Ensure baseline emotions are present
    for (const [emotion, baseline] of Object.entries(baselineEmotions)) {
      if (baseline > 0.05 && !decayedEmotions[emotion as keyof EmotionState]) {
        decayedEmotions[emotion as keyof EmotionState] = baseline;
      }
    }

    return decayedEmotions;
  }

  /**
   * Blend new emotions with current emotions using inertia
   * High inertia = slower change
   */
  applyInertia(
    currentEmotions: EmotionState,
    newEmotions: EmotionState,
    inertia: number
  ): EmotionState {
    const blendedEmotions: EmotionState = {};

    // Get all unique emotions
    const allEmotions = new Set([
      ...Object.keys(currentEmotions),
      ...Object.keys(newEmotions),
    ]);

    for (const emotion of allEmotions) {
      const current = currentEmotions[emotion as keyof EmotionState] || 0;
      const target = newEmotions[emotion as keyof EmotionState] || 0;

      // Blending with inertia
      // inertia = 0 → instant change
      // inertia = 1 → no change
      const blended = current * inertia + target * (1 - inertia);

      if (blended > 0.05) {
        blendedEmotions[emotion as keyof EmotionState] = blended;
      }
    }

    return blendedEmotions;
  }

  /**
   * Update mood with inertia (mood changes slower than emotions)
   */
  updateMoodWithInertia(
    currentMood: PADMood,
    targetMoodShift: Partial<PADMood>,
    moodInertia: number = 0.7 // Mood has higher inertia than emotions
  ): PADMood {
    const newMood: PADMood = {
      valence: this.smoothTransition(
        currentMood.valence,
        currentMood.valence + (targetMoodShift.valence || 0),
        moodInertia
      ),
      arousal: this.smoothTransition(
        currentMood.arousal,
        currentMood.arousal + (targetMoodShift.arousal || 0),
        moodInertia
      ),
      dominance: this.smoothTransition(
        currentMood.dominance,
        currentMood.dominance + (targetMoodShift.dominance || 0),
        moodInertia
      ),
    };

    // Clamp values
    newMood.valence = Math.max(-1, Math.min(1, newMood.valence));
    newMood.arousal = Math.max(0, Math.min(1, newMood.arousal));
    newMood.dominance = Math.max(0, Math.min(1, newMood.dominance));

    return newMood;
  }

  /**
   * Smooth transition between values
   */
  private smoothTransition(current: number, target: number, inertia: number): number {
    return current * inertia + target * (1 - inertia);
  }

  /**
   * Calculate dynamic decay rate based on personality
   * High neuroticism → emotions last longer
   */
  calculateDecayRate(baseDecayRate: number, personality: BigFiveTraits): number {
    // High neuroticism = emotions persist longer (slower decay)
    const neuroticismFactor = 1 - (personality.neuroticism / 100) * 0.5;

    // High extraversion = faster emotional changes
    const extraversionFactor = 1 + (personality.extraversion / 100) * 0.3;

    return baseDecayRate * neuroticismFactor * extraversionFactor;
  }

  /**
   * Calculate dynamic inertia based on personality
   * High neuroticism + negative event = more resistance to positive change
   */
  calculateDynamicInertia(
    baseInertia: number,
    personality: BigFiveTraits,
    currentMoodValence: number,
    targetMoodValence: number
  ): number {
    let dynamicInertia = baseInertia;

    // If in negative mood and high neuroticism, harder to escape
    if (currentMoodValence < -0.3 && personality.neuroticism > 60) {
      const neuroticismBoost = (personality.neuroticism / 100) * 0.3;
      dynamicInertia += neuroticismBoost;
    }

    // If very happy and something bad happens, more abrupt decline (less inertia)
    if (currentMoodValence > 0.5 && targetMoodValence < -0.5) {
      dynamicInertia *= 0.7; // Less resistance to negative change
    }

    return Math.max(0, Math.min(0.95, dynamicInertia));
  }

  /**
   * Generate spontaneous mood fluctuations (human-like)
   * Occasionally, without apparent reason, mood fluctuates slightly
   */
  generateSpontaneousFluctuation(
    currentMood: PADMood,
    fluctuationProbability: number = 0.05
  ): PADMood {
    if (Math.random() > fluctuationProbability) {
      return currentMood; // No fluctuation
    }

    // Small random fluctuation
    const fluctuationMagnitude = 0.1;

    return {
      valence: Math.max(
        -1,
        Math.min(
          1,
          currentMood.valence + (Math.random() - 0.5) * fluctuationMagnitude
        )
      ),
      arousal: Math.max(
        0,
        Math.min(
          1,
          currentMood.arousal + (Math.random() - 0.5) * fluctuationMagnitude
        )
      ),
      dominance: currentMood.dominance, // Dominance more stable
    };
  }

  /**
   * Update complete emotional system
   */
  updateEmotionalSystem(params: {
    currentEmotions: EmotionState;
    newEmotions: EmotionState;
    baselineEmotions: EmotionState;
    currentMood: PADMood;
    targetMoodShift: Partial<PADMood>;
    dynamics: EmotionDynamics;
    personality: BigFiveTraits;
    deltaTimeMinutes?: number;
  }): {
    emotions: EmotionState;
    mood: PADMood;
  } {
    const {
      currentEmotions,
      newEmotions,
      baselineEmotions,
      currentMood,
      targetMoodShift,
      dynamics,
      personality,
      deltaTimeMinutes = 0, // 0 = immediate update without temporal decay
    } = params;

    // 1. Apply decay if time has passed
    let workingEmotions = currentEmotions;
    if (deltaTimeMinutes > 0) {
      workingEmotions = this.applyDecay(
        currentEmotions,
        baselineEmotions,
        dynamics.decayRate,
        deltaTimeMinutes
      );
    }

    // 2. Blend with new emotions using inertia
    const dynamicInertia = this.calculateDynamicInertia(
      dynamics.inertia,
      personality,
      currentMood.valence,
      currentMood.valence + (targetMoodShift.valence || 0)
    );

    const blendedEmotions = this.applyInertia(
      workingEmotions,
      newEmotions,
      dynamicInertia
    );

    // 3. Update mood with inertia
    const updatedMood = this.updateMoodWithInertia(
      currentMood,
      targetMoodShift,
      0.7 // Mood has high inertia
    );

    // 4. Occasionally add spontaneous fluctuation
    const finalMood = this.generateSpontaneousFluctuation(updatedMood, 0.05);

    return {
      emotions: blendedEmotions,
      mood: finalMood,
    };
  }
}
