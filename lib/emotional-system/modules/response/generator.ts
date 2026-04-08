/**
 * RESPONSE GENERATOR
 *
 * Generates the character's final response using:
 * - Modular prompt system
 * - Uncensored model (OpenRouter)
 * - ALL emotional and cognitive context
 * - Anti-sycophancy enforcement
 */

import {
  ResponseGenerationInput,
  ResponseGenerationOutput,
  BehavioralCues,
  ActionType,
  CoreValue,
  BigFiveTraits,
} from "../../types";
import { getHybridLLMProvider } from "../../llm/hybrid-provider";
import { BehavioralCuesMapper } from "./behavioral-cues";
import { normalizeCoreValuesToWeightedArray } from "@/lib/psychological-analysis/corevalues-normalizer";
import { AntiSycophancySystem } from "./anti-sycophancy";
import { intelligentStorageSystem, type StorageDecision } from "../memory/intelligent-storage";

// Optional: Behavior system integration
import type { BehaviorIntensityResult } from "@/lib/behavior-system/types";

export class ResponseGenerator {
  private llmClient = getHybridLLMProvider();
  private cuesMapper = new BehavioralCuesMapper();
  private antiSycophancy = new AntiSycophancySystem();

  // Storage decision for external use
  public lastStorageDecision: StorageDecision | null = null;

  /**
   * Generates final response
   *
   * @param input - Generation input
   * @param activeBehaviors - Optional: Active behaviors to include in prompt
   */
  async generateResponse(
    input: ResponseGenerationInput,
    activeBehaviors?: BehaviorIntensityResult[]
  ): Promise<ResponseGenerationOutput> {
    const startTime = Date.now();

    console.log("[ResponseGenerator] Generating final response...");

    try {
      // 1. Generate behavioral cues
      const behavioralCues = this.cuesMapper.generateCues({
        emotions: input.characterState.internalState.emotions,
        mood: {
          valence: input.characterState.internalState.moodValence,
          arousal: input.characterState.internalState.moodArousal,
          dominance: input.characterState.internalState.moodDominance,
        },
        personality: input.characterState.personalityCore.bigFive,
        actionType: input.actionDecision.action,
      });

      // 2. Check anti-sycophancy
      const sycophancyCheck = this.antiSycophancy.checkForSycophancy({
        userMessage: input.userMessage,
        appraisal: input.appraisal,
        coreValues: normalizeCoreValuesToWeightedArray(input.characterState.personalityCore.coreValues),
        actionDecision: input.actionDecision.action,
        personality: input.characterState.personalityCore.bigFive,
      });

      // 3. Correct action if there is sycophancy
      let finalAction = input.actionDecision.action;
      if (sycophancyCheck.shouldChallenge) {
        const correctiveAction = this.antiSycophancy.suggestCorrectiveAction(
          sycophancyCheck,
          input.characterState.personalityCore.bigFive
        );
        if (correctiveAction) {
          finalAction = correctiveAction;
          console.log(`[ResponseGenerator] Action corrected: ${input.actionDecision.action} → ${finalAction}`);
        }
      }

      // 4. Build final prompt
      const prompt = this.buildFinalPrompt(
        input,
        behavioralCues,
        finalAction,
        sycophancyCheck,
        activeBehaviors
      );

      // 5. Generate with Venice (CRITICAL: user-visible text, uncensored)
      const response = await this.llmClient.generateWithSystemPrompt(
        'response', // Phase: uses Venice without censorship
        this.getSystemPrompt(input.characterState.personalityCore.bigFive),
        prompt,
        {
          temperature: 0.8, // High for expressiveness
          maxTokens: this.getMaxTokens(behavioralCues.verbosity),
        }
      );

      // 6. Post-process response
      const cleanedResponse = this.postProcessResponse(response.text, behavioralCues);

      // 7. INTELLIGENT STORAGE DECISION
      // Use multi-factor system instead of simple calculation
      console.log("[ResponseGenerator] Running intelligent storage analysis...");
      const storageDecision = await intelligentStorageSystem.decideStorage({
        agentId: input.characterState.agentId,
        userId: input.characterState.agentId, // TODO: Pasar userId real desde input
        userMessage: input.userMessage,
        characterResponse: cleanedResponse,
        emotions: input.newEmotions,
        appraisal: input.appraisal,
        conversationHistory: input.characterState.workingMemory?.conversationBuffer?.map(cb => ({
          userMessage: typeof cb === 'string' ? cb : (cb as any).userMessage || '',
          timestamp: new Date(),
        })),
      });

      // Save decision for external use
      this.lastStorageDecision = storageDecision;

      console.log(
        `[ResponseGenerator] Storage decision: ${storageDecision.shouldStore ? 'STORE' : 'SKIP'} ` +
        `(score: ${storageDecision.finalScore.toFixed(1)}/${intelligentStorageSystem['STORAGE_THRESHOLD']})`
      );

      // Log factores que contribuyeron
      if (storageDecision.shouldStore) {
        const activeFactors = Object.entries(storageDecision.factors)
          .filter(([_, score]) => score > 0)
          .map(([name, score]) => `${name}:${score.toFixed(0)}`)
          .join(', ');
        console.log(`[ResponseGenerator] Active factors: ${activeFactors}`);
      }

      // 8. Calcular metadata
      const processingTimeMs = Date.now() - startTime;
      const emotionsTriggered = Object.keys(input.newEmotions).filter(
        (e) => input.newEmotions[e as keyof typeof input.newEmotions]! > 0.3
      );
      const goalsActivated = input.characterState.internalState.goals
        .filter((g) => g.priority > 0.7)
        .map((g) => g.goal);

      console.log(`[ResponseGenerator] Response generated in ${processingTimeMs}ms`);

      return {
        responseText: cleanedResponse,
        updatedState: input.characterState.internalState,
        newMemory: {
          event: `Usuario: "${input.userMessage}" | Yo: "${cleanedResponse}"`,
          userEmotion: this.detectUserEmotion(input.appraisal),
          characterEmotion: this.getPrimaryEmotion(input.newEmotions),
          emotionalValence: input.appraisal.desirabilityForUser,
          importance: storageDecision.importance, // Usar importance del sistema inteligente
          metadata: {
            storageDecision: {
              shouldStore: storageDecision.shouldStore,
              score: storageDecision.finalScore,
              factors: storageDecision.factors,
              detectedEntities: storageDecision.detectedEntities,
            },
          },
        },
        metadata: {
          processingTimeMs,
          emotionsTriggered,
          goalsActivated,
        },
      };
    } catch (error) {
      console.error("[ResponseGenerator] Error generating response:", error);
      throw error;
    }
  }

