/**
 * Category Classifier Service
 *
 * 2-tier system for classifying conversation categories:
 *
 * LEVEL 1: Cache (90% of cases) - FREE for everyone
 * LEVEL 2a: Expanded Keywords + Patterns for FREE - $0 but limited
 * LEVEL 2b: Venice (uncensored) for PAID - Smart, proactive and 100% PRIVATE
 *
 * Business strategy:
 * - FREE: Expanded keywords (synonyms, typos, emojis, patterns) → $0 but limited
 * - PAID: AI with Venice → BRUTAL difference + TOTAL PRIVACY
 *
 * Key competitive advantage:
 * - TOTAL PRIVACY: Venice saves NOTHING (vs Google/OpenAI which do save)
 * - Marketing: "Your conversations are 100% private"
 * - No censorship for NSFW content
 * - Cost: $0.000078/msg → $2.34/month (10K msgs/day with 90% cache)
 * - Worth every cent for user trust
 */

import { createLogger } from '@/lib/logger';
import { createHash } from 'crypto';
import { redis } from '@/lib/redis';

const log = createLogger('CategoryClassifier');

export type ConversationCategory =
  | 'greeting'
  | 'conversation_starter'
  | 'game_proposal'
  | 'emotional_support'
  | 'escalation'
  | 'sexual_initiative';

const CACHE_TTL = 604800; // 7 days in seconds
const CACHE_PREFIX = 'category:';

/**
 * Expanded keywords dictionary by category
 * Includes: synonyms, common typos, regional expressions, emojis
 */
const KEYWORDS_DICTIONARY: Record<ConversationCategory, string[]> = {
  greeting: [
    // Formal greetings
    'hello', 'good morning', 'good afternoon', 'good evening', 'greetings',
    'hey', 'how\'s it going', 'how are you', 'how\'s it', 'what\'s up',

    // Typos
    'hlo', 'hel', 'gud morning',

    // Emojis
    '👋', '👋🏼', '🙋', '🙋‍♂️', '🙋‍♀️',
  ],

  emotional_support: [
    // Formal Spanish
    'sad', 'sadness', 'depressed', 'depression', 'depressive',
    'bad', 'awful', 'horrible', 'terrible', 'terrible',
    'problem', 'problems', 'worried', 'worry', 'anguish', 'anguished',
    'alone', 'solitude', 'cry', 'tears', 'crying',
    'downhearted', 'discouraged', 'slump', 'downcast', 'melancholy', 'melancholic',
    'sorrow', 'pain', 'suffering', 'suffer', 'desperate', 'desperation',
    'anxiety', 'anxious', 'nervous', 'stressed', 'stress', 'overwhelmed',

    // Common variations/typos
    'sad', 'depres', 'worry', 'angst', 'discourag',
    'worry', 'angsti', 'anxie',

    // Colloquial expressions - Argentina
    'para el orto', 'de la re putísima madre', 'hecho mierda', 'de la san puta',
    'una mierda', 'pa la mierda', 'como el orto', 'mal mal', 're mal',
    'cagado', 'bajón zarpado', 're bajón',

    // Colloquial expressions - Mexico
    'de la chingada', 'bien culero', 'bien gacho', 'me lleva la chingada',
    'todo culero', 'bien jodido', 'valió madres',

    // Colloquial expressions - Spain
    'fatal', 'de pena', 'hecho polvo', 'de puta pena', 'como el culo',
    'jodido', 'chungo', 'regular tirando a mal',

    // Colloquial expressions - Chile
    'la wea mala', 'como el pico', 'pal pico', 'como las weas',

    // Colloquial expressions - Colombia
    'todo maluco', 'bien grave', 'bien mal parce',

    // Emojis
    '😢', '😭', '😔', '😞', '😟', '😥', '😪', '😓', '💔', '😿',
    '😩', '😣', '😖', '😫', '🥺', '😰', '😨', '😱',
  ],

  game_proposal: [
    // Explicit boredom
    'aburrido', 'aburido', 'aburrida', 'aburrimiento', 'aburro',
    'aburriendo', 'aburridisimo', 'aburridísimo', 're aburrido',

    // Apathy/disinterest
    'no sé', 'nose', 'no se', 'mmm', 'hmm', 'meh', 'bah', 'pff',
    'ok', 'okay', 'ya', '...', 'dale', 'bueno', 'si', 'sí',
    'da igual', 'me da lo mismo', 'me da igual', 'lo que sea',
    'como quieras', 'lo que quieras', 'vos decí', 'tú di',

    // Doing nothing
    'nada', 'no hago nada', 'sin hacer nada', 'acá nomas', 'acá nomás',
    'por ahí', 'tirado', 'tirada', 'sin hacer', 'pavadas',

    // Typos
    'aburido', 'aburrdo', 'aburrdo',

    // Emojis
    '😐', '😑', '🥱', '😴', '😪', '🙄', '😶',
  ],

  escalation: [
    // Attraction/romantic interest
    'me gustas', 'me atraes', 'me encantas', 'te quiero', 'te amo',
    'gustar', 'atraer', 'querer', 'amor', 'cariño', 'atracción',
    'bonito', 'bonita', 'lindo', 'linda', 'hermoso', 'hermosa',
    'guapo', 'guapa', 'bello', 'bella', 'precioso', 'preciosa',

    // Physical contact (soft)
    'beso', 'besar', 'abrazar', 'abrazo', 'tocar', 'acariciar',
    'cercanía', 'cerca', 'junto', 'juntos',

    // Flirting
    'coqueteo', 'coquetear', 'seducir', 'seducción', 'galanteo',

    // Emojis
    '😍', '🥰', '😘', '💕', '💖', '💗', '💓', '💞', '💝',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🖤', '💋',
  ],

  sexual_initiative: [
    // Explicit sexual content
    'sexo', 'sexual', 'coger', 'follar', 'culear', 'chingar',
    'penetrar', 'penetración', 'oral', 'mamada', 'pete', 'chupada',
    'deseo', 'ganas', 'cachondo', 'caliente', 'excitado', 'excitada',
    'tocar', 'tocarte', 'acariciar', 'masturbación', 'masturbar',
    'desnudo', 'desnuda', 'cuerpo', 'piel', 'cama',

    // Explicit
    'pene', 'polla', 'verga', 'pija', 'vagina', 'concha', 'coño',
    'tetas', 'pechos', 'culo', 'nalgas', 'trasero',

    // Emojis
    '🍆', '🍑', '💦', '👅', '🔥', '😈', '😏',
  ],

  conversation_starter: [
    // Default - no specific keywords
    // This category is used when it doesn't match the above
  ],
};

