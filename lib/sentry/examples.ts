/**
 * Sentry Integration Examples
 *
 * Practical examples of how to use Sentry in different scenarios
 */

import {
  captureCustomError,
  captureAPIError,
  captureDatabaseError,
  captureAIError,
  measurePerformance,
} from "./custom-error";
import {
  trackNavigation,
  trackInteraction,
  trackAPICall,
  trackDatabaseOperation,
  trackAIOperation,
  trackChatMessage,
} from "./breadcrumbs";
import { withSentryMonitoring } from "./api-middleware";
import { NextRequest, NextResponse } from "next/server";

/**
 * Example 1: API Route with automatic monitoring
 */
export const GET_WorldsExample = withSentryMonitoring(
  async (_request: NextRequest) => {
    try {
      // Your API logic here
      const worlds: any[] = [];

      return NextResponse.json({ worlds });
    } catch {
      // Error is automatically captured by the middleware
      return NextResponse.json({ error: "Failed to fetch worlds" }, { status: 500 });
    }
  },
  {
    operationName: "GET /api/worlds",
    trackPerformance: true,
    trackErrors: true,
  }
);

/**
 * Example 2: Database operation with error tracking
 */
export async function findUserWithErrorTracking(userId: string) {
  try {
    // Track breadcrumb
      trackDatabaseOperation("findUnique", "User");

      const user = null;

      return user;
  } catch (error) {
    if (error instanceof Error) {
      // Capture database error with context
      captureDatabaseError(error, {
        operation: "findUnique",
        model: "User",
        userId,
      });
    }
    throw error;
  }
}

/**
 * Example 3: AI/LLM operation with performance monitoring
 */
export async function generateAIResponseWithMonitoring(
  prompt: string,
  userId: string
) {
  const startTime = Date.now();

  try {
    // Measure performance
    const response = await measurePerformance(
      "AI Generation",
      "ai.inference",
      async () => {
        // Track AI operation breadcrumb
        trackAIOperation("openrouter", "meta-llama/llama-3.2-11b-vision", "chat");

        const result = { content: "AI response" };

        return result;
      },
      {
        tags: {
          provider: "openrouter",
          model: "meta-llama/llama-3.2-11b-vision",
        },
        metadata: {
          promptLength: prompt.length,
          userId,
        },
      }
    );

    // Track success
    const duration = Date.now() - startTime;
    trackAIOperation("openrouter", "meta-llama/llama-3.2-11b-vision", "chat", duration);

    return response;
  } catch (error) {
    if (error instanceof Error) {
      // Capture AI error with context
      captureAIError(error, {
        provider: "openrouter",
        model: "meta-llama/llama-3.2-11b-vision",
        operation: "chat",
        promptLength: prompt.length,
        userId,
      });
    }
    throw error;
  }
}

/**
 * Example 4: World simulation with comprehensive tracking
 */
export async function simulateWorldWithTracking(
  worldId: string,
  userId: string
) {
  try {
    // Start performance monitoring
    const result = await measurePerformance(
      "World Simulation",
      "world.simulate",
      async () => {
        // Track database operations
        trackDatabaseOperation("findUnique", "World");

        trackAIOperation("openrouter", "meta-llama/llama-3.2-11b-vision", "simulation");

        trackDatabaseOperation("update", "World");

        return { success: true };
      },
      {
        tags: {
          worldId,
          userId,
        },
      }
    );

    return result;
  } catch (error) {
    if (error instanceof Error) {
      // Capture error with full context
      captureCustomError(
        error,
        {
          operation: "worldSimulation",
          feature: "worlds",
          module: "simulation",
          userId,
          metadata: {
            worldId,
          },
          tags: {
            error_type: "simulation_error",
            world_id: worldId,
          },
        },
        "error"
      );
    }
    throw error;
  }
}

/**
 * Example 5: Chat message with tracking
 */
export async function sendChatMessageWithTracking(
  agentId: string,
  message: string,
  userId: string
) {
  try {
    // Track user interaction
    trackInteraction("chat-input", "send", {
      agentId,
      messageLength: message.length,
    });

    // Track chat message breadcrumb
    trackChatMessage(agentId, "sent", message.length);

    trackChatMessage(agentId, "received", 100);

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      captureCustomError(error, {
        operation: "sendChatMessage",
        feature: "chat",
        userId,
        metadata: {
          agentId,
          messageLength: message.length,
        },
      });
    }
    throw error;
  }
}

/**
 * Example 6: React component with error boundary
 */
export function ComponentErrorExample() {
  try {
    // Component logic that might fail
    throw new Error("Component rendering failed");
  } catch (error) {
    if (error instanceof Error) {
      captureCustomError(error, {
        feature: "ui",
        module: "components",
        operation: "render",
        tags: {
          component: "ExampleComponent",
        },
      });
    }
  }
}

/**
 * Example 7: Client-side navigation tracking
 */
export function trackPageNavigation(from: string, to: string) {
  trackNavigation(from, to);
}

/**
 * Example 8: API error handling
 */
export async function apiCallWithErrorHandling(endpoint: string) {
  const startTime = Date.now();

  try {
    const response = await fetch(endpoint);
    const duration = Date.now() - startTime;

    // Track API call
    trackAPICall("GET", endpoint, response.status, duration);

    if (!response.ok) {
      throw new Error(`API call failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof Error) {
      captureAPIError(error, {
        endpoint,
        method: "GET",
        statusCode: 500,
      });

      trackAPICall("GET", endpoint, 500, duration);
    }

    throw error;
  }
}

/**
 * Example 9: Performance-critical operation
 */
export async function performanceCriticalOperation() {
  const startTime = Date.now();

  try {
    // Some expensive operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    const duration = Date.now() - startTime;

    // Log if operation is too slow
    if (duration > 1000) {
      captureCustomError(
        new Error("Performance degradation detected"),
        {
          operation: "criticalOperation",
          metadata: {
            duration,
            threshold: 1000,
          },
          tags: {
            performance: "slow",
          },
        },
        "warning"
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      captureCustomError(error, {
        operation: "criticalOperation",
        tags: {
          critical: "true",
        },
      });
    }
    throw error;
  }
}
