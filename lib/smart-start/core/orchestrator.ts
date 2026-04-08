/**
 * Smart Start Orchestrator - Main controller for the Smart Start flow
 * Manages session state, coordinates services, handles user progression
 */

import { PrismaClient } from '@prisma/client';
import {
  SmartStartSessionData,
  SmartStartStep,
  CharacterDraft,
  SearchResult,
  GenreId,
  SubGenreId,
  ArchetypeId,
} from '../core/types';
import type { GenderType } from '@/types/character-creation';
import { getGenreService } from '../services/genre-service';
import { getSearchRouter } from '../search/search-router';
import { getCharacterExtractor } from '../search/character-extractor';
import { getAIService } from '../services/ai-service';
import { getValidationService } from '../services/validation-service';
import { PromptBuilder } from '../prompts/generator';
import { nanoid } from 'nanoid';
import { getDescriptionBasedGenerator, type GenerationOptions } from '../services/description-based-generator';
import { getInitialImageGenerationService } from '../services/initial-image-generation.service';
import { getLLMProvider } from '@/lib/llm/provider';
import { withRetry } from '@/lib/utils/retry';
import { getVeniceClient, VENICE_MODELS } from '@/lib/emotional-system/llm/venice';

const prisma = new PrismaClient();

// Define the action types used in the orchestrator
interface SmartStartAction {
  type: 'select_genre' | 'select_type' | 'search' | 'select_result' | 'customize' | 'generate' | 'complete' | 'abandon';
  data: any;
}

// Define SmartStartSession interface matching Prisma model
interface SmartStartSession {
  id: string;
  userId: string;
  currentStep: string;
  startedAt: Date;
  completedAt?: Date | null;
  abandonedAt?: Date | null;
  resultCharacterId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  timestamp?: number;
  // Session data fields from Prisma model
  selectedGenre?: string | null;
  selectedSubgenre?: string | null;
  selectedArchetype?: string | null;
  characterType?: string | null;
  searchQuery?: string | null;
  searchResults?: any;
  selectedResult?: any;
  extractedCharacter?: any;
  userInput?: any;
  aiGeneratedFields?: any;
  userModifications?: any;
  timeSpentPerStep?: any;
  interactionEvents?: any;
}

export class SmartStartOrchestrator {
  private genreService = getGenreService();
  private searchRouter = getSearchRouter();
  private extractor = getCharacterExtractor();
  private aiService = getAIService();
  private promptBuilder = new PromptBuilder();
  private validator = getValidationService();

  /**
   * Helper to generate with Gemini and fallback to Venice if all retries fail
   *
   * Venice Qwen3-235B costs $0.75/M tokens - more cost-effective than service failure
   */
  private async generateWithFallback(options: {
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    maxTokens?: number;
    temperature?: number;
  }): Promise<string> {
    const geminiLLM = getLLMProvider();

    try {
      // Try with Gemini first (with retry)
      console.log('[Orchestrator] Attempting generation with Gemini...');
      const response = await withRetry(
        async () => {
          return await geminiLLM.generate({
            systemPrompt: options.systemPrompt,
            messages: options.messages,
            maxTokens: options.maxTokens,
            temperature: options.temperature,
          });
        },
        {
          maxRetries: 3,
          initialDelay: 2000,
          shouldRetry: (error) => {
            if (error.message?.includes('503') || error.message?.includes('500') || error.message?.includes('saturated')) {
              console.log('[Orchestrator] Gemini saturated, retrying...');
              return true;
            }
            return false;
          },
          onRetry: (error, attempt) => {
            console.log(`[Orchestrator] Retrying with Gemini (${attempt}/3):`, error.message);
          }
        }
      );

      console.log('[Orchestrator] ✅ Generation successful with Gemini');
      return response;
    } catch (geminiError: any) {
      // If Gemini fails after all retries, fallback to Venice
      console.warn('[Orchestrator] ⚠️ Gemini failed after all retries, falling back to Venice/Qwen3...');
      console.warn('[Orchestrator] Gemini error:', geminiError.message);

      try {
        const veniceClient = getVeniceClient();

        // Use Qwen3-235B for cost-effectiveness ($0.75/M tokens)
        // Note: The actual model name in Venice might be different, using DEFAULT for now
        const veniceResponse = await veniceClient.generateWithMessages({
          systemPrompt: options.systemPrompt,
          messages: options.messages,
          temperature: options.temperature ?? 0.8,
          maxTokens: options.maxTokens ?? 15000,
          model: VENICE_MODELS.DEFAULT,
        });

        console.log('[Orchestrator] ✅ Generation successful with Venice fallback');
        return veniceResponse;
      } catch (veniceError: any) {
        console.error('[Orchestrator] ❌ Venice fallback also failed:', veniceError.message);
        throw new Error(`Both Gemini and Venice failed. Gemini: ${geminiError.message}. Venice: ${veniceError.message}`);
      }
    }
  }