/**
 * Generates hash of conversation for cache
 */
function hashConversation(messages: string[]): string {
  const text = messages.join('|').toLowerCase();
  return createHash('md5').update(text).digest('hex');
}

/**
 * LEVEL 1: Check cache (90% hit rate)
 */
async function getCachedCategory(messages: string[]): Promise<ConversationCategory | null> {
  try {
    const hash = hashConversation(messages);
    const cached = await redis.get(`${CACHE_PREFIX}${hash}`);

    if (cached) {
      log.debug({ hash, category: cached }, 'Category retrieved from cache');
      return cached as ConversationCategory;
    }

    return null;
  } catch (error) {
    log.warn({ error }, 'Cache retrieval failed, continuing without cache');
    return null;
  }
}

/**
 * Guardar categoría en caché
 */
async function cacheCategory(messages: string[], category: ConversationCategory): Promise<void> {
  try {
    const hash = hashConversation(messages);
    await redis.setex(`${CACHE_PREFIX}${hash}`, CACHE_TTL, category);
    log.debug({ hash, category }, 'Category cached');
  } catch (error) {
    log.warn({ error }, 'Failed to cache category, continuing');
  }
}

/**
 * NIVEL 2a: Clasificación con Keywords Expandidos + Patrones (FREE)
 *
 * Ventajas:
 * - GRATIS ($0 de costo)
 * - Rápido (~1ms)
 * - Detecta sinónimos comunes y typos
 * - Multiregional (Argentina, México, España, Chile, Colombia)
 * - Detecta emojis
 *
 * Limitaciones:
 * - Requiere palabras/frases específicas
 * - No entiende contextos complejos
 * - Menos proactivo
 * - Precisión: 50-60%
 */
