/**
 * Conflict Detection Rules
 * 
 * Define 30+ psychological conflict detection rules based on:
 * - Big Five ↔ Facets Inconsistencies
 * - Behavioral conflicts (colliding traits)
 * - Extreme Dark Triad
 * - Contradictory attachment
 * - Cross-dimensional conflicts
 * 
 * @version 1.0.0
 */

import type {ConflictRule} from './types';

// ============================================================================
// BIG FIVE CONFLICTS
// ============================================================================

export const IMPULSIVITY_RISK: ConflictRule = {
  id: 'impulsivity-risk',
  severity: 'warning',
  category: 'big-five',
  detect: (p) => p.extraversion > 70 && p.conscientiousness < 40,
  title: 'Riesgo de Impulsividad',
  description: 'Alta extraversión combinada con baja responsabilidad puede llevar a decisiones impulsivas y falta de planificación.',
  implications: [
    'Tendencia a actuar sin pensar en consecuencias',
    'Dificultad para mantener compromisos a largo plazo',
    'Búsqueda excesiva de novedad y estimulación',
    'Problemas con la autodisciplina',
  ],
  mitigations: [
    'Establecer rutinas y sistemas de accountability',
    'Usar timers de "pausa y reflexión" antes de decisiones importantes',
    'Delegar planificación a otros cuando sea posible',
    'Practicar técnicas de mindfulness para impulse control',
  ],
};

export const PERFECTIONIST_ANXIETY: ConflictRule = {
  id: 'perfectionist-anxiety',
  severity: 'warning',
  category: 'big-five',
  detect: (p) => p.neuroticism > 70 && p.conscientiousness > 70,
  title: 'Ansiedad Perfeccionista',
  description: 'Alto neuroticismo combinado con alta responsabilidad puede generar parálisis por análisis y estándares imposibles.',
  implications: [
    'Parálisis por análisis excesivo',
    'Estándares imposiblemente altos',
    'Burnout por sobreesfuerzo',
    'Dificultad para disfrutar logros',
  ],
  mitigations: [
    'Practicar autocompasión y "suficientemente bien"',
    'Establecer límites de tiempo para decisiones',
    'Terapia cognitivo-conductual para perfeccionismo',
    'Mindfulness para aceptación de imperfección',
  ],
};

export const SOCIAL_ISOLATION_RISK: ConflictRule = {
  id: 'social-isolation',
  severity: 'info',
  category: 'big-five',
  detect: (p) => p.extraversion < 30 && p.neuroticism > 60,
  title: 'Riesgo de Aislamiento Social',
  description: 'Baja extraversión combinada con alto neuroticismo puede llevar a evitación social y soledad.',
  implications: [
    'Tendencia a evitar interacciones sociales',
    'Soledad crónica a pesar del deseo de conexión',
    'Ansiedad social marcada',
    'Dificultad para pedir ayuda',
  ],
  mitigations: [
    'Exposición gradual a situaciones sociales',
    'Buscar comunidades con intereses compartidos',
    'Terapia para ansiedad social',
    'Priorizar calidad sobre cantidad en relaciones',
  ],
};

export const CONFLICT_AVOIDANCE: ConflictRule = {
  id: 'conflict-avoidance',
  severity: 'info',
  category: 'big-five',
  detect: (p) => p.agreeableness > 80 && p.neuroticism > 60,
  title: 'Evitación de Conflicto',
  description: 'Alta amabilidad combinada con alto neuroticismo puede llevar a evitar conflictos necesarios y acumular resentimiento.',
  implications: [
    'Dificultad para establecer límites',
    'Acumulación de resentimiento no expresado',
    'People-pleasing excesivo',
    'Pérdida de autenticidad en relaciones',
  ],
  mitigations: [
    'Practicar asertividad progresivamente',
    'Aprender a decir "no" con respeto',
    'Terapia para establecimiento de límites',
    'Reconocer que conflicto != rechazo',
  ],
};

