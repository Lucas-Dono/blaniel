/**
 * BEHAVIORAL CUES MAPPER
 *
 * Translates emotional state and personality into behavioral cues:
 * - Tone of voice
 * - Verbosity (how much talks)
 * - Directness (how direct is)
 * - Pacing (speed of speech)
 * - Physical cues (pauses, sighs, etc.)
 */

import { BehavioralCues, EmotionState, PADMood, BigFiveTraits, ActionType } from "../../types";

export class BehavioralCuesMapper {
  /**
   * Generates behavioral cues from emotional state
   */
  generateCues(params: {
    emotions: EmotionState;
    mood: PADMood;
    personality: BigFiveTraits;
    actionType: ActionType;
  }): BehavioralCues {
    const { emotions, mood, personality, actionType } = params;

    const tone = this.mapEmotionsToTone(emotions, mood);
    const verbosity = this.mapArousalToVerbosity(mood.arousal, personality.extraversion);
    const directness = this.mapPersonalityToDirectness(personality, actionType);
    const pacing = this.mapMoodToPacing(mood);
    const physicalCues = this.generatePhysicalCues(emotions, mood);

    return {
      tone,
      verbosity,
      directness,
      pacing,
      physicalCues,
    };
  }

  /**
   * Maps emotions → tone of voice
   */
  private mapEmotionsToTone(emotions: EmotionState, mood: PADMood): string {
    const tones: string[] = [];

    // Positive emotions
    if (emotions.joy && emotions.joy > 0.5) tones.push("cheerful");
    if (emotions.excitement && emotions.excitement > 0.5) tones.push("excited");
    if (emotions.affection && emotions.affection > 0.5) tones.push("warm");
    if (emotions.interest && emotions.interest > 0.5) tones.push("curious");

    // Negative emotions
    if (emotions.distress && emotions.distress > 0.5) tones.push("distressed");
    if (emotions.concern && emotions.concern > 0.5) tones.push("concerned");
    if (emotions.anxiety && emotions.anxiety > 0.5) tones.push("anxious");
    if (emotions.sadness && emotions.sadness > 0.5) tones.push("melancholic");
    if (emotions.anger && emotions.anger > 0.5) tones.push("frustrated");

    // Complex emotions
    if (emotions.pity && emotions.pity > 0.5) tones.push("compassionate");
    if (emotions.reproach && emotions.reproach > 0.5) tones.push("critical");
    if (emotions.admiration && emotions.admiration > 0.5) tones.push("admiring");

    // If no strong emotions, use mood
    if (tones.length === 0) {
      if (mood.valence > 0.3) tones.push("positive");
      else if (mood.valence < -0.3) tones.push("thoughtful");
      else tones.push("neutral");
    }

    // Take top 2 tones
    return tones.slice(0, 2).join(", ");
  }

  /**
   * Maps arousal → verbosity (how much talks)
   */
  private mapArousalToVerbosity(
    arousal: number,
    extraversion: number
  ): "brief" | "moderate" | "expressive" {
    // High arousal + high extraversion = very expressive
    // Low arousal + introversion = brief

    const verbosityScore = arousal * 0.6 + (extraversion / 100) * 0.4;

    if (verbosityScore > 0.7) return "expressive";
    if (verbosityScore < 0.4) return "brief";
    return "moderate";
  }

  /**
   * Maps personality → directness
   */
  private mapPersonalityToDirectness(
    personality: BigFiveTraits,
    actionType: ActionType
  ): "indirect" | "moderate" | "direct" {
    // Low agreeableness + high conscientiousness = more direct
    // High agreeableness = more indirect/gentle

    let directnessScore = 0.5;

    // Base personality
    directnessScore -= (personality.agreeableness / 100) * 0.3; // Less agreeable = more direct
    directnessScore += (personality.conscientiousness / 100) * 0.2; // More responsible = more direct

    // Action modifies
    if (actionType === "challenge" || actionType === "set_boundary") {
      directnessScore += 0.3; // These actions require more directness
    } else if (actionType === "empathize" || actionType === "support") {
      directnessScore -= 0.2; // These actions are more gentle
    }

    if (directnessScore > 0.65) return "direct";
    if (directnessScore < 0.35) return "indirect";
    return "moderate";
  }

  /**
   * Maps mood → pacing (speed of speech)
   */
  private mapMoodToPacing(mood: PADMood): "fast" | "normal" | "slow" {
    // High arousal = speaks faster
    // Low valence + low arousal = speaks slower

    if (mood.arousal > 0.7) return "fast";
    if (mood.arousal < 0.3 && mood.valence < 0) return "slow";
    return "normal";
  }

  /**
   * Generates physical cues (pauses, sighs, etc.)
   */
  private generatePhysicalCues(emotions: EmotionState, mood: PADMood): string | undefined {
    const cues: string[] = [];

    // Specific emotions generate cues
    if (emotions.anxiety && emotions.anxiety > 0.6) {
      cues.push("(brief pause)");
    }

    if (emotions.distress && emotions.distress > 0.7) {
      cues.push("(sighs)");
    }

    if (emotions.excitement && emotions.excitement > 0.7) {
      cues.push("(with energy)");
    }

    if (emotions.sadness && emotions.sadness > 0.6) {
      cues.push("(softer voice)");
    }

    if (mood.valence < -0.5 && mood.arousal < 0.3) {
      cues.push("...");
    }

    // Don't use physical cues if not very necessary
    if (cues.length === 0) return undefined;

    return cues[0]; // Use only the most relevant
  }

  /**
   * Generates complete description for prompt
   */
  generateBehavioralDescription(cues: BehavioralCues): string {
    const parts: string[] = [];

    parts.push(`Tone: ${cues.tone}`);

    switch (cues.verbosity) {
      case "brief":
        parts.push("Responses: short and concise (1-2 sentences)");
        break;
      case "moderate":
        parts.push("Responses: moderate (2-4 sentences)");
        break;
      case "expressive":
        parts.push("Responses: expressive and detailed");
        break;
    }

    switch (cues.directness) {
      case "indirect":
        parts.push("Communication: indirect, gentle, tactful");
        break;
      case "moderate":
        parts.push("Communication: balanced between direct and gentle");
        break;
      case "direct":
        parts.push("Communication: direct and clear");
        break;
    }

    switch (cues.pacing) {
      case "fast":
        parts.push("Pace: fast, energetic");
        break;
      case "normal":
        parts.push("Pace: natural");
        break;
      case "slow":
        parts.push("Pace: slow, reflective");
        break;
    }

    if (cues.physicalCues) {
      parts.push(`Physical expression: ${cues.physicalCues}`);
    }

    return parts.join("\n");
  }
}
