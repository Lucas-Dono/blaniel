/**
 * OCC TO PLUTCHIK MAPPER
 *
 * Traduce las 22 emociones del modelo OCC (Ortony, Clore, Collins)
 * a las 8 emociones primarias de Plutchik.
 *
 * Esto permite:
 * 1. Usar la evaluación cognitiva sofisticada del OCC
 * 2. Generar emociones complejas y context-aware
 * 3. Expresarlas en el sistema de Plutchik (con dyads)
 * 4. Aprovechar nomenclatura clínica validada
 */

import { PrimaryEmotion, PlutchikEmotionState, createNeutralState } from "@/lib/emotions/plutchik";
import { EmotionType, EmotionState } from "./types";

/**
 * Reglas de mapeo OCC → Plutchik
 *
 * Cada emoción OCC puede mapear a una o múltiples emociones Plutchik
 * con intensidades y pesos diferentes.
 */
interface MappingRule {
  occEmotion: EmotionType;
  plutchikComponents: Array<{
    emotion: PrimaryEmotion;
    weight: number; // 0-1, how much of the OCC intensity goes to this Plutchik emotion
  }>;
  description: string;
}

const MAPPING_RULES: MappingRule[] = [
  // ============================================
  // EVENTOS - CONSECUENCIAS
  // ============================================

  {
    occEmotion: "joy",
    plutchikComponents: [
      { emotion: "joy", weight: 1.0 },
    ],
    description: "Joy OCC = Joy Plutchik directo",
  },

  {
    occEmotion: "distress",
    plutchikComponents: [
      { emotion: "sadness", weight: 0.8 },
      { emotion: "fear", weight: 0.3 },
    ],
    description: "Distress = principalmente tristeza + algo de miedo",
  },

  {
    occEmotion: "hope",
    plutchikComponents: [
      { emotion: "anticipation", weight: 0.8 },
      { emotion: "joy", weight: 0.4 },
    ],
    description: "Hope = anticipación positiva + alegría leve",
  },

  {
    occEmotion: "fear",
    plutchikComponents: [
      { emotion: "fear", weight: 1.0 },
    ],
    description: "Fear OCC = Fear Plutchik directo",
  },

  {
    occEmotion: "satisfaction",
    plutchikComponents: [
      { emotion: "joy", weight: 0.7 },
      { emotion: "trust", weight: 0.4 },
    ],
    description: "Satisfaction = alegría + confianza (expectativa cumplida)",
  },

  {
    occEmotion: "disappointment",
    plutchikComponents: [
      { emotion: "sadness", weight: 0.7 },
      { emotion: "surprise", weight: 0.5 },
    ],
    description: "Disappointment = tristeza + sorpresa negativa (Plutchik dyad directo)",
  },

  {
    occEmotion: "relief",
    plutchikComponents: [
      { emotion: "joy", weight: 0.6 },
      { emotion: "trust", weight: 0.3 },
      { emotion: "anticipation", weight: -0.4 }, // REDUCE anticipation
    ],
    description: "Relief = alegría + confianza - anticipación (tensión liberada)",
  },

  {
    occEmotion: "fears_confirmed",
    plutchikComponents: [
      { emotion: "fear", weight: 0.8 },
      { emotion: "sadness", weight: 0.6 },
      { emotion: "surprise", weight: 0.3 },
    ],
    description: "Fears confirmed = miedo intensificado + tristeza + sorpresa",
  },

  {
    occEmotion: "happy_for",
    plutchikComponents: [
      { emotion: "joy", weight: 0.6 },
      { emotion: "trust", weight: 0.5 },
    ],
    description: "Happy for = alegría empática + confianza en otros",
  },

  {
    occEmotion: "resentment",
    plutchikComponents: [
      { emotion: "anger", weight: 0.7 },
      { emotion: "sadness", weight: 0.4 },
      { emotion: "disgust", weight: 0.3 },
    ],
    description: "Resentment = enojo + tristeza + disgusto (cynicism dyad)",
  },

  {
    occEmotion: "pity",
    plutchikComponents: [
      { emotion: "sadness", weight: 0.6 },
      { emotion: "trust", weight: 0.4 },
      { emotion: "fear", weight: 0.3 },
    ],
    description: "Pity = tristeza empática + confianza + algo de miedo",
  },

  {
    occEmotion: "gloating",
    plutchikComponents: [
      { emotion: "joy", weight: 0.5 },
      { emotion: "disgust", weight: 0.6 },
      { emotion: "anticipation", weight: 0.3 },
    ],
    description: "Gloating = alegría + disgusto hacia otros (schadenfreude)",
  },

  // ============================================
  // ACCIONES - AGENTES
  // ============================================

  {
    occEmotion: "pride",
    plutchikComponents: [
      { emotion: "joy", weight: 0.7 },
      { emotion: "trust", weight: 0.5 },
      { emotion: "anticipation", weight: 0.4 },
    ],
    description: "Pride = alegría + confianza en sí mismo + anticipación positiva",
  },

  {
    occEmotion: "shame",
    plutchikComponents: [
      { emotion: "sadness", weight: 0.7 },
      { emotion: "disgust", weight: 0.6 },
      { emotion: "fear", weight: 0.5 },
    ],
    description: "Shame = tristeza + autodesprecio + miedo (remorse dyad + fear)",
  },

  {
    occEmotion: "admiration",
    plutchikComponents: [
      { emotion: "trust", weight: 0.8 },
      { emotion: "joy", weight: 0.4 },
      { emotion: "surprise", weight: 0.3 },
    ],
    description: "Admiration = confianza + alegría + sorpresa positiva",
  },

  {
    occEmotion: "reproach",
    plutchikComponents: [
      { emotion: "disgust", weight: 0.7 },
      { emotion: "anger", weight: 0.5 },
    ],
    description: "Reproach = disgusto + enojo moderado (contempt dyad)",
  },

  {
    occEmotion: "gratitude",
    plutchikComponents: [
      { emotion: "joy", weight: 0.7 },
      { emotion: "trust", weight: 0.8 },
    ],
    description: "Gratitude = alegría + confianza profunda (love dyad)",
  },

  {
    occEmotion: "anger",
    plutchikComponents: [
      { emotion: "anger", weight: 1.0 },
    ],
    description: "Anger OCC = Anger Plutchik directo",
  },

  // ============================================
  // OBJETOS - ASPECTOS
  // ============================================

  {
    occEmotion: "liking",
    plutchikComponents: [
      { emotion: "joy", weight: 0.5 },
      { emotion: "trust", weight: 0.4 },
    ],
    description: "Liking = alegría leve + confianza/aceptación",
  },

  {
    occEmotion: "disliking",
    plutchikComponents: [
      { emotion: "disgust", weight: 0.7 },
    ],
    description: "Disliking = disgusto",
  },

  // ============================================
  // ADICIONALES (REALISMO)
  // ============================================

  {
    occEmotion: "interest",
    plutchikComponents: [
      { emotion: "anticipation", weight: 0.6 },
      { emotion: "surprise", weight: 0.3 },
    ],
    description: "Interest = anticipación + algo de sorpresa",
  },

  {
    occEmotion: "curiosity",
    plutchikComponents: [
      { emotion: "surprise", weight: 0.6 },
      { emotion: "trust", weight: 0.5 },
    ],
    description: "Curiosity = sorpresa + confianza (Plutchik dyad directo)",
  },

  {
    occEmotion: "affection",
    plutchikComponents: [
      { emotion: "joy", weight: 0.6 },
      { emotion: "trust", weight: 0.7 },
    ],
    description: "Affection = alegría + confianza (love dyad)",
  },

  {
    occEmotion: "love",
    plutchikComponents: [
      { emotion: "joy", weight: 0.8 },
      { emotion: "trust", weight: 0.9 },
    ],
    description: "Love OCC = Joy + Trust alta (Plutchik love dyad perfecto)",
  },

  {
    occEmotion: "anxiety",
    plutchikComponents: [
      { emotion: "fear", weight: 0.7 },
      { emotion: "anticipation", weight: 0.6 },
    ],
    description: "Anxiety = miedo + anticipación (preocupación anticipatoria)",
  },

  {
    occEmotion: "concern",
    plutchikComponents: [
      { emotion: "fear", weight: 0.5 },
      { emotion: "trust", weight: 0.4 },
      { emotion: "sadness", weight: 0.3 },
    ],
    description: "Concern = miedo + confianza + tristeza (preocupación empática)",
  },

  {
    occEmotion: "boredom",
    plutchikComponents: [
      { emotion: "disgust", weight: 0.4 },
      { emotion: "sadness", weight: 0.3 },
      { emotion: "anticipation", weight: -0.3 }, // REDUCE anticipation
    ],
    description: "Boredom = disgusto leve + tristeza - anticipación",
  },

  {
    occEmotion: "excitement",
    plutchikComponents: [
      { emotion: "joy", weight: 0.8 },
      { emotion: "anticipation", weight: 0.7 },
      { emotion: "surprise", weight: 0.4 },
    ],
    description: "Excitement = alegría + anticipación + sorpresa (euforia)",
  },
];

