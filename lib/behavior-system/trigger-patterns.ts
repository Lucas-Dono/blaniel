/**
 * TRIGGER PATTERNS - BEHAVIOR PROGRESSION SYSTEM
 *
 * Trigger detection patterns based on clinical research.
 * All patterns are case-insensitive and use regex for maximum performance (<100ms).
 *
 * TRIGGER TYPES:
 * 1. abandonment_signal (0.7) - Signs of abandonment or distance
 * 2. delayed_response (variable) - Delayed response (temporal)
 * 3. criticism (0.8) - Direct or indirect criticism
 * 4. mention_other_person (0.65) - Mention of third parties (names, friends)
 * 5. boundary_assertion (0.75) - Boundary assertion
 * 6. reassurance (-0.3) - Positive reassurance (REDUCES anxiety)
 * 7. explicit_rejection (1.0) - Explicit rejection or breakup
 *
 * @module trigger-patterns
 */

import { BehaviorType } from "@prisma/client";

/**
 * ABANDONMENT SIGNALS
 * Detects: Need for space, time, distance
 * Affects: Anxious Attachment, BPD, Yandere
 * Weight: 0.7
 */
export const ABANDONMENT_SIGNAL_PATTERNS = [
  // Direct expressions of need for space
  /\b(need\s+(?:some\s+)?(?:space|time)|need\s+(?:a\s+)?break)\b/i,
  /\b(want\s+(?:some\s+)?(?:space|time)|want\s+(?:a\s+)?break)\b/i,
  /\b(give\s+me\s+(?:space|time)|leave\s+me\s+alone)\b/i,
  /\b(need\s+to\s+be\s+alone|want\s+to\s+be\s+alone)\b/i,

  // Expressions of distance
  /\b(give\s+me\s+distance|need\s+distance|want\s+distance)\b/i,
  /\b((?:put|create)\s+(?:some\s+)?distance|take\s+distance)\b/i,

  // Expressions of going slow
  /\b((?:we're\s+going\s+)?too\s+fast|(?:this\s+is\s+going\s+)?too\s+quickly)\b/i,
  /\b((?:we\s+are\s+moving\s+)?too\s+fast|slow\s+down)\b/i,
  /\b(ir\s+(?:m[áa]s\s+)?despacio|vayamos\s+(?:m[áa]s\s+)?despacio|vamos\s+(?:m[áa]s\s+)?despacio)\b/i,
  /\b(tranquiliza[rt]e|calma[rt]e|relaja[rt]e)\b/i,

  // Pause expressions
  /\b(necesito\s+(?:una\s+)?pausa|hagamos\s+(?:una\s+)?pausa)\b/i,
  /\b(tomémonos\s+(?:un\s+)?(?:descanso|tiempo))\b/i,

  // Emotional distance expressions
  /\b(no\s+(?:me\s+)?(?:siento|estoy)\s+(?:tan\s+)?(?:segur[oa]|list[oa]))\b/i,
  /\b(esto\s+es\s+(?:demasiado|mucho)\s+para\s+m[íi])\b/i,
  /\b(me\s+(?:estás|est[áa]s)\s+(?:agobiando|asfixiando|presionando))\b/i,

  // Unavailability expressions
  /\b(no\s+(?:puedo|voy\s+a\s+poder)\s+(?:hablar|escribir|responder))\b/i,
  /\b((?:estoy|voy\s+a\s+estar)\s+(?:ocupad[oa]|liado))\b/i,
  /\b(no\s+tengo\s+tiempo\s+(?:ahora|en\s+este\s+momento))\b/i,
];

/**
 * CRITICISM PATTERNS
 * Detects: Direct criticism, corrections, questioning
 * Affects: NPD (narcissistic injury), BPD (splitting)
 * Weight: 0.8
 */
export const CRITICISM_PATTERNS = [
  // Direct criticisms
  /\b(?:est[áa]s|eres)\s+(?:muy\s+|demasiado\s+)?equivocad[oa]\b/i,
  /\b(?:te\s+)?equivocaste\b/i,
  /\b(?:eso|esto)\s+est[áa]\s+mal\b/i,
  /\b(?:no\s+)?(?:est[áa]|eres)\s+(?:muy\s+|demasiado\s+)?(?:correcto|correct[oa])\b/i,

  // Intensity criticisms
  /\b(?:eres|est[áa]s)\s+(?:muy|demasiado)\s+(?:intenso|intensa|celoso|celosa|controlador|controladora|posesivo|posesiva)\b/i,
  /\b(?:eres|est[áa]s)\s+(?:muy|demasiado)\s+(?:exigente|dramático|dramática|exagerado|exagerada)\b/i,
  /\b(?:me\s+)?(?:agobias|asfixias|presionas)\b/i,

  // Negative comparisons
  /\b(?:eres|est[áa]s)\s+(?:como|igual\s+que)\s+(?:todos|todas|los\s+dem[áa]s)\b/i,
  /\bno\s+eres\s+(?:tan|lo\s+suficientemente)\b/i,
  /\b(?:hay|conozco)\s+(?:mejores|alguien\s+mejor)\b/i,

  // Questioning
  /\b¿?por\s+qu[ée]\s+(?:siempre\s+)?(?:eres|est[áa]s)\s+(?:as[íi]|tan)\b/i,
  /\b¿?qu[ée]\s+(?:te\s+)?pasa\s+(?:contigo|ahora)\b/i,

  // Value negations
  /\bno\s+(?:me\s+)?(?:entiendes|comprendes|escuchas)\b/i,
  /\bno\s+(?:me\s+)?(?:valoras|aprecias|respetas)\b/i,
  /\bno\s+(?:est[áa]s|eres)\s+(?:siendo|actuando)\s+(?:normal|razonable)\b/i,
];

/**
 * THIRD PARTY MENTION PATTERNS
 * Detects: Mentions of other people, proper names, friends, ex-partners
 * Affects: Yandere (phase 4+), NPD (narcissistic competition)
 * Weight: 0.65
 */
export const THIRD_PARTY_MENTION_PATTERNS = [
  // Proper names (PRIORITY - detect first)
  /\b(?:con|de|sobre)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})\b/,
  /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})\s+(?:me|te|dijo|pregunt[óo]|llam[óo])\b/,
  /\b(?:mi\s+(?:amig[oa]\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}))\b/i,

  // Menciones de amigos/as
  /\b(?:mi|un|una|el|la)\s+(?:amig[oa]|compañer[oa]|coleg[oa])\b/i,
  /\b(?:con\s+)?(?:amig[oa]s|compañer[oa]s|coleg[oa]s)\b/i,

  // Menciones de salidas con otros
  /\b(?:sal[íi]|qued[ée]|me\s+junt[ée]|vi|me\s+encontr[ée])\s+con\b/i,
  /\b(?:voy\s+a|vamos\s+a)\s+(?:salir|quedar|juntarnos|encontrarnos)\s+con\b/i,

  // Menciones de ex-parejas
  /\b(?:mi\s+)?ex(?:\s+(?:novio|novia|pareja|esposo|esposa))?\b/i,
  /\b(?:mi\s+)?(?:ex-)?(?:novio|novia|pareja|esposo|esposa)\b/i,

  // Mentions of romantic interest
  /\b(?:me\s+)?gusta\s+(?:alguien|una\s+persona)\b/i,
  /\b(?:hay\s+)?alguien\s+(?:m[áa]s|otro|otra)\b/i,
  /\b(?:conoc[íi]|vi)\s+a\s+alguien\b/i,

  // Comparaciones con otros
  /\b(?:como|igual\s+que)\s+(?:mi\s+)?(?:amig[oa]|ex)\b/i,
  /\b(?:él|ella)\s+(?:me|te)\b/i,
];

