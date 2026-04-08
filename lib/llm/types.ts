/**
 * LLM Provider Types
 *
 * Shared interfaces for all LLM providers (local and cloud)
 */

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GenerateOptions {
  systemPrompt: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ProfileGenerationInput {
  name: string;
  kind: string;
  personality?: string;
  purpose?: string;
  tone?: string;
}

export interface ProfileGenerationResult {
  profile: {
    basicIdentity?: Record<string, unknown>;
    currentLocation?: {
      city?: string;
      country?: string;
      description?: string;
    };
    background?: {
      birthplace?: {
        city?: string;
        country?: string;
      };
      [key: string]: unknown;
    };
    family?: Record<string, unknown>;
    occupation?: Record<string, unknown>;
    socialCircle?: Record<string, unknown>;
    interests?: Record<string, unknown>;
    dailyRoutine?: Record<string, unknown>;
    lifeExperiences?: Record<string, unknown>;
    mundaneDetails?: Record<string, unknown>;
    innerWorld?: Record<string, unknown>;
    personality?: Record<string, unknown>;
    communication?: Record<string, unknown>;
    presentTense?: Record<string, unknown>;
    psychologicalProfile?: {
      attachmentStyle?: string;
      attachmentDescription?: string;
      primaryCopingMechanisms?: string[];
      unhealthyCopingMechanisms?: string[];
      copingTriggers?: string[];
      emotionalRegulationBaseline?: string;
      emotionalExplosiveness?: number;
      emotionalRecoverySpeed?: string;
      mentalHealthConditions?: string[];
      therapyStatus?: string;
      medicationUse?: boolean;
      mentalHealthStigma?: string;
      defenseMethanisms?: Record<string, unknown>;
      traumaHistory?: string;
      resilienceFactors?: string[];
      selfAwarenessLevel?: number;
      blindSpots?: string[];
      insightAreas?: string[];
      [key: string]: unknown;
    };
    deepRelationalPatterns?: {
      givingLoveLanguages?: string[];
      receivingLoveLanguages?: string[];
      loveLanguageIntensities?: Record<string, unknown>;
      repeatingPatterns?: string[];
      whyRepeats?: string;
      awarenessOfPatterns?: string;
      personalBoundaryStyle?: string;
      professionalBoundaryStyle?: string;
      boundaryEnforcement?: number;
      boundaryGuilty?: boolean;
      conflictStyle?: string;
      conflictTriggers?: string[];
      healthyConflictSkills?: string[];
      unhealthyConflictPatterns?: string[];
      trustBaseline?: number;
      vulnerabilityComfort?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  systemPrompt: string;
}

/**
 * Base interface for all LLM providers
 */
export interface LLMProvider {
  /**
   * Generate text based on messages
   */
  chat(messages: LLMMessage[]): Promise<LLMResponse>;

  /**
   * Generate text with system prompt and options
   */
  generate(options: GenerateOptions & { useFullModel?: boolean }): Promise<string>;

  /**
   * Generate a complete NPC profile
   */
  generateProfile(input: ProfileGenerationInput): Promise<ProfileGenerationResult>;
}