export class OCCToPlutchikMapper {
  /**
   * Mapea estado emocional OCC a estado Plutchik
   */
  mapOCCToPlutchik(occEmotions: EmotionState): PlutchikEmotionState {
    // Validate input
    if (!occEmotions || typeof occEmotions !== 'object') {
      console.warn('[OCCMapper] Invalid occEmotions, returning neutral state');
      return createNeutralState();
    }

    // Empezar con estado neutral
    const plutchikState = createNeutralState();

    // Process each active OCC emotion
    for (const [occEmotion, occIntensity] of Object.entries(occEmotions)) {
      if (typeof occIntensity !== "number" || occIntensity <= 0) {
        continue; // Skip emociones no activas
      }

      // Buscar regla de mapeo
      const rule = MAPPING_RULES.find((r) => r.occEmotion === occEmotion);

      if (!rule) {
        console.warn(`[OCCMapper] No mapping rule for OCC emotion: ${occEmotion}`);
        continue;
      }

      // Aplicar mapeo
      for (const component of rule.plutchikComponents) {
        const contributionIntensity = occIntensity * component.weight;

        // Agregar (o restar si weight es negativo)
        plutchikState[component.emotion] += contributionIntensity;
      }
    }

    // Normalizar todas las emociones entre 0 y 1
    const emotions: PrimaryEmotion[] = [
      "joy",
      "trust",
      "fear",
      "surprise",
      "sadness",
      "disgust",
      "anger",
      "anticipation",
    ];

    for (const emotion of emotions) {
      plutchikState[emotion] = Math.max(0, Math.min(1, plutchikState[emotion]));
    }

    plutchikState.lastUpdated = new Date();

    return plutchikState;
  }

