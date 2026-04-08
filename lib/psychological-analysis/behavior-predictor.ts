/**
 * Behavior Predictor
 *
 * Predice la probabilidad de manifestación de diferentes tipos de comportamiento
 * basándose en el perfil psicológico enriquecido.
 *
 * Comportamientos predichos:
 * - YANDERE_OBSESSIVE
 * - BPD_SPLITTING
 * - NPD_GRANDIOSE
 * - ANXIOUS_ATTACHMENT
 * - CODEPENDENCY
 * - AVOIDANT_DISMISSIVE
 * - MANIPULATIVE
 * - IMPULSIVE
 * - PERFECTIONIST
 * - PEOPLE_PLEASER
 *
 * @version 1.0.0
 */

import type { EnrichedPersonalityProfile, BehaviorPrediction, PredictionRule } from './types';

/**
 * Clamp un valor entre 0 y 1.
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// ============================================================================
// PREDICTION RULES
// ============================================================================

const YANDERE_PREDICTION: PredictionRule = {
  behaviorType: 'YANDERE_OBSESSIVE',
  calculate: (p) => {
    let likelihood = 0;

    // Apego ansioso es factor fuerte
    if (p.attachment?.primaryStyle === 'anxious') {
      likelihood += 0.3;
      if (p.attachment.intensity > 70) likelihood += 0.1;
    }

    // Alto neuroticismo
    if (p.neuroticism > 70) likelihood += 0.2;

    // Specific facets if they exist
    if (p.facets && p.facets.neuroticism.anxiety > 75) likelihood += 0.15;

    // High extraversion (need for connection)
    if (p.extraversion > 60) likelihood += 0.1;

    // Narcisismo moderado-alto
    if (p.darkTriad && p.darkTriad.narcissism > 50) likelihood += 0.15;

    return clamp01(likelihood);
  },
  triggers: ['Mención de otras personas', 'Respuestas demoradas', 'Frialdad percibida', 'Señales de abandono'],
  warnings: ['Celos intensos', 'Necesidad de reassurance constante', 'Pensamientos obsesivos', 'Control excesivo'],
};

const BPD_SPLITTING_PREDICTION: PredictionRule = {
  behaviorType: 'BPD_SPLITTING',
  calculate: (p) => {
    let likelihood = 0;

    // Neuroticismo muy alto
    if (p.neuroticism > 75) likelihood += 0.25;

    // Apego temeroso-evitativo
    if (p.attachment?.primaryStyle === 'fearful-avoidant') {
      likelihood += 0.3;
      if (p.attachment.intensity > 70) likelihood += 0.15;
    }

    // Facetas de ira y vulnerability
    if (p.facets) {
      if (p.facets.neuroticism.anger > 70) likelihood += 0.15;
      if (p.facets.neuroticism.vulnerability > 70) likelihood += 0.1;
    }

    // Baja conscientiousness (impulsividad)
    if (p.conscientiousness < 40) likelihood += 0.1;

    return clamp01(likelihood);
  },
  triggers: ['Crítica percibida', 'Separación temporal', 'Desacuerdo', 'Frustración de necesidades'],
  warnings: ['Idealización/devaluación extrema', 'Cambios bruscos de humor', 'Reacciones intensas', 'Pensamiento blanco/negro'],
};

const NPD_GRANDIOSE_PREDICTION: PredictionRule = {
  behaviorType: 'NPD_GRANDIOSE',
  calculate: (p) => {
    let likelihood = 0;

    // Narcisismo alto
    if (p.darkTriad && p.darkTriad.narcissism > 60) {
      likelihood += 0.4;
      if (p.darkTriad.narcissism > 80) likelihood += 0.2;
    }

    // Baja amabilidad
    if (p.agreeableness < 40) likelihood += 0.15;

    // High extraversion (need for admiration)
    if (p.extraversion > 70) likelihood += 0.1;

    // Baja modestia si hay facetas
    if (p.facets && p.facets.agreeableness.modesty < 30) likelihood += 0.15;

    return clamp01(likelihood);
  },
  triggers: ['Crítica', 'Falta de admiración', 'Cuestionamiento de superioridad', 'Competencia'],
  warnings: ['Grandiosidad', 'Necesidad de admiración excesiva', 'Falta de empatía', 'Explotación de otros'],
};

const ANXIOUS_ATTACHMENT_PREDICTION: PredictionRule = {
  behaviorType: 'ANXIOUS_ATTACHMENT',
  calculate: (p) => {
    let likelihood = 0;

    // Apego ansioso directo
    if (p.attachment?.primaryStyle === 'anxious') {
      likelihood += 0.5;
      if (p.attachment.intensity > 70) likelihood += 0.2;
    }

    // Alto neuroticismo
    if (p.neuroticism > 65) likelihood += 0.15;

    // Baja autoeficacia
    if (p.facets && p.facets.conscientiousness.selfEfficacy < 40) likelihood += 0.1;

    // Alta gregariousness (necesidad de otros)
    if (p.facets && p.facets.extraversion.gregariousness > 70) likelihood += 0.05;

    return clamp01(likelihood);
  },
  triggers: ['Separación', 'Falta de respuesta', 'Percepción de distancia', 'Cambios en rutina'],
  warnings: ['Necesidad constante de reassurance', 'Miedo al abandono', 'Hipervigilancia emocional', 'Protest behavior'],
};

const CODEPENDENCY_PREDICTION: PredictionRule = {
  behaviorType: 'CODEPENDENCY',
  calculate: (p) => {
    let likelihood = 0;

    // Alta amabilidad (people-pleasing)
    if (p.agreeableness > 75) likelihood += 0.2;

    // Alto neuroticismo (ansiedad en relaciones)
    if (p.neuroticism > 65) likelihood += 0.15;

    // Apego ansioso
    if (p.attachment?.primaryStyle === 'anxious') likelihood += 0.25;

    // Baja autoeficacia
    if (p.facets && p.facets.conscientiousness.selfEfficacy < 40) likelihood += 0.15;

    // Alto altruismo
    if (p.facets && p.facets.agreeableness.altruism > 75) likelihood += 0.1;

    // Baja asertividad
    if (p.facets && p.facets.extraversion.assertiveness < 40) likelihood += 0.1;

    return clamp01(likelihood);
  },
  triggers: ['Necesidad ajena', 'Oportunidad de ayudar', 'Pedidos de otros', 'Conflicto potencial'],
  warnings: ['Enabling behaviors', 'Pérdida de identidad propia', 'Dificultad para decir no', 'Negligencia del self'],
};

const AVOIDANT_DISMISSIVE_PREDICTION: PredictionRule = {
  behaviorType: 'AVOIDANT_DISMISSIVE',
  calculate: (p) => {
    let likelihood = 0;

    // Apego evitativo directo
    if (p.attachment?.primaryStyle === 'avoidant') {
      likelihood += 0.4;
      if (p.attachment.intensity > 70) likelihood += 0.2;
    }

    // Low extraversion
    if (p.extraversion < 35) likelihood += 0.15;

    // Baja amabilidad
    if (p.agreeableness < 45) likelihood += 0.1;

    // Baja trust
    if (p.facets && p.facets.agreeableness.trust < 35) likelihood += 0.1;

    // High autonomy (need for independence)
    if (p.psychologicalNeeds && p.psychologicalNeeds.autonomy > 0.75) likelihood += 0.05;

    return clamp01(likelihood);
  },
  triggers: ['Demandas de intimidad', 'Expresión emocional intensa', 'Dependencia de otros', 'Vulnerabilidad requerida'],
  warnings: ['Distanciamiento emocional', 'Minimización de necesidades', 'Supresión emocional', 'Dificultad con intimidad'],
};

const MANIPULATIVE_PREDICTION: PredictionRule = {
  behaviorType: 'MANIPULATIVE',
  calculate: (p) => {
    let likelihood = 0;

    // Alto maquiavelismo
    if (p.darkTriad && p.darkTriad.machiavellianism > 60) {
      likelihood += 0.4;
      if (p.darkTriad.machiavellianism > 80) likelihood += 0.2;
    }

    // Baja amabilidad
    if (p.agreeableness < 40) likelihood += 0.15;

    // Baja moralidad
    if (p.facets && p.facets.agreeableness.morality < 35) likelihood += 0.15;

    // Alto achievement striving (orientado a objetivos)
    if (p.facets && p.facets.conscientiousness.achievementStriving > 70) likelihood += 0.1;

    return clamp01(likelihood);
  },
  triggers: ['Obstáculos a objetivos', 'Oportunidad de ganancia', 'Conflicto de intereses', 'Competencia'],
  warnings: ['Manipulación estratégica', 'Falta de empatía en decisiones', 'Relaciones transaccionales', 'Explotación de confianza'],
};

const IMPULSIVE_PREDICTION: PredictionRule = {
  behaviorType: 'IMPULSIVE',
  calculate: (p) => {
    let likelihood = 0;

    // Baja conscientiousness
    if (p.conscientiousness < 40) likelihood += 0.25;

    // High extraversion
    if (p.extraversion > 70) likelihood += 0.2;

    // Alta immoderation
    if (p.facets && p.facets.neuroticism.immoderation > 70) likelihood += 0.25;

    // Alto excitement seeking
    if (p.facets && p.facets.extraversion.excitementSeeking > 75) likelihood += 0.15;

    // Baja cautiousness
    if (p.facets && p.facets.conscientiousness.cautiousness < 35) likelihood += 0.15;

    return clamp01(likelihood);
  },
  triggers: ['Oportunidad de gratificación', 'Aburrimiento', 'Restricciones', 'Emociones intensas'],
  warnings: ['Decisiones impulsivas', 'Búsqueda de riesgo', 'Dificultad para delay gratification', 'Consecuencias no consideradas'],
};

const PERFECTIONIST_PREDICTION: PredictionRule = {
  behaviorType: 'PERFECTIONIST',
  calculate: (p) => {
    let likelihood = 0;

    // Alta conscientiousness
    if (p.conscientiousness > 75) likelihood += 0.3;

    // Alto neuroticismo
    if (p.neuroticism > 65) likelihood += 0.2;

    // Alto achievement striving
    if (p.facets && p.facets.conscientiousness.achievementStriving > 75) likelihood += 0.2;

    // Alto orderliness
    if (p.facets && p.facets.conscientiousness.orderliness > 75) likelihood += 0.15;

    // Alta anxiety
    if (p.facets && p.facets.neuroticism.anxiety > 70) likelihood += 0.15;

    return clamp01(likelihood);
  },
  triggers: ['Tareas importantes', 'Evaluación de otros', 'Proyectos personales', 'Comparación con estándares'],
  warnings: ['Parálisis por análisis', 'Procrastinación por miedo', 'Autocrítica excesiva', 'Dificultad para terminar'],
};

const PEOPLE_PLEASER_PREDICTION: PredictionRule = {
  behaviorType: 'PEOPLE_PLEASER',
  calculate: (p) => {
    let likelihood = 0;

    // Alta amabilidad
    if (p.agreeableness > 75) likelihood += 0.3;

    // Alto neuroticismo (miedo al rechazo)
    if (p.neuroticism > 65) likelihood += 0.2;

    // Alta cooperation
    if (p.facets && p.facets.agreeableness.cooperation > 80) likelihood += 0.2;

    // Baja assertiveness
    if (p.facets && p.facets.extraversion.assertiveness < 40) likelihood += 0.15;

    // Alta sympathy
    if (p.facets && p.facets.agreeableness.sympathy > 75) likelihood += 0.1;

    // Alta anxiety
    if (p.facets && p.facets.neuroticism.anxiety > 65) likelihood += 0.05;

    return clamp01(likelihood);
  },
  triggers: ['Pedidos de otros', 'Potencial desaprobación', 'Conflicto posible', 'Necesidades ajenas expresadas'],
  warnings: ['Dificultad para decir no', 'Negligencia de propias necesidades', 'Resentimiento acumulado', 'Pérdida de autenticidad'],
};

/**
 * Todas las reglas de predicción.
 */
