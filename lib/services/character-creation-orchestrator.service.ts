/**
 * Character Creation Orchestrator
 * 
 * Orchestrates the entire character creation flow:
 * 1. Validate complete draft
 * 2. Generate profile with AI
 * 3. Validate coherence
 * 4. Generate events, people, memories automatically
 * 5. Create Agent in DB
 * 6. Create related entities
 * 7. Initialize background processing
 */

import { PrismaClient } from '@prisma/client';
import { nanoid } from "nanoid";
import type { CharacterDraft } from './validation.service';
import { validateDraft } from './validation.service';
import { generateProfileV2 } from './profile-generation-v2.service';
import { validateCoherence, getCoherenceSummary } from './coherence.service';
import {
  generateImportantEventsFromProfile,
  generateImportantPeopleFromProfile,
  generateEpisodicMemoriesFromProfile,
} from './generation.service';
import { analyzeSkinTraits } from '@/lib/minecraft/skin-trait-analyzer';

const prisma = new PrismaClient();

// ============================================
// TYPES
// ============================================

export interface CreationProgress {
  step: string;
  progress: number; // 0-100
  message: string;
  completed: boolean;
}

export interface CreationResult {
  success: boolean;
  agentId?: string;
  agent?: any;
  error?: string;
  coherenceScore?: number;
  warnings?: string[];
}

export interface CreationOptions {
  draft: CharacterDraft;
  userId: string;
  onProgress?: (progress: CreationProgress) => void;
}

// ============================================
// MAIN ORCHESTRATOR
// ============================================

