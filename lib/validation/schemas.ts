/**
 * Zod Validation Schemas
 *
 * Centralized validation schemas for API endpoints
 */

import { z } from 'zod';

// ============================================
// MESSAGE SCHEMAS
// ============================================

export const messageInputSchema = z.object({
  content: z.string()
    .min(1, 'Content cannot be empty')
    .max(10000, 'Content too long (max 10,000 characters)'),
  messageType: z.enum(['text', 'audio', 'gif', 'image']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // userId is removed from schema - it should ALWAYS come from authenticated session, never from request body
});

export const audioUploadSchema = z.object({
  duration: z.number().positive().max(300, 'Audio too long (max 5 minutes)'),
});

// ============================================
// AGENT SCHEMAS
// ============================================

export const createAgentSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long'),
  kind: z.enum(['companion', 'assistant']),
  personality: z.string().max(500).optional(),
  purpose: z.string().max(500).optional(),
  tone: z.string().max(200).optional(),
  referenceImage: z.string().url().optional(),
  nsfwMode: z.boolean().default(false),
  allowDevelopTraumas: z.boolean().default(false),
  initialBehavior: z.enum([
    'none',
    'random_secret',
    'ANXIOUS_ATTACHMENT',
    'AVOIDANT_ATTACHMENT',
    'DISORGANIZED_ATTACHMENT',
    'YANDERE_OBSESSIVE',
    'BORDERLINE_PD',
    'NARCISSISTIC_PD',
    'CODEPENDENCY',
  ]).optional(),
});

export const updateAgentSchema = createAgentSchema.partial();

// ============================================
// BEHAVIOR SCHEMAS
// ============================================

export const behaviorConfigSchema = z.object({
  baseIntensity: z.number().min(0).max(1),
  volatility: z.number().min(0).max(1),
  escalationRate: z.number().min(0).max(1),
  deEscalationRate: z.number().min(0).max(1),
  thresholdForDisplay: z.number().min(0).max(1),
});

// ============================================
// PAGINATION SCHEMAS
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================
// SEARCH SCHEMAS
// ============================================

export const searchQuerySchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.coerce.number().int().positive().max(50).default(10),
  threshold: z.coerce.number().min(0).max(1).default(0.6),
});

// ============================================
// ID PARAMS SCHEMAS
// ============================================

export const idParamSchema = z.object({
  id: z.string().cuid('Invalid ID format'),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate data against schema and return typed result
 */
export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

/**
 * Safely validate data and return validation result
 */
export function safeValidate<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Format Zod errors for API responses
 */
export function formatZodError(error: z.ZodError): {
  message: string;
  errors: Array<{ field: string; message: string; code: string }>;
} {
  return {
    message: 'Validation failed',
    errors: error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };
}
