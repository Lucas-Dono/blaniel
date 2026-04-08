/**
 * MEMORY QUERY DETECTOR
 *
 * Detects when user asks about past memories using:
 * - Specific linguistic patterns (regex)
 * - Keywords indicative of memory queries
 * - Temporal context analysis
 *
 * EXAMPLES OF DETECTED QUERIES:
 * - "Do you remember when...?"
 * - "Do you recall...?"
 * - "What did I tell you about...?"
 * - "Did I mention...?"
 * - "You said that..."
 * - "We talked about..."
 * - "The last time that..."
 *
 * PERFORMANCE:
 * - Detection: <5ms (regex-based)
 * - Keyword extraction: <10ms (basic NLP)
 * - Total: <15ms overhead
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('MemoryQueryDetector');

export interface MemoryQueryDetection {
  isMemoryQuery: boolean;
  confidence: number; // 0-1
  queryType: 'recall' | 'verification' | 'retrieval' | 'none';
  keywords: string[];
  temporalContext?: 'recent' | 'past' | 'specific';
  rawMatch?: string;
}

/**
 * Patterns that indicate it's NOT a memory query (false positives)
 * These are questions about the future or present
 */
const NEGATIVE_PATTERNS = [
  // Future: "you will do", "I will do", "will do", etc.
  /\b(will|going|going\s+to|can|could|should|would|may|might)/i,
  // Future temporal markers
  /\b(tomorrow|next|tomorrow|day\s+after|following|later|in\s+the\s+future|soon)/i,
  // Questions about future plans
  /\b(plan(s)?|planning|think|want|going\s+to)\b/i,
];

/**
 * Memory query patterns
 * Organized by query type
 */
