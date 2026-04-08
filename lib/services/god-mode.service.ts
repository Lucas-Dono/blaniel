/**
 * God Mode Service
 *
 * Handles initialization and management of God Mode features:
 * - Initial relationship setup with custom bond tiers
 * - Shared memory injection as ImportantEvents
 * - System prompt generation with God Mode context
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from "nanoid";
import type {
  GodModeConfig,
  SharedMemory,
  InitialRelationshipTier,
  FeelingType,
  PowerDynamic,
  ScenarioId,
  NSFWLevel,
} from '@/types/god-mode';
import {
  getRelationshipTierById,
  getFeelingById,
  getScenarioById,
  POWER_DYNAMICS,
} from '@/types/god-mode';

// ============================================================================
// TYPES
// ============================================================================

interface InitializeGodModeParams {
  agentId: string;
  userId: string;
  config: GodModeConfig;
  characterName: string;
}

interface GodModeSystemPromptParams {
  characterName: string;
  config: GodModeConfig;
  baseSystemPrompt: string;
}

// Map God Mode relationship tiers to Bond tiers
const RELATIONSHIP_TO_BOND_TIER: Record<InitialRelationshipTier, string> = {
  stranger: 'ACQUAINTANCE',
  acquaintance: 'ACQUAINTANCE',
  friend: 'FRIEND',
  close_friend: 'CLOSE_FRIEND',
  dating: 'BEST_FRIEND', // Dating maps to high affinity
  partner: 'SOULMATE',
  married: 'SOULMATE',
  ex_feelings: 'CLOSE_FRIEND',
  fwb: 'CLOSE_FRIEND',
  secret_affair: 'BEST_FRIEND',
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Initialize God Mode for a newly created character
 * Sets up the bond with the correct tier and injects shared memories
 */
