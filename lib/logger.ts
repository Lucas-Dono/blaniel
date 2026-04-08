/**
 * Structured Logger with Pino
 *
 * Features:
 * - Automatic redaction of sensitive data (userId, email, apiKey)
 * - Different log levels (debug, info, warn, error)
 * - Pretty printing in development
 * - JSON structured logs in production
 * - Performance optimized
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: isDevelopment ? 'debug' : 'info',

  // Pretty print disabled to avoid worker thread issues in Next.js
  // transport: isDevelopment ? {
  //   target: 'pino-pretty',
  //   options: {
  //     colorize: true,
  //     translateTime: 'HH:MM:ss',
  //     ignore: 'pid,hostname',
  //   }
  // } : undefined,

  // Redact sensitive information
  redact: {
    paths: [
      'userId',
      'email',
      'apiKey',
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GEMINI_API_KEY',
      'MERCADOPAGO_ACCESS_TOKEN',
    ],
    censor: '[REDACTED]',
  },

  // Base fields for all logs
  base: {
    env: process.env.NODE_ENV,
  },
});

/**
 * Create a child logger with context
 *
 * @example
 * const log = createLogger('API', { agentId: '123' });
 * log.info('Processing message');
 * // Output: [API] Processing message { agentId: '123' }
 */
export function createLogger(module: string, context?: Record<string, unknown>) {
  return logger.child({ module, ...context });
}

/**
 * Performance timing helper
 *
 * @example
 * const timer = startTimer();
 * await someOperation();
 * logger.info({ duration: timer() }, 'Operation completed');
 */
export function startTimer() {
  const start = Date.now();
  return () => Date.now() - start;
}

/**
 * Log with automatic error serialization
 */
export function logError(error: unknown, context?: Record<string, unknown>) {
  if (error instanceof Error) {
    logger.error({
      ...context,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    }, error.message);
  } else {
    logger.error({ ...context, error }, 'Unknown error');
  }
}
