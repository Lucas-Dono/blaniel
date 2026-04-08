/**
 * ROUTINE MIDDLEWARE
 *
 * Integrates routine system with messaging/chat
 * Injects routine context into system prompts and modifies response behavior
 */

import { generateRoutineContext } from "./routine-simulator";
import type { RoutineContext } from "@/types/routine";

// ============================================
// PROMPT INJECTION
// ============================================

/**
 * Injects routine context into system prompt
 *
 * @param basePrompt - The original system prompt
 * @param agentId - ID of the agent
 * @returns Modified prompt with routine context
 */
export async function injectRoutineContext(
  basePrompt: string,
  agentId: string
): Promise<string> {
  try {
    const routineContext = await generateRoutineContext(agentId);

    if (!routineContext.promptContext) {
      // No routine or routine disabled
      return basePrompt;
    }

    // Inject routine context into the prompt
    const enhancedPrompt = `${basePrompt}

---

# CURRENT ROUTINE STATE

${routineContext.promptContext}

---

Remember to incorporate your current activity and state into your responses naturally. Your availability, energy level, and focus may be affected by what you're currently doing.`;

    return enhancedPrompt;
  } catch (error) {
    console.error("[RoutineMiddleware] Error injecting routine context:", error);
    // Fail gracefully - return original prompt
    return basePrompt;
  }
}

/**
 * Get routine context for an agent (without prompt injection)
 *
 * Useful for getting current state info for UI or analytics
 */
export async function getRoutineContextForAgent(
  agentId: string
): Promise<RoutineContext | null> {
  try {
    const context = await generateRoutineContext(agentId);
    return context;
  } catch (error) {
    console.error("[RoutineMiddleware] Error getting routine context:", error);
    return null;
  }
}

// ============================================
// RESPONSE BEHAVIOR MODIFICATION
// ============================================

/**
 * Check if agent can respond based on routine
 *
 * In immersive mode, agent may be unavailable (e.g., sleeping)
 *
 * @param agentId - ID of the agent
 * @returns Object with availability status and reason
 */
export async function checkAgentAvailability(agentId: string): Promise<{
  available: boolean;
  reason?: string;
  currentActivity?: string;
  expectedAvailableAt?: string;
}> {
  try {
    const context = await generateRoutineContext(agentId);

    if (!context.currentActivity) {
      return { available: true };
    }

    const { currentActivity, responseModification } = context;

    // Check if can respond
    const canRespond = currentActivity?.canRespond ?? true;

    if (!canRespond) {
      return {
        available: false,
        reason: `Currently ${currentActivity.name.toLowerCase()}`,
        currentActivity: currentActivity.name,
        expectedAvailableAt: currentActivity.expectedEnd,
      };
    }

    return {
      available: true,
      currentActivity: currentActivity.name,
    };
  } catch (error) {
    console.error("[RoutineMiddleware] Error checking availability:", error);
    // Fail gracefully - assume available
    return { available: true };
  }
}

/**
 * Get simulated delay for response based on activity
 *
 * In realistic modes, responses may be delayed based on what character is doing
 *
 * @param agentId - ID of the agent
 * @returns Delay in milliseconds
 */
export async function getResponseDelay(agentId: string): Promise<number> {
  try {
    const context = await generateRoutineContext(agentId);

    if (!context.responseModification?.delaySeconds) {
      return 0; // No delay
    }

    const delaySeconds = context.responseModification.delaySeconds;
    return delaySeconds * 1000; // Convert to ms
  } catch (error) {
    console.error("[RoutineMiddleware] Error getting response delay:", error);
    return 0;
  }
}

/**
 * Should show typing indicator based on routine?
 *
 * @param agentId - ID of the agent
 * @returns Whether to show typing indicator
 */
export async function shouldShowTyping(agentId: string): Promise<boolean> {
  try {
    const context = await generateRoutineContext(agentId);

    if (!context.responseModification) {
      return true; // Default: show typing
    }

    return context.responseModification.showTyping ?? true;
  } catch (error) {
    console.error("[RoutineMiddleware] Error checking typing indicator:", error);
    return true;
  }
}

/**
 * Can agent initiate conversation based on routine?
 *
 * @param agentId - ID of the agent
 * @returns Whether agent can initiate
 */
export async function canAgentInitiate(agentId: string): Promise<boolean> {
  try {
    const context = await generateRoutineContext(agentId);

    if (!context.responseModification) {
      return true; // Default: can initiate
    }

    return context.responseModification.canInitiate ?? true;
  } catch (error) {
    console.error("[RoutineMiddleware] Error checking initiation ability:", error);
    return true;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get activity summary for display
 *
 * @param agentId - ID of the agent
 * @returns Human-readable activity summary
 */
export async function getActivitySummary(agentId: string): Promise<string | null> {
  try {
    const context = await generateRoutineContext(agentId);

    if (!context.currentActivity) {
      return null;
    }

    const { currentActivity, nextActivity } = context;

    let summary = `Currently: ${currentActivity.name}`;

    if (currentActivity.location) {
      summary += ` at ${currentActivity.location}`;
    }

    if (nextActivity) {
      const nextTime = new Date(nextActivity.scheduledStart);
      const hours = nextTime.getHours();
      const minutes = nextTime.getMinutes();
      summary += ` | Next: ${nextActivity.name} at ${hours}:${minutes.toString().padStart(2, "0")}`;
    }

    return summary;
  } catch (error) {
    console.error("[RoutineMiddleware] Error getting activity summary:", error);
    return null;
  }
}

/**
 * Mark instance as having user interaction
 *
 * This affects future simulations and statistics
 *
 * @param agentId - ID of the agent
 */
export async function markUserInteraction(agentId: string): Promise<void> {
  try {
    const context = await generateRoutineContext(agentId);

    if (!context.currentActivity) {
      return;
    }

    // Update instance to mark user interaction
    const { prisma } = await import("@/lib/prisma");

    await prisma.routineInstance.update({
      where: { id: context.currentActivity.instanceId },
      data: { userInteractedDuring: true },
    });
  } catch (error) {
    console.error("[RoutineMiddleware] Error marking user interaction:", error);
    // Non-critical, fail silently
  }
}

// ============================================
// INTEGRATION HELPERS
// ============================================

/**
 * Complete middleware: inject context and get behavior modifications
 *
 * This is the main function to use in chat routes
 *
 * @param basePrompt - Original system prompt
 * @param agentId - ID of the agent
 * @returns Enhanced prompt and behavior modifications
 */
export async function applyRoutineMiddleware(
  basePrompt: string,
  agentId: string
): Promise<{
  enhancedPrompt: string;
  availability: Awaited<ReturnType<typeof checkAgentAvailability>>;
  responseDelay: number;
  shouldShowTyping: boolean;
  activitySummary: string | null;
}> {
  // Run all operations in parallel for performance
  const [enhancedPrompt, availability, responseDelay, showTyping, activitySummary] =
    await Promise.all([
      injectRoutineContext(basePrompt, agentId),
      checkAgentAvailability(agentId),
      getResponseDelay(agentId),
      shouldShowTyping(agentId),
      getActivitySummary(agentId),
    ]);

  // Mark interaction (fire and forget)
  markUserInteraction(agentId).catch(() => {});

  return {
    enhancedPrompt,
    availability,
    responseDelay,
    shouldShowTyping: showTyping,
    activitySummary,
  };
}

/**
 * Simple version: just inject routine context
 *
 * Use this if you only need prompt enhancement without behavior modifications
 */
export { injectRoutineContext as enhancePromptWithRoutine };
