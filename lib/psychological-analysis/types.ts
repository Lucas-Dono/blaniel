/**
 * Psychological Analysis System - Type Definitions
 *
 * Sistema enriquecido de análisis psicológico que expande de 5 dimensiones Big Five
 * a 43+ variables psicológicas con análisis de conflictos y predicción de comportamientos.
 *
 * @version 1.0.0
 */

import { z } from 'zod';
import type { BigFiveTraits, PsychologicalNeeds } from '@/types/character-creation';

// ============================================================================
// BIG FIVE FACETS (30 dimensiones - 6 por cada Big Five trait)
// ============================================================================

/**
 * Facetas de Apertura a la Experiencia (Openness).
 * Todas las facetas son 0-100.
 */
export interface OpennessFacets {
  /** Capacidad imaginativa y fantasía */
  imagination: number;
  /** Apreciación por el arte, música, literatura */
  artisticInterests: number;
  /** Profundidad de emociones */
  emotionality: number;
  /** Búsqueda de aventura y nuevas experiencias */
  adventurousness: number;
  /** Curiosidad intelectual y amor por ideas abstractas */
  intellect: number;
  /** Apertura a valores no tradicionales */
  liberalism: number;
}

export const OpennessFacetsSchema = z.object({
  imagination: z.number().min(0).max(100).default(50),
  artisticInterests: z.number().min(0).max(100).default(50),
  emotionality: z.number().min(0).max(100).default(50),
  adventurousness: z.number().min(0).max(100).default(50),
  intellect: z.number().min(0).max(100).default(50),
  liberalism: z.number().min(0).max(100).default(50),
});

/**
 * Facetas de Responsabilidad (Conscientiousness).
 */
export interface ConscientiousnessFacets {
  /** Confianza en la propia capacidad */
  selfEfficacy: number;
  /** Deseo de orden y organización */
  orderliness: number;
  /** Sentido del deber y adherencia a obligaciones */
  dutifulness: number;
  /** Motivación para lograr objetivos */
  achievementStriving: number;
  /** Capacidad de autodisciplina */
  selfDiscipline: number;
  /** Tendencia a pensar antes de actuar */
  cautiousness: number;
}

export const ConscientiousnessFacetsSchema = z.object({
  selfEfficacy: z.number().min(0).max(100).default(50),
  orderliness: z.number().min(0).max(100).default(50),
  dutifulness: z.number().min(0).max(100).default(50),
  achievementStriving: z.number().min(0).max(100).default(50),
  selfDiscipline: z.number().min(0).max(100).default(50),
  cautiousness: z.number().min(0).max(100).default(50),
});

/**
 * Facetas de Extraversión (Extraversion).
 */
export interface ExtraversionFacets {
  /** Cordialidad y calidez hacia otros */
  friendliness: number;
  /** Preferencia por compañía de otros */
  gregariousness: number;
  /** Tendencia a tomar control y liderar */
  assertiveness: number;
  /** Nivel de energía y ritmo de actividad */
  activityLevel: number;
  /** Búsqueda de excitación y estimulación */
  excitementSeeking: number;
  /** Nivel de entusiasmo y emociones positivas */
  cheerfulness: number;
}

export const ExtraversionFacetsSchema = z.object({
  friendliness: z.number().min(0).max(100).default(50),
  gregariousness: z.number().min(0).max(100).default(50),
  assertiveness: z.number().min(0).max(100).default(50),
  activityLevel: z.number().min(0).max(100).default(50),
  excitementSeeking: z.number().min(0).max(100).default(50),
  cheerfulness: z.number().min(0).max(100).default(50),
});

/**
 * Facetas de Amabilidad (Agreeableness).
 */
export interface AgreeablenessFacets {
  /** Confianza en las intenciones de otros */
  trust: number;
  /** Honestidad y franqueza */
  morality: number;
  /** Preocupación por el bienestar de otros */
  altruism: number;
  /** Preferencia por cooperación sobre competencia */
  cooperation: number;
  /** Humildad y modestia */
  modesty: number;
  /** Capacidad de empatía y compasión */
  sympathy: number;
}