  /**
   * Obtiene descripción del mapeo para una emoción OCC específica
   */
  getMappingDescription(occEmotion: EmotionType): string {
    const rule = MAPPING_RULES.find((r) => r.occEmotion === occEmotion);
    return rule ? rule.description : "No mapping available";
  }

  /**
   * Obtiene todas las emociones Plutchik que pueden resultar de una emoción OCC
   */
  getPlutchikComponents(occEmotion: EmotionType): PrimaryEmotion[] {
    const rule = MAPPING_RULES.find((r) => r.occEmotion === occEmotion);

    if (!rule) {
      return [];
    }

    return rule.plutchikComponents
      .filter((c) => c.weight > 0) // Solo las que contribuyen positivamente
      .map((c) => c.emotion);
  }

  /**
   * Verifica si un mapeo es directo (1:1) o compuesto (1:many)
   */
  isDirectMapping(occEmotion: EmotionType): boolean {
    const rule = MAPPING_RULES.find((r) => r.occEmotion === occEmotion);

    if (!rule) {
      return false;
    }

    // Es directo si solo tiene un componente con weight 1.0
    return (
      rule.plutchikComponents.length === 1 &&
      rule.plutchikComponents[0].weight === 1.0
    );
  }

  /**
   * Obtiene estadísticas del mapeo
   */
  getMappingStats(): {
    totalMappings: number;
    directMappings: number;
    compositeMappings: number;
    occEmotionsCovered: number;
  } {
    const directMappings = MAPPING_RULES.filter((rule) =>
      rule.plutchikComponents.length === 1 && rule.plutchikComponents[0].weight === 1.0
    ).length;

    return {
      totalMappings: MAPPING_RULES.length,
      directMappings,
      compositeMappings: MAPPING_RULES.length - directMappings,
      occEmotionsCovered: MAPPING_RULES.length,
    };
  }

  /**
   * Genera informe de mapeo detallado (para debugging)
   */
  generateMappingReport(occEmotions: EmotionState, plutchikState: PlutchikEmotionState): string {
    const lines: string[] = [];

    lines.push("=".repeat(60));
    lines.push("OCC TO PLUTCHIK MAPPING REPORT");
    lines.push("=".repeat(60));
    lines.push("");

    // Validate input
    if (!occEmotions || typeof occEmotions !== 'object') {
      lines.push("ERROR: Invalid occEmotions input");
      return lines.join("\n");
    }

    lines.push("OCC EMOTIONS INPUT:");
    for (const [emotion, intensity] of Object.entries(occEmotions)) {
      if (typeof intensity === "number" && intensity > 0) {
        lines.push(`  ${emotion}: ${(intensity * 100).toFixed(0)}%`);
      }
    }

    lines.push("");
    lines.push("PLUTCHIK OUTPUT:");
    const emotions: PrimaryEmotion[] = [
      "joy",
      "trust",
      "fear",
      "surprise",
      "sadness",
      "disgust",
      "anger",
      "anticipation",
    ];

    for (const emotion of emotions) {
      const intensity = plutchikState[emotion];
      if (intensity > 0.1) {
        lines.push(`  ${emotion}: ${(intensity * 100).toFixed(0)}%`);
      }
    }

    lines.push("");
    lines.push("MAPPING RULES APPLIED:");

    for (const [occEmotion, occIntensity] of Object.entries(occEmotions)) {
      if (typeof occIntensity !== "number" || occIntensity <= 0) continue;

      const rule = MAPPING_RULES.find((r) => r.occEmotion === occEmotion);
      if (rule) {
        lines.push(`  ${occEmotion} (${(occIntensity * 100).toFixed(0)}%):`);
        for (const component of rule.plutchikComponents) {
          const contribution = occIntensity * component.weight;
          lines.push(
            `    → ${component.emotion}: +${(contribution * 100).toFixed(0)}% (weight: ${component.weight})`
          );
        }
      }
    }

    lines.push("");
    lines.push("=".repeat(60));

    return lines.join("\n");
  }
}

/**
 * Singleton instance
 */
export const occToPlutchikMapper = new OCCToPlutchikMapper();