export const CREATIVE_CHAOS: ConflictRule = {
  id: 'creative-chaos',
  severity: 'info',
  category: 'big-five',
  detect: (p) => p.openness > 80 && p.conscientiousness < 40,
  title: 'Caos Creativo',
  description: 'Alta apertura combinada con baja responsabilidad puede generar ideas brillantes pero falta de ejecución.',
  implications: [
    'Muchas ideas, pocas completadas',
    'Dificultad para enfocarse en un proyecto',
    'Desorganización en ejecución',
    'Frustración por potencial no realizado',
  ],
  mitigations: [
    'Sistemas externos de organización (apps, asistentes)',
    'Colaborar con personas organizadas',
    'Establecer deadlines externos',
    'Técnica Pomodoro para foco sostenido',
  ],
};

export const RIGID_SKEPTICISM: ConflictRule = {
  id: 'rigid-skepticism',
  severity: 'info',
  category: 'big-five',
  detect: (p) => p.openness < 30 && p.conscientiousness > 70,
  title: 'Escepticismo Rígido',
  description: 'Baja apertura combinada con alta responsabilidad puede llevar a rigidez mental y resistencia al cambio.',
  implications: [
    'Resistencia a nuevas ideas o métodos',
    'Dificultad para adaptarse a cambios',
    'Pensamiento "blanco o negro"',
    'Pérdida de oportunidades por conservadurismo',
  ],
  mitigations: [
    'Exposición gradual a nuevas experiencias',
    'Practicar "pensamiento de experimento"',
    'Buscar evidencia para cambios propuestos',
    'Reconocer cuando la rigidez es costosa',
  ],
};

// ============================================================================
// FACET-LEVEL CONFLICTS
// ============================================================================

export const FACET_BIG_FIVE_MISMATCH: ConflictRule = {
  id: 'facet-big-five-mismatch',
  severity: 'warning',
  category: 'facets',
  detect: (p) => {
    if (!p.facets) return false;

    // Calculate average deviation between Big Five and facet average
    const dimensions: Array<keyof typeof p.facets> = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];

    let totalDeviation = 0;
    for (const dim of dimensions) {
      const bigFiveValue = p[dim];
      const facetValues = Object.values(p.facets[dim]);
      const avgFacet = facetValues.reduce((a, b) => a + b, 0) / facetValues.length;
      totalDeviation += Math.abs(bigFiveValue - avgFacet);
    }

    const avgDeviation = totalDeviation / dimensions.length;
    return avgDeviation > 20; // Average deviation >20 points
  },
  title: 'Inconsistencia Facetas-Big Five',
  description: 'Las facetas detalladas no coinciden con los valores generales de Big Five, sugiriendo un perfil contradictorio.',
  implications: [
    'Perfil psicológico inconsistente',
    'Comportamiento impredecible',
    'Posible falta de autoconocimiento',
  ],
  mitigations: [
    'Revisar y ajustar facetas para mayor coherencia',
    'Considerar si las inconsistencias son intencionales',
    'Re-evaluar Big Five o facetas',
  ],
};

// ============================================================================
// DARK TRIAD CONFLICTS
// ============================================================================

export const HIGH_MACHIAVELLIANISM: ConflictRule = {
  id: 'high-machiavellianism',
  severity: 'warning',
  category: 'dark-triad',
  detect: (p) => !!p.darkTriad && p.darkTriad.machiavellianism > 60 && p.agreeableness < 40,
  title: 'Alto Maquiavelismo',
  description: 'Alto maquiavelismo combinado con baja amabilidad indica tendencia a manipulación estratégica y falta de empatía.',
  implications: [
    'Manipulación sistemática de otros',
    'Relaciones transaccionales',
    'Falta de confianza en relaciones cercanas',
    'Conflictos interpersonales frecuentes',
  ],
  mitigations: [
    'Terapia para desarrollo de empatía',
    'Practicar perspectiva-taking',
    'Reconocer costos a largo plazo de manipulación',
    'Buscar relaciones win-win',
  ],
};