export const AgreeablenessFacetsSchema = z.object({
  trust: z.number().min(0).max(100).default(50),
  morality: z.number().min(0).max(100).default(50),
  altruism: z.number().min(0).max(100).default(50),
  cooperation: z.number().min(0).max(100).default(50),
  modesty: z.number().min(0).max(100).default(50),
  sympathy: z.number().min(0).max(100).default(50),
});

/**
 * Facetas de Neuroticismo (Neuroticism).
 */
export interface NeuroticismFacets {
  /** Nivel de ansiedad y preocupación */
  anxiety: number;
  /** Tendencia a experimentar enojo */
  anger: number;
  /** Susceptibilidad a la depresión */
  depression: number;
  /** Timidez social y autoconsciencia */
  selfConsciousness: number;
  /** Dificultad para resistir impulsos */
  immoderation: number;
  /** Vulnerabilidad al estrés */
  vulnerability: number;
}

export const NeuroticismFacetsSchema = z.object({
  anxiety: z.number().min(0).max(100).default(50),
  anger: z.number().min(0).max(100).default(50),
  depression: z.number().min(0).max(100).default(50),
  selfConsciousness: z.number().min(0).max(100).default(50),
  immoderation: z.number().min(0).max(100).default(50),
  vulnerability: z.number().min(0).max(100).default(50),
});

/**
 * Todas las facetas Big Five (30 dimensiones totales).
 */
export interface BigFiveFacets {
  openness: OpennessFacets;
  conscientiousness: ConscientiousnessFacets;
  extraversion: ExtraversionFacets;
  agreeableness: AgreeablenessFacets;
  neuroticism: NeuroticismFacets;
}

export const BigFiveFacetsSchema = z.object({
  openness: OpennessFacetsSchema,
  conscientiousness: ConscientiousnessFacetsSchema,
  extraversion: ExtraversionFacetsSchema,
  agreeableness: AgreeablenessFacetsSchema,
  neuroticism: NeuroticismFacetsSchema,
});

// ============================================================================
// DARK TRIAD (3 dimensiones)
// ============================================================================

/**
 * Dark Triad - Rasgos de personalidad oscuros.
 * Todos los valores son 0-100.
 *
 * ⚠️ Valores >60 indican rasgos marcados que pueden causar conflicto interpersonal.
 * ⚠️ Valores >80 indican rasgos extremos que requieren cuidado especial.
 */
export interface DarkTriad {
  /** Manipulación estratégica y falta de moralidad en las relaciones */
  machiavellianism: number;
  /** Grandiosidad, necesidad de admiración, falta de empatía */
  narcissism: number;
  /** Impulsividad, falta de remordimiento, búsqueda de sensaciones */
  psychopathy: number;
}

export const DarkTriadSchema = z.object({
  machiavellianism: z.number().min(0).max(100).default(0),
  narcissism: z.number().min(0).max(100).default(0),
  psychopathy: z.number().min(0).max(100).default(0),
});

/**
 * Nivel de advertencia para Dark Triad.
 */
export type DarkTriadWarningLevel = 'none' | 'moderate' | 'high' | 'extreme';

/**
 * Calcula el nivel de advertencia basado en el valor de una dimensión Dark Triad.
 */
export function getDarkTriadWarningLevel(value: number): DarkTriadWarningLevel {
  if (value <= 40) return 'none';
  if (value <= 60) return 'moderate';
  if (value <= 80) return 'high';
  return 'extreme';
}

// ============================================================================
// ATTACHMENT STYLE (Estilo de Apego)
// ============================================================================

/**
 * Tipos de estilo de apego basados en la teoría de Bowlby y Ainsworth.
 */
export type AttachmentStyle = 'secure' | 'anxious' | 'avoidant' | 'fearful-avoidant';

/**
 * Perfil completo de estilo de apego.
 */
export interface AttachmentProfile {
  /** Estilo de apego primario */
  primaryStyle: AttachmentStyle;
  /** Intensidad del estilo de apego (0-100) */
  intensity: number;
  /** Manifestaciones específicas del estilo de apego */
  manifestations: string[];
}

