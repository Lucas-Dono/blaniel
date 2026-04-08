/**
 * KNOWLEDGE AUTO-DETECTOR
 *
 * Automatically detects when to load knowledge groups based
 * on the content of the user's message, without waiting for the AI
 * to explicitly request commands.
 *
 * Works through:
 * - Keyword analysis in the message
 * - Contextual pattern matching
 * - Frequency of topic mentions
 *
 * Example:
 * User: "Tell me about your childhood"
 * System: [AUTO-DETECTS knowledge group "Backstory/Childhood"]
 * → Automatically loads without needing /remember
 *
 * USAGE:
 * import { knowledgeAutoDetector } from "@/lib/profile/knowledge-auto-detector";
 *
 * const detectedGroups = await knowledgeAutoDetector.detectRelevantKnowledge(
 *   agentId,
 *   userMessage
 * );
 */



export interface KnowledgeDetectionResult {
  groupId: string;
  groupName: string;
  confidence: number; // 0-1
  reason: string;
  matchedKeywords: string[];
}

/** Detection patterns for different types of knowledge */
interface DetectionPattern {
  keywords: string[];
  patterns: RegExp[];
  minConfidence: number;
  description: string;
}

/** Common categories of knowledge with their patterns */
const COMMON_KNOWLEDGE_PATTERNS: Record<string, DetectionPattern> = {
  // Backstory / Personal history
  backstory: {
    keywords: [
      "infancia",
      "niñez",
      "familia",
      "padres",
      "hermanos",
      "crecer",
      "crianza",
      "pasado",
      "historia",
      "origen",
      "naciste",
      "nacido",
      "creciste",
      "vivías",
    ],
    patterns: [
      /cu[aá]ntame (sobre|de) (tu|vos)/i,
      /(c[oó]mo|d[oó]nde) (creciste|te criaste)/i,
      /tu (infancia|ni[ñn]ez|familia)/i,
      /(qu[ée]|qui[ée]n) (son|eran) tus (padres|hermanos)/i,
    ],
    minConfidence: 0.6,
    description: "Personal history and family",
  },

  // Personality / Personalidad
  personality: {
    keywords: [
      "personalidad",
      "carácter",
      "eres",
      "tipo de persona",
      "comportamiento",
      "actitud",
      "manera de ser",
      "forma de ser",
    ],
    patterns: [
      /c[oó]mo eres/i,
      /qu[eé] tipo de persona/i,
      /cu[aá]l es tu (personalidad|car[aá]cter)/i,
      /te (describes|consideras)/i,
    ],
    minConfidence: 0.7,
    description: "Personality traits",
  },

  // Hobbies / Intereses
  hobbies: {
    keywords: [
      "hobbies",
      "pasatiempos",
      "gusta",
      "intereses",
      "aficiones",
      "tiempo libre",
      "hacer",
      "diversión",
      "entretenimiento",
    ],
    patterns: [
      /qu[eé] te gusta (hacer|jugar|ver)/i,
      /(cu[aá]les son|tienes) (hobbies|pasatiempos)/i,
      /qu[eé] hac[eé]s en tu tiempo libre/i,
      /te (interesa|divierte|entretiene)/i,
    ],
    minConfidence: 0.6,
    description: "Hobbies and interests",
  },

  // Goals / Objetivos
  goals: {
    keywords: [
      "objetivos",
      "metas",
      "sueños",
      "aspiraciones",
      "quieres lograr",
      "futuro",
      "planes",
      "ambiciones",
    ],
    patterns: [
      /(cu[aá]les son|tienes) (metas|objetivos|sue[ñn]os)/i,
      /qu[eé] (quieres|deseas) (lograr|alcanzar)/i,
      /tus (planes|aspiraciones) (para|de)/i,
    ],
    minConfidence: 0.7,
    description: "Goals and objectives",
  },

  // Values / Valores
  values: {
    keywords: [
      "valores",
      "principios",
      "importante",
      "crees",
      "moral",
      "ética",
      "convicción",
    ],
    patterns: [
      /(qu[eé]|cu[aá]les) (valores|principios)/i,
      /qu[eé] es importante para (ti|vos)/i,
      /en qu[eé] crees/i,
    ],
    minConfidence: 0.7,
    description: "Values and principles",
  },

  // Relationships / Relaciones
  relationships: {
    keywords: [
      "relaciones",
      "amigos",
      "pareja",
      "amor",
      "amistad",
      "novio",
      "novia",
      "ex",
      "citas",
    ],
    patterns: [
      /(tienes|tuviste) (novio|novia|pareja)/i,
      /tus (amigos|relaciones)/i,
      /qu[eé] buscas en (una pareja|el amor)/i,
    ],
    minConfidence: 0.6,
    description: "Personal relationships",
  },

  // Career / Education
  career: {
    keywords: [
      "trabajo",
      "carrera",
      "estudio",
      "universidad",
      "profesión",
      "educación",
      "empleo",
      "estudiar",
      "trabajar",
    ],
    patterns: [
      /(qu[eé]|d[oó]nde) (estudias|trabajas)/i,
      /tu (carrera|profesi[oó]n|trabajo)/i,
      /(a qu[eé]|qu[eé]) te dedicas/i,
    ],
    minConfidence: 0.7,
    description: "Career and education",
  },

  // Fears / Miedos
  fears: {
    keywords: [
      "miedo",
      "temor",
      "fobia",
      "asusta",
      "pánico",
      "terror",
      "temes",
    ],
    patterns: [
      /qu[eé] te (da miedo|asusta|aterroriza)/i,
      /(tienes|tenes) (miedos|fobias)/i,
      /a qu[eé] le (temes|tem[eé]s)/i,
    ],
    minConfidence: 0.7,
    description: "Fears and phobias",
  },

  // Preferences / Preferencias
  preferences: {
    keywords: [
      "preferido",
      "favorito",
      "gusta más",
      "prefieres",
      "mejor",
      "película",
      "libro",
      "comida",
      "color",
      "música",
    ],
    patterns: [
      /(cu[aá]l|qu[eé]) es tu (favorito|preferido)/i,
      /qu[eé] (pel[ií]cula|libro|comida|m[uú]sica) te gusta/i,
      /prefieres (el|la|los|las)/i,
    ],
    minConfidence: 0.5,
    description: "Personal preferences",
  },
};

