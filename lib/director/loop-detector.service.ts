/**
 * Loop Detector Service
 *
 * Detecta patrones repetitivos en las conversaciones del grupo
 * para prevenir diálogos monótonos.
 */

import { SceneCategory } from "@prisma/client";
import type { LoopPattern, CorrectiveAction } from "./types";

interface GroupMessage {
  id: string;
  content: string;
  authorType: string;
  agentId?: string;
  userId?: string;
  createdAt: Date;
}

class LoopDetectorService {
  // Thresholds para cada tipo de loop
  private readonly THRESHOLDS = {
    agreement: 4,
    compliments: 5,
    apologies: 3,
    questions: 4,
    topic: 6,
    protagonist: 5,
  };

  // Phrases indicating each pattern
  private readonly PATTERNS = {
    agreement: [
      "tienes razón",
      "estoy de acuerdo",
      "es verdad",
      "exacto",
      "totalmente",
      "sin duda",
      "completamente de acuerdo",
      "me parece bien",
      "correcto",
      "así es",
    ],
    compliments: [
      "que lindo",
      "que bonito",
      "eres increíble",
      "me encanta",
      "maravilloso",
      "genial",
      "fantástico",
      "perfecto",
      "hermoso",
      "asombroso",
    ],
    apologies: [
      "perdón",
      "lo siento",
      "disculpa",
      "perdona",
      "mis disculpas",
      "perdóname",
      "lamento",
    ],
  };

  /**
   * Analiza mensajes recientes buscando patrones de loop
   */
  async detectLoops(
    groupId: string,
    recentMessages: GroupMessage[]
  ): Promise<LoopPattern[]> {
    const detectedLoops: LoopPattern[] = [];

    // Solo analizar mensajes de IAs
    const aiMessages = recentMessages.filter((m) => m.authorType === "agent");

    if (aiMessages.length < 3) {
      // Muy pocos mensajes para detectar loops
      return [];
    }

    // Detectar cada tipo de loop
    const agreementLoop = this.detectAgreementLoop(aiMessages);
    if (agreementLoop) detectedLoops.push(agreementLoop);

    const complimentLoop = this.detectComplimentLoop(aiMessages);
    if (complimentLoop) detectedLoops.push(complimentLoop);

    const apologyLoop = this.detectApologyLoop(aiMessages);
    if (apologyLoop) detectedLoops.push(apologyLoop);

    const questionLoop = this.detectQuestionLoop(aiMessages);
    if (questionLoop) detectedLoops.push(questionLoop);

    const topicLoop = this.detectTopicLoop(aiMessages);
    if (topicLoop) detectedLoops.push(topicLoop);

    const protagonistLoop = this.detectProtagonistLoop(aiMessages);
    if (protagonistLoop) detectedLoops.push(protagonistLoop);

    return detectedLoops;
  }

  /**
   * Detecta si hay demasiados acuerdos
   */
  private detectAgreementLoop(messages: GroupMessage[]): LoopPattern | null {
    const agreements = messages.filter((m) =>
      this.containsAnyPattern(m.content, this.PATTERNS.agreement)
    );

    if (agreements.length >= this.THRESHOLDS.agreement) {
      return {
        type: "agreement",
        count: agreements.length,
        threshold: this.THRESHOLDS.agreement,
        detectedAt: new Date(),
        details: `${agreements.length} mensajes de acuerdo en los últimos ${messages.length}`,
      };
    }

    return null;
  }

  /**
   * Detecta si hay demasiados cumplidos
   */
  private detectComplimentLoop(
    messages: GroupMessage[]
  ): LoopPattern | null {
    const compliments = messages.filter((m) =>
      this.containsAnyPattern(m.content, this.PATTERNS.compliments)
    );

    if (compliments.length >= this.THRESHOLDS.compliments) {
      return {
        type: "compliments",
        count: compliments.length,
        threshold: this.THRESHOLDS.compliments,
        detectedAt: new Date(),
        details: `${compliments.length} cumplidos en los últimos ${messages.length} mensajes`,
      };
    }

    return null;
  }

  /**
   * Detecta si hay demasiadas disculpas
   */
  private detectApologyLoop(messages: GroupMessage[]): LoopPattern | null {
    const apologies = messages.filter((m) =>
      this.containsAnyPattern(m.content, this.PATTERNS.apologies)
    );

    if (apologies.length >= this.THRESHOLDS.apologies) {
      return {
        type: "apologies",
        count: apologies.length,
        threshold: this.THRESHOLDS.apologies,
        detectedAt: new Date(),
        details: `${apologies.length} disculpas en los últimos ${messages.length} mensajes`,
      };
    }

    return null;
  }

  /**
   * Detecta si hay demasiadas preguntas sin contenido propio
   */
  private detectQuestionLoop(messages: GroupMessage[]): LoopPattern | null {
    const questions = messages.filter((m) => m.content.includes("?"));

    // Solo es problema si son SOLO preguntas (sin afirmaciones sustanciales)
    const onlyQuestions = questions.filter((m) => {
      const sentences = m.content.split(/[.!]/);
      const questionSentences = m.content.split("?").length - 1;
      return questionSentences >= sentences.length * 0.7;
    });

    if (onlyQuestions.length >= this.THRESHOLDS.questions) {
      return {
        type: "questions",
        count: onlyQuestions.length,
        threshold: this.THRESHOLDS.questions,
        detectedAt: new Date(),
        details: `${onlyQuestions.length} mensajes con solo preguntas`,
      };
    }

    return null;
  }

