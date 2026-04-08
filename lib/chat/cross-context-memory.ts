import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import type { UserTier } from "./types";

/**
 * Cross-Context Shared Memory System
 *
 * Allows characters to remember group conversations
 * when talking individually and vice versa.
 *
 * Example: "Hey, yesterday's chat with {character2} was very interesting"
 */

export interface CrossContextMemoryData {
  id: string;
  summary: string;
  involvedAgents: Array<{ agentId: string; agentName: string }>;
  happenedAt: Date;
  emotionalTone?: string;
  sourceType: string;
  importance: number;
  timeSince: string; // "2 hours ago", "yesterday", "3 days ago"
}

// Memory limits by tier
const MEMORY_LIMITS = {
  free: {
    maxMemories: 10, // Only remembers 10 recent things
    maxDaysBack: 7, // Maximum 7 days back
    includeGroupMemories: false, // Cannot reference groups
  },
  plus: {
    maxMemories: 50,
    maxDaysBack: 30, // 30 days
    includeGroupMemories: true,
  },
  ultra: {
    maxMemories: null, // Unlimited
    maxDaysBack: null, // All time
    includeGroupMemories: true,
  },
};

/**
 * Creates a cross-context memory from a world interaction
 */
export async function createMemoryFromWorldInteraction(
  agentId: string,
  worldId: string,
  interactionId: string,
  summary: string,
  involvedAgents: Array<{ agentId: string; agentName: string }>,
  importance: number = 0.5
): Promise<void> {
  await prisma.crossContextMemory.create({
    data: {
      id: nanoid(),
      updatedAt: new Date(),
      agentId,
      sourceType: "group_interaction",
      sourceGroupId: worldId,
      summary,
      involvedAgents,
      happenedAt: new Date(),
      importance,
      emotionalTone: "neutral",
    },
  });
}

/**
 * Creates a cross-context memory from individual chat
 */
export async function createMemoryFromIndividualChat(
  agentId: string,
  userId: string,
  summary: string,
  importance: number = 0.5
): Promise<void> {
  await prisma.crossContextMemory.create({
    data: {
      id: nanoid(),
      updatedAt: new Date(),
      agentId,
      sourceType: "individual_chat",
      sourceUserId: userId,
      summary,
      happenedAt: new Date(),
      importance,
    },
  });
}

/**
 * Gets relevant memories to inject into context
 */
export async function getRelevantMemories(
  agentId: string,
  tier: UserTier,
  currentContext: "individual" | "world",
  limit: number = 5
): Promise<CrossContextMemoryData[]> {
  const limits = MEMORY_LIMITS[tier];

  // Free tier: No cross-context memories
  if (!limits.includeGroupMemories && currentContext === "individual") {
    return [];
  }

  // Calculate date limit
  const dateLimit =
    limits.maxDaysBack !== null
      ? new Date(Date.now() - limits.maxDaysBack * 24 * 60 * 60 * 1000)
      : new Date(0);

  // Get memories
  const memories = await prisma.crossContextMemory.findMany({
    where: {
      agentId,
      happenedAt: {
        gte: dateLimit,
      },
      // If we're in individual chat, bring memories from worlds
      // If we're in world, bring memories from individual chats
      sourceType:
        currentContext === "individual" ? "world_interaction" : "individual_chat",
    },
    orderBy: [{ importance: "desc" }, { happenedAt: "desc" }],
    take: limits.maxMemories !== null ? Math.min(limit, limits.maxMemories) : limit,
  });

  // Format with relative time
  return memories.map((mem) => ({
    id: mem.id,
    summary: mem.summary,
    involvedAgents: (mem.involvedAgents as any) || [],
    happenedAt: mem.happenedAt,
    emotionalTone: mem.emotionalTone || undefined,
    sourceType: mem.sourceType,
    importance: mem.importance,
    timeSince: getRelativeTime(mem.happenedAt),
  }));
}

/**
 * Records that a memory was referenced
 */
export async function recordMemoryReference(memoryId: string): Promise<void> {
  await prisma.crossContextMemory.update({
    where: { id: memoryId },
    data: {
      lastReferencedAt: new Date(),
      referenceCount: {
        increment: 1,
      },
      // Increase importance when referenced
      importance: {
        increment: 0.05,
      },
    },
  });
}

/**
 * Updates temporal context of the agent with user
 */
export async function updateTemporalContext(
  agentId: string,
  userId: string,
  contextType: "individual" | "world",
  worldId?: string
): Promise<void> {
  const updates: any = {
    lastSeenAt: new Date(),
  };

  if (contextType === "individual") {
    updates.lastIndividualChatAt = new Date();
    updates.individualChatCount = {
      increment: 1,
    };
  } else if (contextType === "world") {
    updates.lastWorldInteractionAt = new Date();
    updates.lastWorldId = worldId;
    updates.worldInteractionCount = {
      increment: 1,
    };
  }

  await prisma.temporalContext.upsert({
    where: {
      agentId_userId: {
        agentId,
        userId,
      },
    },
    create: {
      id: nanoid(),
      updatedAt: new Date(),
      agentId,
      userId,
      ...updates,
      individualChatCount: contextType === "individual" ? 1 : 0,
      worldInteractionCount: contextType === "world" ? 1 : 0,
    },
    update: updates,
  });
}

