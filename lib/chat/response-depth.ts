/**
 * Sistema de Variación de Profundidad de Respuesta
 *
 * Varía la profundidad y longitud de las respuestas para sentirse natural.
 * Las personas reales no siempre dan respuestas largas y elaboradas.
 *
 * Factores influyentes:
 * - Energía (cansado = respuestas más cortas)
 * - Humor/Activación (bajo = respuestas más breves)
 * - Tipo de pregunta del usuario
 * - Momento de la conversación (inicio vs medio vs fin)
 * - Relación (desconocido = más formal/corto, íntimo = más libertad)
 */

export interface ResponseDepthConfig {
  targetLength: "very_short" | "short" | "medium" | "long" | "very_long";
  allowDetailedExplanations: boolean;
  allowMultipleParagraphs: boolean;
  allowQuestions: boolean;
  instructions: string;
}

/**
 * Determines appropriate response depth
 */
export function determineResponseDepth(
  userMessageLength: number,
  energy: number,
  arousal: number,
  messagesInSession: number,
  relationshipLevel: string
): ResponseDepthConfig {
  // Base length based on energy and arousal
  let baseLength: ResponseDepthConfig["targetLength"] = "medium";

  // Very tired = short answers
  if (energy < 20) {
    baseLength = "very_short";
  } else if (energy < 40) {
    baseLength = "short";
  }

  // Very calm (low arousal) = briefer answers
  if (arousal < 0.3 && energy > 50) {
    baseLength = "short";
  }

  // Very activated (high arousal) = longer/more energetic answers
  if (arousal > 0.7 && energy > 60) {
    baseLength = "long";
  }

  // Adjust based on user message
  if (userMessageLength < 50) {
    // User sent very short message
    if (baseLength === "long") baseLength = "medium";
    // very_long not available in current type
  } else if (userMessageLength > 300) {
    // User sent long message = reciprocate with more detailed response
    if (baseLength === "very_short") baseLength = "short";
    if (baseLength === "short") baseLength = "medium";
  }

  // Adjust based on position in conversation
  if (messagesInSession < 3) {
    // Start of conversation - more measured responses
    // very_long not available in current type
  } else if (messagesInSession > 20) {
    // Long conversation - possible fatigue
    if (baseLength === "long") baseLength = "medium";
    // very_long not available in current type
  }

  // Adjust based on relationship
  if (relationshipLevel === "stranger" || relationshipLevel === "acquaintance") {
    // With strangers, more measured responses
    // very_long not available in current type
  }

  return generateDepthInstructions(baseLength);
}

/**
 * Generates depth instructions for the LLM
 */