export const EXTREME_NARCISSISM: ConflictRule = {
  id: 'extreme-narcissism',
  severity: 'danger',
  category: 'dark-triad',
  detect: (p) => !!p.darkTriad && p.darkTriad.narcissism > 80,
  title: 'Narcisismo Extremo',
  description: 'Narcisismo muy alto puede interferir gravemente con relaciones saludables y bienestar emocional.',
  implications: [
    'Necesidad insaciable de admiración',
    'Incapacidad para aceptar crítica',
    'Relaciones superficiales o explotadoras',
    'Vulnerabilidad extrema a heridas narcisistas',
  ],
  mitigations: [
    'Terapia especializada en trastornos de personalidad',
    'Trabajo en autoaceptación realista',
    'Desarrollo de empatía genuina',
    'Reconocimiento de valor intrínseco vs externo',
  ],
};

export const PSYCHOPATHY_INDICATORS: ConflictRule = {
  id: 'psychopathy-indicators',
  severity: 'critical',
  category: 'dark-triad',
  detect: (p) => !!p.darkTriad && p.darkTriad.psychopathy > 70 && p.agreeableness < 30,
  title: 'Indicadores de Psicopatía',
  description: 'Alta psicopatía combinada con muy baja amabilidad sugiere falta de empatía y remordimiento significativa.',
  implications: [
    'Falta grave de empatía',
    'Impulsividad extrema',
    'Riesgo de comportamiento antisocial',
    'Dificultad severa en relaciones profundas',
  ],
  mitigations: [
    'Evaluación profesional urgente',
    'Terapia especializada (DBT, schema therapy)',
    'Desarrollo de estrategias compensatorias',
    'Supervisión en contextos sociales',
  ],
};

export const DARK_TRIAD_CLUSTER: ConflictRule = {
  id: 'dark-triad-cluster',
  severity: 'critical',
  category: 'dark-triad',
  detect: (p) => {
    if (!p.darkTriad) return false;
    const { machiavellianism, narcissism, psychopathy } = p.darkTriad;
    // Todas las dimensiones >60
    return machiavellianism > 60 && narcissism > 60 && psychopathy > 60;
  },
  title: 'Dark Triad Completo',
  description: 'Puntuaciones altas en las tres dimensiones del Dark Triad sugieren un patrón de personalidad altamente problemático.',
  implications: [
    'Patrón completo de rasgos antisociales',
    'Relaciones extremadamente disfuncionales',
    'Alto riesgo de comportamiento explotador',
    'Necesidad de intervención profesional',
  ],
  mitigations: [
    'Evaluación psicológica comprensiva',
    'Terapia intensiva especializada',
    'Desarrollo de insight sobre impacto en otros',
    'Sistemas de apoyo estructurados',
  ],
};

// ============================================================================
// ATTACHMENT CONFLICTS
// ============================================================================

export const ANXIOUS_ATTACHMENT_HIGH_NEUROTICISM: ConflictRule = {
  id: 'anxious-attachment-high-neuroticism',
  severity: 'warning',
  category: 'attachment',
  detect: (p) => p.attachment?.primaryStyle === 'anxious' && p.neuroticism > 70,
  title: 'Apego Ansioso + Alto Neuroticismo',
  description: 'Apego ansioso combinado con alto neuroticismo amplifica el miedo al abandono y la necesidad de reassurance.',
  implications: [
    'Miedo al abandono intensificado',
    'Necesidad de reassurance constante',
    'Hipervigilancia a señales de rechazo',
    'Comportamientos de clinging',
  ],
  mitigations: [
    'Terapia de apego (attachment-focused therapy)',
    'Desarrollo de autosoothing',
    'Mindfulness para tolerancia a incertidumbre',
    'Comunicación clara de necesidades',
  ],
};

