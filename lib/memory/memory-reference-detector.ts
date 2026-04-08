/**
 * Memory Reference Detector
 *
 * Detecta cuando un mensaje de la IA hace referencia a conversaciones, hechos,
 * eventos o personas anteriores, para poder mostrar "Memory Highlights" en el chat.
 *
 * Estrategia:
 * 1. Análisis de patrones lingüísticos (regex + keywords)
 * 2. Cross-referencia con memoria recuperada
 * 3. Opcional: LLM para casos complejos
 */

import { MemoryContext } from "./manager";

export interface MemoryReference {
  type: "conversation" | "fact" | "event" | "person";
  content: string; // What is being remembered
  originalTimestamp?: Date; // When it originally happened
  context?: string; // Additional context
  confidence: number; // 0-1, how confident we are
}

/**
 * Patrones que indican referencias a memoria
 */
const MEMORY_PATTERNS = {
  conversation: [
    /recuerdo que (dijiste|me contaste|mencionaste|comentaste)/i,
    /como (dijiste|mencionaste|comentaste) (hace|el otro día|ayer|la semana pasada)/i,
    /(me|te) contaste (que|sobre|acerca de)/i,
    /hablamos (de|sobre|acerca de) (eso|esto)/i,
    /(la|nuestra) conversación (anterior|pasada|de ayer)/i,
    /cuando (hablamos|conversamos|platicamos)/i,
  ],
  fact: [
    /recuerdo que (tu|tú)/i,
    /sé que (tu|tú)/i,
    /me dijiste que (tu|tú)/i,
    /tengo entendido que/i,
    /si no me equivoco/i,
  ],
  event: [
    /recuerdo (ese|aquel) (día|momento|evento)/i,
    /cuando (pasó|ocurrió|sucedió)/i,
    /el (día|momento) que/i,
  ],
  person: [
    /recuerdo que (mencionaste|hablaste de) (a|sobre)/i,
    /me contaste (de|sobre|acerca de) (tu|a)/i,
  ],
};

/**
 * Keywords que refuerzan la detección
 */
const MEMORY_KEYWORDS = [
  "recuerdo",
  "recordé",
  "me acuerdo",
  "dijiste",
  "mencionaste",
  "comentaste",
  "contaste",
  "hablamos",
  "conversamos",
  "antes",
  "anterior",
  "pasado",
  "la vez que",
  "cuando",
];

/**
 * Detecta referencias a memoria en un mensaje
 */
export function detectMemoryReferences(
  agentMessage: string,
  memoryContext?: MemoryContext
): MemoryReference[] {
  const references: MemoryReference[] = [];

  // Strategy 1: Pattern-based detection
  const patternReferences = detectByPatterns(agentMessage);
  references.push(...patternReferences);

  // Strategy 2: Cross-reference with retrieved memory
  if (memoryContext && memoryContext.relevantMessages.length > 0) {
    const contextReferences = detectByMemoryContext(
      agentMessage,
      memoryContext
    );
    references.push(...contextReferences);
  }

  // Deduplicar y ordenar por confidence
  const uniqueReferences = deduplicateReferences(references);
  uniqueReferences.sort((a, b) => b.confidence - a.confidence);

  // Retornar solo las de alta confianza (>0.5)
  return uniqueReferences.filter((ref) => ref.confidence >= 0.5);
}

/**
 * Detecta referencias usando patrones de regex
 */
function detectByPatterns(message: string): MemoryReference[] {
  const references: MemoryReference[] = [];

  for (const [type, patterns] of Object.entries(MEMORY_PATTERNS)) {
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        // Extract the relevant content (after the pattern)
        const matchIndex = match.index || 0;
        const matchLength = match[0].length;
        const afterMatch = message
          .substring(matchIndex + matchLength)
          .trim();

        // Take until the next period or 100 characters
        const endIndex = afterMatch.search(/[.!?]/);
        const content =
          endIndex > 0
            ? afterMatch.substring(0, endIndex)
            : afterMatch.substring(0, 100);

        references.push({
          type: type as MemoryReference["type"],
          content: content || match[0],
          confidence: 0.7, // Medium confidence for pattern matching
        });

        break; // Solo una referencia por tipo
      }
    }
  }

  // Boost confidence if there are multiple keywords
  const keywordCount = MEMORY_KEYWORDS.filter((keyword) =>
    message.toLowerCase().includes(keyword)
  ).length;

  if (keywordCount >= 2) {
    references.forEach((ref) => {
      ref.confidence = Math.min(1.0, ref.confidence + 0.15);
    });
  }

  return references;
}

/**
 * Detecta referencias usando el contexto de memoria recuperada
 */
function detectByMemoryContext(
  message: string,
  memoryContext: MemoryContext
): MemoryReference[] {
  const references: MemoryReference[] = [];

  // If the message is similar to any retrieved memory, it's likely making a reference
  for (const memory of memoryContext.relevantMessages) {
    // Check if message contains similar content to memory
    const similarity = calculateSimilarity(
      message.toLowerCase(),
      memory.content.toLowerCase()
    );

    if (similarity > 0.3) {
      // Semantic overlap exists
      references.push({
        type: "conversation",
        content: memory.content.substring(0, 100), // Truncate for display
        originalTimestamp: memory.timestamp,
        confidence: Math.min(0.95, similarity + 0.2), // Cap at 0.95
      });
    }
  }

  return references;
}

/**
 * Calcula similitud simple entre dos strings (Jaccard similarity)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/).filter((w) => w.length > 3));
  const words2 = new Set(str2.split(/\s+/).filter((w) => w.length > 3));

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Deduplicar referencias similares
 */
function deduplicateReferences(
  references: MemoryReference[]
): MemoryReference[] {
  const unique: MemoryReference[] = [];

  for (const ref of references) {
    const isDuplicate = unique.some(
      (existing) =>
        existing.type === ref.type &&
        calculateSimilarity(existing.content, ref.content) > 0.7
    );

    if (!isDuplicate) {
      unique.push(ref);
    } else {
      // If duplicate, boost confidence of existing
      const existing = unique.find(
        (e) =>
          e.type === ref.type &&
          calculateSimilarity(e.content, ref.content) > 0.7
      );
      if (existing) {
        existing.confidence = Math.min(
          1.0,
          existing.confidence + ref.confidence * 0.2
        );
      }
    }
  }

  return unique;
}

/**
 * Versión avanzada con LLM (opcional, para casos complejos)
 * Esta función se puede llamar si las heurísticas no son suficientes
 */
export async function detectMemoryReferencesWithLLM(
  agentMessage: string,
  memoryContext: MemoryContext
): Promise<MemoryReference[]> {
  // TODO: Implementar con LLM si es necesario
  // For now, return basic detection
  return detectMemoryReferences(agentMessage, memoryContext);
}