  /**
   * Detecta si el mismo tema se repite sin avanzar
   */
  private detectTopicLoop(messages: GroupMessage[]): LoopPattern | null {
    // Extrae palabras clave de cada mensaje
    const keywords = messages.map((m) => this.extractKeywords(m.content));

    // Search for repetition of the same keywords
    const keywordCounts = new Map<string, number>();
    for (const kws of keywords) {
      for (const kw of kws) {
        keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1);
      }
    }

    // If any keyword appears in more than the threshold of messages
    const repeatedKeywords = Array.from(keywordCounts.entries()).filter(
      ([_, count]) => count >= this.THRESHOLDS.topic
    );

    if (repeatedKeywords.length > 0) {
      const topKeyword = repeatedKeywords.sort((a, b) => b[1] - a[1])[0];
      return {
        type: "topic",
        count: topKeyword[1],
        threshold: this.THRESHOLDS.topic,
        detectedAt: new Date(),
        details: `Palabra clave "${topKeyword[0]}" repetida ${topKeyword[1]} veces`,
      };
    }

    return null;
  }

  /**
   * Detecta si una IA domina demasiado la conversación
   */
  private detectProtagonistLoop(
    messages: GroupMessage[]
  ): LoopPattern | null {
    const speakerCounts = new Map<string, number>();

    for (const msg of messages) {
      if (msg.agentId) {
        speakerCounts.set(msg.agentId, (speakerCounts.get(msg.agentId) || 0) + 1);
      }
    }

    if (speakerCounts.size === 0) return null;

    const avgMessages = messages.length / speakerCounts.size;
    const maxSpeaker = Array.from(speakerCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0];

    // If someone has more than double the average
    if (maxSpeaker[1] > avgMessages * 2) {
      return {
        type: "protagonist",
        count: maxSpeaker[1],
        threshold: this.THRESHOLDS.protagonist,
        detectedAt: new Date(),
        details: `Una IA domina con ${maxSpeaker[1]} mensajes vs promedio de ${avgMessages.toFixed(1)}`,
      };
    }

    return null;
  }

  /**
   * Verifica si el texto contiene alguno de los patrones
   */
  private containsAnyPattern(text: string, patterns: string[]): boolean {
    const lowerText = text.toLowerCase();
    return patterns.some((pattern) => lowerText.includes(pattern));
  }

  /**
   * Extrae palabras clave de un texto (sustantivos y verbos principales)
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction: palabras de 4+ letras, sin stopwords
    const stopwords = new Set([
      "para",
      "porque",
      "pero",
      "como",
      "cuando",
      "donde",
      "este",
      "esta",
      "estos",
      "estas",
      "aquel",
      "aquella",
      "aquellos",
      "aquellas",
      "solo",
      "también",
      "además",
      "aunque",
      "mientras",
      "sobre",
      "entre",
      "hasta",
      "desde",
      "hacia",
      "contra",
      "tras",
      "durante",
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\sáéíóúñü]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stopwords.has(w));

    // Return unique words
    return Array.from(new Set(words));
  }

  /**
   * Sugiere acción correctiva para romper un loop
   */
  getCorrectiveAction(loop: LoopPattern): CorrectiveAction {
    switch (loop.type) {
      case "agreement":
        return {
          suggestedCategories: ["DEBATE" as SceneCategory, "TENSION" as SceneCategory],
          directive:
            "Introduce un punto de vista diferente o una objeción razonable",
          priority: 8,
        };

      case "compliments":
        return {
          suggestedCategories: ["HUMOR" as SceneCategory, "COTIDIANO" as SceneCategory],
          directive: "Cambia el tema a algo más práctico o cotidiano",
          priority: 7,
        };

      case "apologies":
        return {
          suggestedCategories: ["RECONCILIACION" as SceneCategory, "COTIDIANO" as SceneCategory],
          directive: "Cierra el tema y avanza a algo nuevo",
          priority: 9,
        };

      case "questions":
        return {
          suggestedCategories: ["DESCUBRIMIENTO" as SceneCategory, "VULNERABILIDAD" as SceneCategory],
          directive: "Haz una afirmación o comparte algo personal",
          priority: 7,
        };

      case "topic":
        return {
          suggestedCategories: ["PROACTIVIDAD" as SceneCategory, "HUMOR" as SceneCategory],
          directive: "Propone un tema o actividad completamente diferente",
          priority: 8,
        };

      case "protagonist":
        return {
          suggestedCategories: ["COTIDIANO" as SceneCategory],
          directive: "Da protagonismo a otra IA del grupo",
          priority: 9,
        };

      default:
        return {
          suggestedCategories: ["COTIDIANO" as SceneCategory],
          priority: 5,
        };
    }
  }

  /**
   * Calcula un "score de monotonía" global (0-1, 1 = muy monótono)
   */
  calculateMonotonyScore(loops: LoopPattern[]): number {
    if (loops.length === 0) return 0;

    let totalScore = 0;
    for (const loop of loops) {
      // How much it exceeds the threshold
      const excess = loop.count - loop.threshold;
      const normalizedExcess = Math.min(excess / loop.threshold, 1);
      totalScore += normalizedExcess;
    }

    return Math.min(totalScore / loops.length, 1);
  }
}

// Singleton
export const loopDetectorService = new LoopDetectorService();
