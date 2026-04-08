/**
 * COMPLEXITY ANALYZER
 *
 * Determina si un mensaje requiere procesamiento profundo (Orchestrator)
 * o puede manejarse con procesamiento rápido (Plutchik rule-based).
 *
 * Criterios basados en investigación de procesamiento cognitivo dual:
 * - Sistema 1: Rápido, automático, emocional (Fast Path)
 * - Sistema 2: Lento, deliberado, racional (Deep Path)
 */

export type MessageComplexity = "simple" | "complex";

export interface ComplexityAnalysisResult {
  complexity: MessageComplexity;
  score: number; // 0-1, where 0 = simple and 1 = complex
  reasons: string[];
  recommendedPath: "fast" | "deep";
}

/**
 * Keywords that indicate emotional complexity
 */
const EMOTIONAL_KEYWORDS = [
  // Intense negative emotions
  "triste", "deprimido", "devastado", "destrozado", "roto",
  "ansioso", "angustiado", "aterrado", "pánico", "terror",
  "enojado", "furioso", "indignado", "frustrado", "harto",
  "culpable", "avergonzado", "arrepentido", "remordimiento",

  // Problems and crises
  "problema", "crisis", "ayuda", "necesito", "socorro",
  "mal", "terrible", "horrible", "desastre", "catástrofe",

  // Decisions and dilemmas
  "decidir", "dilema", "conflicto", "duda", "confundido",
  "no sé qué hacer", "qué debería", "consejo", "opinión",

  // Relationships and social conflicts
  "pelea", "discusión", "conflicto", "rompí", "terminé",
  "traición", "engaño", "mentira", "desilusión",

  // Losses and grieving
  "perdí", "murió", "falleció", "terminó", "acabó",
  "dejó", "abandonó", "rechazó",

  // Work and finances
  "despedido", "renuncié", "desempleado", "quebré", "deuda",

  // Mental health
  "depresión", "ansiedad", "trastorno", "terapia", "psicólogo",
  "suicida", "autolesión", "adicción",
];

/**
 * Syntactic patterns that indicate complexity
 */
const COMPLEXITY_PATTERNS = [
  // Questions about decisions
  /¿(debería|debo|tengo que|puedo|es correcto)/i,
  /¿qué (hacer|hago|haría|harías)/i,

  // Complex conditionals
  /si (hubiera|hubiese|tuviera|pudiera).*entonces/i,
  /por un lado.*por otro lado/i,

  // Expressions of internal conflict
  /no sé si/i,
  /me siento (confundido|perdido|dividido)/i,
  /parte de mí.*pero/i,

  // References to values and morality
  /es (correcto|incorrecto|justo|injusto|moral|inmoral)/i,
  /va contra (mis valores|mi ética|mis principios)/i,

  // Temporal references to the past (memories)
  /recuerdo (cuando|que)/i,
  /hace (días|semanas|meses|años)/i,
  /la otra vez/i,
  /antes (me dijiste|hablamos|mencionaste)/i,
];

/**
 * Salutaciones y reacciones simples
 */
const SIMPLE_PATTERNS = [
  /^(hola|hey|hi|buenas|buenos|qué tal|cómo estás?|cómo vas)[\s\?!]*$/i,
  /^(ja+|je+|ji+|lol|xd|jaja+|jeje+|jiji+|ajaj+)[\s!]*$/i,
  /^(ok|okay|vale|bien|sí|no|aja|ajá|uhm|mmm|ah|oh)[\s!.]*$/i,
  /^(wow|guau|genial|cool|nice|wtf)[\s!]*$/i,
  /^(gracias|thanks|thx|grax)[\s!]*$/i,
  /^(adiós|chau|bye|nos vemos|hasta luego)[\s!]*$/i,
  /^(👍|👌|😊|😄|😁|🙂|😢|😭|😡|❤️|💔)+$/,
];

