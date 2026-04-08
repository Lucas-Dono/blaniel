/**
 * CONTEXT COMPRESSION
 * 
 * Compresses old messages so that free users (10 context)
 * can "see" more history without paying the full cost.
 * 
 * Strategy:
 * - Last N messages: FULL (based on tier)
 * - Old messages: SUMMARIZE (rule-based, NO LLM)
 * 
 * Example:
 * Free user (10 context):
 * - Last 10 messages: full
 * - Messages 11-50: compressed into 1 summary
 * 
 * Savings: $0 (does not use LLM to compress)
 */

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface CompressionResult {
  messages: Message[];
  compressionApplied: boolean;
  originalCount: number;
  compressedCount: number;
}

/** Compresses context based on tier limit */
export async function compressContext(
  messages: Message[],
  maxContextSize: number
): Promise<CompressionResult> {

  // If limit not exceeded, do not compress
  if (messages.length <= maxContextSize) {
    return {
      messages,
      compressionApplied: false,
      originalCount: messages.length,
      compressedCount: messages.length,
    };
  }

  // Last N messages: FULL context
  const recentMessages = messages.slice(-maxContextSize);

  // Mensajes antiguos: COMPRIMIR
  const oldMessages = messages.slice(0, -maxContextSize);

  // Comprimir en grupos de 5 mensajes
  const compressedSummary = compressMessagesSimple(oldMessages);

  // Create mensaje de sistema con resumen
  const summaryMessage: Message = {
    id: `compressed-${Date.now()}`,
    role: 'system',
    content: `[📜 Resumen de ${oldMessages.length} mensajes anteriores:
${compressedSummary}]`,
    createdAt: oldMessages[0]?.createdAt || new Date(),
    metadata: {
      compressed: true,
      originalCount: oldMessages.length,
    },
  };

  return {
    messages: [summaryMessage, ...recentMessages],
    compressionApplied: true,
    originalCount: messages.length,
    compressedCount: recentMessages.length + 1,
  };
}

/**
 * Comprime mensajes usando reglas simples (NO LLM)
 */
function compressMessagesSimple(messages: Message[]): string {
  const summaries: string[] = [];

  // Compress every 5 messages into 1 line
  for (let i = 0; i < messages.length; i += 5) {
    const chunk = messages.slice(i, i + 5);

    // Extraer temas principales (keywords)
    const _topics = extractTopics(chunk);

    // Format: "User spoke about X, Y. AI responded Z."
    const userMessages = chunk.filter(m => m.role === 'user');
    const aiMessages = chunk.filter(m => m.role === 'assistant');

    let summary = '';

    if (userMessages.length > 0) {
      const userTopics = userMessages.map(m =>
        m.content.slice(0, 50).trim() + (m.content.length > 50 ? '...' : '')
      ).join('; ');

      summary += `U: ${userTopics}`;
    }

    if (aiMessages.length > 0) {
      const aiSample = aiMessages[0].content.slice(0, 50).trim() +
                      (aiMessages[0].content.length > 50 ? '...' : '');

      summary += ` | IA: ${aiSample}`;
    }

    summaries.push(summary);
  }

  return summaries.join('\n');
}

/**
 * Extrae keywords/topics de un grupo de mensajes
 */
function extractTopics(messages: Message[]): string[] {
  const stopWords = new Set([
    'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'no', 'haber',
    'por', 'con', 'su', 'para', 'como', 'estar', 'tener', 'le', 'lo', 'todo',
    'pero', 'más', 'hacer', 'o', 'poder', 'decir', 'este', 'ir', 'otro', 'ese',
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for',
  ]);

  const words: Map<string, number> = new Map();

  messages.forEach(msg => {
    const tokens = msg.content
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    tokens.forEach(word => {
      words.set(word, (words.get(word) || 0) + 1);
    });
  });

  // Top 3 most frequent words
  return Array.from(words.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);
}

/**
 * Advanced variant: Compresses ONLY if necessary (lazy)
 * Useful to avoid unnecessary processing
 */
export function shouldCompress(
  messageCount: number,
  maxContextSize: number
): boolean {
  return messageCount > maxContextSize;
}

/** Helper: Estimates tokens saved by compression */
export function estimateTokensSaved(
  originalMessages: Message[],
  maxContextSize: number
): number {
  if (originalMessages.length <= maxContextSize) {
    return 0;
  }

  const oldMessages = originalMessages.slice(0, -maxContextSize);

  // Estimar ~4 chars = 1 token
  const originalTokens = oldMessages.reduce(
    (sum, msg) => sum + Math.ceil(msg.content.length / 4),
    0
  );

  // Resumen comprimido: ~50 chars por grupo de 5 mensajes
  const groups = Math.ceil(oldMessages.length / 5);
  const compressedTokens = groups * Math.ceil(50 / 4);

  return originalTokens - compressedTokens;
}

/** Formats the result of compression for logging */
export function logCompressionStats(result: CompressionResult): void {
  if (!result.compressionApplied) {
    return;
  }

  const savings = ((1 - result.compressedCount / result.originalCount) * 100).toFixed(1);

  console.log(`[ContextCompression] Compressed ${result.originalCount} → ${result.compressedCount} messages (${savings}% reduction)`);
}