export const AttachmentProfileSchema = z.object({
  primaryStyle: z.enum(['secure', 'anxious', 'avoidant', 'fearful-avoidant']),
  intensity: z.number().min(0).max(100).default(50),
  manifestations: z.array(z.string().max(300)).max(10).default([]),
});

/**
 * Descripciones de cada estilo de apego.
 */
export const ATTACHMENT_DESCRIPTIONS: Record<AttachmentStyle, string> = {
  secure: 'Confiado en las relaciones, cómodo con intimidad y autonomía',
  anxious: 'Necesitado, miedo al abandono, busca reassurance constante',
  avoidant: 'Distante, incómodo con cercanía, valora independencia extrema',
  'fearful-avoidant': 'Ambivalente, desea intimidad pero la teme, patrones push-pull',
};

// ============================================================================
// ENRICHED PERSONALITY PROFILE
// ============================================================================

/**
 * Perfil de personalidad enriquecido con todas las dimensiones psicológicas.
 * Extiende BigFiveTraits con facetas, Dark Triad y estilo de apego.
 */
export interface EnrichedPersonalityProfile extends BigFiveTraits {
  /** Valores fundamentales del personaje */
  coreValues: string[];
  /** Emociones base */
  baselineEmotions: {
    joy: number;
    sadness: number;
    anger: number;
    fear: number;
    disgust: number;
    surprise: number;
  };
  /** Facetas detalladas de Big Five (30 dimensiones) */
  facets?: BigFiveFacets;
  /** Dark Triad (3 dimensiones) */
  darkTriad?: DarkTriad;
  /** Estilo de apego */
  attachment?: AttachmentProfile;
  /** Necesidades psicológicas (ya existe en el sistema) */
  psychologicalNeeds?: PsychologicalNeeds;
}

export const EnrichedPersonalityProfileSchema = z.object({
  // Big Five base (requeridos)
  openness: z.number().min(0).max(100),
  conscientiousness: z.number().min(0).max(100),
  extraversion: z.number().min(0).max(100),
  agreeableness: z.number().min(0).max(100),
  neuroticism: z.number().min(0).max(100),
  // Core values y emociones base
  coreValues: z.array(z.string()),
  baselineEmotions: z.object({
    joy: z.number(),
    sadness: z.number(),
    anger: z.number(),
    fear: z.number(),
    disgust: z.number(),
    surprise: z.number(),
  }),
  // Dimensiones enriquecidas (opcionales)
  facets: BigFiveFacetsSchema.optional(),
  darkTriad: DarkTriadSchema.optional(),
  attachment: AttachmentProfileSchema.optional(),
  psychologicalNeeds: z
    .object({
      connection: z.number().min(0).max(1),
      autonomy: z.number().min(0).max(1),
      competence: z.number().min(0).max(1),
      novelty: z.number().min(0).max(1),
    })
    .optional(),
});

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

/**
 * Severidad de un conflicto psicológico detectado.
 */
export type ConflictSeverity = 'info' | 'warning' | 'danger' | 'critical';

/**
 * Advertencia de conflicto psicológico detectado.
 */
export interface ConflictWarning {
  /** ID único del conflicto */
  id: string;
  /** Severidad del conflicto */
  severity: ConflictSeverity;
  /** Título corto del conflicto */
  title: string;
  /** Descripción detallada */
  description: string;
  /** Implicaciones del conflicto */
  implications: string[];
  /** Posibles mitigaciones */
  mitigations: string[];
  /** Metadata adicional */
  metadata?: Record<string, unknown>;
}