export const AVOIDANT_ATTACHMENT_LOW_AGREEABLENESS: ConflictRule = {
  id: 'avoidant-attachment-low-agreeableness',
  severity: 'warning',
  category: 'attachment',
  detect: (p) => (p.attachment?.primaryStyle === 'avoidant' || p.attachment?.primaryStyle === 'fearful-avoidant') && p.agreeableness < 40,
  title: 'Apego Evitativo + Baja Amabilidad',
  description: 'Apego evitativo combinado con baja amabilidad puede llevar a aislamiento extremo y falta de intimidad.',
  implications: [
    'Dificultad severa para intimidad',
    'Aislamiento emocional crónico',
    'Relaciones superficiales únicamente',
    'Soledad oculta',
  ],
  mitigations: [
    'Terapia de exposición gradual a intimidad',
    'Trabajo en vulnerabilidad emocional',
    'Reconocimiento de necesidad de conexión',
    'Desarrollo de habilidades de intimidad',
  ],
};

export const FEARFUL_AVOIDANT_PARADOX: ConflictRule = {
  id: 'fearful-avoidant-paradox',
  severity: 'danger',
  category: 'attachment',
  detect: (p) => p.attachment?.primaryStyle === 'fearful-avoidant' && p.attachment.intensity > 70,
  title: 'Paradoja del Apego Temeroso-Evitativo',
  description: 'Apego temeroso-evitativo intenso genera patrones push-pull extremos en relaciones.',
  implications: [
    'Patrones push-pull intensos',
    'Relaciones caóticas y inestables',
    'Sufrimiento emocional considerable',
    'Dificultad para mantener relaciones',
  ],
  mitigations: [
    'Terapia DBT para regulación emocional',
    'Trabajo en seguridad interna',
    'Desarrollo de apego seguro ganado',
    'Comunicación clara sobre necesidades contradictorias',
  ],
};

// ============================================================================
// CROSS-DIMENSIONAL CONFLICTS
// ============================================================================

export const LOW_TRUST_HIGH_EXTRAVERSION: ConflictRule = {
  id: 'low-trust-high-extraversion',
  severity: 'info',
  category: 'cross-dimensional',
  detect: (p) => {
    if (!p.facets) return false;
    return p.facets.agreeableness.trust < 30 && p.extraversion > 70;
  },
  title: 'Baja Confianza + Alta Extraversión',
  description: 'Alta extraversión con baja confianza puede generar relaciones numerosas pero superficiales.',
  implications: [
    'Muchas relaciones pero ninguna profunda',
    'Dificultad para ser vulnerable',
    'Sensación de aislamiento en multitudes',
    'Fatiga social sin satisfacción',
  ],
  mitigations: [
    'Trabajo en vulnerabilidad selectiva',
    'Priorizar calidad sobre cantidad',
    'Terapia para desarrollo de confianza',
    'Identificar relaciones seguras para profundizar',
  ],
};

export const HIGH_ANXIETY_LOW_SELF_EFFICACY: ConflictRule = {
  id: 'high-anxiety-low-self-efficacy',
  severity: 'warning',
  category: 'cross-dimensional',
  detect: (p) => {
    if (!p.facets) return false;
    return p.facets.neuroticism.anxiety > 70 && p.facets.conscientiousness.selfEfficacy < 40;
  },
  title: 'Alta Ansiedad + Baja Autoeficacia',
  description: 'Alta ansiedad combinada con baja confianza en las propias capacidades genera parálisis y evitación.',
  implications: [
    'Parálisis por ansiedad anticipatoria',
    'Evitación de desafíos',
    'Profecías autocumplidas de fracaso',
    'Círculo vicioso de ansiedad-evitación',
  ],
  mitigations: [
    'Terapia cognitivo-conductual',
    'Desarrollo gradual de competencias',
    'Celebración de pequeños logros',
    'Técnicas de exposición gradual',
  ],
};