  /**
   * Create a new Smart Start session
   */
  async createSession(userId: string): Promise<SmartStartSession> {
    const session = await prisma.smartStartSession.create({
      data: {
        id: nanoid(),
        userId,
        // Flow starts with 'type' - user chooses existing vs original character
        currentStep: 'type',
        startedAt: new Date(),
        timeSpentPerStep: {},
        interactionEvents: [],
        updatedAt: new Date(),
      },
    });

    // Track analytics
    await this.trackEvent('smart_start_initiated', {
      userId,
      sessionId: session.id,
      timestamp: new Date().toISOString(),
    });

    return session as SmartStartSession;
  }

  /**
   * Progress session through state machine
   */
  async progressSession(
    sessionId: string,
    action: SmartStartAction
  ): Promise<SmartStartSession> {
    const session = await prisma.smartStartSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Calculate time spent on current step
    const timeSpentPerStep = (session.timeSpentPerStep as Record<string, number>) || {};
    const lastEvent = (session.interactionEvents as any[]).slice(-1)[0];
    if (lastEvent) {
      const timeSpent = Date.now() - new Date(lastEvent.timestamp).getTime();
      timeSpentPerStep[session.currentStep] =
        (timeSpentPerStep[session.currentStep] || 0) + timeSpent;
    }

    // State machine transitions
    const newState = this.transitionState(session as SmartStartSession, action);

    // Extract only allowed update fields
    const { userId: _userId, id: _id, createdAt: _createdAt, startedAt: _startedAt, timestamp: _timestamp, ...allowedUpdates } = newState;

    // Update session
    const updated = await prisma.smartStartSession.update({
      where: { id: sessionId },
      data: {
        ...allowedUpdates,
        timeSpentPerStep,
        interactionEvents: {
          push: {
            type: action.type,
            timestamp: new Date().toISOString(),
            data: action.data,
          },
        },
      },
    });

    // Track analytics
    await this.trackEvent(`step_${action.type}`, {
      sessionId,
      userId: session.userId,
      step: session.currentStep,
      newStep: newState.currentStep,
    });

    return updated as SmartStartSession;
  }

  /**
   * State machine transitions
   */
  private transitionState(
    session: SmartStartSession,
    action: SmartStartAction
  ): Partial<SmartStartSession> {
    const updates: Partial<SmartStartSession> = {};

    switch (action.type) {
      case 'select_genre':
        updates.selectedGenre = action.data.genreId;
        updates.selectedSubgenre = action.data.subgenreId;
        updates.selectedArchetype = action.data.archetypeId;
        updates.currentStep = 'type';
        break;

      case 'select_type':
        updates.characterType = action.data.type;
        updates.currentStep = action.data.type === 'existing' ? 'search' : 'customize';
        break;

      case 'search':
        updates.searchQuery = action.data.query;
        updates.searchResults = action.data.results;
        updates.currentStep = 'search';
        break;

      case 'select_result':
        updates.selectedResult = action.data.characterData;
        updates.extractedCharacter = action.data.characterData;
        updates.currentStep = 'customize';
        break;

      case 'customize':
        updates.userModifications = action.data.modifications;
        updates.currentStep = 'review';
        break;

      case 'generate':
        updates.aiGeneratedFields = action.data.generatedFields;
        updates.currentStep = 'review';
        break;

      case 'complete':
        updates.completedAt = new Date();
        updates.currentStep = 'review'; // Use valid step instead of 'completed'
        updates.resultCharacterId = action.data.characterId;
        break;

      case 'abandon':
        updates.abandonedAt = new Date();
        updates.currentStep = 'review'; // Use valid step instead of 'abandoned'
        break;

      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }

    return updates;
  }

