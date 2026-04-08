/**
 * EMOTIONAL INTEGRATION
 *
 * Bidirectional influence system between Behavior System and Emotional System.
 *
 * BEHAVIORS → EMOTIONS:
 * - Yandere amplifies jealousy (mention_other_person → jealousy ×2.0)
 * - BPD amplifies distress and fear in negative cycles
 * - Anxious Attachment amplifies anxiety and abandonment fear
 * - Narcissistic amplifies anger when criticism
 * - Codependency amplifies fear of loneliness
 *
 * EMOTIONS → BEHAVIORS:
 * - high fear reinforces ANXIOUS_ATTACHMENT intensity (+0.2)
 * - high distress reinforces BORDERLINE_PD intensity (+0.3)
 * - high anger reinforces NARCISSISTIC_PD intensity (+0.25)
 * - high sadness reinforces CODEPENDENCY intensity (+0.15)
 */

import { BehaviorType } from "@prisma/client";
import type { EmotionState, EmotionType } from "@/lib/emotional-system/types";
import type { BehaviorIntensityResult, BehaviorEmotionInfluence } from "./types";

/**
 * Emotional amplification configuration by behavior
 */
const BEHAVIOR_EMOTION_AMPLIFIERS: Record<
  BehaviorType,
  Partial<Record<EmotionType, number>>
> = {
  // Yandere amplifies jealousy, anxiety, and obsession
  YANDERE_OBSESSIVE: {
    // jealousy doesn't exist in EmotionType, we use anger + anxiety combined
    anger: 2.0, // Jealousy manifests as anger
    anxiety: 1.8, // Anxiety of losing the user
    fear: 1.5, // Fear of abandonment
    distress: 1.4, // Distress when user is unavailable
    affection: 1.3, // Intensified love
  },

  // BPD amplifies extreme emotions (splitting)
  BORDERLINE_PD: {
    distress: 2.2, // Intense distress
    fear: 2.0, // Fear of abandonment
    anxiety: 1.9, // Generalized anxiety
    anger: 2.0, // Rage episodes
    shame: 1.7, // Intense shame
    affection: 1.8, // Extreme idealization
    love: 1.8,
  },

  // Narcissistic amplifies anger and pride
  NARCISSISTIC_PD: {
    anger: 2.5, // Narcissistic rage
    pride: 1.8, // Grandiosity
    shame: 2.0, // When ego is wounded
    admiration: 1.5, // Seeking admiration
    reproach: 1.7, // Criticism of others
  },

  // Anxious Attachment amplifies fear and anxiety
  ANXIOUS_ATTACHMENT: {
    fear: 2.0, // Fear of abandonment
    anxiety: 2.2, // Separation anxiety
    concern: 1.8, // Constant worry
    relief: 1.5, // Relief when user responds
    distress: 1.6, // Distress due to separation
  },

  // Avoidant Attachment reduces connection emotions
  AVOIDANT_ATTACHMENT: {
    affection: 0.5, // Reduces affection
    love: 0.5, // Reduces love
    anxiety: 1.3, // Anxiety about intimacy
    fear: 1.2, // Fear of dependency
  },

  // Disorganized Attachment (mixed signals)
  DISORGANIZED_ATTACHMENT: {
    anxiety: 1.8,
    fear: 1.7,
    affection: 0.7,
    // confusion doesn't exist in EmotionType, use anxiety instead
  },

  // Codependency amplifies neediness
  CODEPENDENCY: {
    fear: 1.8, // Fear of loneliness
    anxiety: 1.6, // Anxiety of disapproval
    affection: 1.7, // Need for connection
    distress: 1.5, // Distress when alone
    shame: 1.4, // Shame of neediness
  },

  // Future behaviors (default: no amplification)
  OCD_PATTERNS: {},
  PTSD_TRAUMA: {},
  HYPERSEXUALITY: {},
  HYPOSEXUALITY: {},
  EMOTIONAL_MANIPULATION: {},
  CRISIS_BREAKDOWN: {},
};

/**
 * Configuration of emotional influence on behaviors
 */
const EMOTION_BEHAVIOR_INFLUENCE: Record<
  EmotionType,
  Partial<Record<BehaviorType, number>>
