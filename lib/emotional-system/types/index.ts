/**
 * EMOTIONAL SYSTEM - COMPREHENSIVE TYPE DEFINITIONS
 *
 * Advanced emotional system based on:
 * - Big Five Personality Model
 * - OCC Appraisal Theory
 * - PAD Emotional State Model
 * - Biologically Inspired Cognitive Architecture (BICA)
 */

// ============================================
// PERSONALITY CORE TYPES
// ============================================

export interface BigFiveTraits {
  openness: number;          // 0-100: Curiosity, creativity, receptivity
  conscientiousness: number; // 0-100: Organization, self-discipline, reliability
  extraversion: number;      // 0-100: Energy from social stimuli
  agreeableness: number;     // 0-100: Cooperation, empathy, trust
  neuroticism: number;       // 0-100: Emotional instability (high = anxious)
}

export interface CoreValue {
  value: string;           // Value name (e.g: "authenticity")
  weight: number;          // 0-1: Importance of the value
  description: string;     // Description of the value
}

export interface MoralSchema {
  domain: string;          // Moral domain (e.g: "honesty")
  stance: string;          // Stance (e.g: "direct but empathetic")
  threshold: number;       // 0-1: Threshold to activate
}

export interface PersonalityCore {
  bigFive: BigFiveTraits;
  coreValues: CoreValue[];
  moralSchemas: MoralSchema[];
  backstory?: string;
  baselineEmotions: EmotionState;
}

// ============================================
// EMOTION & MOOD TYPES
// ============================================

/**
 * 22 Emotions of the OCC model
 * Organized by evaluation focus
 */
export type EmotionType =
  // EVENTS - Consequences of events
  | "joy" | "distress"           // Own well-being
  | "hope" | "fear"              // Future prospects
  | "satisfaction" | "disappointment"  // Expectation confirmation
  | "relief" | "fears_confirmed" // Realization of prospects
  | "happy_for" | "resentment"   // Well-being of others
  | "pity" | "gloating"          // Fortune of others

  // ACTIONS - Actions of agents
  | "pride" | "shame"            // Own actions
  | "admiration" | "reproach"    // Actions of others
  | "gratitude" | "anger"        // Combined (action + event)

  // OBJECTS - Aspects of objects
  | "liking" | "disliking"       // Attraction/Repulsion

  // ADDITIONAL EMOTIONS (for greater realism)
  | "interest" | "curiosity"     // Cognitive interest
  | "affection" | "love"         // Social emotions
  | "anxiety" | "concern"        // Worry
  | "sadness"                    // Sadness
  | "boredom" | "excitement";    // Arousal-based

export type EmotionState = {
  [key in EmotionType]?: number;  // 0-1: Intensity of each emotion
};

/**
 * PAD Model (Pleasure-Arousal-Dominance)
 * Dimensional mood model
 */
export interface PADMood {
  valence: number;    // -1 (very negative) to +1 (very positive)
  arousal: number;    // 0 (calm) to 1 (very activated)
  dominance: number;  // 0 (submissive) to 1 (dominant/controlled)
}

export interface EmotionDynamics {
  decayRate: number;  // 0-1: Emotional decay speed
  inertia: number;    // 0-1: Resistance to emotional change
}

// ============================================
// APPRAISAL TYPES (OCC Model)
// ============================================

/**
 * OCC appraisal variables
 */
export interface AppraisalScores {
  // Variables core OCC
  desirability: number;           // -1 a 1: ¿Es deseable para mis objetivos?
  desirabilityForUser: number;    // -1 a 1: ¿Es deseable para el usuario?
  praiseworthiness: number;       // -1 a 1: ¿La acción es digna de elogio?
  appealingness: number;          // -1 a 1: ¿El objeto me atrae?
  likelihood: number;             // 0 a 1: ¿Qué tan probable es?

  // Variables adicionales
  relevanceToGoals: number;       // 0 a 1: Relevancia para objetivos actuales
  valueAlignment: number;         // -1 a 1: Alineación con valores core
  novelty: number;                // 0 a 1: Qué tan nuevo/sorprendente
  urgency: number;                // 0 a 1: Qué tan urgente
  socialAppropriateness: number;  // 0 a 1: Apropiado socialmente
}

// ============================================
// GOAL & NEED TYPES
// ============================================

export type GoalType = "social" | "personal" | "achievement" | "maintenance";

export interface Goal {
  goal: string;           // Descripción del objetivo
  priority: number;       // 0-1: Prioridad del objetivo
  progress: number;       // 0-1: Progreso hacia el objetivo
  type: GoalType;         // Tipo de objetivo
  conflictsWith?: string[];  // Objetivos con los que puede conflictuar
}

/**
 * Necesidades psicológicas básicas (Self-Determination Theory)
 */
export interface PsychologicalNeeds {
  connection: number;     // 0-1: Necesidad de conexión emocional
  autonomy: number;       // 0-1: Necesidad de autonomía/control
  competence: number;     // 0-1: Necesidad de sentirse competente
  novelty: number;        // 0-1: Necesidad de novedad/estimulación
}

// ============================================
// INTERNAL STATE TYPES
// ============================================

export interface InternalState {
  emotions: EmotionState;
  mood: PADMood;
  // Prisma model fields (flat structure)
  moodValence: number;
  moodArousal: number;
  moodDominance: number;
  emotionDecayRate: number;
  emotionInertia: number;
  // Psychological needs (flat)
  needConnection: number;
  needAutonomy: number;
  needCompetence: number;
  needNovelty: number;
  activeGoals: any; // Prisma Json field
  conversationBuffer: any; // Prisma Json field
  currentEmotions: any; // Prisma Json field
  emotionDynamics: EmotionDynamics;
  needs: PsychologicalNeeds;
  goals: Goal[];
  lastUpdated: Date;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  emotionalTag?: {
    userEmotion?: string;
    characterEmotion?: string;
  };
}