/**
 * Gets current temporal context
 */
export async function getTemporalContext(agentId: string, userId: string) {
  return await prisma.temporalContext.findUnique({
    where: {
      agentId_userId: {
        agentId,
        userId,
      },
    },
  });
}

/**
 * Generates memory context to inject into the prompt
 */
export function generateMemoryContext(memories: CrossContextMemoryData[]): string {
  if (memories.length === 0) {
    return "";
  }

  let context = "\n**Memorias Recientes Relevantes**:\n";

  for (const memory of memories) {
    const involvedNames =
      memory.involvedAgents?.map((a) => a.agentName).join(", ") || "otros";

    context += `- ${memory.timeSince}: ${memory.summary}`;

    if (memory.involvedAgents && memory.involvedAgents.length > 0) {
      context += ` (con ${involvedNames})`;
    }

    context += "\n";
  }

  context +=
    "\n*You can mention these memories naturally if they are relevant to the current conversation.*\n";

  return context;
}

/**
 * Calculates relative time in Spanish
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `hace ${diffMinutes} minuto${diffMinutes !== 1 ? "s" : ""}`;
  } else if (diffHours < 24) {
    return `hace ${diffHours} hora${diffHours !== 1 ? "s" : ""}`;
  } else if (diffDays === 1) {
    return "ayer";
  } else if (diffDays < 7) {
    return `hace ${diffDays} días`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `hace ${weeks} semana${weeks !== 1 ? "s" : ""}`;
  } else {
    const months = Math.floor(diffDays / 30);
    return `hace ${months} mes${months !== 1 ? "es" : ""}`;
  }
}

/**
 * Extracts important memories from world interactions
 * (Called periodically or at the end of each world session)
 */
export async function extractMemoriesFromWorld(
  worldId: string,
  agentId: string,
  lastNInteractions: number = 10
): Promise<void> {
  // TODO: Implement group interaction tracking
  // The worldInteraction model has been removed in favor of group messages
  // This functionality should be reimplemented using GroupMessage model
  console.warn('[Cross Context Memory] World interaction tracking not implemented - using group messages instead');

  // For now, return early
  return;

  /* Original code - keeping for reference until reimplemented
  const interactions = await prisma.worldInteraction.findMany({
    where: {
      worldId,
      OR: [{ speakerId: agentId }, { targetId: agentId }],
    },
    orderBy: { createdAt: "desc" },
    take: lastNInteractions,
  });

  if (interactions.length === 0) {
    return;
  }

  // For now, create a simple summarized memory
  // In the future, use LLM to generate a more intelligent summary
  const recentContent = interactions
    .reverse()
    .map((i: any) => i.content)
    .join(" ");

  // Calculate importance based on sentiment and metadata
  let importance = 0.5;
  const hasPositiveSentiment = interactions.some((i: any) => i.sentiment === "positive");
  const hasNegativeSentiment = interactions.some((i: any) => i.sentiment === "negative");

  if (hasPositiveSentiment || hasNegativeSentiment) {
    importance = 0.7; // Emotional interactions are more important
  }

  // Get other agents involved
  const otherAgentIds = [
    ...new Set(
      interactions
        .flatMap((i: any) => [i.speakerId, i.targetId])
        .filter((id: any) => id && id !== agentId)
    ),
  ];

  const otherAgents = await prisma.agent.findMany({
    where: {
      id: {
        in: otherAgentIds as string[],
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const involvedAgents = otherAgents.map((a) => ({
    agentId: a.id,
    agentName: a.name,
  }));

  // Create simplified memory (in the future, use LLM for summary)
  const summary = `Conversación en grupo sobre: ${recentContent.slice(0, 200)}...`;

  await createMemoryFromWorldInteraction(
    agentId,
    worldId,
    interactions[0].id,
    summary,
    involvedAgents,
    importance
  );
  */
}

/**
 * Cleans up old memories according to tier
 */
export async function cleanupOldMemories(agentId: string, tier: UserTier): Promise<void> {
  const limits = MEMORY_LIMITS[tier];

  if (limits.maxDaysBack === null) {
    return; // Ultra tier: no cleanup
  }

  const dateLimit = new Date(Date.now() - limits.maxDaysBack * 24 * 60 * 60 * 1000);

  await prisma.crossContextMemory.deleteMany({
    where: {
      agentId,
      happenedAt: {
        lt: dateLimit,
      },
    },
  });
}