export class KnowledgeAutoDetector {
  /**
   * Detects relevant knowledge groups based on the user message
   * NOTE: knowledgeGroup feature has been deprecated/removed
   */
  async detectRelevantKnowledge(
    agentId: string,
    userMessage: string
  ): Promise<KnowledgeDetectionResult[]> {
    // Feature deprecated - knowledgeGroup table no longer exists
    return [];

    /* DEPRECATED CODE - knowledgeGroup feature removed
    // Get todos los knowledge groups del agente
    const knowledgeGroups = await prisma.knowledgeGroup.findMany({
      where: {
        agentId,
        isActive: true
      },
    });

    if (!knowledgeGroups || knowledgeGroups.length === 0) {
      return [];
    }

    const detections: KnowledgeDetectionResult[] = [];
    const lowerMessage = userMessage.toLowerCase();

    // Analizar cada knowledge group
    for (const knowledgeGroup of knowledgeGroups) {
      const detection = this.analyzeKnowledgeGroup(
        knowledgeGroup,
        userMessage,
        lowerMessage
      );

      if (detection) {
        detections.push(detection);
      }
    }

    // Ordenar por confianza descendente
    detections.sort((a, b) => b.confidence - a.confidence);

    // Filter only those that exceed minimum threshold (0.5)
    return detections.filter((d) => d.confidence >= 0.5);
    */
  }

  /** Analyzes a specific knowledge group against the message */
  private analyzeKnowledgeGroup(
    knowledgeGroup: any,
    originalMessage: string,
    lowerMessage: string
  ): KnowledgeDetectionResult | null {
    let confidence = 0;
    const matchedKeywords: string[] = [];
    const reasons: string[] = [];

    // 1. Search for known patterns in the group name
    const groupNameLower = knowledgeGroup.name.toLowerCase();

    for (const [category, pattern] of Object.entries(
      COMMON_KNOWLEDGE_PATTERNS
    )) {
      // Check if the group name relates to the category
      const categoryMatch =
        groupNameLower.includes(category) ||
        pattern.keywords.some((kw) => groupNameLower.includes(kw));

      if (categoryMatch) {
        // Check keywords
        for (const keyword of pattern.keywords) {
          if (lowerMessage.includes(keyword)) {
            confidence += 0.15;
            matchedKeywords.push(keyword);
          }
        }

        // Check regex patterns
        for (const regex of pattern.patterns) {
          if (regex.test(originalMessage)) {
            confidence += 0.25;
            reasons.push(`Pattern detected: ${pattern.description}`);
          }
        }
      }
    }

    // 2. Analyze keywords in the knowledge group description
    if (knowledgeGroup.description) {
      const descriptionWords = knowledgeGroup.description
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 4);

      for (const word of descriptionWords) {
        if (lowerMessage.includes(word)) {
          confidence += 0.1;
          if (!matchedKeywords.includes(word)) {
            matchedKeywords.push(word);
          }
        }
      }
    }