  /**
   * Perform character search
   */
  async performSearch(
    sessionId: string,
    query: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    const session = await prisma.smartStartSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const genreId = session.selectedGenre as GenreId;
    if (!genreId) {
      throw new Error('Genre not selected');
    }

    // Perform search
    const results = await this.searchRouter.search(query, genreId, { limit });

    // Update session
    await this.progressSession(sessionId, {
      type: 'search',
      data: { query, results },
    });

    return results;
  }

  /**
   * Select a search result and extract character data
   */
  async selectSearchResult(sessionId: string, result: SearchResult): Promise<CharacterDraft> {
    const session = await prisma.smartStartSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const genreId = session.selectedGenre as GenreId;

    // Extract character data
    let extracted;
    try {
      extracted = await this.extractor.extract(result, genreId);
    } catch (error) {
      console.error('[Orchestrator] Character extraction failed:', error);
      throw new Error(`Failed to extract character data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Build generation config for system prompt
    const config = {
      genreId,
      subgenreId: session.selectedSubgenre as SubGenreId | undefined,
      archetypeId: session.selectedArchetype as ArchetypeId | undefined,
      name: extracted.name,
      personality: extracted.personality || [],
      background: extracted.background,
      appearance: extracted.appearance,
    };

    // Generate system prompt
    let systemPrompt;
    try {
      systemPrompt = await this.promptBuilder.build(config);
    } catch (error) {
      console.error('[Orchestrator] System prompt generation failed:', error);
      // Use a basic fallback prompt if template building fails
      systemPrompt = `You are ${extracted.name}. ${extracted.background}\n\nPersonality: ${extracted.personality?.join(', ') || 'unique and interesting'}`;
    }

    // Parse age to number if it's a string
    const parsedAge = extracted.age ? (typeof extracted.age === 'number' ? extracted.age : parseInt(extracted.age, 10)) : undefined;

    // Create draft - convert personality to string if it's an array
    const personalityStr = Array.isArray(extracted.personality)
      ? extracted.personality.join(', ')
      : (extracted.personality || '');

    const draft: CharacterDraft = {
      name: extracted.name,
      alternateName: extracted.alternateName,
      personality: personalityStr,
      backstory: extracted.background,
      physicalAppearance: extracted.appearance,
      age: parsedAge && !isNaN(parsedAge) ? parsedAge : undefined,
      gender: extracted.gender as GenderType | undefined,
      occupation: extracted.occupation,
      systemPrompt,
      imageUrl: result.imageUrl,
      thumbnailUrl: result.thumbnailUrl,
      genreId,
      subgenreId: session.selectedSubgenre as SubGenreId | undefined,
      archetypeId: session.selectedArchetype as ArchetypeId | undefined,
      communicationStyle: extracted.communicationStyle,
      catchphrases: extracted.catchphrases,
    };

    // Update session
    await this.progressSession(sessionId, {
      type: 'select_result',
      data: {
        resultId: result.id,
        characterData: draft,
      },
    });

    return draft;
  }

  /**
   * Generate character from scratch
   */
  async generateCharacter(sessionId: string): Promise<CharacterDraft> {
    const session = await prisma.smartStartSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Build generation config
    const config = this.buildGenerationConfig(session as SmartStartSession);

    // Generate system prompt
    const systemPrompt = await this.promptBuilder.build(config);

    // Generate character fields using AI
    const genre = this.genreService.getGenre(config.genreId);
    const archetype = config.archetypeId
      ? this.genreService.getArchetype(
          config.genreId,
          config.subgenreId!,
          config.archetypeId
        )
      : null;

    const generated = await this.aiService.generateCharacter(
      config.name || 'New Character',
      genre?.name || 'General',
      archetype?.name || 'Balanced',
      config.additionalContext
    );

    const draft: CharacterDraft = {
      name: config.name || generated.name || 'New Character',
      personality: generated.personality,
      backstory: generated.background || '',
      physicalAppearance: generated.appearance,
      age: typeof generated.age === 'string' ? parseInt(generated.age, 10) : generated.age,
      occupation: generated.occupation,
      systemPrompt,
      genreId: config.genreId,
      subgenreId: config.subgenreId,
      archetypeId: config.archetypeId,
      communicationStyle: generated.communicationStyle,
      catchphrases: generated.catchphrases,
    };

    // Validate
    const validation = this.validator.validateCharacterDraft(draft);

    if (!validation.valid) {
      console.warn('[Orchestrator] Generated character has validation errors:', validation.errors);
      // One retry with fixes
      const fixed = await this.regenerateWithFixes(draft, validation.errors);
      return fixed;
    }

    // Update session
    await this.progressSession(sessionId, {
      type: 'generate',
      data: {
        generatedFields: draft,
      },
    });

    return draft;
  }

  /**
   * NEW: Generate character from free-form description (LEGAL - 100% original)
   * This replaces the old "search existing character" flow
   */
  async generateFromDescription(
    sessionId: string,
    description: string,
    userTier: 'FREE' | 'PLUS' | 'ULTRA',
    options?: {
      genreHint?: GenreId;
      archetypeHint?: ArchetypeId;
      era?: string;
      nsfwLevel?: 'sfw' | 'romantic' | 'suggestive' | 'explicit';
      uploadedAvatarUrl?: string; // User-uploaded avatar URL
    }
  ): Promise<CharacterDraft> {
    const session = await prisma.smartStartSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    console.log('[Orchestrator] Generating from description:', {
      sessionId,
      descriptionLength: description.length,
      tier: userTier,
    });

    // Use the new description-based generator
    const generator = getDescriptionBasedGenerator();

    const generationOptions: GenerationOptions = {
      description,
      tier: userTier,
      genreHint: options?.genreHint,
      archetypeHint: options?.archetypeHint,
      constraints: {
        era: options?.era,
        nsfwLevel: options?.nsfwLevel,
      },
    };

    // Generate character with retry logic
    const result = await withRetry(
      async () => await generator.generate(generationOptions),
      {
        maxRetries: 3,
        initialDelay: 2000,
        shouldRetry: (error) => {
          // Retry on model saturation errors
          if (error.message?.includes('503') || error.message?.includes('500') || error.message?.includes('saturated')) {
            console.log('[Orchestrator] Model saturated, retrying character generation...');
            return true;
          }
          return false;
        },
        onRetry: (error, attempt) => {
          console.log(`[Orchestrator] Retrying character generation (${attempt}/3):`, error.message);
        }
      }
    );

    // Log warnings if any (copyright issues detected)
    if (result.warnings && result.warnings.length > 0) {
      console.warn('[Orchestrator] Originality warnings:', result.warnings);
    }

    // Generate character images
    console.log('[Orchestrator] Generating character images...');
    const imageGenerator = getInitialImageGenerationService();

    let avatarUrl: string | undefined;
    let referenceImageUrl: string | undefined;

    try {
      // Determine if we should use uploaded avatar or generate
      if (options?.uploadedAvatarUrl) {
        console.log('[Orchestrator] Using uploaded avatar:', options.uploadedAvatarUrl);
        avatarUrl = options.uploadedAvatarUrl;

        // Generate only full-body reference image with retry
        referenceImageUrl = await withRetry(
          async () => await imageGenerator.generateFullBodyOnly({
            name: result.draft.name || 'Character',
            gender: result.draft.gender || 'other',
            physicalAppearance: result.draft.physicalAppearance,
            age: result.draft.age,
            personality: result.draft.personality,
            style: 'realistic',
            userTier,
          }),
          {
            maxRetries: 2,
            initialDelay: 3000,
            shouldRetry: (error) => {
              if (error.message?.includes('503') || error.message?.includes('500') || error.message?.includes('queue')) {
                console.log('[Orchestrator] Image generation saturated, retrying...');
                return true;
              }
              return false;
            },
            onRetry: (error, attempt) => {
              console.log(`[Orchestrator] Retrying image generation (${attempt}/2):`, error.message);
            }
          }
        );
      } else {
        // Generate both images with AI and retry logic
        console.log('[Orchestrator] Generating both images with AI...');
        const imageResult = await withRetry(
          async () => await imageGenerator.generateBothImages({
            name: result.draft.name || 'Character',
            gender: result.draft.gender || 'other',
            physicalAppearance: result.draft.physicalAppearance,
            age: result.draft.age,
            personality: result.draft.personality,
            style: 'realistic',
            userTier,
          }),
          {
            maxRetries: 2,
            initialDelay: 3000,
            shouldRetry: (error) => {
              if (error.message?.includes('503') || error.message?.includes('500') || error.message?.includes('queue')) {
                console.log('[Orchestrator] Image generation saturated, retrying...');
                return true;
              }
              return false;
            },
            onRetry: (error, attempt) => {
              console.log(`[Orchestrator] Retrying images generation (${attempt}/2):`, error.message);
            }
          }
        );

        avatarUrl = imageResult.avatarUrl;
        referenceImageUrl = imageResult.referenceImageUrl;

        console.log('[Orchestrator] ✅ Images generated in', imageResult.metadata.generationTime, 'seconds');
      }
    } catch (imageError) {
      console.error('[Orchestrator] Error generating images:', imageError);
      // Continue without images - don't fail the entire generation
      console.warn('[Orchestrator] Continuing without images');
    }

    // Generate system prompt from the draft
    const _genre = options?.genreHint ? this.genreService.getGenre(options.genreHint) : null;
    const _archetype = null; // Skip archetype for now as we don't have subgenre

    const systemPrompt = await this.promptBuilder.build({
      genreId: options?.genreHint || ('general' as GenreId),
      name: result.draft.name,
      personality: result.draft.personality ? [result.draft.personality] : [],
      background: result.draft.backstory,
      appearance: result.draft.physicalAppearance,
    });

    // Generate relationships ecosystem
    console.log('[Orchestrator] Generating relationship ecosystem...');
    let importantPeople: any[] = [];
    try {
      importantPeople = await this.generateRelationships({
        description: `${result.draft.name || 'Personaje'}, ${result.draft.age || 25} años. ${result.draft.backstory || description}`,
        name: result.draft.name,
        age: result.draft.age,
        bigFive: (result.draft as any).bigFive,
      });
      console.log('[Orchestrator] ✅ Generated', importantPeople.length, 'relationships');
    } catch (relationshipsError) {
      console.error('[Orchestrator] Error generating relationships:', relationshipsError);
      // Continue without relationships - don't fail entire generation
    }

    // Enhance draft with system prompt, metadata, images, and relationships
    const enhancedDraft: CharacterDraft = {
      ...result.draft,
      systemPrompt,
      avatar: avatarUrl, // Add avatar URL
      referenceImage: referenceImageUrl, // Add reference image URL
      importantPeople, // Add generated relationships
      genreId: options?.genreHint,
      archetypeId: options?.archetypeHint,
      aiGeneratedFields: [
        'name',
        'age',
        'gender',
        'occupation',
        'personality',
        'backstory',
        'physicalAppearance',
        'communicationStyle',
        'catchphrases',
        'systemPrompt',
        ...(importantPeople.length > 0 ? ['importantPeople'] : []),
        ...(avatarUrl && !options?.uploadedAvatarUrl ? ['avatar'] : []),
        ...(referenceImageUrl ? ['referenceImage'] : []),
      ],
      userEditedFields: [],
    };

    // Update session with generated data
    await this.progressSession(sessionId, {
      type: 'generate',
      data: {
        generatedFields: enhancedDraft,
        generationMetadata: {
          method: 'description-based',
          confidence: result.confidence,
          warnings: result.warnings,
          tokensUsed: result.metadata.tokensUsed,
          tier: userTier,
        },
      },
    });

    // Track analytics
    await this.trackEvent('character_generated_from_description', {
      sessionId,
      userId: session.userId,
      tier: userTier,
      descriptionLength: description.length,
      confidence: result.confidence,
      hasWarnings: result.warnings && result.warnings.length > 0,
    });

    return enhancedDraft;
  }

  /**
   * NEW: Generate random character ("Surprise me" button)
   */
  async generateRandomCharacter(
    sessionId: string,
    userTier: 'FREE' | 'PLUS' | 'ULTRA'
  ): Promise<CharacterDraft> {
    const session = await prisma.smartStartSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    console.log('[Orchestrator] Generating random character for tier:', userTier);

    const generator = getDescriptionBasedGenerator();

    // Generate random character with retry logic
    const result = await withRetry(
      async () => await generator.generateRandom(userTier),
      {
        maxRetries: 3,
        initialDelay: 2000,
        shouldRetry: (error) => {
          // Retry on model saturation errors
          if (error.message?.includes('503') || error.message?.includes('500') || error.message?.includes('saturated')) {
            console.log('[Orchestrator] Model saturated, retrying random generation...');
            return true;
          }
          return false;
        },
        onRetry: (error, attempt) => {
          console.log(`[Orchestrator] Retrying random generation (${attempt}/3):`, error.message);
        }
      }
    );

    // Generate system prompt
    const systemPrompt = await this.promptBuilder.build({
      genreId: 'general' as GenreId,
      name: result.draft.name,
      personality: result.draft.personality ? [result.draft.personality] : [],
      background: result.draft.backstory,
      appearance: result.draft.physicalAppearance,
    });

    const enhancedDraft: CharacterDraft = {
      ...result.draft,
      systemPrompt,
      aiGeneratedFields: [
        'name',
        'age',
        'gender',
        'occupation',
        'personality',
        'backstory',
        'physicalAppearance',
        'communicationStyle',
        'catchphrases',
        'systemPrompt',
      ],
      userEditedFields: [],
    };

    // Update session
    await this.progressSession(sessionId, {
      type: 'generate',
      data: {
        generatedFields: enhancedDraft,
        generationMetadata: {
          method: 'random',
          confidence: result.confidence,
          tier: userTier,
        },
      },
    });

    await this.trackEvent('character_generated_random', {
      sessionId,
      userId: session.userId,
      tier: userTier,
    });

    return enhancedDraft;
  }

  /**
   * Regenerate character with fixes
   */
  private async regenerateWithFixes(
    draft: CharacterDraft,
    errors: any[]
  ): Promise<CharacterDraft> {
    console.log('[Orchestrator] Attempting to fix validation errors...');

    // Build fix prompt
    const fixPrompt = `The following character has validation errors. Please fix them:

Character: ${JSON.stringify(draft)}

Errors: ${errors.map(e => e.message).join(', ')}

Return a corrected version in JSON format.`;

    const fixed = await this.aiService.generate({
      type: 'generate-character',
      prompt: fixPrompt,
      temperature: 0.7,
      maxTokens: 2000,
    });

    try {
      const parsedFix = JSON.parse(fixed.text);
      return { ...draft, ...parsedFix };
    } catch {
      console.error('[Orchestrator] Failed to parse fix response');
      return draft; // Return original if fix fails
    }
  }

  /**
   * Build generation configuration from session
   */
  private buildGenerationConfig(session: SmartStartSession): any {
    return {
      genreId: session.selectedGenre as GenreId,
      subgenreId: session.selectedSubgenre as SubGenreId,
      archetypeId: session.selectedArchetype as ArchetypeId,
      name: session.userModifications?.name,
      additionalContext: session.userModifications?.additionalContext,
      externalData: session.extractedCharacter,
    };
  }

  /**
   * Apply user customizations to draft
   */
  async applyCustomizations(
    sessionId: string,
    draft: CharacterDraft,
    customizations: Partial<CharacterDraft>
  ): Promise<CharacterDraft> {
    const updated = { ...draft, ...customizations };

    // Track which fields were user-edited
    const editedFields = Object.keys(customizations);
    updated.userEditedFields = [
      ...(updated.userEditedFields || []),
      ...editedFields,
    ];

    // Remove from AI-generated list if user edited
    updated.aiGeneratedFields = (updated.aiGeneratedFields || []).filter(
      f => !editedFields.includes(f)
    );

    // Update session
    await this.progressSession(sessionId, {
      type: 'customize',
      data: {
        modifications: customizations,
      },
    });

    return updated;
  }

  /**
   * Finalize and create character
   */
  async finalizeCharacter(sessionId: string, draft: CharacterDraft): Promise<string> {
    const session = await prisma.smartStartSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Final validation
    const validation = this.validator.validateCharacterDraft(draft);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // This would be called from the API route that creates the actual Agent
    // We just mark the session as complete here
    await this.progressSession(sessionId, {
      type: 'complete',
      data: {
        characterId: 'pending', // Will be updated by API route
      },
    });

    return sessionId;
  }

  /**
   * Abandon session
   */
  async abandonSession(sessionId: string): Promise<void> {
    await this.progressSession(sessionId, {
      type: 'abandon',
      data: {},
    });

    await this.trackEvent('session_abandoned', { sessionId });
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SmartStartSession | null> {
    const session = await prisma.smartStartSession.findUnique({
      where: { id: sessionId },
    });

    return session as SmartStartSession | null;
  }

  /**
   * Get user's session history
   */
  async getUserSessions(userId: string, limit: number = 10): Promise<SmartStartSession[]> {
    const sessions = await prisma.smartStartSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return sessions as SmartStartSession[];
  }

  /**
   * Generate relationships ecosystem for a character
   */
  private async generateRelationships(params: {
    description: string;
    name?: string;
    age?: number;
    bigFive?: any;
  }): Promise<any[]> {
    const { description, name, age, bigFive } = params;

    // Determinar cantidad y tipo de relaciones basado en personalidad
    const extraversion = bigFive?.extraversion ?? 50;
    const agreeableness = bigFive?.agreeableness ?? 50;
    const neuroticism = bigFive?.neuroticism ?? 50;

    // Calculate number of people according to extraversion
    let minPeople = 2;
    let maxPeople = 6;
    if (extraversion > 70) {
      minPeople = 8;
      maxPeople = 15;
    } else if (extraversion > 50) {
      minPeople = 5;
      maxPeople = 9;
    } else if (extraversion < 30) {
      minPeople = 2;
      maxPeople = 4;
    }

    const personalityContext = `

PERFIL DE PERSONALIDAD (Big Five):
- Extraversión: ${extraversion}/100 ${extraversion > 70 ? '(Muy sociable, vida social activa)' : extraversion < 30 ? '(Introvertido, círculo pequeño)' : '(Moderado)'}
- Amabilidad: ${agreeableness}/100 ${agreeableness > 70 ? '(Muy empático, relaciones armoniosas)' : agreeableness < 30 ? '(Competitivo, relaciones tensas)' : '(Moderado)'}
- Neuroticismo: ${neuroticism}/100 ${neuroticism > 70 ? '(Emocionalmente volátil, relaciones complicadas)' : neuroticism < 30 ? '(Estable, relaciones tranquilas)' : '(Moderado)'}

ADAPTACIÓN BASADA EN PERSONALIDAD:
- Cantidad de relaciones: ${minPeople}-${maxPeople} personas
- Tipo de relaciones: ${extraversion > 70 ? 'Muchos conocidos, varios círculos sociales' : extraversion < 30 ? 'Pocos amigos cercanos, relaciones profundas' : 'Mix de amigos cercanos y conocidos'}`;

    const prompt = `Genera la red social de este personaje con PROFUNDIDAD PSICOLÓGICA.

PERSONAJE:
${description}
${name ? `Nombre: ${name}` : ''}
${age ? `Edad: ${age}` : ''}
${personalityContext}

Genera entre ${minPeople} y ${maxPeople} personas en formato JSON:

{
  "people": [
    {
      "name": "Nombre",
      "relationship": "Madre/Padre/Amigo/etc",
      "description": "Descripción breve",
      "type": "family|friend|romantic|rival|mentor|colleague|other",
      "closeness": 0-100,
      "status": "active|estranged|deceased|distant",
      "influenceOn": {
        "values": ["valor1"],
        "fears": ["miedo1"],
        "skills": ["habilidad1"],
        "personalityImpact": "Cómo moldeó al personaje"
      },
      "sharedHistory": [{"year": 2020, "title": "Evento", "description": "Desc"}],
      "currentDynamic": "Relación actual",
      "conflict": {"active": false, "description": "", "intensity": 0}
    }
  ]
}

Responde SOLO con JSON válido.`;

    // Generate with retry logic for 500/503 errors and Venice fallback
    const response = await this.generateWithFallback({
      systemPrompt: 'Eres un psicólogo experto. Creas redes sociales realistas. Respondes solo con JSON válido.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 15000,
      temperature: 0.8,
    });

    // Parse JSON
    let cleanedResponse = response.trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se pudo extraer JSON de la respuesta');
    }

    let jsonText = jsonMatch[0].replace(/,([\s]*[}\]])/g, '$1');
    const relationshipsData = JSON.parse(jsonText);

    // Add IDs
    if (relationshipsData.people) {
      relationshipsData.people = relationshipsData.people.map((person: any) => ({
        id: nanoid(),
        ...person,
        sharedHistory: person.sharedHistory?.map((event: any) => ({
          id: nanoid(),
          ...event,
        })) || [],
      }));
    }

    return relationshipsData.people || [];
  }

  /**
   * Track analytics event
   */
  private async trackEvent(eventType: string, data: any): Promise<void> {
    // TODO: Integrate with analytics service
    console.log(`[Analytics] ${eventType}:`, data);
  }

  /**
   * Get session analytics
   */
  async getSessionAnalytics(sessionId: string): Promise<any> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const timeSpentPerStep = (session.timeSpentPerStep as Record<string, number>) || {};
    const interactionEvents = (session.interactionEvents as any[]) || [];

    const totalTime = Object.values(timeSpentPerStep).reduce((a: number, b: number) => a + b, 0);

    return {
      sessionId,
      totalTime,
      timeSpentPerStep,
      stepsCompleted: Object.keys(timeSpentPerStep).length,
      interactionCount: interactionEvents.length,
      currentStep: session.currentStep,
      completed: session.completedAt !== null,
      abandoned: session.abandonedAt !== null,
    };
  }
}

// Singleton instance
let orchestratorInstance: SmartStartOrchestrator | null = null;

export function getSmartStartOrchestrator(): SmartStartOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new SmartStartOrchestrator();
  }
  return orchestratorInstance;
}

export const smartStartOrchestrator = getSmartStartOrchestrator();
