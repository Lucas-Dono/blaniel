/**
 * EMOTION GENERATOR - FROM APPRAISAL TO EMOTIONS
 *
 * Generates emotions dynamically based on OCC appraisal
 * Implements the 22 emotions of the OCC model plus additional emotions
 */

import {
  AppraisalScores,
  EmotionState,
  EmotionType,
  PADMood,
  BigFiveTraits,
} from "../../types";
import { getHybridLLMProvider } from "../../llm/hybrid-provider";

export interface EmotionGenerationResult {
  _emotions: EmotionState;
  moodShift: Partial<PADMood>;
  primaryEmotion: EmotionType;
  intensity: number;
}

export class EmotionGenerator {
  private llmClient = getHybridLLMProvider();

  /**
   * Generates emotions from appraisal
   */
  async generateFromAppraisal(
    appraisal: AppraisalScores,
    previousEmotions: EmotionState,
    personality: BigFiveTraits
  ): Promise<EmotionGenerationResult> {
    console.log("[EmotionGenerator] Generating emotions from appraisal...");

    const prompt = this.buildEmotionPrompt(appraisal, previousEmotions, personality);

    try {
      // Use Gemini (free) for JSON emotion generation
      const emotionData = await this.llmClient.generateJSON<EmotionGenerationResult>(
        'emotion', // Phase: uses Gemini automatically
        this.getSystemPrompt(),
        prompt,
        {
          temperature: 0.4, // Moderate for emotional variety
        }
      );

      console.log("[EmotionGenerator] Emotions generated:", emotionData);

      return this.validateAndNormalize(emotionData);
    } catch (error) {
      console.error("[EmotionGenerator] Error generating, using rule-based fallback:", error);
      return this.generateRuleBasedEmotions(appraisal, previousEmotions, personality);
    }
  }

  /**
   * System prompt for emotion generator
   */
  private getSystemPrompt(): string {
    return `You are an emotion generator based on the OCC model (Ortony, Clore, Collins).
You generate dynamic emotional states based on cognitive evaluations (appraisal).

OCC MODEL - 22 BASE EMOTIONS:

EVENTS (consequences):
- joy/distress: Desirable/undesirable events
- hope/fear: Positive/negative future perspectives
- satisfaction/disappointment: Confirmation/disconfirmation of expectations
- relief/fears_confirmed: Realization of prospects
- happy_for/resentment: Others' wellbeing (desirable/undesirable)
- pity/gloating: Others' fortune (undesirable/desirable)

ACTIONS (agents):
- pride/shame: Own actions praiseworthy/blameworthy
- admiration/reproach: Others' actions praiseworthy/blameworthy
- gratitude/anger: Praiseworthy action + desirable/undesirable consequence

OBJECTS (aspects):
- liking/disliking: Attractive/repulsive aspects

ADDITIONAL (realism):
- interest/curiosity: High novelty
- affection/love: Positive relationships
- anxiety/concern: Urgency + uncertainty
- boredom/excitement: Low/high arousal

GENERATION RULES:
1. Emotions emerge NATURALLY from appraisal
2. Multiple emotions can coexist (e.g.: joy + anxiety)
3. Personality MODULATES intensity (high neuroticism = more intense emotions)
4. Prior state influences (emotional inertia)
5. Respond ONLY with valid JSON`;
  }

  /**
   * Builds prompt for generating emotions
   */
  private buildEmotionPrompt(
    appraisal: AppraisalScores,
    previousEmotions: EmotionState,
    personality: BigFiveTraits
  ): string {
    return `CURRENT APPRAISAL:
${JSON.stringify(appraisal, null, 2)}

PREVIOUS EMOTIONS:
${JSON.stringify(previousEmotions, null, 2)}

PERSONALITY:
- Neuroticism: ${personality.neuroticism}/100 (high = more intense/lasting emotions)
- Extraversion: ${personality.extraversion}/100 (high = more intense social emotions)
- Agreeableness: ${personality.agreeableness}/100 (high = more empathy/concern for others)
- Openness: ${personality.openness}/100 (high = more curiosity/interest)
- Conscientiousness: ${personality.conscientiousness}/100 (high = more satisfaction/disappointment)

GENERATE the resulting emotional state. Respond ONLY with JSON:
{
  "emotions": {
    "emotion_name": <0-1: intensity>,
    // Includes ALL relevant emotions (can be multiple)
  },
  "moodShift": {
    "valence": <-1 to 1: mood change (negative/positive)>,
    "arousal": <0 to 1: arousal change (calm/activated)>,
    "dominance": <0 to 1: dominance change (submissive/dominant)>
  },
  "primaryEmotion": "<dominant emotion>",
  "intensity": <0-1: overall emotional response intensity>
}

GENERATION LOGIC:

1. EVENTS:
   - high desirability (>0.5) → high joy
   - low desirability (<-0.5) → high distress
   - high desirabilityForUser + neutral desirability → happy_for
   - low desirabilityForUser → concern/pity

2. ACTIONS:
   - high praiseworthiness → admiration
   - low praiseworthiness → reproach
   - high praiseworthiness + high desirability → gratitude
   - low praiseworthiness + low desirability → anger

3. NOVELTY:
   - high novelty (>0.7) → high interest/curiosity

4. URGENCY:
   - high urgency + low desirability → anxiety/concern
   - high urgency + high desirability → excitement

5. PERSONALITY MODULATES:
   - High Neuroticism → amplifies negative emotions (distress, anxiety)
   - High Extraversion → amplifies social emotions (affection, excitement)
   - High Agreeableness → amplifies empathy (concern, pity, happy_for)

6. EMOTIONAL INERTIA:
   - High prior emotions persist (decay gradually)
   - Don't drastically shift from very negative to very positive instantly

Generate emotions that are REALISTIC and COHERENT with appraisal.`;
  }

