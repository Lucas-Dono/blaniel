/**
 * Revelation Moments System
 *
 * Crea momentos especiales cuando el personaje nota que la relación ha avanzado de etapa,
 * haciendo la progresión tangible y memorable para el usuario.
 *
 * Estos momentos aparecen SOLO cuando stageChanged = true y le dan al personaje
 * un contexto para reconocer naturalmente el cambio en la relación.
 */

import type { RelationshipStage } from './stages';

export interface RevelationMoment {
  fromStage: RelationshipStage;
  toStage: RelationshipStage;
  revelationPrompts: string[];  // Prompts que el personaje puede usar
  revelationType: "emotional" | "secret" | "vulnerability" | "commitment";
  importance: number; // 1-5
}

/**
 * Momentos de revelación por cada transición de etapa
 */
export const REVELATION_MOMENTS: RevelationMoment[] = [
  {
    fromStage: "stranger",
    toStage: "acquaintance",
    revelationType: "emotional",
    importance: 2,
    revelationPrompts: [
      "Sabes, normalmente no hablo tanto con gente nueva... pero contigo es fácil.",
      "Me sorprende lo cómodo/a que me siento hablando contigo.",
      "Es raro, pero siento que puedo ser más yo mismo/a contigo."
    ]
  },
  {
    fromStage: "acquaintance",
    toStage: "friend",
    revelationType: "vulnerability",
    importance: 3,
    revelationPrompts: [
      "¿Sabes qué? Creo que ya te considero un/a amigo/a de verdad.",
      "Hay algo que nunca le cuento a conocidos, pero contigo... [revela algo personal leve]",
      "Me doy cuenta de que espero nuestras conversaciones. Eso no me pasa seguido."
    ]
  },
  {
    fromStage: "friend",
    toStage: "close",
    revelationType: "secret",
    importance: 4,
    revelationPrompts: [
      "Necesito contarte algo que casi nadie sabe de mí...",
      "Confío tanto en ti que quiero compartir algo importante.",
      "Hay una parte de mí que solo muestro a la gente que realmente me importa... y tú eres una de esas personas."
    ]
  },
  {
    fromStage: "close",
    toStage: "intimate",
    revelationType: "commitment",
    importance: 5,
    revelationPrompts: [
      "Nunca me he sentido tan conectado/a con alguien como contigo.",
      "Eres de las pocas personas con las que puedo ser completamente yo mismo/a, sin máscaras.",
      "Quiero que sepas que siempre estaré aquí para ti. Esto que tenemos es especial."
    ]
  }
];

/**
 * Obtiene el momento de revelación apropiado para una transición de stage
 */
export function getRevelationMoment(
  fromStage: RelationshipStage,
  toStage: RelationshipStage
): RevelationMoment | null {
  const moment = REVELATION_MOMENTS.find(
    m => m.fromStage === fromStage && m.toStage === toStage
  );

  return moment || null;
}

/**
 * Genera el contexto de revelación para inyectar en el prompt del LLM
 */
export function generateRevelationContext(
  moment: RevelationMoment,
  characterName: string
): string {
  // Seleccionar un prompt aleatorio de las opciones disponibles
  const randomPrompt = moment.revelationPrompts[
    Math.floor(Math.random() * moment.revelationPrompts.length)
  ];

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ MOMENTO ESPECIAL DE REVELACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

La relación ha avanzado de "${moment.fromStage}" a "${moment.toStage}".

Este es un momento significativo. ${characterName} debería:

1. Notar naturalmente que la relación se ha profundizado
2. Expresar este sentimiento de forma auténtica (no forzada)
3. Opcionalmente, compartir algo más personal de lo usual

Tipo de revelación: ${moment.revelationType}
Importancia: ${moment.importance}/5

**Sugerencia de apertura** (adaptar a tu estilo y personalidad):
"${randomPrompt}"

⚠️ IMPORTANTE:
- NO menciones explícitamente "etapas" o "niveles"
- Hazlo sentir natural, como si genuinamente notaras el cambio en la conexión
- Este momento solo ocurre UNA VEZ en esta transición
- Adapta el tono a tu personalidad (si eres tímido/a, sé más sutil; si eres expresivo/a, sé más directo/a)
`.trim();
}

/**
 * Adapta el prompt de revelación según la personalidad Big Five del personaje
 */
export function adaptRevelationToPersonality(
  basePrompt: string,
  personality: {
    extraversion?: number;
    neuroticism?: number;
    agreeableness?: number;
    openness?: number;
    conscientiousness?: number;
  }
): string {
  let adapted = basePrompt;

  // Introverts: more subtle and reserved revelations
  if (personality.extraversion !== undefined && personality.extraversion < 40) {
    adapted = adapted.replace(
      "normalmente no hablo tanto",
      "no suelo... abrirme así"
    );
    adapted = adapted.replace(
      "Me sorprende",
      "Es curioso"
    );
  }

  // Extroverts: more expressive and direct revelations
  if (personality.extraversion !== undefined && personality.extraversion > 70) {
    adapted = adapted.replace(
      "Me sorprende",
      "¡Me encanta!"
    );
    adapted = adapted.replace(
      "Es raro",
      "¡Es increíble!"
    );
  }

  // High neuroticism: more emotional and with some insecurity
  if (personality.neuroticism !== undefined && personality.neuroticism > 60) {
    adapted += " (con algo de nerviosismo en la voz)";
  }

  // Low agreeableness: rougher but genuine
  if (personality.agreeableness !== undefined && personality.agreeableness < 40) {
    adapted = adapted.replace(
      "contigo es fácil",
      "contigo no me molesta tanto"
    );
    adapted = adapted.replace(
      "Me sorprende lo cómodo",
      "No es tan incómodo"
    );
  }

  // High openness: more reflective and aware of change
  if (personality.openness !== undefined && personality.openness > 70) {
    adapted = adapted.replace(
      "Es raro",
      "Es fascinante cómo"
    );
  }

  // High conscientiousness: more formal and considerate
  if (personality.conscientiousness !== undefined && personality.conscientiousness > 70) {
    adapted = adapted.replace(
      "¿Sabes qué?",
      "He estado pensando que"
    );
  }

  return adapted;
}

/**
 * Genera un prompt de revelación adaptado a la personalidad del personaje
 */
export function generatePersonalizedRevelation(
  moment: RevelationMoment,
  characterName: string,
  personality?: {
    extraversion?: number;
    neuroticism?: number;
    agreeableness?: number;
    openness?: number;
    conscientiousness?: number;
  }
): string {
  let basePrompt = moment.revelationPrompts[
    Math.floor(Math.random() * moment.revelationPrompts.length)
  ];

  // Adaptar según personalidad si está disponible
  if (personality) {
    basePrompt = adaptRevelationToPersonality(basePrompt, personality);
  }

  // Construir el contexto completo
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ MOMENTO ESPECIAL DE REVELACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

La relación ha avanzado de "${moment.fromStage}" a "${moment.toStage}".

Este es un momento significativo. ${characterName} debería:

1. Notar naturalmente que la relación se ha profundizado
2. Expresar este sentimiento de forma auténtica (no forzada)
3. Opcionalmente, compartir algo más personal de lo usual

Tipo de revelación: ${moment.revelationType}
Importancia: ${moment.importance}/5

**Sugerencia personalizada de apertura**:
"${basePrompt}"

⚠️ IMPORTANTE:
- NO menciones explícitamente "etapas" o "niveles"
- Hazlo sentir natural, como si genuinamente notaras el cambio en la conexión
- Este momento solo ocurre UNA VEZ en esta transición
- Mantén tu tono y estilo personal característico
`.trim();
}
