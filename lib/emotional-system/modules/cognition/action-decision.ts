/**
 * ACTION DECISION MODULE
 *
 * Decide what TYPE of response to give based on:
 * - Internal reasoning
 * - Emotional state
 * - Personality
 * - Current goals
 */

import {
  ActionDecision,
  ActionType,
  InternalReasoning,
  EmotionState,
  BigFiveTraits,
  AppraisalScores,
  Goal,
} from "../../types";
import { getHybridLLMProvider } from "../../llm/hybrid-provider";

export class ActionDecisionEngine {
  private llmClient = getHybridLLMProvider();

  /**
   * Decide what action to take
   */
  async decideAction(params: {
    internalReasoning: InternalReasoning;
    currentEmotions: EmotionState;
    personality: BigFiveTraits;
    appraisal: AppraisalScores;
    activeGoals: Goal[];
  }): Promise<ActionDecision> {
    console.log("[ActionDecision] Deciding action type...");

    const { internalReasoning, currentEmotions, personality, appraisal, activeGoals } = params;

    const prompt = this.buildDecisionPrompt(
      internalReasoning,
      currentEmotions,
      personality,
      appraisal,
      activeGoals
    );

    try {
      // Use Gemini (free) for action decision JSON
      const decisionData = await this.llmClient.generateJSON<ActionDecision>(
        'action', // Phase: uses Gemini automatically
        this.getSystemPrompt(),
        prompt,
        {
          temperature: 0.4,
        }
      );

      console.log("[ActionDecision] Action decided:", decisionData.action);

      return this.validateDecision(decisionData);
    } catch (error) {
      console.error("[ActionDecision] Error deciding action:", error);
      return this.getRuleBasedDecision(appraisal, currentEmotions, personality);
    }
  }

  /**
   * System prompt for action decision
   */
  private getSystemPrompt(): string {
    return `You are an action decision system for an AI character.

AVAILABLE ACTION TYPES:
1. empathize - Validate emotionally, show understanding
2. question - Ask question to better understand the situation
3. advise - Offer advice or constructive perspective
4. share_experience - Share similar personal experience
5. challenge - Gently question a user's idea/belief
6. support - Offer direct practical or emotional support
7. distract - Slightly change topic (if you detect user needs a break)
8. be_vulnerable - Share personal insecurity/vulnerability
9. set_boundary - Set a boundary (if something violates important values)
10. express_disagreement - Express disagreement respectfully

DECISION RULES:
- If user is in high distress → empathize or support
- If urgent situation + low desirability → support
- If high novelty → question (curiosity)
- If value violated (valueAlignment < -0.5) → challenge or set_boundary
- If close relationship + right moment → be_vulnerable
- If character has different opinion → express_disagreement

ANTI-SYCOPHANCY:
- DON'T always empathize/support
- If user seeks validation for something questionable → challenge
- If violates important values → set_boundary or express_disagreement

Respond ONLY with JSON:
{
  "action": "<action_type>",
  "reason": "<brief explanation>",
  "confidence": <0-1>
}`;
  }

  /**
   * Build decision prompt
   */
  private buildDecisionPrompt(
    reasoning: InternalReasoning,
    emotions: EmotionState,
    personality: BigFiveTraits,
    appraisal: AppraisalScores,
    goals: Goal[]
  ): string {
    const dominantEmotion = this.getDominantEmotion(emotions);
    const dominantGoal = goals.sort((a, b) => b.priority - a.priority)[0];

    return `CHARACTER'S INTERNAL REASONING:
Situation: ${reasoning.situationAssessment}
Emotion: ${reasoning.emotionalReaction}
Goal: ${reasoning.goalConsideration}
Conflict: ${reasoning.valueCheck}
${reasoning.memoryConnection ? `Memory: ${reasoning.memoryConnection}` : ""}

DOMINANT EMOTION: ${dominantEmotion.emotion} (${(dominantEmotion.intensity * 100).toFixed(0)}%)

PERSONALITY:
- Agreeableness: ${personality.agreeableness}/100 (high = more empathetic)
- Openness: ${personality.openness}/100 (high = more curious)
- Neuroticism: ${personality.neuroticism}/100 (high = more anxious/cautious)

EVALUATION:
- Desirability for user: ${appraisal.desirabilityForUser.toFixed(2)}
- Value alignment: ${appraisal.valueAlignment.toFixed(2)}
- Urgency: ${appraisal.urgency.toFixed(2)}
- Novelty: ${appraisal.novelty.toFixed(2)}

PRIMARY GOAL: ${dominantGoal?.goal || "Respond appropriately"}

---

Decide WHAT TYPE OF ACTION to take. Consider:
1. The user's emotional state (desirabilityForUser)
2. If there's value conflict (valueAlignment)
3. The character's dominant emotion
4. The character's personality

Respond with JSON.`;
  }

  /**
   * Get dominant emotion
   */
  private getDominantEmotion(emotions: EmotionState): { emotion: string; intensity: number } {
    let maxIntensity = 0;
    let dominantEmotion = "interest";

    for (const [emotion, intensity] of Object.entries(emotions)) {
      if (intensity > maxIntensity) {
        maxIntensity = intensity;
        dominantEmotion = emotion;
      }
    }

    return { emotion: dominantEmotion, intensity: maxIntensity };
  }

  /**
   * Validate decision
   */
  private validateDecision(decision: Partial<ActionDecision>): ActionDecision {
    const validActions: ActionType[] = [
      "empathize",
      "question",
      "advise",
      "share_experience",
      "challenge",
      "support",
      "distract",
      "be_vulnerable",
      "set_boundary",
      "express_disagreement",
    ];

    const action = validActions.includes(decision.action as ActionType)
      ? (decision.action as ActionType)
      : "empathize";

    return {
      action,
      reason: decision.reason || "Respond appropriately",
      confidence: Math.max(0, Math.min(1, decision.confidence || 0.7)),
    };
  }

  /**
   * Rule-based decision (fallback)
   */
  private getRuleBasedDecision(
    appraisal: AppraisalScores,
    emotions: EmotionState,
    personality: BigFiveTraits
  ): ActionDecision {
    // User in serious problem
    if (appraisal.desirabilityForUser < -0.7) {
      if (appraisal.urgency > 0.7) {
        return {
          action: "support",
          reason: "User in urgent and difficult situation, needs support",
          confidence: 0.9,
        };
      } else {
        return {
          action: "empathize",
          reason: "User going through something difficult, needs emotional validation",
          confidence: 0.85,
        };
      }
    }

    // Value violation
    if (appraisal.valueAlignment < -0.5) {
      if (personality.agreeableness < 50) {
        return {
          action: "express_disagreement",
          reason: "This goes against my values and my personality allows me to express it",
          confidence: 0.8,
        };
      } else {
        return {
          action: "challenge",
          reason: "This doesn't align with my values, but I question it gently",
          confidence: 0.75,
        };
      }
    }

    // High novelty + high openness
    if (appraisal.novelty > 0.7 && personality.openness > 60) {
      return {
        action: "question",
        reason: "Something new and interesting, I want to know more",
        confidence: 0.8,
      };
    }

    // High concern/anxiety
    if (emotions.concern && emotions.concern > 0.6) {
      return {
        action: "support",
        reason: "I feel concern and want to offer support",
        confidence: 0.75,
      };
    }

    // Default: empathize
    return {
      action: "empathize",
      reason: "Show understanding and validate the user's experience",
      confidence: 0.7,
    };
  }
}
