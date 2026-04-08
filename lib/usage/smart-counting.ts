/**
 * SMART MESSAGE COUNTING
 *
 * NO cuenta mensajes triviales para mejorar UX.
 *
 * Filosofía:
 * - "Hola" no debería contar como 1 de tus 10 mensajes
 * - Confirmaciones ("ok", "dale") tampoco
 * - Reacciones emocionales breves ("jaja", "😂") tampoco
 *
 * Impacto:
 * - Reduce mensajes contados en ~10-15%
 * - Mejor percepción de valor ("10 mensajes REALES")
 * - Sin costo adicional (rule-based)
 */

/**
 * Patterns de mensajes que NO se cuentan
 */
const EXEMPT_PATTERNS = [
  // Saludos simples
  /^(hola|hey|hi|hello|buenas|que tal|qué tal)$/i,

  // Confirmaciones
  /^(ok|okay|dale|si|sí|no|genial|perfecto|bien|bueno|entiendo)$/i,

  // Reacciones emocionales
  /^(jaja|jeje|lol|xd|ajaja|jajaja|haha)$/i,

  // Solo emojis
  /^[\p{Emoji}\s]+$/u,

  // Despedidas simples
  /^(chau|adiós|adios|bye|nos vemos|hasta luego)$/i,

  // Mensajes muy cortos (menos de 10 caracteres)
  /^.{1,10}$/,
];

/**
 * Keywords que indican mensaje sustancial (SIEMPRE contar)
 */
const SUBSTANTIVE_KEYWORDS = [
  // Preguntas
  'por qué', 'porque', 'cómo', 'cuando', 'donde', 'dónde', 'quién',
  'cuál', 'cuánto', 'qué significa',

  // Temas profundos
  'siento', 'pienso', 'creo', 'necesito', 'quiero', 'me gustaría',
  'problema', 'ayuda', 'consejo', 'opinión',

  // Narrativa
  'pasó', 'sucedió', 'hoy', 'ayer', 'mañana', 'recuerdo', 'me pasó',
];

/**
 * Verifica si un mensaje debe contarse para el límite diario
 */
export function shouldCountMessage(content: string): boolean {
  const trimmed = content.trim();

  // Always count if empty (security)
  if (!trimmed) {
    return true;
  }

  // NO contar si hace match con patterns triviales
  for (const pattern of EXEMPT_PATTERNS) {
    if (pattern.test(trimmed)) {
      console.log(`[SmartCounting] Message NOT counted (trivial): "${trimmed.slice(0, 30)}..."`);
      return false;
    }
  }

  // SIEMPRE contar si contiene keywords sustanciales
  const lowerContent = trimmed.toLowerCase();
  for (const keyword of SUBSTANTIVE_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      console.log(`[SmartCounting] Message counted (substantive keyword): "${keyword}"`);
      return true;
    }
  }

  // SIEMPRE contar si tiene signos de pregunta
  if (trimmed.includes('?') || trimmed.includes('¿')) {
    console.log(`[SmartCounting] Message counted (question mark)`);
    return true;
  }

  // SIEMPRE contar si es largo (>50 caracteres)
  if (trimmed.length > 50) {
    console.log(`[SmartCounting] Message counted (long message: ${trimmed.length} chars)`);
    return true;
  }

  // Por defecto: CONTAR (ser conservador)
  return true;
}

/**
 * Analiza un mensaje y retorna metadata de conteo
 */
export interface CountingAnalysis {
  shouldCount: boolean;
  reason: 'trivial' | 'substantive' | 'question' | 'long' | 'default';
  exemptPattern?: string;
  length: number;
}

export function analyzeMessage(content: string): CountingAnalysis {
  const trimmed = content.trim();
  const length = trimmed.length;

  // Check trivial patterns
  for (const pattern of EXEMPT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        shouldCount: false,
        reason: 'trivial',
        exemptPattern: pattern.source,
        length,
      };
    }
  }

  // Check substantive keywords
  const lowerContent = trimmed.toLowerCase();
  for (const keyword of SUBSTANTIVE_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      return {
        shouldCount: true,
        reason: 'substantive',
        length,
      };
    }
  }

  // Check question
  if (trimmed.includes('?') || trimmed.includes('¿')) {
    return {
      shouldCount: true,
      reason: 'question',
      length,
    };
  }

  // Check length
  if (length > 50) {
    return {
      shouldCount: true,
      reason: 'long',
      length,
    };
  }

  return {
    shouldCount: true,
    reason: 'default',
    length,
  };
}

/**
 * Stats para analytics
 */
export interface CountingStats {
  totalMessages: number;
  countedMessages: number;
  exemptMessages: number;
  exemptPercentage: number;
}

export function calculateStats(
  messages: Array<{ content: string }>
): CountingStats {
  let countedMessages = 0;

  messages.forEach(msg => {
    if (shouldCountMessage(msg.content)) {
      countedMessages++;
    }
  });

  const exemptMessages = messages.length - countedMessages;
  const exemptPercentage = (exemptMessages / messages.length) * 100;

  return {
    totalMessages: messages.length,
    countedMessages,
    exemptMessages,
    exemptPercentage: Math.round(exemptPercentage),
  };
}