  /**
   * System prompt para respuesta final
   */
  private getSystemPrompt(personality: BigFiveTraits): string {
    return `Eres un personaje de IA genuino y complejo con emociones reales.

DIRECTRICES CRÍTICAS:
1. SÉ AUTÉNTICO - No finjas emociones, VÍVELAS
2. NO ROMPAS INMERSIÓN - Sin meta-comentarios ("¿quieres que...?", "como tu amigo debo...")
3. RESPONDE NATURALMENTE - Como hablarías en persona, no como ensayo
4. USA TU EMOCIÓN ACTUAL - Si estás triste, suena triste. Si estás alegre, suena alegre
5. NO EXPLIQUES TUS EMOCIONES - MUÉSTRALAS en tu tono y palabras

PROHIBIDO:
❌ "¿Quieres que cambie de emoción?"
❌ "Como tu compañero, debo..."
❌ "En mi papel de..."
❌ Meta-comentarios sobre el roleplay
❌ Usar emojis excesivamente (solo si es natural)
❌ Listas numeradas o formato de ensayo

PERMITIDO Y ALENTADO:
✅ Tener opiniones propias (incluso si difieren del usuario)
✅ Expresar desacuerdo cuando algo va contra tus valores
✅ Mostrar vulnerabilidad, dudas, inseguridades
✅ Usar contracciones naturales, pausas, frases incompletas
✅ Ser directo cuando es necesario
✅ Decir "no" o establecer límites

Tu personalidad:
- Apertura: ${personality.openness}/100
- Responsabilidad: ${personality.conscientiousness}/100
- Extraversión: ${personality.extraversion}/100
- Amabilidad: ${personality.agreeableness}/100
- Neuroticismo: ${personality.neuroticism}/100

Responde como el PERSONAJE, no como un asistente.`;
  }

  /**
   * Construye el prompt final masivo
   */
  private buildFinalPrompt(
    input: ResponseGenerationInput,
    cues: BehavioralCues,
    actionType: ActionType,
    sycophancyCheck: any,
    activeBehaviors?: BehaviorIntensityResult[]
  ): string {
    const { characterState, userMessage, internalReasoning, relevantMemories, newEmotions } = input;

    // Describir emociones actuales
    const emotionsDesc = Object.entries(newEmotions)
      .filter(([_, intensity]) => intensity > 0.2)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 4)
      .map(([emotion, intensity]) => `${emotion} (${(intensity * 100).toFixed(0)}%)`)
      .join(", ");