const MEMORY_PATTERNS = {
  // RECALL: "Do you remember...?"
  recall: [
    // Specific patterns with keywords
    /\b(remember|recall|do\s+you\s+remember|did\s+you|can\s+you\s+remember)\s+(when|that|how|which|what|where|who)\s+(.+)/i,
    /\b(you\s+remember|recall|remember\s+when)\s+(that|about|how|which|what|where)\s+(.+)/i,
    // More flexible patterns without required keywords
    /\b(remember|recall)\s+(.{3,})/i, // "Remember my name?"
    /\b(you\s+remember|recall)\s+(.{3,})/i, // "You recall my birthday?"
    /\b(do\s+you\s+know|did\s+you\s+know)\s+(.+)/i, // "Did you know..." (more specific)
    /\b(remem(ber|bered))\s+(.+)/i,
    // Past references starting with "when" - prioritized here over verification
    /\bwhen\s+you\s+(told|said|mentioned)\s+(.+)/i,
  ],

  // PERSONAL INFO QUERIES: "What/When/How is my...?"
  // Questions about personal information that imply prior memory
  personalInfo: [
    // "When is my birthday/anniversary?"
    /\bwhen\s+is\s+my\s+(.+)/i,
    // "What is my/your/the...?"
    /\b(what\s+is|what's)\s+(my|your|the)\s+(.+)/i,
    // "What is my favorite color/food/movie?"
    /\b(what\s+is|what's)\s+my\s+(.+)\s+favorite/i,
    // "What is my name/age/job?"
    /\b(what\s+is|what's)\s+my\s+(.+)/i,
    // "Where do I live/work/study?"
    /\b(where)\s+(do\s+i|i)\s+(live|work|study|born)/i,
  ],

  // VERIFICATION: "Did you...?"
  verification: [
    /\b(did\s+you|did\s+i)\s+(tell|say|mention)\s+(that|about|how|which)?\s*(.+)/i,
    /\b(did|have)\s+you\s+(already)?\s+(talked|spoken)\s+(about|of)\s+(.+)/i,
  ],

  // RETRIEVAL: "What did I tell you about...?"
  retrieval: [
    // Direct pattern: "What did I tell you about...?"
    /\b(what|which|how|when|where|who)\s+(did|do)\s+you\s+(tell|say|mention|ask)\s+(me|about|regarding)?\s*(.+)/i,
    // Flexible pattern: "What was... that you mentioned?"
    /\b(what|which|how)\s+\w+\s+.*?\s+(you\s+)?(tell|told|mentioned|say|said)/i,
    // "What did we talk about...?"
    /\b(what|about\s+what)\s+(did\s+we)?(talk|discuss|converse)\s+(about)?\s*(.+)/i,
  ],

  // PAST REFERENCE: Referencias directas al pasado
  pastReference: [
    /la\s+(última|primera)\s+vez\s+que\s+(.+)/i,
    /(dijiste|mencionaste|comentaste)\s+que\s+(.+)/i,
    /(hablamos|conversamos|charlamos)\s+(de|sobre)\s+(.+)/i,
    /cuando\s+te\s+(dije|conté|habl[ée]|mencioné)\s+(.+)/i,
  ],
};

/**
 * Keywords que indican query de memoria
 */
const MEMORY_KEYWORDS = [
  // Verbos de memoria
  'recordar', 'recuerdas', 'recuerdo', 'acordar', 'acuerdas',

  // Past communication verbs
  'dije', 'dijiste', 'conté', 'contaste', 'mencioné', 'mencionaste',
  'comenté', 'comentaste', 'hablé', 'hablaste', 'hablamos',

  // Marcadores temporales
  'antes', 'ayer', 'anoche', 'pasado', 'última', 'primera',
  'hace', 'cuando', 'aquel', 'aquella',
];

/**
 * Stop words para filtrar del keyword extraction
 */
const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para',
  'que', 'qué', 'te', 'me', 'se', 'si',
  'y', 'o', 'pero', 'porque', 'como',
  'es', 'era', 'fue', 'ser', 'estar',
  'muy', 'más', 'menos', 'tan', 'tanto',
]);

export class MemoryQueryDetector {
  /**
   * Detecta si un mensaje es una query sobre memoria
   */
  detectMemoryQuery(message: string): MemoryQueryDetection {
    const startTime = Date.now();

    // Normalizar mensaje
    const normalizedMessage = this.normalizeMessage(message);

    // 0. CHECK: Excluir false positives (preguntas sobre futuro/presente)
    if (this.isFutureOrientedQuery(normalizedMessage)) {
      return {
        isMemoryQuery: false,
        confidence: 0,
        queryType: 'none',
        keywords: [],
      };
    }

    // 1. CHECK: RETRIEVAL patterns (more specific, checked first)
    const retrievalMatch = this.matchPatterns(normalizedMessage, MEMORY_PATTERNS.retrieval);
    if (retrievalMatch) {
      const keywords = this.extractKeywords(retrievalMatch.match);
      const temporal = this.detectTemporalContext(normalizedMessage);

      log.debug(
        { message: message.substring(0, 100), type: 'retrieval', confidence: 0.95, timeMs: Date.now() - startTime },
        'Memory query detected (retrieval)'
      );

      return {
        isMemoryQuery: true,
        confidence: 0.95,
        queryType: 'retrieval',
        keywords,
        temporalContext: temporal,
        rawMatch: retrievalMatch.match,
      };
    }

    // 2. CHECK: Patrones de RECALL
    const recallMatch = this.matchPatterns(normalizedMessage, MEMORY_PATTERNS.recall);
    if (recallMatch) {
      const keywords = this.extractKeywords(recallMatch.match);
      const temporal = this.detectTemporalContext(normalizedMessage);

      log.debug(
        { message: message.substring(0, 100), type: 'recall', confidence: 0.9, timeMs: Date.now() - startTime },
        'Memory query detected (recall)'
      );

      return {
        isMemoryQuery: true,
        confidence: 0.9,
        queryType: 'recall',
        keywords,
        temporalContext: temporal,
        rawMatch: recallMatch.match,
      };
    }

    // 3. CHECK: VERIFICATION patterns (more specific than personal info)
    const verificationMatch = this.matchPatterns(normalizedMessage, MEMORY_PATTERNS.verification);
    if (verificationMatch) {
      const keywords = this.extractKeywords(verificationMatch.match);
      const temporal = this.detectTemporalContext(normalizedMessage);

      log.debug(
        { message: message.substring(0, 100), type: 'verification', confidence: 0.85, timeMs: Date.now() - startTime },
        'Memory query detected (verification)'
      );

      return {
        isMemoryQuery: true,
        confidence: 0.85,
        queryType: 'verification',
        keywords,
        temporalContext: temporal,
        rawMatch: verificationMatch.match,
      };
    }

    // 4. CHECK: PERSONAL INFO patterns (implicit queries about personal information)
    // Checked after verification to avoid capturing "did you tell me where I live?"
    const personalInfoMatch = this.matchPatterns(normalizedMessage, MEMORY_PATTERNS.personalInfo);
    if (personalInfoMatch) {
      const keywords = this.extractKeywords(personalInfoMatch.match);

      log.debug(
        { message: message.substring(0, 100), type: 'personalInfo', confidence: 0.75, timeMs: Date.now() - startTime },
        'Memory query detected (personal info)'
      );

      return {
        isMemoryQuery: true,
        confidence: 0.75, // Slightly lower confidence as these could be new info requests
        queryType: 'recall',
        keywords,
        temporalContext: undefined,
        rawMatch: personalInfoMatch.match,
      };
    }

    // 5. CHECK: Referencias al pasado
    const pastRefMatch = this.matchPatterns(normalizedMessage, MEMORY_PATTERNS.pastReference);
    if (pastRefMatch) {
      const keywords = this.extractKeywords(pastRefMatch.match);

      // Past references tienen menor confidence
      const keywordScore = this.calculateKeywordScore(normalizedMessage);
      const confidence = 0.6 + (keywordScore * 0.2); // 0.6-0.8 confidence

      if (confidence >= 0.65) {
        log.debug(
          { message: message.substring(0, 100), type: 'pastReference', confidence, timeMs: Date.now() - startTime },
          'Memory query detected (past reference)'
        );

        return {
          isMemoryQuery: true,
          confidence,
          queryType: 'recall',
          keywords,
          temporalContext: 'past',
          rawMatch: pastRefMatch.match,
        };
      }
    }

    // 6. FALLBACK: Keyword-based detection (baja confidence)
    const keywordScore = this.calculateKeywordScore(normalizedMessage);
    if (keywordScore >= 0.5) {
      const keywords = this.extractKeywords(normalizedMessage);

      log.debug(
        { message: message.substring(0, 100), keywordScore, timeMs: Date.now() - startTime },
        'Possible memory query detected (keyword-based)'
      );

      return {
        isMemoryQuery: true,
        confidence: 0.4 + (keywordScore * 0.2), // 0.4-0.6 confidence
        queryType: 'recall',
        keywords,
      };
    }

    // NO ES MEMORY QUERY
    const duration = Date.now() - startTime;
    if (duration > 5) {
      log.warn({ duration }, 'Memory query detection took longer than expected');
    }

    return {
      isMemoryQuery: false,
      confidence: 0,
      queryType: 'none',
      keywords: [],
    };
  }

  /**
   * Normaliza mensaje para matching
   */
  private normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .trim()
      // Normalize punctuation marks
      .replace(/[¿¡]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Verifica si el mensaje es sobre el futuro (no es memoria)
   */
  private isFutureOrientedQuery(message: string): boolean {
    for (const pattern of NEGATIVE_PATTERNS) {
      if (pattern.test(message)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Intenta hacer match con lista de patrones
   */
  private matchPatterns(
    message: string,
    patterns: RegExp[]
  ): { match: string; groups: string[] } | null {
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          match: match[0],
          groups: match.slice(1).filter(Boolean),
        };
      }
    }
    return null;
  }

  /**
   * Extrae keywords relevantes del mensaje
   */
  private extractKeywords(text: string): string[] {
    // Tokenizar
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\sáéíóúñü]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(Boolean);

    // Filtrar stop words y palabras cortas
    const keywords = tokens
      .filter(token =>
        token.length >= 3 &&
        !STOP_WORDS.has(token) &&
        !token.match(/^\d+$/) // No pure numbers
      )
      // Deduplicar
      .filter((token, index, arr) => arr.indexOf(token) === index)
      // Top 10 keywords
      .slice(0, 10);

    return keywords;
  }

  /**
   * Calcula score basado en keywords de memoria presentes
   */
  private calculateKeywordScore(message: string): number {
    const tokens = message
      .toLowerCase()
      .split(/\s+/);

    let matchCount = 0;
    for (const token of tokens) {
      // Filtrar tokens muy cortos para evitar false positives
      if (token.length < 3) continue;

      for (const keyword of MEMORY_KEYWORDS) {
        // Match exacto o el token empieza con el keyword (para conjugaciones)
        // Avoid substring matches (e.g., "me" in "mentioned")
        if (token === keyword || token.startsWith(keyword)) {
          matchCount++;
          break;
        }
      }
    }

    return Math.min(matchCount / 3, 1.0); // Normalizar a 0-1
  }

  /**
   * Detecta contexto temporal en el mensaje
   */
  private detectTemporalContext(message: string): 'recent' | 'past' | 'specific' | undefined {
    // Temporal reciente
    if (message.match(/\b(hoy|ahora|hace\s+poco|hace\s+un\s+rato|recién|recientemente|esta\s+(mañana|tarde|noche))\b/i)) {
      return 'recent';
    }

    // Specific temporal
    if (message.match(/\b(ayer|anoche|anteanoche|hace\s+\d+|el\s+(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)|la\s+semana\s+pasada|el\s+mes\s+pasado)\b/i)) {
      return 'specific';
    }

    // Temporal pasado general
    if (message.match(/\b(antes|pasado|antigua?|anterior|previamente|tiempo\s+atr[áa]s|hace\s+tiempo)\b/i)) {
      return 'past';
    }

    return undefined;
  }

  /**
   * Extrae el tema/tópico principal de la query
   * Útil para refinar la búsqueda semántica
   */
  extractTopic(message: string, detection: MemoryQueryDetection): string {
    // If there's an explicit match, use captured groups
    if (detection.rawMatch) {
      // Limpiar el match de marcadores temporales y verbos de memoria
      const cleaned = detection.rawMatch
        .replace(/¿|¡|\?/g, '')
        .replace(/\b(recuerdas?|te\s+acuerdas?|dije|dijiste|conté|contaste|mencioné|hablamos)\b/gi, '')
        .replace(/\b(que|de|sobre|cuando|si)\b/gi, '')
        .trim();

      if (cleaned.length > 0) {
        return cleaned;
      }
    }

    // Fallback: usar keywords principales
    if (detection.keywords.length > 0) {
      return detection.keywords.slice(0, 3).join(' ');
    }

    // Last resort: mensaje completo limpio
    return message
      .replace(/¿|¡|\?/g, '')
      .trim()
      .substring(0, 100);
  }
}

/**
 * Singleton instance
 */
export const memoryQueryDetector = new MemoryQueryDetector();

/**
 * Helper function para uso rápido
 */
export function detectMemoryQuery(message: string): MemoryQueryDetection {
  return memoryQueryDetector.detectMemoryQuery(message);
}
