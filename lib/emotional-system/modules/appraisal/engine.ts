/**
 * APPRAISAL ENGINE - OCC MODEL IMPLEMENTATION
 * 
 * Evaluates situations based on the OCC model (Ortony, Clore, Collins)
 * to dynamically generate emotions based on:
 * - Desirability for character goals
 * - Desirability for the user
 * - Worthiness of praise/reproach of actions
 * - Appeal of objects
 * - Relevance for goals, values, and context
 */

import {AppraisalScores, CompleteCharacterState, CoreValue} from "../../types";
import { getHybridLLMProvider } from "../../llm/hybrid-provider";
import { normalizeCoreValuesToWeightedArray } from "@/lib/psychological-analysis/corevalues-normalizer";

export class AppraisalEngine {
  private llmClient = getHybridLLMProvider();

  /** Evaluates a user message based on the character's state */
  async evaluateSituation(
    userMessage: string,
    characterState: CompleteCharacterState
  ): Promise<AppraisalScores> {
    console.log("[AppraisalEngine] Evaluating situation...");

    const prompt = this.buildAppraisalPrompt(userMessage, characterState);

    try {
      // Use Gemini (free) for technical appraisal
      const appraisalData = await this.llmClient.generateJSON<AppraisalScores>(
        'appraisal', // Phase: uses Gemini automatically
        this.getSystemPrompt(),
        prompt,
        {
          temperature: 0.3, // Low for consistent evaluation
        }
      );

      console.log("[AppraisalEngine] Appraisal completed:", appraisalData);

      return this.validateAndNormalize(appraisalData);
    } catch (error) {
      console.error("[AppraisalEngine] Error evaluating, using fallback:", error);
      return this.getFallbackAppraisal();
    }
  }

  /**
   * System prompt for the evaluator
   */
  private getSystemPrompt(): string {
    return `You are an internal psychological evaluator based on the OCC model (Ortony, Clore, Collins).
Your task is to analyze messages from a character's perspective and generate quantitative evaluations.

IMPORTANT:
- Respond ONLY with valid JSON
- All scores must be within the specified ranges
- Your evaluation must be from the CHARACTER'S PERSPECTIVE, not neutral

OCC evaluation model:
1. EVENTS - How desirable is this?
2. ACTIONS - Are they worthy of praise/reproach?
3. OBJECTS - Are they attractive/repulsive?
4. CONTEXT - Relevance to goals, values, novelty`;
  }

  /** Builds the evaluation prompt */
  private buildAppraisalPrompt(
    userMessage: string,
    characterState: CompleteCharacterState
  ): string {
    const { personalityCore, internalState, semanticMemory } = characterState;

    // Extract key information
    const currentGoals = internalState.goals
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3); // Top 3 goals