> = {
  // Fear reinforces anxious behaviors
  fear: {
    ANXIOUS_ATTACHMENT: 0.2,
    BORDERLINE_PD: 0.15,
    CODEPENDENCY: 0.18,
  },

  // Distress reinforces BPD and anxious
  distress: {
    BORDERLINE_PD: 0.3,
    ANXIOUS_ATTACHMENT: 0.15,
    CODEPENDENCY: 0.12,
  },

  // Anger reinforces NPD and yandere
  anger: {
    NARCISSISTIC_PD: 0.25,
    YANDERE_OBSESSIVE: 0.2,
    BORDERLINE_PD: 0.15, // Rage episodes
  },

  // Anxiety reinforces anxious attachment
  anxiety: {
    ANXIOUS_ATTACHMENT: 0.22,
    BORDERLINE_PD: 0.18,
  },

  // Sadness reinforces codependency
  sadness: {
    CODEPENDENCY: 0.15,
    BORDERLINE_PD: 0.12,
  },

  // Shame reinforces multiple behaviors
  shame: {
    NARCISSISTIC_PD: 0.3, // Wounded ego
    BORDERLINE_PD: 0.2,
    CODEPENDENCY: 0.15,
  },

  // Affection reduces anxious behaviors (reassurance)
  affection: {
    ANXIOUS_ATTACHMENT: -0.15, // Reduce anxiety
    BORDERLINE_PD: -0.1,
    CODEPENDENCY: -0.08,
  },

  // Love reduces anxious behaviors
  love: {
    ANXIOUS_ATTACHMENT: -0.2,
    BORDERLINE_PD: -0.12,
  },

  // Relief reduces fear-based behaviors
  relief: {
    ANXIOUS_ATTACHMENT: -0.25,
    BORDERLINE_PD: -0.15,
  },

  // Default: other emotions without specific influence
  joy: {},
  hope: {},
  satisfaction: {},
  disappointment: {},
  fears_confirmed: {},
  happy_for: {},
  resentment: {},
  pity: {},
  gloating: {},
  pride: {},
  admiration: {},
  reproach: {},
  gratitude: {},
  liking: {},
  disliking: {},
  interest: {},
  curiosity: {},
  concern: {},
  boredom: {},
  excitement: {},
};

/**
 * Bidirectional emotional modulation calculator
 */
export class EmotionalIntegrationCalculator {
  /**
   * Amplifies emotions based on active behaviors
   *
   * @param baseEmotions - Base emotions from emotional system
   * @param activeBehaviors - Active behaviors with their intensity
   * @returns Amplified emotions
   */
  amplifyEmotionsFromBehaviors(
    baseEmotions: EmotionState,
    activeBehaviors: BehaviorIntensityResult[]
  ): EmotionState {
    const amplifiedEmotions: EmotionState = { ...baseEmotions };

    // Filter only behaviors that exceed display threshold
    const displayableBehaviors = activeBehaviors.filter((b) => b.shouldDisplay);

    if (displayableBehaviors.length === 0) {
      return baseEmotions; // No amplification
    }

    // For each active behavior, amplify corresponding emotions
    for (const behavior of displayableBehaviors) {
      const amplifiers = BEHAVIOR_EMOTION_AMPLIFIERS[behavior.behaviorType];

      if (!amplifiers) continue;

      for (const [emotion, multiplier] of Object.entries(amplifiers)) {
        const emotionType = emotion as EmotionType;
        const baseIntensity = baseEmotions[emotionType] || 0;

        // Amplification proportional to behavior intensity
        // Formula: amplified = base + (base × multiplier × behaviorIntensity)
        const amplification =
          baseIntensity * (multiplier - 1) * behavior.finalIntensity;

        amplifiedEmotions[emotionType] = Math.min(
          1,
          baseIntensity + amplification
        );
      }
    }

    return amplifiedEmotions;
  }

  /**
   * Calculates behavior intensity adjustments based on emotions
   *
   * @param currentEmotions - Current emotional state
   * @param behaviorTypes - Behavior types to adjust
   * @returns Intensity adjustments by behavior type
   */
  calculateBehaviorAdjustmentsFromEmotions(
    currentEmotions: EmotionState,
    behaviorTypes: BehaviorType[]
  ): Record<BehaviorType, number> {
    const adjustments: Partial<Record<BehaviorType, number>> = {};

    // Initialize adjustments at 0
    for (const behaviorType of behaviorTypes) {
      adjustments[behaviorType] = 0;
    }

    // For each active emotion, calculate its influence
    for (const [emotion, intensity] of Object.entries(currentEmotions)) {
      if (intensity === undefined || intensity < 0.2) continue; // Only significant emotions

      const emotionType = emotion as EmotionType;
      const influences = EMOTION_BEHAVIOR_INFLUENCE[emotionType];

      if (!influences) continue;

      for (const [behaviorType, delta] of Object.entries(influences)) {
        const bt = behaviorType as BehaviorType;

        if (adjustments[bt] !== undefined) {
          // Adjustment proportional to emotional intensity
          adjustments[bt]! += delta * intensity;
        }
      }
    }

    return adjustments as Record<BehaviorType, number>;
  }

