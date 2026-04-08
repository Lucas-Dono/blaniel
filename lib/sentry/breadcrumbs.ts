/**
 * Automatic Breadcrumb Tracking for User Actions
 *
 * Provides utilities to automatically track user interactions and system events
 */

import { addBreadcrumb } from "./custom-error";

/**
 * Tracks a user navigation event
 */
export function trackNavigation(from: string, to: string) {
  addBreadcrumb(
    `Navigation: ${from} -> ${to}`,
    "navigation",
    {
      from,
      to,
    },
    "info"
  );
}

/**
 * Tracks a user interaction (click, input, etc.)
 */
export function trackInteraction(
  element: string,
  action: string,
  data?: Record<string, any>
) {
  addBreadcrumb(`User ${action}: ${element}`, "user", data, "info");
}

/**
 * Tracks an API call
 */
export function trackAPICall(
  method: string,
  endpoint: string,
  statusCode?: number,
  duration?: number
) {
  addBreadcrumb(
    `API ${method} ${endpoint}`,
    "http",
    {
      method,
      endpoint,
      statusCode,
      duration,
    },
    statusCode && statusCode >= 400 ? "warning" : "info"
  );
}

/**
 * Tracks a database operation
 */
export function trackDatabaseOperation(
  operation: string,
  model: string,
  duration?: number
) {
  addBreadcrumb(
    `DB ${operation} on ${model}`,
    "database",
    {
      operation,
      model,
      duration,
    },
    "info"
  );
}

/**
 * Tracks an AI/LLM operation
 */
export function trackAIOperation(
  provider: string,
  model: string,
  operation: string,
  duration?: number
) {
  addBreadcrumb(
    `AI ${operation} with ${provider}/${model}`,
    "ai",
    {
      provider,
      model,
      operation,
      duration,
    },
    "info"
  );
}

/**
 * Tracks a state change
 */
export function trackStateChange(
  component: string,
  from: any,
  to: any,
  reason?: string
) {
  addBreadcrumb(
    `State change in ${component}`,
    "state",
    {
      component,
      from: JSON.stringify(from),
      to: JSON.stringify(to),
      reason,
    },
    "debug"
  );
}

/**
 * Tracks a file operation
 */
export function trackFileOperation(
  operation: "upload" | "download" | "delete",
  filename: string,
  size?: number
) {
  addBreadcrumb(
    `File ${operation}: ${filename}`,
    "file",
    {
      operation,
      filename,
      size,
    },
    "info"
  );
}

/**
 * Tracks a world simulation event
 */
export function trackWorldEvent(
  worldId: string,
  eventType: string,
  data?: Record<string, any>
) {
  addBreadcrumb(
    `World event: ${eventType}`,
    "world",
    {
      worldId,
      eventType,
      ...data,
    },
    "info"
  );
}

/**
 * Tracks a chat message
 */
export function trackChatMessage(
  agentId: string,
  direction: "sent" | "received",
  messageLength: number
) {
  addBreadcrumb(
    `Chat message ${direction}`,
    "chat",
    {
      agentId,
      direction,
      messageLength,
    },
    "info"
  );
}

/**
 * Tracks an authentication event
 */
export function trackAuthEvent(
  event: "login" | "logout" | "signup" | "failed",
  userId?: string
) {
  addBreadcrumb(
    `Auth: ${event}`,
    "auth",
    {
      event,
      userId,
    },
    event === "failed" ? "warning" : "info"
  );
}

/**
 * Tracks a payment/billing event
 */
export function trackBillingEvent(
  event: string,
  amount?: number,
  currency?: string
) {
  addBreadcrumb(
    `Billing: ${event}`,
    "billing",
    {
      event,
      amount,
      currency,
    },
    "info"
  );
}
