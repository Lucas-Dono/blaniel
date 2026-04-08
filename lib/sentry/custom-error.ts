/**
 * Custom Sentry Error Tracking Utilities
 *
 * Provides enhanced error tracking with custom context and categorization
 */

import * as Sentry from "@sentry/nextjs";
import type { SeverityLevel } from "@sentry/nextjs";

export interface ErrorContext {
  // User context
  userId?: string;
  userEmail?: string;
  userName?: string;

  // Operation context
  operation?: string;
  feature?: string;
  module?: string;

  // Additional context
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
}

export interface PerformanceContext {
  operation?: string;
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
}

/**
 * Captures a custom error with enriched context
 */
export function captureCustomError(
  error: Error,
  context?: ErrorContext,
  level: SeverityLevel = "error"
) {
  Sentry.withScope((scope) => {
    scope.setLevel(level);

    // Set user context if provided
    if (context?.userId || context?.userEmail || context?.userName) {
      scope.setUser({
        id: context.userId,
        email: context.userEmail,
        username: context.userName,
      });
    }

    // Set tags for filtering
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    // Set module/feature tags
    if (context?.feature) {
      scope.setTag("feature", context.feature);
    }
    if (context?.module) {
      scope.setTag("module", context.module);
    }
    if (context?.operation) {
      scope.setTag("operation", context.operation);
    }

    // Set custom context
    if (context?.metadata) {
      scope.setContext("custom", context.metadata);
    }

    Sentry.captureException(error);
  });
}

/**
 * Captures an API error with request/response context
 */
export function captureAPIError(
  error: Error,
  context: {
    endpoint: string;
    method: string;
    statusCode?: number;
    requestBody?: any;
    responseBody?: any;
    userId?: string;
  }
) {
  Sentry.withScope((scope) => {
    scope.setLevel("error");
    scope.setTag("error_type", "api_error");
    scope.setTag("endpoint", context.endpoint);
    scope.setTag("method", context.method);

    if (context.statusCode) {
      scope.setTag("status_code", context.statusCode.toString());
    }

    if (context.userId) {
      scope.setUser({ id: context.userId });
    }

    // Add request/response context (scrubbed)
    scope.setContext("api", {
      endpoint: context.endpoint,
      method: context.method,
      statusCode: context.statusCode,
      // Only include if error is 5xx (server error)
      requestBody:
        context.statusCode && context.statusCode >= 500
          ? scrubSensitiveData(context.requestBody)
          : undefined,
      responseBody:
        context.statusCode && context.statusCode >= 500
          ? scrubSensitiveData(context.responseBody)
          : undefined,
    });

    Sentry.captureException(error);
  });
}

/**
 * Captures a database error with query context
 */
export function captureDatabaseError(
  error: Error,
  context: {
    operation: string;
    model?: string;
    query?: string;
    userId?: string;
  }
) {
  Sentry.withScope((scope) => {
    scope.setLevel("error");
    scope.setTag("error_type", "database_error");
    scope.setTag("db_operation", context.operation);

    if (context.model) {
      scope.setTag("db_model", context.model);
    }

    if (context.userId) {
      scope.setUser({ id: context.userId });
    }

    scope.setContext("database", {
      operation: context.operation,
      model: context.model,
      // Only include query for debugging, without sensitive data
      query: context.query ? sanitizeQuery(context.query) : undefined,
    });

    Sentry.captureException(error);
  });
}

/**
 * Captures an LLM/AI error with provider context
 */
export function captureAIError(
  error: Error,
  context: {
    provider: string;
    model: string;
    operation: string;
    promptLength?: number;
    responseLength?: number;
    userId?: string;
    worldId?: string;
    agentId?: string;
  }
) {
  Sentry.withScope((scope) => {
    scope.setLevel("error");
    scope.setTag("error_type", "ai_error");
    scope.setTag("ai_provider", context.provider);
    scope.setTag("ai_model", context.model);
    scope.setTag("ai_operation", context.operation);

    if (context.userId) {
      scope.setUser({ id: context.userId });
    }

    scope.setContext("ai", {
      provider: context.provider,
      model: context.model,
      operation: context.operation,
      promptLength: context.promptLength,
      responseLength: context.responseLength,
      worldId: context.worldId,
      agentId: context.agentId,
    });

    Sentry.captureException(error);
  });
}

/**
 * Starts a performance transaction
 */
export function startPerformanceTransaction(
  name: string,
  op: string,
  context?: PerformanceContext
) {
  return Sentry.startSpan(
    {
      name,
      op,
      attributes: {
        ...context?.tags,
        ...context?.metadata,
      },
    },
    (span) => span
  );
}

/**
 * Measures async operation performance
 */
export async function measurePerformance<T>(
  name: string,
  op: string,
  fn: () => Promise<T>,
  context?: PerformanceContext
): Promise<T> {
  return await Sentry.startSpan(
    {
      name,
      op,
      attributes: {
        ...context?.tags,
        ...context?.metadata,
      },
    },
    async () => {
      try {
        return await fn();
      } catch (error) {
        throw error;
      }
    }
  );
}

/**
 * Adds a breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>,
  level: SeverityLevel = "info"
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data: data ? scrubSensitiveData(data) : undefined,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Scrubs sensitive data from objects
 */
function scrubSensitiveData(data: any): any {
  if (!data) return data;

  const sensitiveKeys = [
    "password",
    "token",
    "apiKey",
    "api_key",
    "secret",
    "authorization",
    "cookie",
    "session",
  ];

  if (typeof data === "object") {
    const scrubbed = { ...data };

    for (const key of Object.keys(scrubbed)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        scrubbed[key] = "[REDACTED]";
      } else if (typeof scrubbed[key] === "object") {
        scrubbed[key] = scrubSensitiveData(scrubbed[key]);
      }
    }

    return scrubbed;
  }

  return data;
}

/**
 * Sanitizes SQL/database queries
 */
function sanitizeQuery(query: string): string {
  // Remove potential sensitive data from queries
  return query
    .replace(/password\s*=\s*'[^']*'/gi, "password='[REDACTED]'")
    .replace(/token\s*=\s*'[^']*'/gi, "token='[REDACTED]'")
    .replace(/api_key\s*=\s*'[^']*'/gi, "api_key='[REDACTED]'");
}

/**
 * Sets user context globally
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  username?: string;
  [key: string]: any;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

/**
 * Clears user context (on logout)
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Captures a message (non-error event)
 */
export function captureMessage(
  message: string,
  level: SeverityLevel = "info",
  context?: ErrorContext
) {
  Sentry.withScope((scope) => {
    scope.setLevel(level);

    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context?.metadata) {
      scope.setContext("custom", context.metadata);
    }

    Sentry.captureMessage(message);
  });
}
