import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { getLLMProvider } from "@/lib/llm/provider";
import type { UserTier } from "./types";

/**
 * Advanced Context Window Management System
 *
 * Based on best practices of 2024-2025:
 * - MemGPT (virtual memory paging)
 * - LongLLMLingua (prompt compression)
 * - Progressive summarization
 * - Multi-tier memory architecture
 *
 * Token budget (32K Gemini limit):
 * FREE:  ~8K tokens  (25% of the limit)
 * PLUS:  ~15K tokens (47% of the limit)
 * ULTRA: ~25K tokens (78% of the limit)
 */

// ============================================================================
// TIER CONFIGURATION
// ============================================================================

const TIER_CONFIG = {
  free: {
    // Messages
    maxRecentMessages: 10, // Only 10 complete recent messages
    includeSummary: false, // Does not include summary of old context

    // Semantic memory
    maxSemanticFacts: 10, // Maximum 10 important facts

    // Dynamic contexts
    includeRoutineContext: false,
    includeGoalsContext: false,
    includeCrossContextMemory: false,
    maxTemporalReferences: 0,

    // Budget
    totalTokenBudget: 8000,
    messagesTokenBudget: 2000,
    contextTokenBudget: 3000,
    summaryTokenBudget: 0,
  },
  plus: {
    maxRecentMessages: 30,
    includeSummary: true,

    maxSemanticFacts: 30,

    includeRoutineContext: true,
    includeGoalsContext: true,
    includeCrossContextMemory: true,
    maxTemporalReferences: 3,

    totalTokenBudget: 15000,
    messagesTokenBudget: 6000,
    contextTokenBudget: 5000,
    summaryTokenBudget: 1000,
  },
  ultra: {
    maxRecentMessages: 60,
    includeSummary: true,

    maxSemanticFacts: 100, // No practical limit

    includeRoutineContext: true,
    includeGoalsContext: true,
    includeCrossContextMemory: true,
    maxTemporalReferences: 5,

    totalTokenBudget: 25000,
    messagesTokenBudget: 12000,
    contextTokenBudget: 8000,
    summaryTokenBudget: 3000,
  },
};

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/** Token estimator (4 characters ≈ 1 token for Spanish/English) */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Truncates text so it does not exceed a number of tokens */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + "...";
}

// ============================================================================
// SEMANTIC MEMORY EXTRACTION
// ============================================================================

/**
 * Extracts important facts from recent messages
 * Inspired by MemGPT - persistent storage of key information
 */
export async function extractAndStoreSemanticFacts(
  agentId: string,
  userId: string,
  messages: Array<{ role: string; content: string }>
): Promise<string[]> {
  const userMessages = messages.filter((m) => m.role === "user");
  const newFacts: string[] = [];

  // Expanded personal information patterns
  const patterns = [
    { regex: /(?:me llamo|soy) ([A-ZÁ-Ú][a-zá-ú]+)/i, type: "name", template: "Se llama" },
    { regex: /tengo (\d+) años/i, type: "age", template: "Tiene" },
    { regex: /(?:vivo en|soy de) ([^,.]+)/i, type: "location", template: "Vive en" },
    { regex: /trabajo (?:como|de|en) ([^,.]+)/i, type: "occupation", template: "Trabaja como" },
    { regex: /estudio ([^,.]+)/i, type: "education", template: "Estudia" },
    { regex: /me (?:gusta|encanta) ([^,.]+)/i, type: "interest", template: "Le gusta" },
    { regex: /(?:odio|detesto) ([^,.]+)/i, type: "dislike", template: "No le gusta" },
    { regex: /mi (?:hobby|pasatiempo) es ([^,.]+)/i, type: "hobby", template: "Su hobby es" },
    { regex: /tengo (?:un|una) ([^,.]+)/i, type: "possession", template: "Tiene" },
    { regex: /(?:mi|el) objetivo es ([^,.]+)/i, type: "goal", template: "Su objetivo es" },
  ];

  for (const msg of userMessages) {
    for (const { regex, type, template } of patterns) {
      const match = msg.content.match(regex);
      if (match) {
        const fact = `${template} ${match[1]}`;
        newFacts.push(fact);
      }
    }
  }

  if (newFacts.length === 0) return [];

  // Update semantic memory in DB
  const existingMemory = await prisma.semanticMemory.findUnique({
    where: { agentId },
  });

  const currentFacts = (existingMemory?.userFacts as string[]) || [];
  const allFacts = [...new Set([...currentFacts, ...newFacts])]; // Deduplicar

  await prisma.semanticMemory.upsert({
    where: { agentId },
    create: {
      id: nanoid(),
      agentId,
      userFacts: allFacts,
      userPreferences: {},
    },
    update: {
      userFacts: allFacts,
      lastUpdated: new Date(),
    },
  });

  return newFacts;
}