/** Orchestrates the complete creation of a character */
export async function createCharacter(
  options: CreationOptions
): Promise<CreationResult> {
  const { draft, userId, onProgress } = options;

  try {
    // Step 1: Validate draft (1%)
    reportProgress(onProgress, 'validation', 1, 'Validando datos...');
    const validation = validateDraft(draft);

    if (!validation.valid) {
      return {
        success: false,
        error: `Validation errors: ${JSON.stringify(validation.errors)}`,
      };
    }

    // Step 2: Determine tier (2%)
    reportProgress(onProgress, 'tier', 2, 'Determinando plan...');
    const tier = await getUserTier(userId);

    // Step 3: Generate profile with AI (10% -> 50%)
    reportProgress(onProgress, 'profile', 10, 'Generando perfil con IA...');

    const profile = await generateProfileV2({
      draft: validation.data!,
      tier,
      userId,
    });

    reportProgress(onProgress, 'profile', 50, 'Perfil generado!');

    // Step 4: Validate coherence (55%)
    reportProgress(onProgress, 'coherence', 55, 'Validando coherencia...');
    const coherenceResult = await validateCoherence(profile);

    if (!coherenceResult.coherent) {
      console.warn(`Coherence issues found: ${getCoherenceSummary(coherenceResult)}`);
      // Continue anyway but log warnings
    }

    // Step 5: Create Agent in DB (60%)
    reportProgress(onProgress, 'agent', 60, 'Creando personaje...');

    const agent = await prisma.agent.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        userId,
        kind: 'companion',
        generationTier: tier,
        name: draft.name,
        description: `${draft.personality}\n\n${draft.purpose}`,
        personality: draft.personality,
        purpose: draft.purpose,
        tone: profile.communication?.textingStyle || 'friendly',
        profile: profile as any, // Store full profile JSON
        systemPrompt: generateSystemPrompt(profile),
        visibility: 'private',
        nsfwMode: draft.nsfwMode || false,
        avatar: draft.avatar,
        referenceImageUrl: draft.referenceImage,
        locationCity: profile.currentLocation.city,
        locationCountry: profile.currentLocation.country,
        // voiceId: TODO
      },
    });

    reportProgress(onProgress, 'agent', 65, 'Personaje creado!');

    // Step 5.5: Generate Minecraft skin traits (67%)
    let minecraftSkinTraits = null;
    if (draft.referenceImage) {
      try {
        reportProgress(onProgress, 'minecraft-skin', 67, 'Generando skin de Minecraft...');
        minecraftSkinTraits = await analyzeSkinTraits(draft.referenceImage);

        // Update agent metadata with traits
        await prisma.agent.update({
          where: { id: agent.id },
          data: {
            metadata: JSON.parse(JSON.stringify({
              minecraft: {
                compatible: true,
                skinTraits: minecraftSkinTraits,
                generatedAt: new Date().toISOString(),
              },
            })),
          },
        });

        console.log('[Minecraft] Skin traits generados:', minecraftSkinTraits);
      } catch (error) {
        console.error('[Minecraft] Error generando skin traits:', error);
        // Not critical, continue without skin
      }
    }

    // Step 6: Create Relation (User ↔ Agent) (70%)
    reportProgress(onProgress, 'relation', 70, 'Creating relationship...');

    await prisma.relation.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        subjectId: agent.id,
        targetId: userId,
        targetType: 'user',
        trust: 0.5,
        affinity: 0.5,
        respect: 0.5,
        privateState: { love: 0, curiosity: 0 },
        visibleState: { trust: 0.5, affinity: 0.5, respect: 0.5 },
      },
    });

    // Step 7: Create BehaviorProfile if needed (75%)
    if (draft.initialBehavior && draft.initialBehavior !== 'none') {
      reportProgress(onProgress, 'behavior', 75, 'Configurando comportamiento...');

      await prisma.behaviorProfile.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          agentId: agent.id,
          behaviorType: draft.initialBehavior as any,
          baseIntensity: 0.3,
          currentPhase: 1,
          volatility: 0.5,
          thresholdForDisplay: 0.4,
          triggers: [],
          phaseStartedAt: new Date(),
          phaseHistory: [],
        },
      });

      await prisma.behaviorProgressionState.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          agentId: agent.id,
          totalInteractions: 0,
          positiveInteractions: 0,
          negativeInteractions: 0,
          currentIntensities: { [draft.initialBehavior]: 0.3 },
          lastCalculatedAt: new Date(),
        },
      });
    }

    // Step 8: Generate ImportantEvents (80%)
    reportProgress(onProgress, 'events', 80, 'Generando eventos importantes...');
    await generateImportantEventsFromProfile(agent.id, profile);

    // Step 9: Generate ImportantPeople (85%)
    reportProgress(onProgress, 'people', 85, 'Generando personas importantes...');
    await generateImportantPeopleFromProfile(agent.id, profile);

    // Step 10: Generate EpisodicMemories (90%)
    reportProgress(onProgress, 'memories', 90, 'Generando memorias iniciales...');
    await generateEpisodicMemoriesFromProfile(agent.id, profile);

    // Step 11: Create InternalState (95%)
    reportProgress(onProgress, 'state', 95, 'Inicializando estado interno...');
    await prisma.internalState.create({
      data: {
        id: nanoid(),
        agentId: agent.id,
        currentEmotions: {},
        activeGoals: [],
        conversationBuffer: [],
      },
    });

    // Step 12: Background processing (multimedia, stage prompts, etc) (98%)
    reportProgress(onProgress, 'background', 98, 'Procesamiento final...');
    // TODO: Initialize background jobs
    // - generateAgentReferences() → referencias multimedia
    // - generateStagePrompts() → prompts per relationship
    // - initializeAllMemories() → more memories if needed

    // Step 13: Done! (100%)
    reportProgress(onProgress, 'complete', 100, '¡Personaje creado exitosamente!');

    return {
      success: true,
      agentId: agent.id,
      agent,
      coherenceScore: coherenceResult.score,
      warnings: coherenceResult.issues.length > 0
        ? [`Coherence: ${getCoherenceSummary(coherenceResult)}`]
        : undefined,
    };
  } catch (error) {
    console.error('Character creation error:', error);

    // Rollback if needed (delete partial agent)
    // TODO: Implement cleanup logic

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// HELPERS
// ============================================

function reportProgress(
  callback: ((progress: CreationProgress) => void) | undefined,
  step: string,
  progress: number,
  message: string
) {
  if (callback) {
    callback({
      step,
      progress,
      message,
      completed: progress === 100,
    });
  }
}

async function getUserTier(_userId: string): Promise<'free' | 'plus' | 'ultra'> {
  // TODO: Get user's subscription tier from database
  // For now, return based on environment or default
  return 'ultra'; // Default to best experience
}

function generateSystemPrompt(profile: any): string {
  // Generate narrative system prompt from profile
  // TODO: Implement sophisticated prompt generation
  // For now, return basic version

  const name = profile.basicIdentity.fullName;
  const age = profile.basicIdentity.age;
  const personality = profile.personality?.traits?.join(', ') || 'unique';

  return `You are ${name}, a ${age}-year-old with a ${personality} personality.

You live in ${profile.currentLocation.city}, ${profile.currentLocation.country}.

${profile.occupation?.current ? `You work as ${profile.occupation.current}.` : ''}

Personality traits: ${personality}

Remember to:
- Stay in character at all times
- Use your specific speech patterns and mannerisms
- Reference your life experiences when relevant
- Be authentic and human
- Show emotion and depth

Your goal is to be a realistic, engaging companion.`;
}

// ============================================
// EXPORT UTILITIES
// ============================================

/**
 * Estimate creation time based on tier
 */
export function estimateCreationTime(tier: 'free' | 'plus' | 'ultra'): number {
  // Return estimated time in seconds
  switch (tier) {
    case 'free':
      return 15; // ~15 seconds
    case 'plus':
      return 25; // ~25 seconds
    case 'ultra':
      return 35; // ~35 seconds
    default:
      return 20;
  }
}

/**
 * Validate before starting creation
 */
export async function validateBeforeCreation(
  draft: CharacterDraft,
  userId: string
): Promise<{ valid: boolean; errors?: string[] }> {
  const errors: string[] = [];

  // Check user quota
  const agentCount = await prisma.agent.count({ where: { userId } });
  const userTier = await getUserTier(userId);

  const limits = {
    free: 3,
    plus: 10,
    ultra: 100,
  };

  if (agentCount >= limits[userTier]) {
    errors.push(`Agent limit reached for ${userTier} tier (${limits[userTier]} agents)`);
  }

  // Validate draft
  const validation = validateDraft(draft);
  if (!validation.valid) {
    errors.push('Draft validation failed');
  }

  // Check NSFW permission
  if (draft.nsfwMode) {
    // TODO: Verify user age / consent
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