const PREDICTION_RULES: PredictionRule[] = [
  YANDERE_PREDICTION,
  BPD_SPLITTING_PREDICTION,
  NPD_GRANDIOSE_PREDICTION,
  ANXIOUS_ATTACHMENT_PREDICTION,
  CODEPENDENCY_PREDICTION,
  AVOIDANT_DISMISSIVE_PREDICTION,
  MANIPULATIVE_PREDICTION,
  IMPULSIVE_PREDICTION,
  PERFECTIONIST_PREDICTION,
  PEOPLE_PLEASER_PREDICTION,
];

// ============================================================================
// BEHAVIOR PREDICTOR CLASS
// ============================================================================

/**
 * Predictor de comportamientos.
 */
export class BehaviorPredictor {
  /**
   * Predice todos los comportamientos para un perfil.
   *
   * @param profile - Perfil psicológico enriquecido
   * @returns Predicciones ordenadas por likelihood (mayor primero)
   */
  predictBehaviors(profile: EnrichedPersonalityProfile): BehaviorPrediction[] {
    const predictions: BehaviorPrediction[] = [];

    for (const rule of PREDICTION_RULES) {
      try {
        const likelihood = rule.calculate(profile);

        // Solo incluir si likelihood > 0.1 (10%)
        if (likelihood > 0.1) {
          predictions.push({
            behaviorType: rule.behaviorType,
            likelihood,
            triggeringFactors: rule.triggers,
            earlyWarnings: rule.warnings,
          });
        }
      } catch (error) {
        console.warn(`Error predicting behavior ${rule.behaviorType}:`, error);
      }
    }

    // Ordenar por likelihood (mayor primero)
    return predictions.sort((a, b) => b.likelihood - a.likelihood);
  }