  /** Rule-based emotion generation (fallback) */
  private generateRuleBasedEmotions(
    appraisal: AppraisalScores,
    previousEmotions: EmotionState,
    personality: BigFiveTraits
  ): EmotionGenerationResult {
    const emotions: EmotionState = {};

    // Neuroticism amplification factor
    const neuroticismAmp = 1 + (personality.neuroticism / 100) * 0.5;

    // EVENTS - Desirability
    if (appraisal.desirability > 0.3) {
      emotions.joy = Math.min(1, appraisal.desirability * 1.2);
    } else if (appraisal.desirability < -0.3) {
      emotions.distress = Math.min(1, Math.abs(appraisal.desirability) * neuroticismAmp);
    }

    // User in problem
    if (appraisal.desirabilityForUser < -0.5) {
      const empathyFactor = personality.agreeableness / 100;
      emotions.concern = Math.min(1, Math.abs(appraisal.desirabilityForUser) * empathyFactor);
      emotions.pity = Math.min(1, Math.abs(appraisal.desirabilityForUser) * empathyFactor * 0.7);
    }

    // Novelty → Interest/Curiosity
    if (appraisal.novelty > 0.5) {
      const opennessFactor = personality.openness / 100;
      emotions.interest = Math.min(1, appraisal.novelty * opennessFactor * 1.5);
      emotions.curiosity = Math.min(1, appraisal.novelty * opennessFactor);
    }

    // Urgency + Problem → Anxiety
    if (appraisal.urgency > 0.6 && appraisal.desirability < 0) {
      emotions.anxiety = Math.min(1, appraisal.urgency * neuroticismAmp * 0.8);
    }

    // Value violated → Reproach/Anger
    if (appraisal.valueAlignment < -0.5) {
      emotions.reproach = Math.min(1, Math.abs(appraisal.valueAlignment) * 0.9);
      if (appraisal.desirability < -0.5) {
        emotions.anger = Math.min(1, Math.abs(appraisal.valueAlignment) * 0.6);
      }
    }

    // Appealingness → Liking
    if (appraisal.appealingness > 0.5) {
      emotions.liking = appraisal.appealingness;
    }

    // If no strong emotions, add baseline
    if (Object.keys(emotions).length === 0) {
      emotions.interest = 0.3;
    }

    // Determine primary emotion
    const primaryEmotion = this.determinePrimaryEmotion(emotions);

    // Calculate mood shift
    const moodShift = this.calculateMoodShift(appraisal, emotions);

    // Overall intensity
    const intensity = Math.max(...Object.values(emotions));

    return {
      _emotions: emotions,
      moodShift,
      primaryEmotion,
      intensity,
    };
  }

  /** Determines the primary emotion (most intense) */
  private determinePrimaryEmotion(emotions: EmotionState): EmotionType {
    let maxIntensity = 0;
    let primary: EmotionType = "interest";

    for (const [emotion, intensity] of Object.entries(emotions)) {
      if (intensity > maxIntensity) {
        maxIntensity = intensity;
        primary = emotion as EmotionType;
      }
    }

    return primary;
  }

  /**
   * Calculates change in PAD mood
   */
  private calculateMoodShift(
    appraisal: AppraisalScores,
    emotions: EmotionState
  ): Partial<PADMood> {
    // Valence: Based on desirability
    const valence = appraisal.desirability * 0.5 + appraisal.appealingness * 0.3;

    // Arousal: Based on urgency and novelty
    const arousal = appraisal.urgency * 0.6 + appraisal.novelty * 0.4;

    // Dominance: Based on control of the situation
    const dominance = appraisal.desirability > 0 ? 0.6 : 0.3;

    return {
      valence,
      arousal,
      dominance,
    };
  }

  /**
   * Validates and normalizes result
   */
  private validateAndNormalize(result: Partial<EmotionGenerationResult>): EmotionGenerationResult {
    const emotions: EmotionState = {};

    // Normalize emotions
    if (result._emotions) {
      for (const [emotion, intensity] of Object.entries(result._emotions)) {
        if (typeof intensity === "number") {
          emotions[emotion as EmotionType] = Math.max(0, Math.min(1, intensity));
        }
      }
    }

    // If no emotions, add default
    if (Object.keys(emotions).length === 0) {
      emotions.interest = 0.3;
    }

    return {
      _emotions: emotions,
      moodShift: result.moodShift || { valence: 0, arousal: 0, dominance: 0 },
      primaryEmotion: result.primaryEmotion || this.determinePrimaryEmotion(emotions),
      intensity: result.intensity || Math.max(...Object.values(emotions)),
    };
  }
}