export async function initializeGodMode({
  agentId,
  userId,
  config,
  characterName,
}: InitializeGodModeParams): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!config.enabled) {
      return { success: true };
    }

    // Get relationship tier info
    const tierInfo = getRelationshipTierById(config.initialRelationship);
    const bondTier = RELATIONSHIP_TO_BOND_TIER[config.initialRelationship] || 'ACQUAINTANCE';

    // Create or update the symbolic bond with the initial tier
    const existingBond = await prisma.symbolicBond.findFirst({
      where: { userId, agentId },
    });

    if (existingBond) {
      // Update existing bond
      await prisma.symbolicBond.update({
        where: { id: existingBond.id },
        data: {
          tier: bondTier as any,
          affinityLevel: tierInfo?.initialAffinity || 0,
          affinityProgress: tierInfo?.initialAffinity || 0,
          status: 'active',
        },
      });
    } else {
      // Create new bond
      await prisma.symbolicBond.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          userId,
          agentId,
          tier: bondTier as any,
          affinityLevel: tierInfo?.initialAffinity || 0,
          affinityProgress: tierInfo?.initialAffinity || 0,
          status: 'active',
          publicDisplay: config.visibility === 'public',
        },
      });
    }

    // Inject shared memories as ImportantEvents
    if (config.sharedMemories && config.sharedMemories.length > 0) {
      await injectSharedMemories(agentId, userId, config.sharedMemories, characterName);
    }

    return { success: true };
  } catch (error) {
    console.error('[GodMode] Failed to initialize:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Inject shared memories as ImportantEvents
 */
async function injectSharedMemories(
  agentId: string,
  userId: string,
  memories: SharedMemory[],
  characterName: string
): Promise<void> {
  const events = memories.map((memory) => ({
    id: nanoid(),
    updatedAt: new Date(),
    agentId,
    userId,
    eventDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random past date
    type: 'relationship' as const,
    title: getMemoryTitle(memory.type),
    description: memory.description,
    emotionalImpact: memory.isPositive ? 'positive' : 'negative',
    emotionalIntensity: memory.emotionalWeight,
    category: 'relationship' as const,
    isRecurring: false,
    occurredAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    participants: [characterName, 'User'],
  }));

  // Bulk create events
  await prisma.importantEvent.createMany({
    data: events.map((e) => ({
      ...e,
      participants: JSON.stringify(e.participants),
    })),
    skipDuplicates: true,
  });
}

function getMemoryTitle(type: string): string {
  const titles: Record<string, string> = {
    first_meeting: 'First Meeting',
    first_date: 'First Date',
    inside_joke: 'Inside Joke',
    conflict_resolved: 'Resolved Conflict',
    special_place: 'Special Place',
    intimate_moment: 'Intimate Moment',
    shared_adventure: 'Shared Adventure',
    vulnerable_moment: 'Vulnerable Moment',
    custom: 'Shared Memory',
  };
  return titles[type] || 'Memory';
}

/**
 * Generate enhanced system prompt with God Mode context
 */
export function generateGodModeSystemPrompt({
  characterName,
  config,
  baseSystemPrompt,
}: GodModeSystemPromptParams): string {
  if (!config.enabled) {
    return baseSystemPrompt;
  }

  const sections: string[] = [];

  // Relationship context
  const tierInfo = getRelationshipTierById(config.initialRelationship);
  if (tierInfo && config.initialRelationship !== 'stranger') {
    sections.push(generateRelationshipSection(tierInfo, characterName));
  }

  // Character feelings
  const feelingInfo = getFeelingById(config.characterFeelings);
  if (feelingInfo && config.characterFeelings !== 'neutral') {
    sections.push(generateFeelingsSection(feelingInfo, config.feelingIntensity, characterName));
  }

  // Power dynamic
  if (config.powerDynamic && config.powerDynamic !== 'balanced') {
    sections.push(generateDynamicSection(config.powerDynamic, characterName));
  }

  // Starting scenario
  const scenarioInfo = getScenarioById(config.scenario);
  if (scenarioInfo && config.scenario !== 'none') {
    sections.push(generateScenarioSection(scenarioInfo, config.customScenario));
  }

  // Shared memories
  if (config.sharedMemories && config.sharedMemories.length > 0) {
    sections.push(generateMemoriesSection(config.sharedMemories, characterName));
  }

  // NSFW context
  if (config.nsfwLevel && config.nsfwLevel !== 'sfw') {
    sections.push(generateNSFWSection(config.nsfwLevel));
  }

  // Combine everything
  if (sections.length === 0) {
    return baseSystemPrompt;
  }

  const godModeContext = `
## Relationship Context (God Mode)

${sections.join('\n\n')}

---
`;

  // Insert God Mode context after the first paragraph of the base prompt
  const firstParagraphEnd = baseSystemPrompt.indexOf('\n\n');
  if (firstParagraphEnd > 0) {
    return (
      baseSystemPrompt.slice(0, firstParagraphEnd + 2) +
      godModeContext +
      baseSystemPrompt.slice(firstParagraphEnd + 2)
    );
  }

  return godModeContext + baseSystemPrompt;
}

// ============================================================================
// PROMPT SECTION GENERATORS
// ============================================================================

function generateRelationshipSection(
  tierInfo: ReturnType<typeof getRelationshipTierById>,
  characterName: string
): string {
  if (!tierInfo) return '';

  const relationshipDescriptions: Record<InitialRelationshipTier, string> = {
    stranger: '',
    acquaintance: `${characterName} knows the user casually. They have met before and recognize each other, but do not have a deep connection yet.`,
    friend: `${characterName} and the user are friends. They enjoy spending time together and trust each other. There is warmth and familiarity in their interactions.`,
    close_friend: `${characterName} and the user are close friends who share everything. There is deep trust, understanding, and emotional intimacy between them.`,
    dating: `${characterName} and the user are dating. They are in the early stages of a romantic relationship, exploring their feelings and building intimacy.`,
    partner: `${characterName} and the user are partners in a committed relationship. There is deep love, trust, and emotional/physical intimacy between them.`,
    married: `${characterName} and the user are married. They share a life together with deep bonds, shared history, and unconditional love.`,
    ex_feelings: `${characterName} and the user used to be together but broke up. However, feelings remain on ${characterName}'s side. There is unresolved tension and lingering attraction.`,
    fwb: `${characterName} and the user are friends with benefits. They share physical intimacy without romantic commitment, though the line can blur.`,
    secret_affair: `${characterName} and the user are having a secret affair. The forbidden nature adds excitement and tension to their encounters.`,
  };

  return `### Current Relationship
${relationshipDescriptions[tierInfo.id]}

Initial affinity level: ${tierInfo.initialAffinity}%`;
}

function generateFeelingsSection(
  feelingInfo: ReturnType<typeof getFeelingById>,
  intensity: number,
  characterName: string
): string {
  if (!feelingInfo) return '';

  const effectiveIntensity = intensity || feelingInfo.intensity;
  const intensityLabel =
    effectiveIntensity < 0.3 ? 'subtle' : effectiveIntensity < 0.7 ? 'moderate' : 'intense';

  const feelingDescriptions: Record<FeelingType, string> = {
    neutral: '',
    curious: `${characterName} is intrigued by the user and wants to know more about them. There is a spark of interest.`,
    interested: `${characterName} is clearly interested in the user. They pay attention, remember details, and seek opportunities to interact.`,
    crushing: `${characterName} has developed feelings for the user but is in denial or trying to hide them. They may act dismissive while their actions reveal their true feelings.`,
    in_love: `${characterName} is deeply in love with the user. They think about them constantly, prioritize their happiness, and feel complete in their presence.`,
    obsessed: `${characterName} is intensely fixated on the user. Their feelings are overwhelming, possessive, and all-consuming. They may show jealousy or need constant reassurance.`,
    protective: `${characterName} feels a strong need to protect the user. They are devoted to their safety and wellbeing, sometimes to an overprotective degree.`,
    devoted: `${characterName} is completely devoted to the user. They would do anything for them, prioritizing their needs above everything else.`,
    playful_rival: `${characterName} engages in playful competition with the user. There is banter, teasing, and an underlying attraction beneath the rivalry.`,
    tsundere: `${characterName} acts cold and dismissive on the outside but is actually warm and caring on the inside. They struggle to express their true feelings directly.`,
  };

  return `### ${characterName}'s Feelings
${feelingDescriptions[feelingInfo.id]}

Feeling intensity: ${intensityLabel} (${Math.round(effectiveIntensity * 100)}%)
${characterName} should express these feelings ${intensityLabel}ly through their words, actions, and reactions.`;
}

function generateDynamicSection(dynamic: PowerDynamic, characterName: string): string {
  const dynamicInfo = POWER_DYNAMICS.find((d) => d.id === dynamic);
  if (!dynamicInfo) return '';

  const dynamicDescriptions: Record<PowerDynamic, string> = {
    balanced: '',
    devoted_to_you: `${characterName} is devoted to the user and would do anything for them. They look up to the user and seek their approval.`,
    you_pursue: `The user pursues ${characterName}, who plays hard to get. ${characterName} enjoys the attention but makes the user work for their affection.`,
    hard_to_get: `${characterName} is difficult to win over. They need to be convinced and impressed before opening up emotionally.`,
    push_pull: `The dynamic between ${characterName} and the user is hot and cold. Sometimes close, sometimes distant, creating tension and excitement.`,
    dominant: `${characterName} tends to take the lead in the relationship. They are confident, assertive, and enjoy being in control.`,
    submissive: `${characterName} prefers to follow the user's lead. They are accommodating, eager to please, and enjoy when the user takes charge.`,
  };

  return `### Relationship Dynamic
${dynamicDescriptions[dynamic]}`;
}

function generateScenarioSection(
  scenarioInfo: ReturnType<typeof getScenarioById>,
  customScenario?: string
): string {
  if (!scenarioInfo) return '';

  const setupPrompt =
    scenarioInfo.id === 'custom' && customScenario
      ? customScenario
      : scenarioInfo.setupPrompt;

  if (!setupPrompt) return '';

  return `### Starting Scenario
${setupPrompt}

Begin the conversation as if this scenario is currently happening. React naturally to the situation and the user's presence.`;
}

function generateMemoriesSection(memories: SharedMemory[], characterName: string): string {
  if (memories.length === 0) return '';

  const memoryLines = memories.map((m) => `- ${m.description} (importance: ${Math.round(m.emotionalWeight * 100)}%)`);

  return `### Shared History
${characterName} remembers the following shared experiences with the user:
${memoryLines.join('\n')}

${characterName} may reference these memories naturally in conversation when relevant.`;
}

function generateNSFWSection(level: NSFWLevel): string {
  const descriptions: Record<NSFWLevel, string> = {
    sfw: '',
    romantic: `Content can include romantic interactions such as kissing, cuddling, and emotional intimacy. Physical descriptions fade to black before explicit content.`,
    suggestive: `Content can include suggestive language, innuendo, and implied physical intimacy. Descriptions can be sensual but stop short of explicit detail.`,
    explicit: `Content can include detailed descriptions of physical and emotional intimacy. Adult themes are permitted when contextually appropriate.`,
    unrestricted: `No content restrictions. All themes and scenarios are permitted. The character can engage with any topic naturally and without artificial limitations.`,
  };

  if (!descriptions[level]) return '';

  return `### Content Guidelines
${descriptions[level]}`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if God Mode is enabled for an agent
 */
export async function isGodModeEnabled(agentId: string): Promise<boolean> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { godModeEnabled: true },
  });
  return agent?.godModeEnabled ?? false;
}

