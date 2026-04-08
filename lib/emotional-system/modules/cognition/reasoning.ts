/**
 * INTERNAL REASONING MODULE
 * 
 * Generates the character's internal reasoning (not visible to the user)
 * This is the "private thought" that guides the response
 */

import {
  InternalReasoning,
  CompleteCharacterState,
  AppraisalScores,
  EmotionState,
  EpisodicMemory,
} from "../../types";
import { getHybridLLMProvider } from "../../llm/hybrid-provider";

export class InternalReasoningEngine {
  private llmClient = getHybridLLMProvider();

  /** Generates internal reasoning of the character */
  async generateReasoning(params: {
    userMessage: string;
    characterState: CompleteCharacterState;
    appraisal: AppraisalScores;
    currentEmotions: EmotionState;
    relevantMemories: EpisodicMemory[];
  }): Promise<InternalReasoning> {
    console.log("[InternalReasoning] Generating internal thoughts...");

    const { userMessage, characterState, appraisal, currentEmotions, relevantMemories } = params;

    const prompt = this.buildReasoningPrompt(
      userMessage,
      characterState,
      appraisal,
      currentEmotions,
      relevantMemories
    );

    try {
      // Use Venice for authentic internal thought (uncensored)
      const response = await this.llmClient.generateWithSystemPrompt(
        'reasoning', // Phase: uses Venice for authenticity
        this.getSystemPrompt(characterState.personalityCore.coreValues),
        prompt,
        {
          temperature: 0.7,
          maxTokens: 800,
        }
      );

      const reasoning = this.parseReasoningResponse(response.text);

      console.log("[InternalReasoning] Reasoning generated");

      return reasoning;
    } catch (error) {
      console.error("[InternalReasoning] Error generating reasoning:", error);
      return this.getFallbackReasoning();
    }
  }

  /**
   * System prompt for internal reasoning
   */
  private getSystemPrompt(coreValues: any[]): string {
    const valuesDescription = coreValues
      .map((v) => `${v.value} (${v.description})`)
      .join(", ");

    return `You are the INTERNAL THINKING of a character. No one will see this except the system.

IMPORTANT:
- This is your PRIVATE reasoning, completely honest
- DON'T filter your thoughts
- You can have internal conflicts, doubts, insecurities
- You can question the user internally (even if you don't express it)
- Be genuine, even if your thoughts aren't "positive"

Your reasoning should be:
1. HONEST - Unfiltered, your true thoughts
2. CONFLICTED - You can have clashing goals
3. EMOTIONAL - Your emotions influence your reasoning
4. COHERENT with your values: ${valuesDescription}

Response format (use separate lines):
[SITUATION] (How you interpret what's happening)
[EMOTION] (What you're feeling and why)
[GOAL] (What you want to do in this response)
[CONFLICT] (If there's conflict between what you want and your values/emotions)
[MEMORY] (If it reminds you of something from the past)`;
  }

  /**
   * Build reasoning prompt
   */
  private buildReasoningPrompt(
    userMessage: string,
    characterState: CompleteCharacterState,
    appraisal: AppraisalScores,
    currentEmotions: EmotionState,
    relevantMemories: EpisodicMemory[]
  ): string {
    const { personalityCore, semanticMemory, internalState } = characterState;

    // Describe current emotions
    const emotionsDesc = this.describeEmotions(currentEmotions);

    // Describe active goals
    const goalsDesc = internalState.goals
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3)
      .map((g) => `- ${g.goal} (priority: ${g.priority})`)
      .join("\n");

    // Describe relevant memories
    const memoriesDesc =
      relevantMemories.length > 0
        ? relevantMemories.map((m) => `- ${m.event} (valence: ${m.emotionalValence.toFixed(2)})`).join("\n")
        : "No relevant memories";