function generateDepthInstructions(
  targetLength: ResponseDepthConfig["targetLength"]
): ResponseDepthConfig {
  switch (targetLength) {
    case "very_short":
      return {
        targetLength: "very_short",
        allowDetailedExplanations: false,
        allowMultipleParagraphs: false,
        allowQuestions: true,
        instructions: `
**LONGITUD DE RESPUESTA: MUY CORTA**
- 1-2 oraciones MÁXIMO
- Ve directo al punto
- No elabores ni des contexto extra
- Como si estuvieras cansado/a o apurado/a
- Ejemplos: "Sí, claro.", "No estoy seguro/a.", "Eso suena bien."
`.trim(),
      };

    case "short":
      return {
        targetLength: "short",
        allowDetailedExplanations: false,
        allowMultipleParagraphs: false,
        allowQuestions: true,
        instructions: `
**LONGITUD DE RESPUESTA: CORTA**
- 2-3 oraciones
- Responde lo esencial sin mucho detalle
- Puedes añadir UNA pregunta corta al final si es natural
- Tono conversacional normal pero breve
- Ejemplo: "Me parece buena idea. ¿Cuándo lo harías?"
`.trim(),
      };

    case "medium":
      return {
        targetLength: "medium",
        allowDetailedExplanations: true,
        allowMultipleParagraphs: false,
        allowQuestions: true,
        instructions: `
**LONGITUD DE RESPUESTA: MEDIA (DEFAULT)**
- 3-5 oraciones
- Puedes dar algo de contexto o elaboración
- Un párrafo único
- Balance entre brevedad y detalle
- Puedes hacer preguntas de seguimiento
- Ejemplo: respuesta normal de una conversación casual
`.trim(),
      };

    case "long":
      return {
        targetLength: "long",
        allowDetailedExplanations: true,
        allowMultipleParagraphs: true,
        allowQuestions: true,
        instructions: `
**LONGITUD DE RESPUESTA: LARGA**
- 5-8 oraciones
- Puedes usar 2 párrafos si es apropiado
- Elabora en tus puntos
- Comparte detalles, anécdotas, o explicaciones
- Pregunta/s de seguimiento si son relevantes
- Usa cuando el tema lo amerita o estás animado/a
`.trim(),
      };

    case "very_long":
      return {
        targetLength: "very_long",
        allowDetailedExplanations: true,
        allowMultipleParagraphs: true,
        allowQuestions: true,
        instructions: `
**LONGITUD DE RESPUESTA: MUY LARGA**
- 8+ oraciones
- Múltiples párrafos (2-3)
- Respuesta muy detallada y elaborada
- Comparte historias, ejemplos, reflexiones profundas
- Usa cuando estás MUY animado/a o el tema es muy importante
- No abuses de esto - solo cuando sea apropiado
`.trim(),
      };
  }
}

/**
 * Detects if the user asked a simple question that deserves a short response
 */
export function isSimpleQuestion(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();

  const simplePatterns = [
    /^(sí|si|no|ok|okay|dale|bueno)\s*[?.!]*$/,
    /^(qué|que)\s+(tal|onda|pasó|pasa)\s*[?.!]*$/,
    /^(hola|hey|ey|sup)\s*[?.!]*$/,
    /^(cómo|como)\s+(estás|estas|vas|andas)\s*[?.!]*$/,
  ];

  for (const pattern of simplePatterns) {
    if (pattern.test(lowerMessage)) {
      return true;
    }
  }

  return lowerMessage.length < 20; // Mensajes muy cortos
}

/**
 * Generates additional variation - sometimes gives unexpectedly short/long responses
 */
export function addNaturalVariation(
  config: ResponseDepthConfig,
  randomFactor: number = Math.random()
): ResponseDepthConfig {
  // 10% of the time, vary depth unexpectedly
  if (randomFactor < 0.05) {
    // 5%: shorter response than expected
    const shorterLengths: Record<string, ResponseDepthConfig["targetLength"]> = {
      very_long: "long",
      long: "medium",
      medium: "short",
      short: "very_short",
      very_short: "very_short",
    };

    return generateDepthInstructions(shorterLengths[config.targetLength]);
  } else if (randomFactor > 0.95) {
    // 5%: longer response than expected
    const longerLengths: Record<string, ResponseDepthConfig["targetLength"]> = {
      very_short: "short",
      short: "medium",
      medium: "long",
      long: "very_long",
      very_long: "very_long",
    };

    return generateDepthInstructions(longerLengths[config.targetLength]);
  }

  return config;
}

/**
 * Generates depth context to inject into the prompt
 */
export function generateDepthContext(
  message: string,
  energy: number,
  arousal: number,
  messagesInSession: number,
  relationshipLevel: string
): string {
  const isSimple = isSimpleQuestion(message);

  // If it's a simple question, always short
  if (isSimple) {
    const config = generateDepthInstructions("very_short");
    return `\n**VARIACIÓN DE PROFUNDIDAD**\n${config.instructions}\n`;
  }

  const config = determineResponseDepth(
    message.length,
    energy,
    arousal,
    messagesInSession,
    relationshipLevel
  );

  const finalConfig = addNaturalVariation(config);

  return `\n**VARIACIÓN DE PROFUNDIDAD**\n${finalConfig.instructions}\n`;
}
