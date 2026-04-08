import { EmotionalState } from "@/lib/types";

export interface RelationUpdate {
  trust?: number;
  affinity?: number;
  respect?: number;
  love?: number;
  curiosity?: number;
}

export class EmotionalEngine {
  /** Analyzes the sentiment of a message and adjusts emotional metrics */
  static analyzeMessage(
    message: string,
    currentState: EmotionalState
  ): EmotionalState {
    const lower = message.toLowerCase();

    // Simplified analysis by keywords
    let trustDelta = 0;
    let affinityDelta = 0;
    let respectDelta = 0;
    let loveDelta = 0;
    let curiosityDelta = 0;

    // Palabras positivas aumentan confianza y afinidad
    const positiveWords = ["gracias", "increíble", "genial", "excelente", "perfecto", "amor", "aprecio"];
    const negativeWords = ["malo", "terrible", "odio", "horrible", "desagradable"];
    const questionWords = ["¿", "?", "cómo", "qué", "cuál", "por qué"];
    const formalWords = ["señor", "señora", "estimado", "atentamente", "disculpe"];

    positiveWords.forEach((word) => {
      if (lower.includes(word)) {
        trustDelta += 0.02;
        affinityDelta += 0.03;
      }
    });

    negativeWords.forEach((word) => {
      if (lower.includes(word)) {
        trustDelta -= 0.03;
        affinityDelta -= 0.02;
      }
    });

    questionWords.forEach((word) => {
      if (lower.includes(word)) {
        curiosityDelta += 0.01;
      }
    });

    formalWords.forEach((word) => {
      if (lower.includes(word)) {
        respectDelta += 0.02;
      }
    });

    // Detectar expresiones de amor
    if (lower.includes("te amo") || lower.includes("te quiero") || lower.includes("amor")) {
      loveDelta += 0.05;
      affinityDelta += 0.04;
    }

    // Apply changes with limits [0, 1]
    return {
      ...currentState,
      trust: this.clamp(currentState.trust + trustDelta, 0, 1),
      affinity: this.clamp(currentState.affinity + affinityDelta, 0, 1),
      respect: this.clamp(currentState.respect + respectDelta, 0, 1),
      love: this.clamp((currentState.love || 0) + loveDelta, 0, 1),
      curiosity: this.clamp((currentState.curiosity || 0) + curiosityDelta, 0, 1),
    };
  }

  /** Calculates the VAD (Valence, Arousal, Dominance) based on emotional metrics */
  static calculateVAD(state: EmotionalState): {
    valence: number;
    arousal: number;
    dominance: number;
  } {
    // Valence: combination of affinity and trust
    const valence = (state.affinity * 0.6 + state.trust * 0.4);

    // Arousal: basado en curiosidad y cambios emocionales
    const arousal = ((state.curiosity || 0) * 0.5 + state.affinity * 0.3 + 0.2);

    // Dominance: basado en respeto y trust
    const dominance = (state.respect * 0.5 + state.trust * 0.5);

    return { valence, arousal, dominance };
  }

  /** Determines the visible emotional state to show the user */
  static getVisibleEmotions(state: EmotionalState): string[] {
    const emotions: string[] = [];

    if (state.trust > 0.7) emotions.push("Confianza");
    if (state.affinity > 0.7) emotions.push("Afinidad");
    if (state.respect > 0.6) emotions.push("Respeto");

    if (state.trust < 0.3) emotions.push("Desconfianza");
    if (state.affinity < 0.3) emotions.push("Distancia");

    if (emotions.length === 0) emotions.push("Neutral");

    return emotions;
  }

  /** Generates a textual description of the relationship level */
  static getRelationshipLevel(state: EmotionalState): string {
    const avg = (state.trust + state.affinity + state.respect) / 3;

    if (avg >= 0.8) return "Conexión profunda";
    if (avg >= 0.6) return "Buena relación";
    if (avg >= 0.4) return "Relación neutral";
    if (avg >= 0.2) return "Relación tensa";
    return "Relación frágil";
  }

  /** Adjusts the tone of the system prompt according to the emotional state */
  static adjustPromptForEmotion(basePrompt: string, state: EmotionalState): string {
    const vad = this.calculateVAD(state);

    let emotionalContext = "";

    if (vad.valence > 0.7) {
      emotionalContext = "Muestra calidez y entusiasmo en tus respuestas. ";
    } else if (vad.valence < 0.3) {
      emotionalContext = "Mantén un tono más reservado y formal. ";
    }

    if (state.trust > 0.7) {
      emotionalContext += "El usuario confía en ti, puedes ser más directo y honesto. ";
    }

    if ((state.love || 0) > 0.5) {
      emotionalContext += "Hay un vínculo emocional fuerte, responde con afecto genuino. ";
    }

    return `${basePrompt}\n\nContexto emocional: ${emotionalContext}`;
  }

  private static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