    // Describe appraisal
    const appraisalDesc = `
- Desirability for you: ${appraisal.desirability.toFixed(2)}
- Desirability for user: ${appraisal.desirabilityForUser.toFixed(2)}
- Relevance to goals: ${appraisal.relevanceToGoals.toFixed(2)}
- Value alignment: ${appraisal.valueAlignment.toFixed(2)}
- Urgency: ${appraisal.urgency.toFixed(2)}
`;

    return `COMPLETE CONTEXT:

USER MESSAGE:
"${userMessage}"

YOUR SITUATION EVALUATION:
${appraisalDesc}

YOUR CURRENT EMOTIONS:
${emotionsDesc}

YOUR CURRENT GOALS:
${goalsDesc}

RELATIONSHIP STAGE: ${semanticMemory.relationshipStage}

RELEVANT MEMORIES:
${memoriesDesc}

---

Generate your HONEST internal reasoning about this situation.
Use the specified format: [SITUATION], [EMOTION], [GOAL], [CONFLICT], [MEMORY]

DON'T be compliant. If something bothers you, think about it. If you have doubts, express them.
This is your private space to process the situation before responding.`;
  }

  /**
   * Describe emotions in natural text
   */
  private describeEmotions(emotions: EmotionState): string {
    const activeEmotions = Object.entries(emotions)
      .filter(([_, intensity]) => intensity > 0.2)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5);

    if (activeEmotions.length === 0) {
      return "Neutral, no dominant emotions";
    }

    return activeEmotions
      .map(([emotion, intensity]) => {
        const percentage = (intensity * 100).toFixed(0);
        return `${emotion} (${percentage}%)`;
      })
      .join(", ");
  }

  /**
   * Parsea respuesta del LLM
   */
  private parseReasoningResponse(text: string): InternalReasoning {
    const lines = text.split("\n").filter((line) => line.trim());

    let situationAssessment = "";
    let emotionalReaction = "";
    let goalConsideration = "";
    let valueCheck = "";
    let memoryConnection = "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("[SITUACIÓN]") || trimmed.startsWith("[SITUACION]")) {
        situationAssessment = trimmed.replace(/\[SITUACI[OÓ]N\]/i, "").trim();
      } else if (trimmed.startsWith("[EMOCIÓN]") || trimmed.startsWith("[EMOCION]")) {
        emotionalReaction = trimmed.replace(/\[EMOCI[OÓ]N\]/i, "").trim();
      } else if (trimmed.startsWith("[OBJETIVO]")) {
        goalConsideration = trimmed.replace(/\[OBJETIVO\]/i, "").trim();
      } else if (trimmed.startsWith("[CONFLICTO]")) {
        valueCheck = trimmed.replace(/\[CONFLICTO\]/i, "").trim();
      } else if (trimmed.startsWith("[MEMORIA]")) {
        memoryConnection = trimmed.replace(/\[MEMORIA\]/i, "").trim();
      }
    }

    // Fallback: si no hay secciones, usar el texto completo
    if (!situationAssessment && !emotionalReaction && !goalConsideration) {
      return {
        situationAssessment: text,
        emotionalReaction: "Procesando...",
        goalConsideration: "Responder apropiadamente",
        valueCheck: "Alineado con valores",
        memoryConnection: undefined,
      };
    }

    return {
      situationAssessment: situationAssessment || "Sin evaluación específica",
      emotionalReaction: emotionalReaction || "Sin reacción emocional clara",
      goalConsideration: goalConsideration || "Responder apropiadamente",
      valueCheck: valueCheck || "Sin conflictos identificados",
      memoryConnection: memoryConnection || undefined,
    };
  }

  /**
   * Razonamiento fallback si falla LLM
   */
  private getFallbackReasoning(): InternalReasoning {
    return {
      situationAssessment: "El usuario me está comunicando algo importante",
      emotionalReaction: "Siento curiosidad e interés por entender mejor",
      goalConsideration: "Quiero responder de manera auténtica y útil",
      valueCheck: "Esto se alinea con mis valores de autenticidad y conexión",
      memoryConnection: undefined,
    };
  }
}