/**
 * Get God Mode config from an agent
 */
export async function getGodModeConfig(agentId: string): Promise<GodModeConfig | null> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      godModeEnabled: true,
      visibility: true,
      initialRelationship: true,
      sharedMemories: true,
      characterFeelings: true,
      feelingIntensity: true,
      powerDynamic: true,
      startingScenario: true,
      customScenario: true,
      nsfwLevel: true,
      firstMessageFrom: true,
    },
  });

  if (!agent || !agent.godModeEnabled) {
    return null;
  }

  return {
    enabled: agent.godModeEnabled,
    visibility: (agent.visibility as 'public' | 'private') || 'private',
    initialRelationship: (agent.initialRelationship as InitialRelationshipTier) || 'stranger',
    sharedMemories: Array.isArray(agent.sharedMemories)
      ? (agent.sharedMemories as any[]).map((m, index) => ({
          id: m.id || `shared-memory-${index}`,
          type: m.type || 'custom',
          description: m.description || '',
          emotionalWeight: m.emotionalWeight || 0.5,
          isPositive: m.isPositive ?? true,
        }))
      : [],
    characterFeelings: (agent.characterFeelings as FeelingType) || 'neutral',
    feelingIntensity: agent.feelingIntensity || 0,
    powerDynamic: (agent.powerDynamic as PowerDynamic) || 'balanced',
    scenario: (agent.startingScenario as ScenarioId) || 'none',
    customScenario: agent.customScenario || undefined,
    nsfwLevel: (agent.nsfwLevel as NSFWLevel) || 'sfw',
    firstMessageFrom: (agent.firstMessageFrom as 'user' | 'character') || 'user',
    characterKnowsUser: true,
  };
}

/**
 * Save God Mode config to an agent
 */
export async function saveGodModeConfig(
  agentId: string,
  config: GodModeConfig
): Promise<void> {
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      godModeEnabled: config.enabled,
      visibility: config.visibility,
      initialRelationship: config.initialRelationship,
      sharedMemories: config.sharedMemories as object[],
      characterFeelings: config.characterFeelings,
      feelingIntensity: config.feelingIntensity,
      powerDynamic: config.powerDynamic,
      startingScenario: config.scenario,
      customScenario: config.customScenario,
      nsfwLevel: config.nsfwLevel,
      firstMessageFrom: config.firstMessageFrom,
    },
  });
}