export const ConflictWarningSchema = z.object({
  id: z.string(),
  severity: z.enum(['info', 'warning', 'danger', 'critical']),
  title: z.string().max(200),
  description: z.string().max(1000),
  implications: z.array(z.string().max(500)).max(10),
  mitigations: z.array(z.string().max(500)).max(10),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Regla de detección de conflictos.
 */
export interface ConflictRule {
  /** ID único de la regla */
  id: string;
  /** Severidad del conflicto si se detecta */
  severity: ConflictSeverity;
  /** Función de detección */
  detect: (profile: EnrichedPersonalityProfile) => boolean;
  /** Título del conflicto */
  title: string;
  /** Descripción del conflicto */
  description: string;
  /** Implicaciones del conflicto */
  implications: string[];
  /** Mitigaciones sugeridas */
  mitigations: string[];
  /** Categoría de la regla */
  category?: 'big-five' | 'facets' | 'dark-triad' | 'attachment' | 'cross-dimensional';
}

// ============================================================================
// BEHAVIOR PREDICTION
// ============================================================================

/**
 * Tipos de comportamiento que se pueden predecir.
 */
export type BehaviorType =
  | 'YANDERE_OBSESSIVE'
  | 'BPD_SPLITTING'
  | 'NPD_GRANDIOSE'
  | 'ANXIOUS_ATTACHMENT'
  | 'CODEPENDENCY'
  | 'AVOIDANT_DISMISSIVE'
  | 'MANIPULATIVE'
  | 'IMPULSIVE'
  | 'PERFECTIONIST'
  | 'PEOPLE_PLEASER';

/**
 * Predicción de un comportamiento basado en el perfil psicológico.
 */
export interface BehaviorPrediction {
  /** Tipo de comportamiento */
  behaviorType: BehaviorType;
  /** Probabilidad de manifestación (0-1) */
  likelihood: number;
  /** Factores que disparan el comportamiento */
  triggeringFactors: string[];
  /** Señales tempranas del comportamiento */
  earlyWarnings: string[];
  /** Metadata adicional */
  metadata?: Record<string, unknown>;
}

export const BehaviorPredictionSchema = z.object({
  behaviorType: z.enum([
    'YANDERE_OBSESSIVE',
    'BPD_SPLITTING',
    'NPD_GRANDIOSE',
    'ANXIOUS_ATTACHMENT',
    'CODEPENDENCY',
    'AVOIDANT_DISMISSIVE',
    'MANIPULATIVE',
    'IMPULSIVE',
    'PERFECTIONIST',
    'PEOPLE_PLEASER',
  ]),
  likelihood: z.number().min(0).max(1),
  triggeringFactors: z.array(z.string().max(300)).max(10),
  earlyWarnings: z.array(z.string().max(300)).max(10),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Regla de predicción de comportamiento.
 */
export interface PredictionRule {
  /** Tipo de comportamiento que predice */
  behaviorType: BehaviorType;
  /** Función que calcula la probabilidad (0-1) */
  calculate: (profile: EnrichedPersonalityProfile) => number;
  /** Factores desencadenantes */
  triggers: string[];
  /** Señales de advertencia temprana */
  warnings: string[];
}

// ============================================================================
// AUTHENTICITY SCORING
// ============================================================================

/**
 * Desglose del score de autenticidad por componente.
 */
export interface AuthenticityBreakdown {
  /** Consistencia entre Big Five y facetas (0-1) */
  bigFiveFacetsConsistency: number;
  /** Alineación entre valores y traits (0-1) */
  valuesTraitsAlignment: number;
  /** Coherencia emocional con neuroticism (0-1) */
  emotionalCoherence: number;
  /** Coherencia Dark Triad con agreeableness (0-1) */
  darkTriadCoherence: number;
  /** Coherencia apego con extraversion (0-1) */
  attachmentCoherence: number;
  /** Alineación de comportamientos predichos (0-1) */
  behaviorAlignment: number;
}

/**
 * Score de autenticidad del perfil psicológico (0-100).
 */
export interface AuthenticityScore {
  /** Score total de autenticidad (0-100) */
  score: number;
  /** Desglose por componente */
  breakdown: AuthenticityBreakdown;
  /** Nivel de autenticidad */
  level: 'highly-inconsistent' | 'unrealistic' | 'some-inconsistencies' | 'mostly-coherent' | 'highly-authentic';
}

export const AuthenticityScoreSchema = z.object({
  score: z.number().min(0).max(100),
  breakdown: z.object({
    bigFiveFacetsConsistency: z.number().min(0).max(1),
    valuesTraitsAlignment: z.number().min(0).max(1),
    emotionalCoherence: z.number().min(0).max(1),
    darkTriadCoherence: z.number().min(0).max(1),
    attachmentCoherence: z.number().min(0).max(1),
    behaviorAlignment: z.number().min(0).max(1),
  }),
  level: z.enum(['highly-inconsistent', 'unrealistic', 'some-inconsistencies', 'mostly-coherent', 'highly-authentic']),
});

/**
 * Determina el nivel de autenticidad basado en el score.
 */
export function getAuthenticityLevel(score: number): AuthenticityScore['level'] {
  if (score >= 80) return 'highly-authentic';
  if (score >= 60) return 'mostly-coherent';
  if (score >= 40) return 'some-inconsistencies';
  if (score >= 20) return 'unrealistic';
  return 'highly-inconsistent';
}

// ============================================================================
// PSYCHOLOGICAL ANALYSIS RESULT
// ============================================================================

/**
 * Resultado completo del análisis psicológico.
 */
export interface PsychologicalAnalysis {
  /** Score de autenticidad */
  authenticityScore: AuthenticityScore;
  /** Conflictos detectados */
  detectedConflicts: ConflictWarning[];
  /** Comportamientos predichos */
  predictedBehaviors: BehaviorPrediction[];
  /** Timestamp del análisis */
  analyzedAt: Date;
  /** Metadata adicional */
  metadata?: Record<string, unknown>;
}

export const PsychologicalAnalysisSchema = z.object({
  authenticityScore: AuthenticityScoreSchema,
  detectedConflicts: z.array(ConflictWarningSchema),
  predictedBehaviors: z.array(BehaviorPredictionSchema),
  analyzedAt: z.date(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// PRESETS
// ============================================================================

/**
 * Preset de Big Five.
 */
export interface BigFivePreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  values: BigFiveTraits;
}

/**
 * Preset de Dark Triad.
 */
export interface DarkTriadPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  values: DarkTriad;
}

/**
 * Preset de estilo de apego.
 */
export interface AttachmentPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  style: AttachmentStyle;
  intensity: number;
}

// ============================================================================
// DEFAULTS
// ============================================================================

export const DEFAULT_DARK_TRIAD: DarkTriad = {
  machiavellianism: 0,
  narcissism: 0,
  psychopathy: 0,
};

export const DEFAULT_ATTACHMENT_PROFILE: AttachmentProfile = {
  primaryStyle: 'secure',
  intensity: 50,
  manifestations: [],
};

/**
 * Genera facetas por defecto (todas en 50).
 */
export function createDefaultFacets(): BigFiveFacets {
  return {
    openness: {
      imagination: 50,
      artisticInterests: 50,
      emotionality: 50,
      adventurousness: 50,
      intellect: 50,
      liberalism: 50,
    },
    conscientiousness: {
      selfEfficacy: 50,
      orderliness: 50,
      dutifulness: 50,
      achievementStriving: 50,
      selfDiscipline: 50,
      cautiousness: 50,
    },
    extraversion: {
      friendliness: 50,
      gregariousness: 50,
      assertiveness: 50,
      activityLevel: 50,
      excitementSeeking: 50,
      cheerfulness: 50,
    },
    agreeableness: {
      trust: 50,
      morality: 50,
      altruism: 50,
      cooperation: 50,
      modesty: 50,
      sympathy: 50,
    },
    neuroticism: {
      anxiety: 50,
      anger: 50,
      depression: 50,
      selfConsciousness: 50,
      immoderation: 50,
      vulnerability: 50,
    },
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function hasEnrichedDimensions(profile: EnrichedPersonalityProfile): boolean {
  return !!(profile.facets || profile.darkTriad || profile.attachment);
}

export function hasFacets(profile: EnrichedPersonalityProfile): profile is EnrichedPersonalityProfile & { facets: BigFiveFacets } {
  return profile.facets !== undefined;
}

export function hasDarkTriad(profile: EnrichedPersonalityProfile): profile is EnrichedPersonalityProfile & { darkTriad: DarkTriad } {
  return profile.darkTriad !== undefined;
}

export function hasAttachment(
  profile: EnrichedPersonalityProfile
): profile is EnrichedPersonalityProfile & { attachment: AttachmentProfile } {
  return profile.attachment !== undefined;
}
