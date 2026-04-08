/**
 * API Validation Schemas
 *
 * Zod schemas for validating API request bodies, query parameters, and responses.
 * Use these schemas to ensure type safety across API boundaries.
 */

import { z } from 'zod';

// ============================================
// AGENT SCHEMAS
// ============================================

export const createAgentBodySchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long (max 100 characters)'),
  kind: z.enum(['companion', 'assistant'], {
    message: 'Kind must be either "companion" or "assistant"',
  }),
  personality: z.string()
    .max(500, 'Personality too long (max 500 characters)')
    .optional(),
  purpose: z.string()
    .max(500, 'Purpose too long (max 500 characters)')
    .optional(),
  tone: z.string()
    .max(200, 'Tone too long (max 200 characters)')
    .optional(),
  avatar: z.string()
    .url('Avatar must be a valid URL')
    .optional(),
  referenceImage: z.string()
    .url('Reference image must be a valid URL')
    .optional(),
  nsfwMode: z.boolean()
    .default(false),
  allowDevelopTraumas: z.boolean()
    .default(false),
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

export const updateAgentBodySchema = z.object({
  name: z.string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name too long (max 100 characters)')
    .optional(),
  personality: z.string()
    .max(500, 'Personality too long (max 500 characters)')
    .optional(),
  purpose: z.string()
    .max(500, 'Purpose too long (max 500 characters)')
    .optional(),
  tone: z.string()
    .max(200, 'Tone too long (max 200 characters)')
    .optional(),
  description: z.string()
    .max(1000, 'Description too long (max 1000 characters)')
    .optional(),
  avatar: z.string()
    .url('Avatar must be a valid URL')
    .optional(),
  visibility: z.enum(['private', 'public', 'world', 'team'])
    .optional(),
  nsfwMode: z.boolean()
    .optional(),
});

export const agentQuerySchema = z.object({
  kind: z.enum(['companion', 'assistant'])
    .optional(),
  visibility: z.enum(['private', 'public', 'world', 'team'])
    .optional(),
  featured: z.coerce.boolean()
    .optional(),
  userId: z.string()
    .cuid('Invalid user ID format')
    .optional(),
});

// ============================================
// MESSAGE SCHEMAS
// ============================================

export const sendMessageBodySchema = z.object({
  content: z.string()
    .min(1, 'Content cannot be empty')
    .max(10000, 'Content too long (max 10,000 characters)'),
  messageType: z.enum(['text', 'audio', 'gif', 'image'])
    .default('text')
    .optional(),
  metadata: z.record(z.string(), z.unknown())
    .optional(),
  userId: z.string()
    .cuid('Invalid user ID format')
    .optional(),
});

export const messageMetadataSchema = z.object({
  multimedia: z.array(z.object({
    type: z.enum(['image', 'audio', 'gif']),
    url: z.string().url(),
    description: z.string().optional(),
    duration: z.number().positive().optional(),
    prompt: z.string().optional(),
  })).optional(),
  emotions: z.object({
    dominant: z.array(z.string()),
    secondary: z.array(z.string()).optional(),
    mood: z.string(),
    pad: z.object({
      valence: z.number().min(0).max(1),
      arousal: z.number().min(0).max(1),
      dominance: z.number().min(0).max(1),
    }),
    visible: z.array(z.string()).optional(),
  }).optional(),
  relationLevel: z.string().optional(),
  tokensUsed: z.number().int().positive().optional(),
  behaviors: z.object({
    active: z.array(z.string()),
    phase: z.number().int().positive().optional(),
    safetyLevel: z.string(),
    triggers: z.array(z.string()),
  }).optional(),
  messageType: z.enum(['text', 'audio', 'gif', 'image']).optional(),
  gifDescription: z.string().optional(),
  audioDuration: z.number().positive().optional(),
  agentName: z.string().optional(),
  userMessage: z.string().optional(),
});

// ============================================
// WORLD SCHEMAS
// ============================================

export const createWorldBodySchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long (max 100 characters)'),
  description: z.string()
    .max(1000, 'Description too long (max 1000 characters)')
    .optional(),
  worldType: z.enum(['visual_novel', 'simulation', 'group_chat'])
    .default('group_chat'),
  agentIds: z.array(z.string().cuid('Invalid agent ID format'))
    .min(1, 'At least one agent is required')
    .max(10, 'Maximum 10 agents per world'),
  visibility: z.enum(['private', 'public'])
    .default('private'),
});

export const updateWorldBodySchema = z.object({
  name: z.string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name too long (max 100 characters)')
    .optional(),
  description: z.string()
    .max(1000, 'Description too long (max 1000 characters)')
    .optional(),
  visibility: z.enum(['private', 'public'])
    .optional(),
});

export const worldMessageBodySchema = z.object({
  content: z.string()
    .min(1, 'Content cannot be empty')
    .max(5000, 'Content too long (max 5,000 characters)'),
  userId: z.string()
    .cuid('Invalid user ID format')
    .default('default-user')
    .optional(),
});

// ============================================
// PAGINATION SCHEMAS
// ============================================