export class ComplexityAnalyzer {
  /**
   * Analiza la complejidad de un mensaje
   */
  analyze(message: string): ComplexityAnalysisResult {
    const reasons: string[] = [];
    let complexityScore = 0.0;

    // 1. SIMPLE PATTERNS CHECK (early exit)
    for (const pattern of SIMPLE_PATTERNS) {
      if (pattern.test(message.trim())) {
        return {
          complexity: "simple",
          score: 0.0,
          reasons: ["Saludo o reacción simple detectada"],
          recommendedPath: "fast",
        };
      }
    }

    // 2. MESSAGE LENGTH
    const wordCount = message.trim().split(/\s+/).length;

    if (wordCount <= 3) {
      complexityScore += 0.0;
      reasons.push(`Very short message (${wordCount} words)`);
    } else if (wordCount <= 10) {
      complexityScore += 0.2;
      reasons.push(`Short message (${wordCount} words)`);
    } else if (wordCount <= 30) {
      complexityScore += 0.4;
      reasons.push(`Moderate message (${wordCount} words)`);
    } else {
      complexityScore += 0.6;
      reasons.push(`Long message (${wordCount} words) - requires deep analysis`);
    }

    // 3. EMOTIONAL KEYWORDS
    const lowerMessage = message.toLowerCase();
    let emotionalKeywordCount = 0;

    for (const keyword of EMOTIONAL_KEYWORDS) {
      if (lowerMessage.includes(keyword)) {
        emotionalKeywordCount++;
      }
    }

    if (emotionalKeywordCount > 0) {
      const emotionalScore = Math.min(0.8, emotionalKeywordCount * 0.3);
      complexityScore += emotionalScore;
      reasons.push(`${emotionalKeywordCount} emotional keyword(s) detected`);
    }

    // 4. COMPLEX SYNTACTIC PATTERNS
    let patternMatches = 0;

    for (const pattern of COMPLEXITY_PATTERNS) {
      if (pattern.test(message)) {
        patternMatches++;
      }
    }

    if (patternMatches > 0) {
      const patternScore = Math.min(0.7, patternMatches * 0.35);
      complexityScore += patternScore;
      reasons.push(`${patternMatches} complexity pattern(s) detected`);
    }

    // 5. QUESTIONS (may require context)
    const questionMarks = (message.match(/[\?¿]/g) || []).length;
    if (questionMarks > 0) {
      complexityScore += 0.2;
      reasons.push(`Contains ${questionMarks} question(s)`);
    }

    // 6. MULTIPLE SENTENCES (complex narrative)
    const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 3) {
      complexityScore += 0.3;
      reasons.push(`Complex narrative (${sentences.length} sentences)`);
    }

    // 7. MENTIONS TO THIRD PARTIES (social situations)
    const thirdPersonMentions = [
      /mi (mamá|papá|madre|padre|hermano|hermana|amigo|amiga|novio|novia|jefe|compañero)/i,
      /(él|ella|ellos|ellas) (dijo|hizo|me)/i,
    ];

    for (const pattern of thirdPersonMentions) {
      if (pattern.test(message)) {
        complexityScore += 0.2;
        reasons.push("Mentions third parties (complex social situation)");
        break;
      }
    }

    // NORMALIZE SCORE (0-1)
    complexityScore = Math.min(1.0, complexityScore);

    // DETERMINE COMPLEXITY
    // Threshold: 0.5 - if exceeds this, it's complex
    const complexity: MessageComplexity = complexityScore >= 0.5 ? "complex" : "simple";
    const recommendedPath = complexity === "complex" ? "deep" : "fast";

    return {
      complexity,
      score: complexityScore,
      reasons,
      recommendedPath,
    };
  }

  /**
   * Fast version that only returns the recommended path
   */
  getRecommendedPath(message: string): "fast" | "deep" {
    return this.analyze(message).recommendedPath;
  }

  /**
   * Stats on complexity distribution (for analytics)
   */
  static getStats(messages: string[]): {
    total: number;
    simple: number;
    complex: number;
    simplePercentage: number;
    complexPercentage: number;
    averageScore: number;
  } {
    const analyzer = new ComplexityAnalyzer();
    let simpleCount = 0;
    let complexCount = 0;
    let totalScore = 0;

    for (const message of messages) {
      const result = analyzer.analyze(message);
      if (result.complexity === "simple") {
        simpleCount++;
      } else {
        complexCount++;
      }
      totalScore += result.score;
    }

    const total = messages.length;

    return {
      total,
      simple: simpleCount,
      complex: complexCount,
      simplePercentage: (simpleCount / total) * 100,
      complexPercentage: (complexCount / total) * 100,
      averageScore: totalScore / total,
    };
  }
}

/**
 * Singleton instance
 */
export const complexityAnalyzer = new ComplexityAnalyzer();
