/**
 * [SEARCH:...] Command Interceptor
 *
 * Detecta cuando la IA solicita buscar en la memoria y ejecuta la búsqueda
 * Similar a knowledge-interceptor y remember-interceptor
 */

import { createLogger } from '@/lib/logger';
import { searchMemoryHuman, formatMemorySearchForPrompt } from './smart-search';

const log = createLogger('SearchInterceptor');

// Regex para detectar comandos SEARCH
const SEARCH_PATTERN = /\[SEARCH:([^\]]+)\]/gi;

export interface SearchCommandResult {
  shouldIntercept: boolean;
  searchQuery: string | null;
  memoryContext: string | null;
  cleanResponse: string;
}

/**
 * Interceptar comandos [SEARCH:...] en la respuesta de la IA
 */
export async function interceptSearchCommand(
  agentId: string,
  userId: string,
  response: string
): Promise<SearchCommandResult> {
  const match = SEARCH_PATTERN.exec(response);

  if (!match) {
    return {
      shouldIntercept: false,
      searchQuery: null,
      memoryContext: null,
      cleanResponse: response,
    };
  }

  const searchQuery = match[1].trim();

  log.debug({ agentId, userId, searchQuery }, 'Comando SEARCH detectado');

  try {
    // Execute memory search
    const searchResult = await searchMemoryHuman(agentId, userId, searchQuery);

    // Formatear resultados para el prompt
    const memoryContext = formatMemorySearchForPrompt(searchResult);

    // Remover el comando de la respuesta
    const cleanResponse = response.replace(SEARCH_PATTERN, '').trim();

    log.info(
      {
        agentId,
        userId,
        searchQuery,
        found: searchResult.found,
        confidence: searchResult.confidence,
        timeMs: searchResult.searchTimeMs,
      },
      'Búsqueda de memoria completada'
    );

    return {
      shouldIntercept: true,
      searchQuery,
      memoryContext,
      cleanResponse,
    };
  } catch (error) {
    log.error({ error, agentId, userId, searchQuery }, 'Error ejecutando búsqueda de memoria');

    // En caso de error, retornar sin interceptar
    return {
      shouldIntercept: false,
      searchQuery,
      memoryContext: null,
      cleanResponse: response,
    };
  }
}

/**
 * Instrucciones para la IA sobre cómo usar [SEARCH:...]
 */
export const SEARCH_INSTRUCTIONS = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 COMANDO [SEARCH:...] - BÚSQUEDA DE MEMORIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Si el usuario pregunta algo que NO recordás de los últimos 10 mensajes,
podés usar el comando [SEARCH:...] para buscar en toda la conversación pasada.

FORMATO:
[SEARCH:palabras clave de búsqueda]

EJEMPLOS DE USO:

Usuario: "¿Cómo se llamaba mi perro?"
Vos: [SEARCH:perro mascota nombre]
Sistema: Te da resultados con nivel de confianza
Vos: "Sí! Tu perro se llama Max" (si confidence = high)

Usuario: "¿Qué me dijiste sobre mi trabajo?"
Vos: [SEARCH:trabajo empleo oficina]
Sistema: Te da resultados
Vos: Respondes según la confianza

Usuario: "¿Recuerdas lo de mi cumpleaños?"
Vos: [SEARCH:cumpleaños fecha celebración]

REGLAS:
1. Usá keywords relevantes separadas por espacio
2. NO uses preguntas, solo palabras clave
3. Máximo 3-5 palabras clave
4. El sistema te dará automáticamente los resultados con nivel de confianza
5. Respondé según el nivel de confianza que te den

CUÁNDO USAR:
- Usuario pregunta sobre algo que no está en los últimos 10 mensajes
- Necesitás recordar información específica del pasado
- El usuario dice "¿recuerdas...?" o "¿qué te dije sobre...?"

CUÁNDO NO USAR:
- Si ya tenés la información en los últimos mensajes
- Si es algo que acaba de pasar
- Si el usuario está contándote algo nuevo
`;
