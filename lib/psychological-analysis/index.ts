/**
 * Psychological Analysis System - Public API
 *
 * Exporta todos los tipos, schemas, clases y utilidades del sistema de análisis psicológico.
 *
 * @version 1.0.0
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Big Five Facets
  OpennessFacets,
  ConscientiousnessFacets,
  ExtraversionFacets,
  AgreeablenessFacets,
  NeuroticismFacets,
  BigFiveFacets,
  // Dark Triad
  DarkTriad,
  DarkTriadWarningLevel,
  // Attachment
  AttachmentStyle,
  AttachmentProfile,
  // Enriched Profile
  EnrichedPersonalityProfile,
  // Conflict Detection
  ConflictSeverity,
  ConflictWarning,
  ConflictRule,
  // Behavior Prediction
  BehaviorType,
  BehaviorPrediction,
  PredictionRule,
  // Authenticity Scoring
  AuthenticityBreakdown,
  AuthenticityScore,
  // Analysis Result
  PsychologicalAnalysis,
  // Presets
  BigFivePreset,
  DarkTriadPreset,
  AttachmentPreset,
} from './types';

// ============================================================================
// SCHEMA EXPORTS
// ============================================================================

export {
  OpennessFacetsSchema,
  ConscientiousnessFacetsSchema,
  ExtraversionFacetsSchema,
  AgreeablenessFacetsSchema,
  NeuroticismFacetsSchema,
  BigFiveFacetsSchema,
  DarkTriadSchema,
  AttachmentProfileSchema,
  EnrichedPersonalityProfileSchema,
  ConflictWarningSchema,
  BehaviorPredictionSchema,
  AuthenticityScoreSchema,
  PsychologicalAnalysisSchema,
} from './types';

// ============================================================================
// UTILITY EXPORTS (from types)
// ============================================================================

export {
  getDarkTriadWarningLevel,
  getAuthenticityLevel,
  createDefaultFacets,
  hasEnrichedDimensions,
  hasFacets,
  hasDarkTriad,
  hasAttachment,
  DEFAULT_DARK_TRIAD,
  DEFAULT_ATTACHMENT_PROFILE,
  ATTACHMENT_DESCRIPTIONS,
} from './types';

// ============================================================================
// FACET INFERENCE EXPORTS
// ============================================================================

export {
  inferFacetsFromBigFive,
  checkFacetConsistency,
  adjustFacetsTowardsBigFive,
  calculateFacetAverage,
} from './facet-inference';

// ============================================================================
// CONFLICT DETECTION EXPORTS
// ============================================================================

export { ConflictDetector, detectConflicts, detectCriticalConflicts, calculateConflictScore } from './conflict-detector';

export {
  CONFLICT_RULES,
  RULES_BY_CATEGORY,
  RULES_BY_SEVERITY,
  // Individual rules exported for testing/customization
  IMPULSIVITY_RISK,
  PERFECTIONIST_ANXIETY,
  SOCIAL_ISOLATION_RISK,
  CONFLICT_AVOIDANCE,
  CREATIVE_CHAOS,
  RIGID_SKEPTICISM,
  HIGH_MACHIAVELLIANISM,
  EXTREME_NARCISSISM,
  PSYCHOPATHY_INDICATORS,
  DARK_TRIAD_CLUSTER,
  ANXIOUS_ATTACHMENT_HIGH_NEUROTICISM,
  AVOIDANT_ATTACHMENT_LOW_AGREEABLENESS,
  FEARFUL_AVOIDANT_PARADOX,
} from './conflict-rules';

// ============================================================================
// AUTHENTICITY SCORING EXPORTS
// ============================================================================

export { AuthenticityScorer, calculateAuthenticityScore, isProfileRealistic } from './authenticity-scorer';

// ============================================================================
// BEHAVIOR PREDICTION EXPORTS
// ============================================================================

export { BehaviorPredictor, predictBehaviors, predictTopBehaviors } from './behavior-predictor';

// ============================================================================
// CORE VALUES NORMALIZATION EXPORTS (Backwards Compatibility)
// ============================================================================

export {
  normalizeCoreValuesToStringArray,
  normalizeCoreValuesToWeightedArray,
  extractEnrichedDimensions,
  hasEnrichedDimensions as hasCoreValuesEnrichedFormat,
  migrateToEnrichedFormat,
  type CoreValueWithWeight,
  type EnrichedCoreValuesData,
} from './corevalues-normalizer';

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

import type { EnrichedPersonalityProfile, PsychologicalAnalysis } from './types';
import { ConflictDetector } from './conflict-detector';
import { AuthenticityScorer } from './authenticity-scorer';
import { BehaviorPredictor } from './behavior-predictor';

/**
 * Analiza un perfil psicológico completo.
 *
 * Esta es la función principal que orquesta todos los análisis:
 * - Score de autenticidad
 * - Detección de conflictos
 * - Predicción de comportamientos
 *
 * @param profile - Perfil psicológico enriquecido
 * @returns Análisis psicológico completo
 *
 * @example
 * const analysis = analyzePsychologicalProfile(enrichedProfile);
 * console.log(`Autenticidad: ${analysis.authenticityScore.score}%`);
 * console.log(`Conflictos: ${analysis.detectedConflicts.length}`);
 * console.log(`Comportamientos predichos: ${analysis.predictedBehaviors.length}`);
 */
export function analyzePsychologicalProfile(profile: EnrichedPersonalityProfile): PsychologicalAnalysis {
  const conflictDetector = new ConflictDetector();
  const authenticityScorer = new AuthenticityScorer();
  const behaviorPredictor = new BehaviorPredictor();

  return {
    authenticityScore: authenticityScorer.calculateScore(profile),
    detectedConflicts: conflictDetector.detectConflicts(profile),
    predictedBehaviors: behaviorPredictor.predictBehaviors(profile),
    analyzedAt: new Date(),
  };
}