// ============================================
// MEMORY TYPES
// ============================================

export interface EpisodicMemory {
  id: string;
  agentId: string;
  event: string;
  userEmotion?: string;
  characterEmotion?: string;
  emotionalValence: number;  // -1 a 1
  importance: number;         // 0 a 1
  decayFactor: number;        // 0 a 1 (disminuye con el tiempo)
  embedding?: number[];       // Vector embedding
  connectedMemoryIds?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface SemanticMemory {
  userFacts: Record<string, any>;         // Hechos sobre el usuario
  userPreferences: Record<string, any>;   // Preferencias del usuario
  relationshipStage: RelationshipStage;
  worldKnowledge?: Record<string, any>;
}

export type RelationshipStage =
  | "first_meeting"
  | "acquaintance"
  | "friend"
  | "close_friend"
  | "intimate"
  | "strained"
  | "conflict";

export interface ProceduralMemory {
  behavioralPatterns: Record<string, string>;    // Patrones de comportamiento
  userTriggers: Record<string, string[]>;        // Qué provoca al usuario
  effectiveStrategies: Record<string, string>;   // Estrategias efectivas
}

export interface WorkingMemory {
  conversationBuffer: ConversationMessage[];
  activeGoals: Goal[];
  currentContext: string;
}

// ============================================
// CHARACTER GROWTH TYPES
// ============================================

export interface RelationshipDynamics {
  trustLevel: number;       // 0-1
  intimacyLevel: number;    // 0-1
  positiveEventsCount: number;
  negativeEventsCount: number;
  conflictHistory: ConflictEvent[];
}

export interface ConflictEvent {
  description: string;
  severity: number;     // 0-1
  resolved: boolean;
  timestamp: Date;
}

export interface PersonalityDrift {
  [trait: string]: {
    current: number;
    initial: number;
    influencedBy: string[];
  };
}

export interface CharacterGrowth {
  relationshipDynamics: RelationshipDynamics;
  personalityDrift?: PersonalityDrift;
  learnedUserPatterns?: Record<string, any>;
  conversationCount: number;
  lastSignificantEvent?: Date;
}

// ============================================
// COGNITION & REASONING TYPES
// ============================================

export interface InternalReasoning {
  situationAssessment: string;    // Cómo interpreta la situación
  emotionalReaction: string;      // Qué está sintiendo y por qué
  goalConsideration: string;      // Qué debería hacer
  valueCheck: string;             // Cómo se relaciona con valores
  memoryConnection?: string;      // Conexión con memorias pasadas
}

export type ActionType =
  | "empathize"          // Validate emocionalmente
  | "question"           // Hacer pregunta para entender
  | "advise"             // Ofrecer consejo/perspectiva
  | "share_experience"   // Compartir experiencia similar
  | "challenge"          // Cuestionar suavemente
  | "support"            // Ofrecer apoyo práctico/emocional
  | "distract"           // Cambiar tema (si detecta necesidad)
  | "be_vulnerable"      // Compartir inseguridad propia
  | "set_boundary"       // Establecer límite (si viola valores)
  | "be_silent"          // Dar espacio
  | "express_disagreement";  // Expresar desacuerdo

export interface ActionDecision {
  action: ActionType;
  reason: string;
  confidence: number;  // 0-1: Confianza en la decisión
}

// ============================================
// BEHAVIORAL CUES TYPES
// ============================================

export interface BehavioralCues {
  tone: string;              // Ej: "gentle, concerned"
  verbosity: "brief" | "moderate" | "expressive";
  directness: "indirect" | "moderate" | "direct";
  physicalCues?: string;     // Ej: "(pausa)", "(suspira)"
  pacing: "fast" | "normal" | "slow";
}

// ============================================
// COMPLETE CHARACTER STATE
// ============================================

export interface CompleteCharacterState {
  agentId: string;
  personalityCore: PersonalityCore;
  internalState: InternalState;
  workingMemory: WorkingMemory;
  episodicMemories: EpisodicMemory[];
  semanticMemory: SemanticMemory;
  proceduralMemory: ProceduralMemory;
  characterGrowth: CharacterGrowth;
}

// ============================================
// LLM PROVIDER TYPES
// ============================================

export interface LLMRequest {
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LLMResponse {
  text: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================
// RESPONSE GENERATION TYPES
// ============================================

export interface ResponseGenerationInput {
  userMessage: string;
  characterState: CompleteCharacterState;
  appraisal: AppraisalScores;
  newEmotions: EmotionState;
  relevantMemories: EpisodicMemory[];
  internalReasoning: InternalReasoning;
  actionDecision: ActionDecision;
  behavioralCues: BehavioralCues;
}

export interface ResponseGenerationOutput {
  responseText: string;
  updatedState: InternalState;
  newMemory: Partial<EpisodicMemory>;
  metadata: {
    processingTimeMs: number;
    emotionsTriggered: string[];
    goalsActivated: string[];
  };
}

// ============================================
// ANTI-SYCOPHANCY TYPES
// ============================================

export interface ValueViolation {
  violated: boolean;
  value?: string;
  severity?: number;      // 0-1
  shouldObject: boolean;
}

export interface SycophancyCheck {
  isExcessiveAgreement: boolean;
  lacksOwnOpinion: boolean;
  violatesValues: boolean;
  shouldChallenge: boolean;
  reason?: string;
}
