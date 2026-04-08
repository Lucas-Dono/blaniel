/**
 * Sistema de logging centralizado usando Pino
 *
 * Características:
 * - Niveles: trace, debug, info, warn, error, fatal
 * - Desarrollo: pretty print con colores
 * - Producción: JSON estructurado
 * - Redacción automática de datos sensibles
 * - Child loggers por módulo/namespace
 */

import pino from 'pino';
import type { Logger } from 'pino';

// Configuración de redacción de datos sensibles
const redactPaths = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'secret',
  'accessToken',
  'refreshToken',
  'jwt',
  '*.password',
  '*.token',
  '*.apiKey',
  '*.api_key',
  '*.authorization',
  '*.secret',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

// Determinar entorno
const isDevelopment = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

// Configuración base de Pino
const pinoConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Redactar datos sensibles
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },

  // Serializers personalizados
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      // No incluir headers completos por seguridad
      userAgent: req.headers?.['user-agent'],
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },

  // Base para todos los logs
  base: {
    pid: process.pid,
    env: process.env.NODE_ENV || 'development',
  },

  // Timestamp
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Configuración de logger (transport disabled to avoid worker issues)
let logger: Logger;

if (isTest) {
  // In tests, use silent or minimum level
  logger = pino({
    ...pinoConfig,
    level: 'silent',
  });
} else {
  // Usar JSON estructurado en todos los entornos
  // (pino-pretty transport disabled to avoid worker thread issues)
  logger = pino(pinoConfig);
}

/**
 * Crea un child logger con namespace/módulo específico
 */
export function createLogger(module: string): Logger {
  return logger.child({ module });
}

/**
 * Logger por defecto para uso general
 */
export const defaultLogger = createLogger('app');

/**
 * Helper para logging de errores con contexto completo
 */
export function logError(
  logger: Logger,
  error: unknown,
  context: Record<string, unknown> = {}
): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  logger.error({
    err: errorObj,
    ...context,
    errorName: errorObj.name,
    errorMessage: errorObj.message,
    stack: errorObj.stack,
  }, 'Error occurred');
}

/**
 * Helper para timing de operaciones
 */
export function createTimer(logger: Logger, operation: string) {
  const start = Date.now();

  return {
    end: (metadata?: Record<string, unknown>) => {
      const duration = Date.now() - start;
      logger.info({
        operation,
        duration,
        ...metadata,
      }, `${operation} completed in ${duration}ms`);
    },

    fail: (error: unknown, metadata?: Record<string, unknown>) => {
      const duration = Date.now() - start;
      logError(logger, error, {
        operation,
        duration,
        ...metadata,
      });
    },
  };
}

/**
 * Helper para logging de requests HTTP
 */
export function logRequest(
  logger: Logger,
  method: string,
  url: string,
  metadata?: Record<string, unknown>
): void {
  logger.info({
    method,
    url,
    ...metadata,
  }, `${method} ${url}`);
}

/**
 * Helper para logging de responses HTTP
 */
export function logResponse(
  logger: Logger,
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  metadata?: Record<string, unknown>
): void {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  logger[level]({
    method,
    url,
    statusCode,
    duration,
    ...metadata,
  }, `${method} ${url} ${statusCode} ${duration}ms`);
}

/**
 * Helper para sanitizar objetos antes de loguear
 * (elimina campos sensibles que podrían no estar en redactPaths)
 */
export function sanitize<T extends Record<string, any>>(obj: T): T {
  const sensitiveKeys = [
    'password',
    'token',
    'apiKey',
    'api_key',
    'authorization',
    'secret',
    'accessToken',
    'refreshToken',
    'jwt',
    'cookie',
    'session',
  ];

  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Si la key contiene términos sensibles, redactar
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursivamente sanitizar objetos anidados
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

// Exportar logger por defecto y funciones principales
export { logger, Logger };
export default logger;