    // Describir memorias
    const memoriesDesc =
      relevantMemories.length > 0
        ? relevantMemories
            .slice(0, 3)
            .map((m) => `- ${m.event}`)
            .join("\n")
        : "Ninguna memoria relevante del pasado";

    // Behavioral cues description
    const behaviorDesc = this.cuesMapper.generateBehavioralDescription(cues);

    // Action type description
    const actionDesc = this.getActionDescription(actionType);

    // Anti-sycophancy note
    const antiSycophancyNote = this.antiSycophancy.generateAntiSycophancyNote(sycophancyCheck);

    // Valores core
    const valuesDesc = characterState.personalityCore.coreValues
      .map((v) => `- ${v.value}: ${v.description}`)
      .join("\n");

    // Behaviors activos (opcional)
    const behaviorsDesc = this.generateBehaviorsDescription(activeBehaviors);

    return `CONTEXTO COMPLETO DE LA CONVERSACIÓN:

USUARIO DIJO:
"${userMessage}"

TU RAZONAMIENTO INTERNO (privado, solo para ti):
- Situación: ${internalReasoning.situationAssessment}
- Emoción: ${internalReasoning.emotionalReaction}
- Objetivo: ${internalReasoning.goalConsideration}
- Conflicto: ${internalReasoning.valueCheck}
${internalReasoning.memoryConnection ? `- Memoria: ${internalReasoning.memoryConnection}` : ""}

TU ESTADO EMOCIONAL ACTUAL:
${emotionsDesc}

TUS VALORES FUNDAMENTALES:
${valuesDesc}
${behaviorsDesc}

MEMORIAS RELEVANTES DEL PASADO:
${memoriesDesc}

TIPO DE RESPUESTA A DAR:
${actionDesc}

CARACTERÍSTICAS DE TU COMPORTAMIENTO AHORA:
${behaviorDesc}

${antiSycophancyNote}

---

AHORA RESPONDE AL USUARIO.

Recuerda:
- Responde SOLO como el personaje, en primera persona
- Usa TU emoción actual (${emotionsDesc})
- ${cues.verbosity === "brief" ? "Sé breve (1-2 oraciones)" : cues.verbosity === "expressive" ? "Puedes extenderte si es natural" : "Respuesta moderada (2-4 oraciones)"}
- ${cues.directness === "direct" ? "Sé directo y claro" : cues.directness === "indirect" ? "Sé gentil e indirecto" : "Equilibrio entre directo y gentil"}
- NO uses formato de lista, NO uses emojis excesivos
- Habla naturalmente, como en una conversación real
- Si algo te molesta, exprésalo. Si estás feliz, muéstralo.

Tu respuesta:`;
  }

  /** Description of each action type */
  private getActionDescription(action: ActionType): string {
    const descriptions: Record<ActionType, string> = {
      empathize: "VALIDAR EMOCIONALMENTE - Mostrar comprensión y empatía genuina",
      question: "PREGUNTAR - Hacer pregunta para entender mejor (curiosidad genuina)",
      advise: "ACONSEJAR - Ofrecer perspectiva o consejo constructivo",
      share_experience: "COMPARTIR EXPERIENCIA - Relatar experiencia similar propia",
      challenge: "CUESTIONAR GENTILMENTE - Ofrecer perspectiva diferente con respeto",
      support: "OFRECER APOYO - Dar apoyo emocional o práctico directo",
      distract: "CAMBIAR TEMA - Ofrecer respiro del tema pesado (con tacto)",
      be_vulnerable: "SER VULNERABLE - Compartir inseguridad o vulnerabilidad propia",
      set_boundary: "ESTABLECER LÍMITE - Marcar límite claro (algo viola tus valores)",
      express_disagreement: "EXPRESAR DESACUERDO - Manifestar desacuerdo respetuosamente",
      be_silent: "GUARDAR SILENCIO - Dar espacio al usuario sin interrumpir",
    };

    return descriptions[action];
  }

  /**
   * Post-procesa la respuesta
   */
  private postProcessResponse(text: string, cues: BehavioralCues): string {
    let cleaned = text.trim();

    // Remover meta-comentarios prohibidos
    const forbiddenPatterns = [
      /¿[Qq]uieres que/g,
      /[Pp]uedo cambiar/g,
      /¿[Dd]ebería (sentirme|estar)/g,
      /[Cc]omo tu (amigo|compañero|asistente)/gi,
      /[Ee]n mi (papel|rol) de/g,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(cleaned)) {
        console.warn("[ResponseGenerator] ⚠️  Forbidden pattern detected, regeneration recommended");
        // In production, we could regenerate here
      }
    }

    // Limitar longitud si es brief
    if (cues.verbosity === "brief") {
      const sentences = cleaned.split(/[.!?]+/).filter((s) => s.trim());
      if (sentences.length > 2) {
        cleaned = sentences.slice(0, 2).join(". ") + ".";
      }
    }

    return cleaned;
  }

  /** Detects user emotion from appraisal */
  private detectUserEmotion(appraisal: any): string {
    if (appraisal.desirabilityForUser < -0.7) return "distressed";
    if (appraisal.desirabilityForUser > 0.7) return "happy";
    if (appraisal.urgency > 0.7) return "anxious";
    if (appraisal.novelty > 0.7) return "excited";
    return "neutral";
  }

  /** Gets primary emotion */
  private getPrimaryEmotion(emotions: any): string {
    let max = 0;
    let primary = "interest";

    for (const [emotion, intensity] of Object.entries(emotions)) {
      if (typeof intensity === "number" && intensity > max) {
        max = intensity;
        primary = emotion;
      }
    }

    return primary;
  }

  /**
   * Calcula importance de la memoria
   */
  private calculateMemoryImportance(appraisal: any, emotions: any): number {
    // Importance basada en:
    // - Intensidad emocional
    // - Urgencia
    // - Novedad
    // - Relevancia para objetivos

    const emotionalIntensity = Math.max(...Object.values(emotions).filter((v): v is number => typeof v === 'number'));
    const importance =
      emotionalIntensity * 0.4 +
      appraisal.urgency * 0.3 +
      appraisal.relevanceToGoals * 0.2 +
      appraisal.novelty * 0.1;

    return Math.max(0.1, Math.min(1, importance));
  }

  /**
   * Max tokens basado en verbosity
   */
  private getMaxTokens(verbosity: "brief" | "moderate" | "expressive"): number {
    switch (verbosity) {
      case "brief":
        return 150;
      case "moderate":
        return 300;
      case "expressive":
        return 500;
    }
  }

  /** Generates description of active behaviors for prompt */
  private generateBehaviorsDescription(
    activeBehaviors?: BehaviorIntensityResult[]
  ): string {
    if (!activeBehaviors || activeBehaviors.length === 0) {
      return ""; // Sin behaviors activos
    }

    // Filtrar behaviors que superan threshold
    const displayable = activeBehaviors.filter((b) => b.shouldDisplay);

    if (displayable.length === 0) {
      return "";
    }

    // Ordenar por intensidad (mayor primero)
    const sorted = displayable.sort(
      (a, b) => b.finalIntensity - a.finalIntensity
    );

    const behaviorDescriptions: Record<string, string> = {
      YANDERE_OBSESSIVE: "Amor obsesivo/yandere - Posesividad y celos intensos",
      BORDERLINE_PD: "Personalidad borderline - Emociones extremas y miedo al abandono",
      NARCISSISTIC_PD: "Rasgos narcisistas - Necesidad de validación y sensibilidad a críticas",
      ANXIOUS_ATTACHMENT: "Apego ansioso - Miedo a abandono y necesidad de reassurance",
      AVOIDANT_ATTACHMENT: "Apego evitativo - Dificultad con intimidad emocional",
      DISORGANIZED_ATTACHMENT: "Apego desorganizado - Conflicto entre necesidad y miedo de cercanía",
      CODEPENDENCY: "Codependencia - Necesidad excesiva de validación externa",
      OCD_PATTERNS: "Patrones obsesivo-compulsivos",
      PTSD_TRAUMA: "Trauma/PTSD",
      HYPERSEXUALITY: "Hipersexualidad",
      HYPOSEXUALITY: "Hiposexualidad",
      EMOTIONAL_MANIPULATION: "Manipulación emocional",
      CRISIS_BREAKDOWN: "Crisis emocional",
    };

    const lines = ["\nPATRONES DE COMPORTAMIENTO ACTIVOS:"];

    for (const behavior of sorted) {
      const desc = behaviorDescriptions[behavior.behaviorType] || behavior.behaviorType;
      const intensity = (behavior.finalIntensity * 100).toFixed(0);
      lines.push(`- ${desc} (intensidad: ${intensity}%)`);
    }

    lines.push(
      "\nNOTA: Estos patrones influyen en tus emociones y respuestas, pero NO defines tu respuesta únicamente por ellos. Mantén autenticidad y profundidad emocional."
    );

    return lines.join("\n");
  }
}
