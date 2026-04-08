/**
 * Barrel export for logging system
 */

// Main logger and utilities
export {
  logger,
  defaultLogger,
  createLogger,
  logError,
  createTimer,
  logRequest,
  logResponse,
  sanitize,
  type Logger,
} from './logger';

// Module-specific loggers
export {
  apiLogger,
  llmLogger,
  dbLogger,
  authLogger,
  emotionalLogger,
  memoryLogger,
  socketLogger,
  voiceLogger,
  visualLogger,
  behaviorLogger,
  notificationLogger,
  billingLogger,
  recommendationLogger,
  worldLogger,
  middlewareLogger,
  cronLogger,
  metricsLogger,
} from './loggers';

// Request context tracking
export {
  generateRequestId,
  getRequestContext,
  getRequestId,
  getUserId,
  runInContext,
  runInContextAsync,
  updateContext,
  createContextLogger,
  withRequestContext,
  extractUserIdFromHeaders,
  getRequestDuration,
} from './request-context';