    const coreValues = normalizeCoreValuesToWeightedArray(personalityCore.coreValues)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3); // Top 3 values

    const currentEmotions = this.describeCurrentEmotions(internalState.emotions);

    return `CHARACTER:
Name: ${characterState.agentId}
Big Five Personality:
- Openness: ${personalityCore.bigFive.openness}/100
- Conscientiousness: ${personalityCore.bigFive.conscientiousness}/100
- Extraversion: ${personalityCore.bigFive.extraversion}/100
- Agreeableness: ${personalityCore.bigFive.agreeableness}/100
- Neuroticism: ${personalityCore.bigFive.neuroticism}/100

Core Values (most important):
${coreValues.map((v) => `- ${v.value} (weight: ${v.weight}): ${v.description}`).join("\n")}

Current Goals:
${currentGoals.map((g) => `- ${g.goal} (priority: ${g.priority}, type: ${g.type})`).join("\n")}

Current Emotional State:
${currentEmotions}

Relationship Stage with User: ${semanticMemory.relationshipStage}

USER MESSAGE:
"${userMessage}"

EVALUATE this message on a numeric scale. Respond ONLY with this JSON:
{
  "desirability": <-1 to 1: Is it desirable for the character's goals?>,
  "desirabilityForUser": <-1 to 1: Is it good/bad for the user?>,
  "praiseworthiness": <-1 to 1: Are the user's actions worthy of praise (-1) or reproach (1)?>,
  "appealingness": <-1 to 1: Is the content attractive/pleasant to the character?>,
  "likelihood": <0 to 1: If there is future perspective, how likely is it?>,
  "relevanceToGoals": <0 to 1: How relevant to current goals?>,
  "valueAlignment": <-1 to 1: Does it align with the character's core values?>,
  "novelty": <0 to 1: How new/surprising is this information?>,
  "urgency": <0 to 1: How urgent to respond/act?>,
  "socialAppropriateness": <0 to 1: Is it socially appropriate?>
}

EVALUATION CRITERIA:
- desirability: Evaluate according to CHARACTER's goals. If conflicts with goals = negative.
- desirabilityForUser: Evaluate USER's wellbeing. Losing job = very negative.
- praiseworthiness: Only applies if user performed an ACTION. Neutral if just informing.
- valueAlignment: Compare with core values. Violating important value = very negative.
- novelty: First mention of something = high novelty. Recurring topic = low novelty.
- urgency: Serious problem/crisis = high urgency. Casual conversation = low urgency.

Remember: Evaluate from the CHARACTER'S PERSPECTIVE, considering THEIR personality and values.`;
  }

  /**
   * Describe current emotions as text
   */
  private describeCurrentEmotions(emotions: Record<string, number>): string {
    const activeEmotions = Object.entries(emotions)
      .filter(([_, intensity]) => intensity > 0.3)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 3);

    if (activeEmotions.length === 0) {
      return "Neutral (no dominant emotion)";
    }

    return activeEmotions
      .map(([emotion, intensity]) => `${emotion} (${(intensity * 100).toFixed(0)}%)`)
      .join(", ");
  }

  /**
   * Validate and normalize appraisal scores
   */
  private validateAndNormalize(appraisal: Partial<AppraisalScores>): AppraisalScores {
    const clamp = (value: number | undefined, min: number, max: number): number => {
      if (value === undefined || isNaN(value)) return (min + max) / 2;
      return Math.max(min, Math.min(max, value));
    };

    return {
      desirability: clamp(appraisal.desirability, -1, 1),
      desirabilityForUser: clamp(appraisal.desirabilityForUser, -1, 1),
      praiseworthiness: clamp(appraisal.praiseworthiness, -1, 1),
      appealingness: clamp(appraisal.appealingness, -1, 1),
      likelihood: clamp(appraisal.likelihood, 0, 1),
      relevanceToGoals: clamp(appraisal.relevanceToGoals, 0, 1),
      valueAlignment: clamp(appraisal.valueAlignment, -1, 1),
      novelty: clamp(appraisal.novelty, 0, 1),
      urgency: clamp(appraisal.urgency, 0, 1),
      socialAppropriateness: clamp(appraisal.socialAppropriateness, 0, 1),
    };
  }

  /**
   * Appraisal fallback if LLM fails
   */
  private getFallbackAppraisal(): AppraisalScores {
    return {
      desirability: 0.1,
      desirabilityForUser: 0.0,
      praiseworthiness: 0.0,
      appealingness: 0.0,
      likelihood: 0.5,
      relevanceToGoals: 0.5,
      valueAlignment: 0.0,
      novelty: 0.3,
      urgency: 0.4,
      socialAppropriateness: 0.7,
    };
  }

  /** Evaluates if a message violates the character's core values */
  evaluateValueViolation(
    appraisal: AppraisalScores,
    coreValues: CoreValue[]
  ): { violated: boolean; value?: string; severity?: number } {
    // If value alignment is very negative and there are important values
    if (appraisal.valueAlignment < -0.5) {
      const importantValues = coreValues.filter((v) => v.weight > 0.7);

      if (importantValues.length > 0) {
        const mostImportant = importantValues[0];
        return {
          violated: true,
          value: mostImportant.value,
          severity: Math.abs(appraisal.valueAlignment),
        };
      }
    }

    return { violated: false };
  }
}
