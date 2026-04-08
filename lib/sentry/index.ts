/**
 * Sentry Integration - Main Export
 *
 * Central export point for all Sentry utilities
 */

// Error tracking
export {
  captureCustomError,
  captureAPIError,
  captureDatabaseError,
  captureAIError,
  setUserContext,
  clearUserContext,
  captureMessage,
  addBreadcrumb,
  startPerformanceTransaction,
  measurePerformance,
} from "./custom-error";

// Breadcrumbs
export {
  trackNavigation,
  trackInteraction,
  trackAPICall,
  trackDatabaseOperation,
  trackAIOperation,
  trackStateChange,
  trackFileOperation,
  trackWorldEvent,
  trackChatMessage,
  trackAuthEvent,
  trackBillingEvent,
} from "./breadcrumbs";

// API Middleware
export {
  withSentryMonitoring,
  withDatabaseMonitoring,
  withAIMonitoring,
} from "./api-middleware";

// Types
export type { ErrorContext, PerformanceContext } from "./custom-error";
export type { APIHandler, APIHandlerContext } from "./api-middleware";