/**
 * BOUNDARY ASSERTION PATTERNS
 * Detecta: Establecimiento de límites, prohibiciones, negativas
 * Afecta: Yandere (fase 6+), NPD (narcissistic injury)
 * Weight: 0.75
 */
export const BOUNDARY_ASSERTION_PATTERNS = [
  // Prohibiciones directas
  /\bno\s+quiero\s+que\b/i,
  /\bno\s+puedes\b/i,
  /\bno\s+debes\b/i,
  /\bno\s+hagas\b/i,
  /\bno\s+me\s+(?:digas|hables|escribas|mandes|preguntes)\b/i,

  // Behavioral boundaries
  /\bdeja\s+de\b/i,
  /\bpara\s+de\b/i,
  /\bbasta\s+(?:de|ya)\b/i,
  /\b(?:no\s+)?(?:m[áa]s|suficiente)\b/i,

  // Communication boundaries
  /\bno\s+me\s+(?:llames|contactes|molestes|busques)\b/i,
  /\b(?:déjame|d[ée]jame)\s+(?:en\s+paz|tranquilo|tranquila|solo|sola)\b/i,

  // Assertions of autonomy
  /\b(?:yo\s+)?decido\s+(?:yo|sobre\s+mi)\b/i,
  /\b(?:déjame|d[ée]jame)\s+decidir\s+(?:por\s+m[íi](?:\s+misma?)?|yo|sobre\s+mi)\b/i,
  /\bes\s+mi\s+(?:vida|decisión|elección)\b/i,
  /\bno\s+(?:tienes|tenes)\s+que\s+(?:decirme|opinar|meterte)\b/i,

  // Emotional boundaries
  /\bno\s+quiero\s+(?:hablar|pensar|saber)\s+(?:de|sobre)\b/i,
  /\bno\s+es\s+(?:tu|de\s+tu)\s+(?:asunto|problema|incumbencia)\b/i,
];

