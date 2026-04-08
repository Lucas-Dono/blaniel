/**
 * Smart Start System - Core Type Definitions
 *
 * Complete TypeScript types for the Smart Start intelligent character creation system.
 * These types define the entire data structure and flow of the system.
 *
 * Note: CharacterDraft and GeneratedProfile are now imported from the unified
 * character-creation module for consistency across Smart Start and Manual Wizard.
 */

// Re-export unified types for convenience
// Note: GeneratedProfile has a local definition below, so we don't re-export it
export type {
  CharacterDraft,
  PersonalityCoreData,
  CharacterAppearanceData,
  ImportantPersonData,
  ImportantEventData,
  BigFiveTraits,
  CoreValue,
  MoralSchema,
  BaselineEmotions,
  PsychologicalNeeds,
  SmartStartStep as SmartStartStepType,
  // Re-export GeneratedProfile from unified types as a different name if needed
  GeneratedProfile as UnifiedGeneratedProfile,
} from '@/types/character-creation';

export {
  DEFAULT_BIG_FIVE,
  DEFAULT_BASELINE_EMOTIONS,
  DEFAULT_PERSONALITY_CORE,
  validateCharacterDraft,
  validatePersonalityCore,
  validateCharacterAppearance,
} from '@/types/character-creation';

// SubGenreId and ArchetypeId are string IDs (aliases for clarity)
export type SubGenreId = string;
export type ArchetypeId = string;

// Re-export depth customization types from smart-start-core package
export type {
  DepthLevelId,
  UserTier,
  DepthLevel,
  DepthFeature,
} from '@circuitpromptai/smart-start-core';

// ============================================================================
// GENRE TAXONOMY TYPES
// ============================================================================

export type GenreId = 'romance' | 'friendship' | 'gaming' | 'professional' | 'roleplay' | 'wellness';

export interface Genre {
  id: GenreId;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  color: {
    from: string;
    to: string;
  };

  metadata: {
    emotionalProfile: {
      primaryEmotions: string[];
      secondaryEmotions: string[];
      emotionalRange: string;
      attachmentStyle: string;
      intimacyThreshold: string;
    };

    behavioralTendencies: {
      initiationStyle: string;
      affectionLevel: string;
      vulnerabilityWillingness: string;
      conflictStyle: string;
    };

    contentGuidelines: {
      allowedThemes: string[];
      toneRange: string[];
      nsfwCompatible: boolean | 'configurable';
      requiredBoundaries: string[];
    };
  };

  subgenres: SubGenre[];
  universalTraits: string[];
  advancedOptions?: {
    [key: string]: Array<{ id: string; label: string; description: string }> | string[];
  };
  disclaimers?: {
    [key: string]: string;
  };
}

export interface SubGenre {
  id: string;
  name: string;
  description: string;
  icon: string;

  archetypes: Archetype[];

  systemPromptModifiers: {
    tone: string;
    [key: string]: string | string[];
  };
}

export interface Archetype {
  id: string;
  name: string;
  description: string;
  suggestedTraits: string[];
  personalityTemplate: string; // ID of system prompt template
}

// ============================================================================
// WEB SEARCH TYPES
// ============================================================================

export type CharacterType = 'anime' | 'tv' | 'game' | 'book' | 'historical' | 'celebrity' | 'unknown';

export type SearchSourceId =
  | 'myanimelist'
  | 'anilist'
  | 'jikan'
  | 'mal'
  | 'tvmaze'
  | 'tmdb'
  | 'igdb'
  | 'wikipedia'
  | 'wikidata'
  | 'fandom'
  | 'custom'
  | 'firecrawl';

export interface SearchOptions {
  limit?: number;
  page?: number;
  filters?: Record<string, unknown>;
}

export interface SearchSource {
  sourceId: SearchSourceId;
  name: string;
  supportedGenres: GenreId[];
  baseUrl: string;
  rateLimit: {
    requests: number;
    per: number;
  };

  // Methods that implementations must provide
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getDetails(id: string): Promise<SearchResult | null>;
  testConnection(): Promise<boolean>;
}

