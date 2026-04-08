/**
 * DYAD CALCULATOR
 *
 * Calculates the 20 secondary emotions (dyads) of Plutchik
 * based on the state of primary emotions.
 *
 * Based on Robert Plutchik's research on
 * emotional combinations and affective psychology.
 */

import {
  PrimaryEmotion,
  PlutchikEmotionState,
  SecondaryEmotion,
} from "@/lib/emotions/plutchik";

export interface DyadResult {
  name: SecondaryEmotion;
  label: string;
  intensity: number; // 0-1
  components: [PrimaryEmotion, number, PrimaryEmotion, number]; // [emotion1, intensity1, emotion2, intensity2]
  type: "primary" | "secondary" | "tertiary";
}

/**
 * Configuration of dyads with their components
 */
interface DyadDefinition {
  name: SecondaryEmotion;
  label: string;
  components: [PrimaryEmotion, PrimaryEmotion];
  type: "primary" | "secondary" | "tertiary";
  description: string;
}

const DYAD_DEFINITIONS: DyadDefinition[] = [
  // PRIMARY DYADS (adjacent on the wheel)
  {
    name: "love",
    label: "Amor",
    components: ["joy", "trust"],
    type: "primary",
    description: "Joy + Trust = Love/Deep Affection",
  },
  {
    name: "submission",
    label: "Sumisión",
    components: ["trust", "fear"],
    type: "primary",
    description: "Trust + Fear = Respect/Obedience",
  },
  {
    name: "alarm",
    label: "Alarma",
    components: ["fear", "surprise"],
    type: "primary",
    description: "Fear + Surprise = Startle/Alarm",
  },
  {
    name: "disappointment",
    label: "Decepción",
    components: ["surprise", "sadness"],
    type: "primary",
    description: "Surprise + Sadness = Disappointment/Broken Expectations",
  },
  {
    name: "remorse",
    label: "Remordimiento",
    components: ["sadness", "disgust"],
    type: "primary",
    description: "Sadness + Disgust = Remorse/Self-Contempt",
  },
  {
    name: "contempt",
    label: "Desprecio",
    components: ["disgust", "anger"],
    type: "primary",
    description: "Disgust + Anger = Contempt/Disdain",
  },
  {
    name: "aggression",
    label: "Agresividad",
    components: ["anger", "anticipation"],
    type: "primary",
    description: "Anger + Anticipation = Directed Aggression",
  },
  {
    name: "optimism",
    label: "Optimismo",
    components: ["anticipation", "joy"],
    type: "primary",
    description: "Anticipation + Joy = Optimism/Hope",
  },

  // SECONDARY DYADS (separated by one emotion)
  {
    name: "guilt",
    label: "Culpa",
    components: ["joy", "fear"],
    type: "secondary",
    description: "Joy + Fear = Guilt (pleasure with anxiety)",
  },
  {
    name: "curiosity",
    label: "Curiosidad",
    components: ["trust", "surprise"],
    type: "secondary",
    description: "Trust + Surprise = Curiosity (openness to discovery)",
  },
  {
    name: "despair",
    label: "Desesperación",
    components: ["fear", "sadness"],
    type: "secondary",
    description: "Fear + Sadness = Despair (hopelessness)",
  },
  {
    name: "envy",
    label: "Envidia",
    components: ["surprise", "disgust"],
    type: "secondary",
    description: "Surprise + Disgust = Envy (unpleasant discovery)",
  },
  {
    name: "cynicism",
    label: "Cinismo",
    components: ["sadness", "anger"],
    type: "secondary",
    description: "Sadness + Anger = Cynicism/Resentment",
  },
  {
    name: "pride",
    label: "Orgullo",
    components: ["disgust", "anticipation"],
    type: "secondary",
    description: "Disgust toward others + Anticipation = Pride/Arrogance",
  },
  {
    name: "hope",
    label: "Esperanza",
    components: ["anger", "joy"],
    type: "secondary",
    description: "Anger + Joy = Hope/Positive Determination",
  },
  {
    name: "anxiety",
    label: "Ansiedad",
    components: ["anticipation", "trust"],
    type: "secondary",
    description: "Anticipation + Trust = Anticipatory Anxiety",
  },

  // TERTIARY DYADS (opposite)
  {
    name: "ambivalence",
    label: "Ambivalencia",
    components: ["joy", "sadness"],
    type: "tertiary",
    description: "Joy + Sadness = Ambivalence (emotional conflict)",
  },
  {
    name: "frozenness",
    label: "Paralización",
    components: ["trust", "disgust"],
    type: "tertiary",
    description: "Trust + Disgust = Decision Paralysis",
  },
  {
    name: "outrage",
    label: "Indignación",
    components: ["fear", "anger"],
    type: "tertiary",
    description: "Fear + Anger = Outrage (fear that becomes wrath)",
  },
  {
    name: "confusion",
    label: "Confusión",
    components: ["surprise", "anticipation"],
    type: "tertiary",
    description: "Surprise + Anticipation = Confusion (contradictory expectations)",
  },
];

export class DyadCalculator {
  /**
   * Minimum threshold to consider a primary emotion
   */
  private readonly MIN_INTENSITY = 0.25;

  /**
   * Minimum threshold for a dyad to be significant
   */
  private readonly MIN_DYAD_INTENSITY = 0.3;

