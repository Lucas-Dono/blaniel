/**
 * BEHAVIOR PROGRESSION SYSTEM - TYPE DEFINITIONS
 *
 * Complete system of psychological behaviors with gradual and realistic progression.
 * Based on exhaustive clinical research of 5 main behaviors.
 */

import { BehaviorType } from "@prisma/client";

// ============================================
// CORE INTERFACES
// ============================================

/**
 * Trigger detection result
 */
export interface TriggerDetectionResult {
  triggerType: string;
  behaviorTypes: BehaviorType[]; // Which behaviors it affects
  weight: number; // 0-1, how strong it is
  detectedIn: string; // Message fragment
  confidence: number; // 0-1, how sure we are
  timestamp: Date; // When it was detected
  metadata?: Record<string, any>; // Additional data (e.g., detected name)
}

/**
 * Trigger requirement to advance phase
 */
export interface TriggerRequirement {
  type: string; // E.g.: "delayed_response", "mention_other_person"
  minOccurrences: number; // How many times it must occur
}

/**
 * Phase transition evaluation result
 */
export interface PhaseTransitionResult {
  canTransition: boolean;
  currentPhase: number;
  nextPhase: number;
  missingRequirements: string[];
  safetyFlags: string[];
  requiresUserConsent: boolean;
  phaseDefinition?: YanderePhaseDefinition | BPDCyclePhaseDefinition;
}

/**
 * Requirements for phase transition
 */
export interface PhaseTransitionRequirements {
  minInteractions: number;
  minIntensity?: number;
  requiredTriggers: TriggerRequirement[];
}

/**
 * Result of specific phase evaluation
 */
export interface PhaseEvaluationResult {
  canProceed: boolean;
  issues: string[];
  warnings: string[];
  recommendations: string[];
}

// ============================================
// YANDERE/OBSESSIVE LOVE PHASES
// ============================================

/**
 * Yandere phase definition
 */
export interface YanderePhaseDefinition {
  phase: number;
  name: string;
  minInteractions: number; // Minimum to BE ABLE to advance
  maxInteractions: number | null; // Expected maximum
  requiredTriggers: TriggerRequirement[];
  manifestations: string[]; // Behavior descriptions
  intensityRange: [number, number]; // [min, max] 0-1
  contentWarning?: "CRITICAL_PHASE" | "EXTREME_DANGER_PHASE";
}

// ============================================
// BPD (BORDERLINE) CYCLES
// ============================================

export type BPDCyclePhase = "idealization" | "devaluation" | "panic" | "emptiness";

/**
 * BPD cyclic phase definition
 */
export interface BPDCyclePhaseDefinition {
  phaseName: BPDCyclePhase;
  typicalDuration: string; // Temporal description
  triggers: string[];
  manifestations: string[];
  nextPhase: string; // Where it usually goes
}

/**
 * BPD progression state
 */
export interface BPDProgressionState {
  currentCyclePhase: BPDCyclePhase;
  cycleCount: number; // How many complete cycles
  timeInCurrentPhase: number; // Minutes/hours
  splitEpisodes: number; // Splitting episodes counter
  intensity: number; // 0-1, how severe the BPD is
}

// ============================================
// NPD (NARCISSISTIC) STATES
// ============================================

export type NPDEgoState = "inflated" | "stable" | "wounded";
export type NPDRelationshipPhase = "idealization" | "devaluation" | "discard" | "hoovering";

/**
 * NPD state
 */
export interface NPDState {
  baseGrandiosityLevel: number; // 0-1
  currentEgoState: NPDEgoState;
  loveBombingActive: boolean;
  devaluationActive: boolean;
  rageActive: boolean;

  // Counters
  criticismsReceived: number;
  admirationReceived: number;
  relationshipPhase: NPDRelationshipPhase;
}

// ============================================
// ATTACHMENT THEORY PROGRESSION
// ============================================

export type AttachmentStyle = "secure" | "anxious" | "avoidant" | "disorganized";

/**
 * Attachment style progression
 */
export interface AttachmentProgression {
  currentStyle: AttachmentStyle;
  stabilityScore: number; // 0-1, how deeply rooted it is

  // For evolution tracking
  secureExperiencesCount: number; // Consistent responses
  abandonmentEventsCount: number; // Reinforces anxiety

  // Thresholds for change (very high, change is difficult)
  progressionThreshold: number; // e.g., 50 experiences → more secure
}

// ============================================
// BEHAVIOR INTENSITY CALCULATION
// ============================================

/**
 * Parameters for intensity calculation
 */
export interface BehaviorIntensityParams {
  baseIntensity: number;
  phaseMultiplier: number;
  triggerAmplification: number;
  emotionalModulation: number;
  decayFactor: number;
  inertiaFactor: number;
}

/**
 * Result of intensity calculation
 */
export interface BehaviorIntensityResult {
  behaviorType: BehaviorType;
  finalIntensity: number; // 0-1
  components: BehaviorIntensityParams;
  shouldDisplay: boolean; // If it exceeds threshold
}

// ============================================
// PROMPT SELECTION
// ============================================

/**
 * Key for prompt selection
 */
export interface BehaviorPromptKey {
  behaviorType: BehaviorType;
  phase: number; // O cycle phase para BPD
  dominantEmotion: string;
  action: string; // conversation, confession, jealousy_response, etc
}