/** Gets semantic facts to inject into the context */
export async function getSemanticFacts(
  agentId: string,
  maxFacts: number
): Promise<string> {
  const memory = await prisma.semanticMemory.findUnique({
    where: { agentId },
  });

  if (!memory) return "";

  const facts = (memory.userFacts as string[]) || [];
  if (facts.length === 0) return "";

  const selectedFacts = facts.slice(-maxFacts); // Más recientes

  return `\n**HECHOS IMPORTANTES DEL USUARIO**\n${selectedFacts.map((f) => `- ${f}`).join("\n")}\n`;
}

// ============================================================================
// PROGRESSIVE SUMMARIZATION (LongLLMLingua-inspired)
// ============================================================================

/**
 * Generates an intelligent summary of old messages using the LLM
 */
async function generateIntelligentSummary(
  messages: Array<{ role: string; content: string; createdAt: Date }>,
  maxTokens: number
): Promise<string> {
  if (messages.length === 0) return "";

  // Construir contexto para el LLM
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content}`)
    .join("\n\n");

  const summaryPrompt = `Summarize the following conversation in a concise but complete manner. Include:
- Main topics discussed
- Important information shared by the user
- Overall emotional state of the conversation
- Any plans or commitments mentioned

Conversation:
${conversationText}

Summary (maximum ${maxTokens * 4} characters):`;

  try {
    const llm = getLLMProvider();
    const summary = await llm.generate({
      systemPrompt: "You are an assistant that generates concise and accurate summaries of conversations.",
      messages: [{ role: "user", content: summaryPrompt }],
    });

    return truncateToTokens(summary, maxTokens);
  } catch (error) {
    console.error("Error generating summary:", error);
    // Fallback: simple summary
    return generateSimpleSummary(messages, maxTokens);
  }
}

/**
 * Simple summary as fallback (without LLM)
 */
function generateSimpleSummary(
  messages: Array<{ role: string; content: string; createdAt: Date }>,
  maxTokens: number
): string {
  const userMessages = messages.filter((m) => m.role === "user");

  // Take the longest messages (more information)
  const importantMessages = userMessages
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, 5);

  let summary = `Summary of ${messages.length} previous messages:\n\n`;
  summary += "Topics mentioned:\n";

  for (const msg of importantMessages) {
    const preview = msg.content.slice(0, 80);
    summary += `- ${preview}${msg.content.length > 80 ? "..." : ""}\n`;
  }

  return truncateToTokens(summary, maxTokens);
}

/** Gets or generates old conversation summary */
async function getOrCreateSummary(
  agentId: string,
  userId: string | undefined,
  oldMessages: Array<{ role: string; content: string; createdAt: Date }>,
  maxTokens: number,
  useIntelligentSummary: boolean
): Promise<string | undefined> {
  if (oldMessages.length === 0) return undefined;

  // Search for existing summary
  const existing = await prisma.conversationSummary.findFirst({
    where: {
      agentId,
      userId: userId || null,
      messagesCount: oldMessages.length,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) return existing.summary;

  // Generate new summary
  const summary = useIntelligentSummary
    ? await generateIntelligentSummary(oldMessages, maxTokens)
    : generateSimpleSummary(oldMessages, maxTokens);

  // Save in DB for reuse
  await prisma.conversationSummary.create({
    data: {
      id: nanoid(),
      updatedAt: new Date(),
      agentId,
      userId: userId || null,
      summary,
      messagesCount: oldMessages.length,
      periodStart: oldMessages[0].createdAt,
      periodEnd: oldMessages[oldMessages.length - 1].createdAt,
      estimatedTokens: estimateTokens(summary),
    },
  });

  return summary;
}

// ============================================================================
// SLIDING WINDOW MESSAGE RETRIEVAL
// ============================================================================

/**
 * Gets optimized messages with sliding window
 */
export async function getOptimizedMessages(
  agentId: string,
  userId: string | undefined,
  tier: UserTier
): Promise<{
  recentMessages: Array<{ role: string; content: string }>;
  summary?: string;
  semanticFacts?: string;
  stats: {
    totalMessages: number;
    recentCount: number;
    oldCount: number;
    messagesTokens: number;
    summaryTokens: number;
    factsTokens: number;
  };
}> {
  const config = TIER_CONFIG[tier];

  // 1. Get ALL messages
  const allMessages = await prisma.message.findMany({
    where: {
      agentId,
      ...(userId ? { userId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      content: true,
      createdAt: true,
    },
  });

  if (allMessages.length === 0) {
    return {
      recentMessages: [],
      stats: {
        totalMessages: 0,
        recentCount: 0,
        oldCount: 0,
        messagesTokens: 0,
        summaryTokens: 0,
        factsTokens: 0,
      },
    };
  }

  // 2. Separate recent vs old messages (sliding window)
  const recentMessages = allMessages.slice(-config.maxRecentMessages);
  const oldMessages = allMessages.slice(0, -config.maxRecentMessages);

  // 3. Format recent messages
  const formattedRecent = recentMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const messagesTokens = formattedRecent.reduce(
    (sum, m) => sum + estimateTokens(m.content),
    0
  );

  // 4. Generate summary of old messages (if applicable)
  let summary: string | undefined;
  let summaryTokens = 0;

  if (config.includeSummary && oldMessages.length > 0 && userId) {
    summary = await getOrCreateSummary(
      agentId,
      userId,
      oldMessages,
      config.summaryTokenBudget,
      tier === "ultra" // Ultra uses intelligent summary with LLM
    );

    if (summary) {
      summaryTokens = estimateTokens(summary);
    }
  }

  // 5. Extract and obtain semantic facts
  let semanticFacts: string | undefined;
  let factsTokens = 0;

  if (userId) {
    await extractAndStoreSemanticFacts(agentId, userId, formattedRecent);
    semanticFacts = await getSemanticFacts(agentId, config.maxSemanticFacts);

    if (semanticFacts) {
      factsTokens = estimateTokens(semanticFacts);
    }
  }

  return {
    recentMessages: formattedRecent,
    summary,
    semanticFacts,
    stats: {
      totalMessages: allMessages.length,
      recentCount: recentMessages.length,
      oldCount: oldMessages.length,
      messagesTokens,
      summaryTokens,
      factsTokens,
    },
  };
}

// ============================================================================
// CONTEXT PRIORITY SYSTEM
// ============================================================================

interface ContextItem {
  name: string;
  content: string;
  priority: number;
  essential: boolean;
  tokens: number;
}

/** Prioritizes and filters contexts based on token budget */
export function prioritizeContexts(
  tier: UserTier,
  contexts: Record<string, string>
): {
  selectedContexts: string[];
  droppedContexts: string[];
  totalTokens: number;
} {
  const config = TIER_CONFIG[tier];

  // Define priorities
  const contextPriorities: Array<{
    name: string;
    priority: number;
    essential: boolean;
    tierRequired?: UserTier;
  }> = [
    // ESSENTIAL (always included)
    { name: "vulnerabilityContext", priority: 100, essential: true },
    { name: "moodContext", priority: 95, essential: true },
    { name: "energyContext", priority: 90, essential: true },
    { name: "depthContext", priority: 85, essential: true },

    // IMPORTANT (included if there's budget)
    { name: "supporterContext", priority: 75, essential: true }, // Supporter recognition - always included if exists
    { name: "routineContext", priority: 70, essential: false, tierRequired: "plus" },
    { name: "livingAIContext", priority: 65, essential: false, tierRequired: "plus" },
    { name: "memoryContext", priority: 60, essential: false, tierRequired: "plus" },
    { name: "temporalReferencesContext", priority: 55, essential: false, tierRequired: "plus" },

    // OPTIONAL (included if budget remains)
    { name: "fatigueContext", priority: 40, essential: false },
    { name: "timeAwarenessContext", priority: 30, essential: false },
  ];

  // Create list of items with tokens
  const items: ContextItem[] = [];

  for (const { name, priority, essential, tierRequired } of contextPriorities) {
    const content = contexts[name];
    if (!content) continue;

    // Check tier requirement
    if (tierRequired) {
      const tierOrder = { free: 0, plus: 1, ultra: 2 };
      if (tierOrder[tier] < tierOrder[tierRequired]) {
        continue; // Skip this context for this tier
      }
    }

    items.push({
      name,
      content,
      priority,
      essential,
      tokens: estimateTokens(content),
    });
  }

  // Sort by priority
  items.sort((a, b) => b.priority - a.priority);

  // Select contexts based on budget
  const selected: ContextItem[] = [];
  const dropped: string[] = [];
  let totalTokens = 0;

  for (const item of items) {
    if (item.essential) {
      // Essential always included
      selected.push(item);
      totalTokens += item.tokens;
    } else {
      // Optional only if there's budget
      if (totalTokens + item.tokens <= config.contextTokenBudget) {
        selected.push(item);
        totalTokens += item.tokens;
      } else {
        dropped.push(item.name);
      }
    }
  }

  return {
    selectedContexts: selected.map((item) => item.content),
    droppedContexts: dropped,
    totalTokens,
  };
}

// ============================================================================
// MAIN BUILDER FUNCTION
// ============================================================================

/** Builds the optimized final prompt with full token management */
export async function buildOptimizedPrompt(
  agentId: string,
  userId: string | undefined,
  tier: UserTier,
  systemPrompt: string,
  dynamicContexts: Record<string, string>
): Promise<{
  finalPrompt: string;
  optimizedMessages: Array<{ role: string; content: string }>;
  stats: {
    totalTokens: number;
    systemTokens: number;
    contextTokens: number;
    factsTokens: number;
    summaryTokens: number;
    messagesTokens: number;
    percentageUsed: number;
    budget: number;
    remaining: number;
  };
  warnings: string[];
}> {
  const config = TIER_CONFIG[tier];
  const warnings: string[] = [];

  // 1. Get optimized messages with sliding window
  const {
    recentMessages,
    summary,
    semanticFacts,
    stats: messageStats,
  } = await getOptimizedMessages(agentId, userId, tier);

  // 2. Prioritize dynamic contexts
  const { selectedContexts, droppedContexts, totalTokens: contextTokens } =
    prioritizeContexts(tier, dynamicContexts);

  if (droppedContexts.length > 0) {
    warnings.push(`Contexts dropped due to token limit: ${droppedContexts.join(", ")}`);
  }

  // 3. Build final prompt
  let finalPrompt = systemPrompt;

  // Add semantic facts (persistent memory)
  if (semanticFacts) {
    finalPrompt += "\n" + semanticFacts;
  }

  // Add summary of old context
  if (summary) {
    finalPrompt += "\n**PREVIOUS CONVERSATION CONTEXT**\n" + summary + "\n";
  }

  // Add prioritized dynamic contexts
  if (selectedContexts.length > 0) {
    finalPrompt += "\n" + selectedContexts.join("\n");
  }

  // 4. Calculate final statistics
  const systemTokens = estimateTokens(systemPrompt);
  const totalTokens =
    systemTokens +
    messageStats.factsTokens +
    messageStats.summaryTokens +
    contextTokens +
    messageStats.messagesTokens;

  const percentageUsed = (totalTokens / 32000) * 100;
  const remaining = config.totalTokenBudget - totalTokens;

  // 5. Warning if we approach the limit
  if (percentageUsed > 80) {
    warnings.push(`⚠️ High token usage: ${percentageUsed.toFixed(1)}%`);
  }

  if (remaining < 1000) {
    warnings.push(`⚠️ Low budget remaining: ${remaining} tokens`);
  }

  return {
    finalPrompt,
    optimizedMessages: recentMessages,
    stats: {
      totalTokens,
      systemTokens,
      contextTokens,
      factsTokens: messageStats.factsTokens,
      summaryTokens: messageStats.summaryTokens,
      messagesTokens: messageStats.messagesTokens,
      percentageUsed,
      budget: config.totalTokenBudget,
      remaining,
    },
    warnings,
  };
}

// ============================================================================
// MAINTENANCE
// ============================================================================

/** Clean old summaries (run periodically) */
export async function cleanupOldSummaries(agentId?: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await prisma.conversationSummary.deleteMany({
    where: {
      ...(agentId ? { agentId } : {}),
      createdAt: { lt: thirtyDaysAgo },
    },
  });

  return result.count;
}