  /**
   * Calculates all active dyads from an emotional state
   */
  calculateDyads(emotionState: PlutchikEmotionState): DyadResult[] {
    const dyads: DyadResult[] = [];

    for (const dyadDef of DYAD_DEFINITIONS) {
      const [emotion1, emotion2] = dyadDef.components;
      const intensity1 = emotionState[emotion1];
      const intensity2 = emotionState[emotion2];

      // Only calculate dyad if both emotions are active
      if (intensity1 >= this.MIN_INTENSITY && intensity2 >= this.MIN_INTENSITY) {
        // Calculate dyad intensity
        // Formula: geometric mean (more conservative than arithmetic)
        // This ensures both emotions must be present
        const dyadIntensity = Math.sqrt(intensity1 * intensity2);

        // Apply weight by dyad type
        let weightedIntensity = dyadIntensity;

        if (dyadDef.type === "primary") {
          // Primary dyads are easier to form (adjacent emotions)
          weightedIntensity *= 1.2;
        } else if (dyadDef.type === "secondary") {
          // Secondary dyads require more intensity
          weightedIntensity *= 1.0;
        } else if (dyadDef.type === "tertiary") {
          // Tertiary dyads (opposite) are harder to form
          // Represent genuine internal conflict
          weightedIntensity *= 0.8;
        }

        // Clamp between 0 and 1
        weightedIntensity = Math.min(1.0, weightedIntensity);

        // Only include if exceeds threshold
        if (weightedIntensity >= this.MIN_DYAD_INTENSITY) {
          dyads.push({
            name: dyadDef.name,
            label: dyadDef.label,
            intensity: weightedIntensity,
            components: [emotion1, intensity1, emotion2, intensity2],
            type: dyadDef.type,
          });
        }
      }
    }

    // Sort by intensity (highest first)
    return dyads.sort((a, b) => b.intensity - a.intensity);
  }

  /**
   * Calculates dyads and returns only top N
   */
  getTopDyads(emotionState: PlutchikEmotionState, limit: number = 3): DyadResult[] {
    const allDyads = this.calculateDyads(emotionState);
    return allDyads.slice(0, limit);
  }

  /**
   * Gets the dominant dyad (most intense)
   */
  getDominantDyad(emotionState: PlutchikEmotionState): DyadResult | null {
    const dyads = this.calculateDyads(emotionState);
    return dyads.length > 0 ? dyads[0] : null;
  }

  /**
   * Checks if a specific dyad is active
   */
  isDyadActive(
    emotionState: PlutchikEmotionState,
    dyadName: SecondaryEmotion
  ): boolean {
    const dyads = this.calculateDyads(emotionState);
    return dyads.some((dyad) => dyad.name === dyadName);
  }

  /**
   * Gets intensity of a specific dyad
   */
  getDyadIntensity(
    emotionState: PlutchikEmotionState,
    dyadName: SecondaryEmotion
  ): number {
    const dyads = this.calculateDyads(emotionState);
    const dyad = dyads.find((d) => d.name === dyadName);
    return dyad ? dyad.intensity : 0;
  }

  /**
   * Generates textual description of active dyads
   */
  describeDyads(emotionState: PlutchikEmotionState): string {
    const dyads = this.getTopDyads(emotionState, 3);

    if (dyads.length === 0) {
      return "No significant secondary emotions";
    }

    return dyads
      .map((dyad) => {
        const intensityPercent = (dyad.intensity * 100).toFixed(0);
        return `${dyad.label} (${intensityPercent}% - ${dyad.components[0]}+${dyad.components[2]})`;
      })
      .join(", ");
  }

  /**
   * Detects emotional conflicts (active tertiary dyads)
   */
  detectEmotionalConflicts(emotionState: PlutchikEmotionState): DyadResult[] {
    const allDyads = this.calculateDyads(emotionState);
    return allDyads.filter((dyad) => dyad.type === "tertiary");
  }

  /**
   * Calculates "emotional stability" based on presence of tertiary dyads
   */
  calculateEmotionalStability(emotionState: PlutchikEmotionState): number {
    const conflicts = this.detectEmotionalConflicts(emotionState);

    if (conflicts.length === 0) {
      return 1.0; // Maximum stability
    }

    // Reduce stability by conflict intensity
    const totalConflict = conflicts.reduce((sum, dyad) => sum + dyad.intensity, 0);
    const stability = Math.max(0, 1.0 - totalConflict);

    return stability;
  }

  /**
   * Generates clinical recommendation based on dyads
   * (useful for disorder simulation)
   */
  getClinicalInsights(emotionState: PlutchikEmotionState): {
    stability: number;
    dominantDyad: DyadResult | null;
    conflicts: DyadResult[];
    recommendation: string;
  } {
    const stability = this.calculateEmotionalStability(emotionState);
    const dominantDyad = this.getDominantDyad(emotionState);
    const conflicts = this.detectEmotionalConflicts(emotionState);

    let recommendation = "";

    if (stability < 0.4) {
      recommendation = "High emotional conflict - consider therapeutic intervention";
    } else if (stability < 0.7) {
      recommendation = "Moderate emotional conflict - monitor";
    } else {
      recommendation = "Relatively stable emotional state";
    }

    // Add insight from dominant dyad
    if (dominantDyad) {
      if (dominantDyad.name === "despair" && dominantDyad.intensity > 0.7) {
        recommendation += " | High despair - risk of clinical depression";
      } else if (dominantDyad.name === "anxiety" && dominantDyad.intensity > 0.7) {
        recommendation += " | High anxiety - possible anxiety disorder";
      } else if (dominantDyad.name === "contempt" && dominantDyad.intensity > 0.7) {
        recommendation += " | High contempt - potential interpersonal conflict";
      }
    }

    return {
      stability,
      dominantDyad,
      conflicts,
      recommendation,
    };
  }
}

/**
 * Singleton instance
 */
export const dyadCalculator = new DyadCalculator();