export interface SearchResult {
  id: string;
  source: SearchSourceId;
  externalId?: string;
  name: string;
  alternateName?: string;
  nameNative?: string;
  nameKanji?: string;
  image?: string; // Legacy field, use imageUrl instead
  imageUrl?: string;
  thumbnailUrl?: string;
  description?: string;
  age?: string | number;
  gender?: string;
  nicknames?: string[];
  sourceUrl: string;
  actorName?: string;
  species?: string;
  confidence?: number;

  metadata: {
    favorites?: number;
    animeAppearances?: string[] | number;
    popularity?: string | number;
    show?: string;
    games?: string[];
    year?: number | string;
    malId?: number;
    pageId?: number;
    wikipediaUrl?: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// CHARACTER EXTRACTION TYPES
// ============================================================================

export interface RawCharacterData {
  source: SearchSourceId;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface ExtractedCharacter {
  name: string;
  age?: string | number;
  gender?: string;
  physicalAppearance?: string;
  personality: string;
  traits: string[];
  backstory?: string;
  occupation?: string;
  relationships?: string[];
  abilities?: string[];
  goals?: string;
  fears?: string;
  quirks?: string[];
  catchphrases?: string[];
  source: string;
  fandomPopularity?: string;
  avatar?: string;
  referenceImage?: string;
  additionalImages?: string[];
}

// ============================================================================
// AI GENERATION TYPES
// ============================================================================

export interface GenerationTask {
  type: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  source?: 'public-api' | 'user-input';
  nsfwMode?: boolean;
  allowAdultContent?: boolean;
  userContext?: {
    userId?: string;
    chatHistory?: unknown[];
    preferences?: unknown;
    previousCharacters?: unknown[];
  };
  context?: Record<string, unknown>;
}

export interface GenerationResult {
  text: string;
  model: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  finishReason?: string;
}

// ============================================================================
// SMART START SESSION TYPES
// ============================================================================

export type SmartStartStep =
  | 'description' // NEW: Legal flow - generate from free-form description
  | 'type'       // DEPRECATED: Old flow
  | 'search'     // DEPRECATED: Old illegal flow
  | 'customize'
  | 'depth'
  | 'review'
  | 'genre'; // Optional - accessed from customize when changing genre

export interface SmartStartState {
  step: SmartStartStep;
  data: SmartStartSessionData;
}

export interface SmartStartSessionData {
  source?: 'original' | 'existing';

  // Search path
  searchQuery?: string;
  searchResults?: SearchResult[];
  selectedResult?: SearchResult;
  extractedCharacter?: ExtractedCharacter;

  // Genre path
  genre?: GenreId;
  genreMetadata?: Genre['metadata'];
  subgenre?: string;
  subgenreMetadata?: SubGenre['systemPromptModifiers'];
  archetype?: string;
  selectedTraits?: string[];

  // User customizations
  userInput?: {
    name?: string;
    age?: string;
    background?: string;
    interests?: string[];
    values?: string[];
    customTraits?: string[];
  };

  // Generation
  generated?: GeneratedProfile;
  aiGeneratedFields?: string[];
  userModifications?: Record<string, unknown>;

  // Metadata
  timestamp: number;
  timeSpentPerStep?: Record<SmartStartStep, number>;
  interactionEvents?: InteractionEvent[];
}

export interface InteractionEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface GeneratedProfile {
  name: string;
  description?: string;
  gender?: string;
  personality: string;
  traits: string[];
  backstory?: string;
  physicalAppearance?: string;
  occupation?: string;
  interests?: string[];
  values?: string[];
  goals?: string;
  fears?: string;
  quirks?: string[];
  catchphrases?: string[];
  systemPrompt: string;

  // Metadata
  generatedBy: 'gemini' | 'mistral';
  generationMethod: 'template' | 'ai-generated' | 'hybrid';
  tokensUsed: {
    input: number;
    output: number;
  };
}

// ============================================================================
// SYSTEM PROMPT TYPES
// ============================================================================

export interface SystemPromptTemplate {
  id: string;
  genreId: GenreId;
  subgenreId: string;
  archetypeId: string;

  version: number;
  templateContent: string; // Full template with variables

  // Two-level strategy for cost optimization
  coreTemplate?: string; // 500-800 tokens - always included
  extendedTemplate?: string; // 1500-2000 tokens - only when needed

  variables: string[]; // List of ${VARIABLE} placeholders
  metadata: {
    wordCount: number;
    estimatedTokens: number;
    quality: 'basic' | 'standard' | 'premium';
  };
}

export interface SystemPromptConfig {
  template: SystemPromptTemplate;
  variables: Record<string, string>; // Variable replacements
  useExtended: boolean; // Include extended section?
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationRules {
  emotionalCoherence: {
    minTraitsCount: number;
    requiredTraits: string[];
    conflictingTraits: Array<[string, string]>;
  };

  genreAlignment: {
    mustHaveKeywords: string[];
    forbiddenKeywords: string[];
    toneConsistency: 'formal' | 'casual' | 'playful' | 'serious';
  };

  contentQuality: {
    minPersonalityLength: number;
    minBackstoryLength: number;
    maxRepetitionRatio: number;
    requiresSpecificity: boolean;
  };
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  score: number; // 0-100
}

export interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  field: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// ORCHESTRATOR TYPES
// ============================================================================

export interface UserSelections {
  source: 'original' | 'existing';
  characterQuery?: string;
  existingInfo?: ExtractedCharacter;
  genre: GenreId;
  subgenre: string;
  archetype?: string;
  traits: string[];
  preferences?: UserPreferences;

  // Internal use
  _retry?: boolean;
  _corrections?: string[];
}

export interface UserPreferences {
  tone?: string;
  style?: string;
  communicationPreference?: string;
  advancedOptions?: Record<string, unknown>;
}

export interface SmartStartContext {
  source: 'original' | 'existing';
  genre: GenreId;
  genreMetadata: Genre['metadata'];
  subgenre?: string;
  subgenreMetadata?: SubGenre['systemPromptModifiers'];
  selectedTraits: string[];
  suggestedTraits: string[];
  emotionalProfile: Genre['metadata']['emotionalProfile'];
  existingCharacterInfo?: ExtractedCharacter;
  userPreferences?: UserPreferences;
  webData?: SearchResult;
  timestamp: number;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export type SmartStartEventType =
  | 'smart_start_initiated'
  | 'genre_selected'
  | 'subgenre_selected'
  | 'archetype_selected'
  | 'character_type_selected'
  | 'search_performed'
  | 'search_result_selected'
  | 'trait_toggled'
  | 'character_generated'
  | 'field_edited'
  | 'smart_start_completed'
  | 'smart_start_abandoned'
  | 'step_skipped';

export interface SmartStartAnalyticsEvent {
  type: SmartStartEventType;
  timestamp: number;
  sessionId: string;
  userId: string;

  data: {
    step?: SmartStartStep;
    genre?: GenreId;
    subgenre?: string;
    archetype?: string;
    searchQuery?: string;
    resultCount?: number;
    timeSpent?: number;
    field?: string;
    oldValue?: unknown;
    newValue?: unknown;
    [key: string]: unknown;
  };
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateSessionRequest {
  userId: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  state: SmartStartState;
}

export interface UpdateSessionRequest {
  sessionId: string;
  updates: Partial<SmartStartSessionData>;
}

export interface UpdateSessionResponse {
  success: boolean;
  state: SmartStartState;
}

export interface SearchCharactersRequest {
  query: string;
  genre: GenreId;
  sessionId: string;
}

export interface SearchCharactersResponse {
  results: SearchResult[];
  sources: SearchSourceId[];
  cached: boolean;
}

export interface ExtractCharacterRequest {
  resultId: string;
  sessionId: string;
}

export interface ExtractCharacterResponse {
  extracted: ExtractedCharacter;
  generatedBy: 'gemini' | 'mistral';
  cached: boolean;
}

export interface GenerateCharacterRequest {
  sessionId: string;
  context: SmartStartContext;
  quality: 'fast' | 'standard' | 'high';
}

export interface GenerateCharacterResponse {
  profile: GeneratedProfile;
  validationResult: ValidationResult;
}

export interface GetGenresResponse {
  genres: Genre[];
  cached: boolean;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class SmartStartError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SmartStartError';
  }
}

export type SmartStartErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'INVALID_STEP_TRANSITION'
  | 'SEARCH_FAILED'
  | 'EXTRACTION_FAILED'
  | 'GENERATION_FAILED'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_GENRE'
  | 'MISSING_REQUIRED_FIELD'
  | 'AI_SERVICE_ERROR';

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  namespace: string;
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];
