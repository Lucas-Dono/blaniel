/**
 * Request context tracking
 * 
 * Allows keeping a unique requestId across the entire execution chain
 * without needing to pass the ID manually in every function
 * 
 * Compatible with Edge Runtime (uses Web Crypto API instead of Node.js crypto)
 */

import type { Logger } from 'pino';

interface RequestContext {
  requestId: string;
  userId?: string;
  agentId?: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

// Storage para el contexto de request
// Solo se inicializa en Node.js runtime (no en Edge)
let asyncLocalStorage: any = null;

// Inicializar AsyncLocalStorage solo si estamos en Node.js runtime
if (typeof process !== 'undefined' && process.versions?.node) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AsyncLocalStorage } = require('async_hooks');
    asyncLocalStorage = new AsyncLocalStorage();
  } catch {
    // Edge runtime - AsyncLocalStorage no disponible
    console.warn('[RequestContext] AsyncLocalStorage not available (Edge Runtime)');
  }
}

/**
 * Generates a new unique request ID
 * Compatible with Edge Runtime (uses Web Crypto API)
 */
export function generateRequestId(): string {
  // Use Web Crypto API which is available in both Node.js and Edge Runtime
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for very old environments (should not be necessary)
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Obtiene el contexto actual del request
 */
export function getRequestContext(): RequestContext | undefined {
  if (!asyncLocalStorage) return undefined;
  return asyncLocalStorage.getStore();
}

/**
 * Obtiene el request ID actual
 */
export function getRequestId(): string | undefined {
  return getRequestContext()?.requestId;
}

/**
 * Obtiene el user ID del contexto actual
 */
export function getUserId(): string | undefined {
  return getRequestContext()?.userId;
}

/** Executes a function within a request context */
export function runInContext<T>(
  context: Partial<RequestContext>,
  fn: () => T
): T {
  const fullContext: RequestContext = {
    requestId: context.requestId || generateRequestId(),
    userId: context.userId,
    agentId: context.agentId,
    startTime: context.startTime || Date.now(),
    metadata: context.metadata,
  };

  // Si no hay asyncLocalStorage (Edge Runtime), ejecutar sin contexto
  if (!asyncLocalStorage) {
    return fn();
  }

  return asyncLocalStorage.run(fullContext, fn);
}

/** Executes an async function within a request context */
export async function runInContextAsync<T>(
  context: Partial<RequestContext>,
  fn: () => Promise<T>
): Promise<T> {
  const fullContext: RequestContext = {
    requestId: context.requestId || generateRequestId(),
    userId: context.userId,
    agentId: context.agentId,
    startTime: context.startTime || Date.now(),
    metadata: context.metadata,
  };

  // Si no hay asyncLocalStorage (Edge Runtime), ejecutar sin contexto
  if (!asyncLocalStorage) {
    return fn();
  }

  return asyncLocalStorage.run(fullContext, fn);
}

/** Updates the current context with new data */
export function updateContext(updates: Partial<RequestContext>): void {
  if (!asyncLocalStorage) return;

  const current = getRequestContext();
  if (current) {
    Object.assign(current, updates);
  }
}

/** Creates a child logger that automatically includes the requestId */
export function createContextLogger(baseLogger: Logger): Logger {
  // Si no hay asyncLocalStorage (Edge Runtime), retornar logger base
  if (!asyncLocalStorage) {
    return baseLogger;
  }

  const context = getRequestContext();

  if (!context) {
    return baseLogger;
  }

  return baseLogger.child({
    requestId: context.requestId,
    userId: context.userId,
    agentId: context.agentId,
  });
}

/**
 * Middleware helper for Next.js API routes
 *
 * Usage:
 * ```typescript
 * export async function POST(request: Request) {
 *   return withRequestContext(async () => {
 *     // Your code here
 *     // The requestId will be automatically available in logs
 *   });
 * }
 * ```
 */
export async function withRequestContext<T>(
  fn: () => Promise<T>,
  context?: Partial<RequestContext>
): Promise<T> {
  // Si no hay asyncLocalStorage (Edge Runtime), ejecutar directamente
  if (!asyncLocalStorage) {
    return fn();
  }

  return runInContextAsync(
    {
      requestId: generateRequestId(),
      startTime: Date.now(),
      ...context,
    },
    fn
  );
}

/**
 * Helper to extract user ID from authentication headers
 * (Can be integrated with your auth system)
 */
export function extractUserIdFromHeaders(_headers: Headers): string | undefined {
  // Implement according to your auth system
  // For example, decode JWT from the Authorization header
  return undefined;
}

/** Gets the duration of the current request in ms */
export function getRequestDuration(): number {
  const context = getRequestContext();
  if (!context) {
    return 0;
  }

  return Date.now() - context.startTime;
}