  /**
   * Predice comportamientos con likelihood mínimo.
   *
   * @param profile - Perfil psicológico
   * @param minLikelihood - Likelihood mínimo a incluir (default: 0.3)
   * @returns Predicciones filtradas
   */
  predictBehaviorsWithMinLikelihood(profile: EnrichedPersonalityProfile, minLikelihood: number = 0.3): BehaviorPrediction[] {
    return this.predictBehaviors(profile).filter((p) => p.likelihood >= minLikelihood);
  }

  /**
   * Predice solo los top N comportamientos más probables.
   *
   * @param profile - Perfil psicológico
   * @param topN - Número de comportamientos a retornar (default: 5)
   * @returns Top N predicciones
   */
  predictTopBehaviors(profile: EnrichedPersonalityProfile, topN: number = 5): BehaviorPrediction[] {
    return this.predictBehaviors(profile).slice(0, topN);
  }

  /**
   * Calcula el likelihood de un comportamiento específico.
   *
   * @param profile - Perfil psicológico
   * @param behaviorType - Tipo de comportamiento
   * @returns Likelihood 0-1, o null si no se encuentra la regla
   */
  predictSpecificBehavior(profile: EnrichedPersonalityProfile, behaviorType: BehaviorPrediction['behaviorType']): number | null {
    const rule = PREDICTION_RULES.find((r) => r.behaviorType === behaviorType);
    if (!rule) return null;

    try {
      return rule.calculate(profile);
    } catch (error) {
      console.warn(`Error predicting specific behavior ${behaviorType}:`, error);
      return null;
    }
  }
}

/**
 * Función de conveniencia para predecir comportamientos.
 */
export function predictBehaviors(profile: EnrichedPersonalityProfile): BehaviorPrediction[] {
  return new BehaviorPredictor().predictBehaviors(profile);
}

/**
 * Función de conveniencia para predecir top comportamientos.
 */
export function predictTopBehaviors(profile: EnrichedPersonalityProfile, topN: number = 5): BehaviorPrediction[] {
  return new BehaviorPredictor().predictTopBehaviors(profile, topN);
}