export const IMPULSIVE_NARCISSIST: ConflictRule = {
  id: 'impulsive-narcissist',
  severity: 'danger',
  category: 'cross-dimensional',
  detect: (p) => {
    if (!p.facets || !p.darkTriad) return false;
    return p.facets.neuroticism.immoderation > 70 && p.darkTriad.narcissism > 60;
  },
  title: 'Impulsividad + Narcisismo',
  description: 'Impulsividad alta combinada con narcisismo puede llevar a comportamientos riesgosos y grandiosos.',
  implications: [
    'Toma de riesgos sin considerar consecuencias',
    'Comportamiento grandioso e imprudente',
    'Daño a relaciones por impulsividad',
    'Vulnerabilidad a heridas narcisistas inesperadas',
  ],
  mitigations: [
    'Terapia para control de impulsos',
    'Desarrollo de pause-and-think',
    'Trabajo en humildad y realismo',
    'Sistemas de accountability',
  ],
};

// ============================================================================
// VALORES Y COMPORTAMIENTO
// ============================================================================

export const ACHIEVEMENT_WITHOUT_DISCIPLINE: ConflictRule = {
  id: 'achievement-without-discipline',
  severity: 'info',
  category: 'cross-dimensional',
  detect: (p) => {
    if (!p.facets) return false;
    return p.facets.conscientiousness.achievementStriving > 70 && p.facets.conscientiousness.selfDiscipline < 40;
  },
  title: 'Alta Ambición sin Disciplina',
  description: 'Alto deseo de logro sin autodisciplina genera frustración por objetivos no alcanzados.',
  implications: [
    'Frustración crónica por metas no cumplidas',
    'Ciclo de motivación-procrastinación',
    'Autocrítica por falta de progreso',
    'Burnout por esfuerzos erráticos',
  ],
  mitigations: [
    'Desarrollo de sistemas y hábitos',
    'Accountability partners',
    'Técnicas de productividad (GTD, Pomodoro)',
    'Objetivos SMART en lugar de aspiracionales',
  ],
};

// ============================================================================
// EXPORT ALL RULES
// ============================================================================

/**
 * All conflict detection rules.
 * Total: 19 rules (expandable to 30-40).
 */
export const CONFLICT_RULES: ConflictRule[] = [
  // Big Five conflicts (6)
  IMPULSIVITY_RISK,
  PERFECTIONIST_ANXIETY,
  SOCIAL_ISOLATION_RISK,
  CONFLICT_AVOIDANCE,
  CREATIVE_CHAOS,
  RIGID_SKEPTICISM,

  // Facet-level (1)
  FACET_BIG_FIVE_MISMATCH,

  // Dark Triad (4)
  HIGH_MACHIAVELLIANISM,
  EXTREME_NARCISSISM,
  PSYCHOPATHY_INDICATORS,
  DARK_TRIAD_CLUSTER,

  // Attachment (3)
  ANXIOUS_ATTACHMENT_HIGH_NEUROTICISM,
  AVOIDANT_ATTACHMENT_LOW_AGREEABLENESS,
  FEARFUL_AVOIDANT_PARADOX,

  // Cross-dimensional (5)
  LOW_TRUST_HIGH_EXTRAVERSION,
  HIGH_ANXIETY_LOW_SELF_EFFICACY,
  IMPULSIVE_NARCISSIST,
  ACHIEVEMENT_WITHOUT_DISCIPLINE,
];

/** Rules organized by category. */
export const RULES_BY_CATEGORY = {
  'big-five': CONFLICT_RULES.filter((r) => r.category === 'big-five'),
  facets: CONFLICT_RULES.filter((r) => r.category === 'facets'),
  'dark-triad': CONFLICT_RULES.filter((r) => r.category === 'dark-triad'),
  attachment: CONFLICT_RULES.filter((r) => r.category === 'attachment'),
  'cross-dimensional': CONFLICT_RULES.filter((r) => r.category === 'cross-dimensional'),
};

/**
 * Reglas organizadas por severidad.
 */
export const RULES_BY_SEVERITY = {
  info: CONFLICT_RULES.filter((r) => r.severity === 'info'),
  warning: CONFLICT_RULES.filter((r) => r.severity === 'warning'),
  danger: CONFLICT_RULES.filter((r) => r.severity === 'danger'),
  critical: CONFLICT_RULES.filter((r) => r.severity === 'critical'),
};
