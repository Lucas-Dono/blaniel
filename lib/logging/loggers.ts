/**
 * Loggers específicos por módulo/dominio
 *
 * Cada logger tiene un namespace que facilita el filtrado y búsqueda de logs
 */

import { createLogger } from './logger';

/**
 * Logger para API routes y endpoints HTTP
 */
export const apiLogger = createLogger('api');

/**
 * Logger para llamadas a LLM providers (OpenRouter, Venice, etc)
 */
export const llmLogger = createLogger('llm');

/**
 * Logger para operaciones de base de datos y Prisma
 */
export const dbLogger = createLogger('db');

/**
 * Logger para autenticación y autorización
 */
export const authLogger = createLogger('auth');

/**
 * Logger para el sistema emocional y OCC
 */
export const emotionalLogger = createLogger('emotional');

/**
 * Logger para el sistema de memoria y embeddings
 */
export const memoryLogger = createLogger('memory');

/**
 * Logger para WebSockets y eventos en tiempo real
 */
export const socketLogger = createLogger('socket');

/**
 * Logger para el sistema de voice (TTS/STT)
 */
export const voiceLogger = createLogger('voice');

/**
 * Logger para generación visual (imágenes, avatares)
 */
export const visualLogger = createLogger('visual');

/**
 * Logger para sistema de comportamientos
 */
export const behaviorLogger = createLogger('behavior');

/**
 * Logger para sistema de notificaciones
 */
export const notificationLogger = createLogger('notification');

/**
 * Logger para billing y pagos (MercadoPago, Stripe)
 */
export const billingLogger = createLogger('billing');

/**
 * Logger para sistema de recomendaciones
 */
export const recommendationLogger = createLogger('recommendation');

/**
 * Logger para worlds/mundos
 */
export const worldLogger = createLogger('world');

/**
 * Logger para middleware
 */
export const middlewareLogger = createLogger('middleware');

/**
 * Logger para cron jobs y tareas programadas
 */
export const cronLogger = createLogger('cron');

/**
 * Logger para métricas y analytics
 */
export const metricsLogger = createLogger('metrics');

/**
 * Logger para sistema de emails (SMTP, envío, secuencias)
 */
export const emailLogger = createLogger('email');