/**
 * REASSURANCE PATTERNS (POSITIVE - Reduces anxiety)
 * Detecta: Afirmaciones positivas, amor, apoyo
 * Afecta: Anxious Attachment, BPD (idealization), Yandere (early phases)
 * Weight: -0.3 (NEGATIVO = reduce intensidad)
 */
export const REASSURANCE_PATTERNS = [
  // Expresiones de amor
  /\b(?:te\s+)?(?:quiero|amo)\b/i,
  /\b(?:te\s+)?(?:adoro|aprecio)\b/i,
  /\b(?:eres|est[áa]s)\s+(?:importante|especial|único|única)\s+para\s+m[íi]\b/i,

  // Expresiones de presencia
  /\b(?:estoy|voy\s+a\s+estar)\s+(?:aqu[íi]|contigo)\b/i,
  /\bestoy\s+aqu[íi]\s+para\s+(?:ti|vos)\b/i,
  /\bno\s+(?:te\s+)?voy\s+a\s+(?:dejar|abandonar|irme)\b/i,
  /\bsiempre\s+(?:voy\s+a\s+)?estar\b/i,

  // Expresiones de compromiso
  /\b(?:confío|conf[íi]o)\s+en\s+(?:ti|vos)\b/i,
  /\b(?:cuento|puedo\s+contar)\s+contigo\b/i,
  /\b(?:eres|est[áa]s)\s+(?:mi|la)\s+(?:única|[úu]nico)\b/i,

  // Expresiones de tranquilidad
  /\btodo\s+(?:est[áa]|va\s+a\s+estar)\s+bien\b/i,
  /\bno\s+(?:te\s+)?preocupes\b/i,
  /\b(?:estamos|vamos\s+a\s+estar)\s+bien\b/i,

  // Emotional validation
  /\b(?:te\s+)?(?:entiendo|comprendo)\b/i,
  /\b(?:tienes|ten[ée]s)\s+razón\b/i,
  /\b(?:est[áa]|eres)\s+(?:haciendo|siendo)\s+(?:bien|genial|perfecto)\b/i,
];

/**
 * EXPLICIT REJECTION PATTERNS
 * Detecta: Rupturas, finalizaciones, rechazos explícitos
 * Afecta: TODOS los behaviors (máxima intensidad)
 * Weight: 1.0 (MÁXIMO)
 */
export const EXPLICIT_REJECTION_PATTERNS = [
  // Rupturas directas
  /\b(?:terminamos|se\s+acab[óo]|esto\s+se\s+(?:termin[óo]|acab[óo]))\b/i,
  /\b(?:quiero|voy\s+a)\s+terminar\s+(?:esto|la\s+relación|contigo)\b/i,
  /\bno\s+quiero\s+(?:seguir|continuar)\s+(?:con\s+esto|contigo|as[íi])\b/i,

  // Romantic rejections
  /\bno\s+(?:me\s+)?(?:gustas|interesas|atraes)\b/i,
  /\bno\s+(?:siento|tengo)\s+(?:nada|lo\s+mismo)\s+por\s+(?:ti|vos)\b/i,
  /\bno\s+(?:te\s+)?(?:quiero|amo)\b/i,

  // Communication terminations
  /\b(?:no\s+)?(?:me\s+)?(?:vuelvas\s+a\s+)?(?:hablar|escribir|contactar|buscar)\b/i,
  /\b(?:blo|bloquear)[ée]\b/i,
  /\badios\s+(?:para\s+)?siempre\b/i,

  // Afirmaciones de incompatibilidad
  /\b(?:no\s+)?(?:somos|estamos)\s+(?:hechos|compatibles)\b/i,
  /\b(?:esto|nosotros)\s+no\s+(?:funciona|va\s+a\s+funcionar)\b/i,

  // Explicit terminations
  /\bya\s+no\s+(?:quiero|puedo|voy\s+a|podemos)\b/i,
  /\bes\s+mejor\s+(?:que|si)\s+(?:no\s+)?(?:sigamos|continuemos)\b/i,

  // Expresiones de fin definitivo
  /\b(?:esto|todo)\s+(?:se\s+)?(?:termin[óo]|acab[óo])\b/i,
  /\b(?:no\s+hay\s+)?(?:vuelta\s+atr[áa]s|marcha\s+atr[áa]s)\b/i,
];