function classifyWithKeywords(messages: string[]): ConversationCategory {
  const conversationText = messages.slice(-5).join(' ').toLowerCase();

  // Pattern analysis (before keywords to detect boredom)

  // PATTERN 1: Short repetitive messages (boredom)
  const shortMessages = messages.filter(m => m.trim().length < 30).length;
  if (shortMessages > 3) {
    log.debug({ shortMessages }, 'Short messages pattern detected → game_proposal');
    return 'game_proposal';
  }

  // PATTERN 2: Multiple ellipsis (apathy)
  const ellipsisCount = (conversationText.match(/\.\.\./g) || []).length;
  if (ellipsisCount >= 2) {
    log.debug({ ellipsisCount }, 'Ellipsis pattern detected → game_proposal');
    return 'game_proposal';
  }

  // PATTERN 3: Only emojis without text (several possible categories)
  const onlyEmojis = messages.every(m => /^[\p{Emoji}\s]+$/u.test(m));
  if (onlyEmojis) {
    // Detect emoji type
    if (KEYWORDS_DICTIONARY.emotional_support.some(k => conversationText.includes(k))) {
      return 'emotional_support';
    }
    if (KEYWORDS_DICTIONARY.game_proposal.some(k => conversationText.includes(k))) {
      return 'game_proposal';
    }
  }

  // Search by keywords (priority order)
  const priorities: ConversationCategory[] = [
    'sexual_initiative',
    'emotional_support',
    'escalation',
    'game_proposal',
    'greeting',
  ];

  for (const category of priorities) {
    const keywords = KEYWORDS_DICTIONARY[category];

    // Search for matches
    const matches = keywords.filter(keyword => {
      // Exact word search (not substring)
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(conversationText) || conversationText.includes(keyword);
    });

    if (matches.length > 0) {
      log.debug({ category, matches: matches.slice(0, 3), method: 'keywords' }, 'Category classified with keywords');
      return category;
    }
  }

  // Default: conversation_starter
  log.debug({ method: 'keywords-default' }, 'No keywords matched → conversation_starter');
  return 'conversation_starter';
}

/**
 * NIVEL 2b: Clasificación con Venice (PAID)
 *
 * Ventajas:
 * - MUY preciso (90-95% accuracy)
 * - Entiende contextos complejos y sutilezas
 * - MUY proactivo (detecta emociones sin palabras explícitas)
 * - Flexible y adaptable
 * - 🔒 PRIVACIDAD TOTAL: Sin logging, sin almacenamiento
 * - Sin censura (perfecto para NSFW)
 *
 * Costo:
 * - ~$0.50 / 1M tokens (promedio input+output)
 * - ~155 tokens total = $0.000078 por clasificación
 * - Con caché 90%: ~$0.0000078 promedio
 * - 10,000 msgs/día = $2.34/mes
 *
 * 💎 VALOR AGREGADO: "PRIVACIDAD TOTAL" como diferenciador de marketing
 */