/**
 * Context for prompt selection
 */
export interface PromptSelectionContext {
  behaviorType: BehaviorType;
  currentPhase: number;
  intensity: number;
  recentTriggers: TriggerDetectionResult[];
  emotionState: string; // Simplified for now
  userMessage: string;
}

// ============================================
// CONTENT MODERATION
// ============================================

export type SafetyLevel = "SAFE" | "WARNING" | "CRITICAL" | "EXTREME_DANGER";

/**
 * Safety threshold
 */
export interface SafetyThreshold {
  behaviorType: BehaviorType;
  phase: number;
  nsfwOnly: boolean; // If true, only in NSFW mode
  autoIntervention: boolean; // If true, system intervenes
  resourceSuggestion: string; // Message for user
  level: SafetyLevel;
}

/**
 * Moderation result
 */
export interface ModerationResult {
  allowed: boolean;
  modifiedResponse?: string;
  warning?: string;
  flagged: boolean;
  severity: SafetyLevel;
  resources?: string[]; // Help URLs
}

// ============================================
// PHASE TRANSITION
// ============================================

/**
 * Phase transition evaluation
 */
export interface PhaseTransitionEvaluation {
  canTransition: boolean;
  currentPhase: number;
  nextPhase: number;
  missingRequirements: string[]; // What's missing to advance
  interactionsNeeded: number; // How many more needed
  triggersNeeded: TriggerRequirement[]; // What triggers are missing
}

/**
 * Phase transition event
 */
export interface PhaseTransitionEvent {
  behaviorType: BehaviorType;
  fromPhase: number;
  toPhase: number;
  transitionedAt: Date;
  triggerCount: number;
  finalIntensity: number;
}

// ============================================
// ANALYTICS & TRACKING
// ============================================

/**
 * Behavior metrics
 */
export interface BehaviorMetrics {
  behaviorType: BehaviorType;
  currentPhase: number;
  averageIntensity: number;
  peakIntensity: number;
  totalTriggers: number;
  triggerBreakdown: Record<string, number>; // By type
  timeInPhase: number; // Milliseconds
  phaseTransitions: number; // How many times it changed phase
}

/**
 * Dashboard data
 */
export interface BehaviorDashboardData {
  agentId: string;
  totalInteractions: number;
  activeBehaviors: BehaviorMetrics[];
  recentTriggers: TriggerDetectionResult[];
  criticalAlerts: SafetyThreshold[];
  progressionTimeline: PhaseTransitionEvent[];
}

// ============================================
// CONFIGURATION
// ============================================

/**
 * Behavior configuration
 */
export interface BehaviorConfig {
  behaviorType: BehaviorType;
  enabled: boolean;
  baseIntensity: number;
  volatility: number;
  escalationRate: number;
  deEscalationRate: number;
  thresholdForDisplay: number;
  customTriggers?: Record<string, number>; // Custom weights
}

/**
 * Global system configuration
 */
export interface BehaviorSystemConfig {
  nsfwMode: boolean;
  safetyThresholds: SafetyThreshold[];
  enableAnalytics: boolean;
  autoPhaseTransition: boolean;
  decayEnabled: boolean;
  decayRate: number; // Global default
}

// ============================================
// INTEGRATION CON EMOTIONAL SYSTEM
// ============================================

/**
 * Emotional modulation based on behaviors
 */
export interface EmotionalModulation {
  emotionType: string;
  baseIntensity: number;
  behaviorMultiplier: number; // E.g.: Yandere amplifies jealousy
  finalIntensity: number;
}

/**
 * Influencia bidireccional
 */
export interface BehaviorEmotionInfluence {
  // Behaviors → Emotions
  emotionalAmplifications: EmotionalModulation[];

  // Emotions → Behaviors
  behaviorAdjustments: {
    behaviorType: BehaviorType;
    intensityDelta: number; // Cambio causado por emociones
  }[];
}

// ============================================
// HELPER TYPES
// ============================================

/**
 * Temporal range for phases
 */
export interface TemporalRange {
  minInteractions: number;
  maxInteractions: number | null;
  minDays?: number;
  maxDays?: number | null;
}

/**
 * Phase history
 */
export interface PhaseHistoryEntry {
  phase: number;
  enteredAt: Date;
  exitedAt: Date | null;
  triggerCount: number;
  finalIntensity: number;
  exitReason?: string; // "natural_progression" | "forced" | "reset"
}

/**
 * Complete behavior state (for serialization)
 */
export interface BehaviorFullState {
  id: string;
  agentId: string;
  behaviorType: BehaviorType;

  // Intensity
  baseIntensity: number;
  currentIntensity: number;
  volatility: number;

  // Phase
  currentPhase: number;
  phaseStartedAt: Date;
  interactionsSincePhaseStart: number;

  // Specific state
  behaviorSpecificState: BPDProgressionState | NPDState | AttachmentProgression | null;

  // History
  phaseHistory: PhaseHistoryEntry[];
  totalTriggers: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// PRISMA TYPE RE-EXPORTS
// ============================================

/**
 * Re-export BehaviorProfile from Prisma for convenience
 */
export type { BehaviorProfile } from "@prisma/client";