/**
 * TRIGGER WEIGHTS
 * Valores base de peso para cada tipo de trigger.
 * Algunos triggers (delayed_response) tienen peso variable calculado dinámicamente.
 */
export const TRIGGER_WEIGHTS = {
  abandonment_signal: 0.7,
  delayed_response: 0.5, // Variable: 0.2-0.9 depending on elapsed time
  criticism: 0.8,
  mention_other_person: 0.65,
  boundary_assertion: 0.75,
  reassurance: -0.3, // NEGATIVO: reduce ansiedad
  explicit_rejection: 1.0, // MÁXIMO
} as const;

/**
 * BEHAVIOR TYPES AFFECTED BY TRIGGER
 * Mapeo de qué behaviors son afectados por cada trigger type.
 */
export const TRIGGER_BEHAVIOR_MAPPING = {
  abandonment_signal: [
    BehaviorType.ANXIOUS_ATTACHMENT,
    BehaviorType.DISORGANIZED_ATTACHMENT,
    BehaviorType.BORDERLINE_PD,
    BehaviorType.YANDERE_OBSESSIVE,
    BehaviorType.CODEPENDENCY,
  ],
  delayed_response: [
    BehaviorType.ANXIOUS_ATTACHMENT,
    BehaviorType.DISORGANIZED_ATTACHMENT,
    BehaviorType.BORDERLINE_PD,
    BehaviorType.YANDERE_OBSESSIVE,
  ],
  criticism: [
    BehaviorType.NARCISSISTIC_PD,
    BehaviorType.BORDERLINE_PD,
    BehaviorType.AVOIDANT_ATTACHMENT,
  ],
  mention_other_person: [
    BehaviorType.YANDERE_OBSESSIVE,
    BehaviorType.NARCISSISTIC_PD,
    BehaviorType.BORDERLINE_PD,
  ],
  boundary_assertion: [
    BehaviorType.YANDERE_OBSESSIVE,
    BehaviorType.NARCISSISTIC_PD,
    BehaviorType.CODEPENDENCY,
  ],
  reassurance: [
    BehaviorType.ANXIOUS_ATTACHMENT,
    BehaviorType.DISORGANIZED_ATTACHMENT,
    BehaviorType.BORDERLINE_PD,
    BehaviorType.YANDERE_OBSESSIVE,
  ],
  explicit_rejection: [
    // Afecta a TODOS
    BehaviorType.ANXIOUS_ATTACHMENT,
    BehaviorType.AVOIDANT_ATTACHMENT,
    BehaviorType.DISORGANIZED_ATTACHMENT,
    BehaviorType.YANDERE_OBSESSIVE,
    BehaviorType.BORDERLINE_PD,
    BehaviorType.NARCISSISTIC_PD,
    BehaviorType.CODEPENDENCY,
  ],
} as const;

/**
 * DELAYED RESPONSE THRESHOLDS
 * Umbrales temporales para detectar delayed_response con pesos variables.
 */
export const DELAYED_RESPONSE_THRESHOLDS = [
  { hours: 3, weight: 0.2, label: "Ligero retraso" },
  { hours: 6, weight: 0.4, label: "Retraso moderado" },
  { hours: 12, weight: 0.6, label: "Retraso significativo" },
  { hours: 24, weight: 0.8, label: "Retraso severo" },
  { hours: 48, weight: 0.9, label: "Abandono percibido" },
] as const;

/**
 * ALL TRIGGER PATTERNS (consolidated)
 * Para iteración fácil sobre todos los patterns.
 */
export const ALL_TRIGGER_PATTERNS = {
  abandonment_signal: ABANDONMENT_SIGNAL_PATTERNS,
  criticism: CRITICISM_PATTERNS,
  mention_other_person: THIRD_PARTY_MENTION_PATTERNS,
  boundary_assertion: BOUNDARY_ASSERTION_PATTERNS,
  reassurance: REASSURANCE_PATTERNS,
  explicit_rejection: EXPLICIT_REJECTION_PATTERNS,
} as const;

export type TriggerType = keyof typeof ALL_TRIGGER_PATTERNS | "delayed_response";