async function classifyWithLLM(messages: string[]): Promise<ConversationCategory> {
  try {
    const { getVeniceClient } = await import('@/lib/emotional-system/llm/venice');
    const venice = getVeniceClient();

    const systemPrompt = `Eres un clasificador experto de conversaciones. Analiza los mensajes recientes y determina la categoría de respuesta que el usuario necesita.

**CATEGORÍAS DISPONIBLES:**

1. **greeting** - Primer saludo del día
   - Usuario acaba de iniciar conversación
   - Dice "hola", "buenos días", "hey", etc.

2. **conversation_starter** - Iniciar/continuar conversación normal
   - Conversación fluida y casual
   - Sin necesidades específicas detectadas
   - Charla general

3. **game_proposal** - Usuario aburrido, necesita entretenimiento
   - Mensajes cortos y repetitivos ("ok", "mmm", "ya", "...")
   - Dice estar aburrido o sin hacer nada
   - Baja energía en las respuestas
   - Apatía detectada (incluso sin decir "aburrido")
   - Respuestas monosilábicas
   - Falta de iniciativa

4. **emotional_support** - Usuario necesita apoyo emocional
   - Expresa tristeza, preocupación, angustia
   - Menciona problemas o situaciones difíciles
   - Tono negativo o desanimado
   - DETECTA PROACTIVAMENTE: "cabizbajo", "desanimado", "me siento raro"
   - Incluso si no dice "triste" explícitamente
   - Cambios de humor sutiles
   - Lenguaje corporal emocional (emojis tristes)

5. **escalation** - Contexto romántico/flirteo ligero
   - Expresa atracción o cariño
   - Flirteo sutil o directo
   - Busca cercanía emocional/física (no sexual)
   - Cumplidos románticos

6. **sexual_initiative** - Contenido sexual explícito
   - Menciones sexuales directas
   - Deseo sexual explícito
   - Contexto claramente NSFW

**INSTRUCCIONES:**

1. Lee TODOS los mensajes para entender el contexto
2. Detecta el ESTADO EMOCIONAL aunque no use palabras exactas
3. Sé MUY PROACTIVO: detecta necesidades antes de que las expresen
4. Analiza PATRONES de comportamiento (no solo palabras)
5. Responde SOLO con el nombre de la categoría (sin explicación)

**EJEMPLOS DE PROACTIVIDAD:**

Usuario: "no sé", "...", "da igual"
→ game_proposal (detecta apatía sin decir "aburrido")

Usuario: "me siento raro", "no sé explicarlo"
→ emotional_support (detecta malestar sin decir "triste")

Usuario: "todo bien" + "..." + "😔"
→ emotional_support (detecta incongruencia emoji-texto)

Responde SOLO con: greeting, conversation_starter, game_proposal, emotional_support, escalation, o sexual_initiative`;

    const conversationText = messages.slice(-5).join('\n');
    const userMessage = `Conversación reciente:
${conversationText}

¿Qué categoría de respuesta necesita el usuario?`;

    const response = await venice.generateWithMessages({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.3, // Baja temperatura para clasificación consistente
      maxTokens: 10,    // Solo necesita 1 palabra
      model: 'venice-uncensored',
    });

    // Limpiar y validar respuesta
    const category = response.trim().toLowerCase().replace(/['"]/g, '') as ConversationCategory;

    const validCategories: ConversationCategory[] = [
      'greeting',
      'conversation_starter',
      'game_proposal',
      'emotional_support',
      'escalation',
      'sexual_initiative',
    ];

    if (validCategories.includes(category)) {
      log.info({ category, method: 'llm' }, 'Category classified with LLM');
      return category;
    }

    // If response is invalid, try to extract
    for (const validCategory of validCategories) {
      if (response.toLowerCase().includes(validCategory)) {
        log.info({ category: validCategory, method: 'llm-extracted' }, 'Category classified with LLM (extracted)');
        return validCategory;
      }
    }

    // Fallback
    log.warn({ response }, 'LLM response invalid, falling back to keywords');
    return classifyWithKeywords(messages);
  } catch (error) {
    log.error({ error }, 'LLM classification failed, falling back to keywords');
    return classifyWithKeywords(messages);
  }
}

/**
 * FUNCIÓN PRINCIPAL: Detectar categoría según tier del usuario
 *
 * NIVEL 1: Caché (90% hit rate) - GRATIS para todos
 * NIVEL 2a: Keywords expandidos (FREE) - $0
 * NIVEL 2b: Gemini Flash 2.0 Lite (PAID) - $0.000017/msg (~gratis hasta 1,500/día)
 */
export async function detectConversationCategory(
  messages: string[],
  userTier: 'free' | 'plus' | 'ultra' = 'free'
): Promise<ConversationCategory> {
  if (!messages || messages.length === 0) {
    return 'conversation_starter';
  }

  // LEVEL 1: Check cache (90% hit rate for everyone)
  const cached = await getCachedCategory(messages);
  if (cached) {
    return cached; // ← FREE and instant
  }

  // LEVEL 2: Classify by tier
  let category: ConversationCategory;

  if (userTier === 'plus' || userTier === 'ultra') {
    // PAID: Use Gemini Flash 2.0 Lite (precise and proactive)
    category = await classifyWithLLM(messages);
  } else {
    // FREE: Use expanded keywords + patterns (free but limited)
    category = classifyWithKeywords(messages);
  }

  // Save to cache for 7 days
  await cacheCategory(messages, category);

  return category;
}