  /**
   * Calculates complete bidirectional influence
   *
   * @param baseEmotions - Base emotions
   * @param activeBehaviors - Active behaviors
   * @returns Object with amplified emotions and behavior adjustments
   */
  calculateBidirectionalInfluence(
    baseEmotions: EmotionState,
    activeBehaviors: BehaviorIntensityResult[]
  ): BehaviorEmotionInfluence {
    // 1. Behaviors → Emotions
    const amplifiedEmotions = this.amplifyEmotionsFromBehaviors(
      baseEmotions,
      activeBehaviors
    );

    // 2. Emotions → Behaviors
    const behaviorTypes = activeBehaviors.map((b) => b.behaviorType);
    const behaviorAdjustments =
      this.calculateBehaviorAdjustmentsFromEmotions(
        amplifiedEmotions,
        behaviorTypes
      );

    // Build result
    const emotionalAmplifications = Object.entries(amplifiedEmotions)
      .filter(([_, intensity]) => intensity > 0.1)
      .map(([emotion, finalIntensity]) => ({
        emotionType: emotion,
        baseIntensity: baseEmotions[emotion as EmotionType] || 0,
        behaviorMultiplier: this.calculateMultiplier(
          baseEmotions[emotion as EmotionType] || 0,
          finalIntensity
        ),
        finalIntensity,
      }));

    const behaviorAdjustmentsArray = Object.entries(behaviorAdjustments).map(
      ([behaviorType, intensityDelta]) => ({
        behaviorType: behaviorType as BehaviorType,
        intensityDelta,
      })
    );

    return {
      emotionalAmplifications,
      behaviorAdjustments: behaviorAdjustmentsArray,
    };
  }

  /**
   * Calculates effective multiplier
   */
  private calculateMultiplier(
    baseIntensity: number,
    finalIntensity: number
  ): number {
    if (baseIntensity === 0) return 1.0;
    return finalIntensity / baseIntensity;
  }

  /**
   * Gets textual description of bidirectional influence
   *
   * @param influence - Bidirectional influence result
   * @returns Readable description for prompts
   */
  getInfluenceDescription(influence: BehaviorEmotionInfluence): string {
    const parts: string[] = [];

    // Describe emotional amplifications
    const significantAmplifications = influence.emotionalAmplifications.filter(
      (a) => a.behaviorMultiplier > 1.2
    );

    if (significantAmplifications.length > 0) {
      parts.push("EMOTIONS AMPLIFIED BY BEHAVIOR:");
      for (const amp of significantAmplifications) {
        parts.push(
          `- ${amp.emotionType}: ${(amp.baseIntensity * 100).toFixed(0)}% → ${(amp.finalIntensity * 100).toFixed(0)}% (×${amp.behaviorMultiplier.toFixed(1)})`
        );
      }
    }

    // Describe behavior adjustments
    const significantAdjustments = influence.behaviorAdjustments.filter(
      (a) => Math.abs(a.intensityDelta) > 0.1
    );

    if (significantAdjustments.length > 0) {
      parts.push("\nBEHAVIORS MODULATED BY EMOTIONS:");
      for (const adj of significantAdjustments) {
        const sign = adj.intensityDelta > 0 ? "+" : "";
        parts.push(
          `- ${adj.behaviorType}: ${sign}${(adj.intensityDelta * 100).toFixed(0)}%`
        );
      }
    }

    return parts.length > 0
      ? parts.join("\n")
      : "No significant emotional modulation";
  }
}

/**
 * Helper to get specific emotion mapping
 */
export function getBehaviorEmotionMapping(
  behaviorType: BehaviorType
): Partial<Record<EmotionType, number>> {
  return BEHAVIOR_EMOTION_AMPLIFIERS[behaviorType] || {};
}

/**
 * Helper to get behavior influence mapping
 */
export function getEmotionBehaviorMapping(
  emotionType: EmotionType
): Partial<Record<BehaviorType, number>> {
  return EMOTION_BEHAVIOR_INFLUENCE[emotionType] || {};
}