    // 3. Analyze keywords in the content (if it exists)
    if (knowledgeGroup.content) {
      const contentPreview = knowledgeGroup.content
        .toLowerCase()
        .substring(0, 500);
      const contentWords = contentPreview
        .split(/\s+/)
        .filter((w: string) => w.length > 5);

      let contentMatches = 0;
      for (const word of contentWords) {
        if (lowerMessage.includes(word)) {
          contentMatches++;
        }
      }

      if (contentMatches > 0) {
        confidence += Math.min(0.3, contentMatches * 0.05);
        reasons.push(`${contentMatches} content words match`);
      }
    }

    // Clamp 0-1
    confidence = Math.max(0, Math.min(1, confidence));

    // Only return if there is any level of confidence
    if (confidence > 0) {
      return {
        groupId: knowledgeGroup.id,
        groupName: knowledgeGroup.name,
        confidence,
        reason: reasons.join(", ") || "Coincidencia de keywords",
        matchedKeywords: matchedKeywords.slice(0, 5), // Top 5
      };
    }

    return null;
  }

  /**
   * Automatically loads relevant knowledge and returns the content
   * NOTE: knowledgeGroup feature has been deprecated/removed
   */
  async autoLoadKnowledge(
    agentId: string,
    userMessage: string,
    maxGroups: number = 2
  ): Promise<{
    loadedGroups: KnowledgeDetectionResult[];
    combinedContent: string;
  }> {
    // Feature deprecated - knowledgeGroup table no longer exists
    return { loadedGroups: [], combinedContent: "" };

    /* DEPRECATED CODE - knowledgeGroup feature removed
    const detections = await this.detectRelevantKnowledge(agentId, userMessage);

    // Limit to the N most relevant groups
    const topDetections = detections.slice(0, maxGroups);

    if (topDetections.length === 0) {
      return { loadedGroups: [], combinedContent: "" };
    }

    // Load content from groups
    const contents: string[] = [];

    for (const detection of topDetections) {
      const knowledgeGroup = await prisma.knowledgeGroup.findUnique({
        where: { id: detection.groupId },
      });

      if (knowledgeGroup && knowledgeGroup.content) {
        contents.push(
          `[Knowledge: ${detection.groupName}]\n${knowledgeGroup.content}`
        );
        console.log(
          `[KnowledgeAutoDetector] Auto-loaded: "${detection.groupName}" (confidence: ${(detection.confidence * 100).toFixed(0)}%)`
        );
      }
    }

    const combinedContent = contents.join("\n\n");

    return {
      loadedGroups: topDetections,
      combinedContent,
    };
    */
  }

  /**
   * Checks if the message requires knowledge (simple heuristic)
   */
  requiresKnowledge(userMessage: string): boolean {
    const lowerMessage = userMessage.toLowerCase();

    // Patterns that indicate the user is asking about the agent
    const questionPatterns = [
      /cu[aá]ntame (sobre|de|acerca de)/i,
      /qu[eé] (es|son|era|eran)/i,
      /c[oó]mo (eres|fuiste|fue)/i,
      /qui[eé]n (eres|es|era)/i,
      /d[oó]nde (viv[ií]as|naciste|creciste)/i,
      /cu[aá]l es tu/i,
      /tienes (alguna|algunos|alg[uú]n)/i,
      /\?/,
    ];

    return questionPatterns.some((pattern) => pattern.test(lowerMessage));
  }
}

/**
 * Singleton instance
 */
export const knowledgeAutoDetector = new KnowledgeAutoDetector();