export const paginationQuerySchema = z.object({
  page: z.coerce.number()
    .int('Page must be an integer')
    .positive('Page must be positive')
    .default(1),
  limit: z.coerce.number()
    .int('Limit must be an integer')
    .positive('Limit must be positive')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
  sortBy: z.string()
    .max(50)
    .optional(),
  sortOrder: z.enum(['asc', 'desc'])
    .default('desc'),
});

// ============================================
// SEARCH SCHEMAS
// ============================================

export const searchQuerySchema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .max(500, 'Query too long (max 500 characters)'),
  limit: z.coerce.number()
    .int()
    .positive()
    .max(50, 'Limit cannot exceed 50')
    .default(10),
  threshold: z.coerce.number()
    .min(0, 'Threshold must be between 0 and 1')
    .max(1, 'Threshold must be between 0 and 1')
    .default(0.6),
  agentId: z.string()
    .cuid('Invalid agent ID format')
    .optional(),
  userId: z.string()
    .cuid('Invalid user ID format')
    .optional(),
});

// ============================================
// BEHAVIOR SCHEMAS
// ============================================

export const createBehaviorBodySchema = z.object({
  behaviorType: z.enum([
    'ANXIOUS_ATTACHMENT',
    'AVOIDANT_ATTACHMENT',
    'DISORGANIZED_ATTACHMENT',
    'YANDERE_OBSESSIVE',
    'BORDERLINE_PD',
    'NARCISSISTIC_PD',
    'CODEPENDENCY',
  ]),
  baseIntensity: z.number()
    .min(0, 'Base intensity must be between 0 and 1')
    .max(1, 'Base intensity must be between 0 and 1')
    .default(0.3),
  volatility: z.number()
    .min(0, 'Volatility must be between 0 and 1')
    .max(1, 'Volatility must be between 0 and 1')
    .default(0.5),
  thresholdForDisplay: z.number()
    .min(0, 'Threshold must be between 0 and 1')
    .max(1, 'Threshold must be between 0 and 1')
    .default(0.4),
});

export const updateBehaviorBodySchema = z.object({
  baseIntensity: z.number()
    .min(0, 'Base intensity must be between 0 and 1')
    .max(1, 'Base intensity must be between 0 and 1')
    .optional(),
  volatility: z.number()
    .min(0, 'Volatility must be between 0 and 1')
    .max(1, 'Volatility must be between 0 and 1')
    .optional(),
  thresholdForDisplay: z.number()
    .min(0, 'Threshold must be between 0 and 1')
    .max(1, 'Threshold must be between 0 and 1')
    .optional(),
  currentPhase: z.number()
    .int()
    .min(1)
    .max(5)
    .optional(),
});

// ============================================
// AUDIO UPLOAD SCHEMAS
// ============================================

export const audioUploadMetadataSchema = z.object({
  duration: z.number()
    .positive('Duration must be positive')
    .max(300, 'Audio too long (max 5 minutes)'),
  format: z.enum(['mp3', 'wav', 'ogg', 'webm'])
    .optional(),
  sampleRate: z.number()
    .int()
    .positive()
    .optional(),
});

// ============================================
// ID PARAM SCHEMAS
// ============================================

export const idParamSchema = z.object({
  id: z.string().cuid('Invalid ID format'),
});

export const userIdParamSchema = z.object({
  userId: z.string().cuid('Invalid user ID format'),
});

export const behaviorIdParamSchema = z.object({
  behaviorId: z.string().cuid('Invalid behavior ID format'),
});

// ============================================
// FILTER SCHEMAS
// ============================================

export const dateRangeSchema = z.object({
  startDate: z.coerce.date()
    .optional(),
  endDate: z.coerce.date()
    .optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: 'Start date must be before or equal to end date' }
);

export const agentFilterSchema = z.object({
  kind: z.enum(['companion', 'assistant']).optional(),
  visibility: z.enum(['private', 'public', 'world', 'team']).optional(),
  featured: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  tags: z.array(z.string()).optional(),
  nsfwMode: z.coerce.boolean().optional(),
});

// ============================================
// TYPE INFERENCE
// ============================================

export type CreateAgentBody = z.infer<typeof createAgentBodySchema>;
export type UpdateAgentBody = z.infer<typeof updateAgentBodySchema>;
export type AgentQuery = z.infer<typeof agentQuerySchema>;
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
export type MessageMetadata = z.infer<typeof messageMetadataSchema>;
export type CreateWorldBody = z.infer<typeof createWorldBodySchema>;
export type UpdateWorldBody = z.infer<typeof updateWorldBodySchema>;
export type WorldMessageBody = z.infer<typeof worldMessageBodySchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type CreateBehaviorBody = z.infer<typeof createBehaviorBodySchema>;
export type UpdateBehaviorBody = z.infer<typeof updateBehaviorBodySchema>;
export type AudioUploadMetadata = z.infer<typeof audioUploadMetadataSchema>;
export type IdParam = z.infer<typeof idParamSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type BehaviorIdParam = z.infer<typeof behaviorIdParamSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type AgentFilter = z.infer<typeof agentFilterSchema>;

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate and parse data with a schema
 * @throws ZodError if validation fails
 */
export function validateSchema<T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

/**
 * Safely validate data and return result with success/error
 */
export function safeValidateSchema<T extends z.ZodType>(
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
 * Format Zod error for API responses
 */
export function formatValidationError(error: z.ZodError): {
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
