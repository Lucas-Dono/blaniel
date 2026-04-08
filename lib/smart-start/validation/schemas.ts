/**
 * Zod validation schemas for Smart Start API responses
 * Ensures data integrity and type safety across the application
 */

import { z } from 'zod';

/**
 * Search Result Schema
 */
export const SearchResultSchema = z.object({
  id: z.string(),
  externalId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  alternateName: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  source: z.string(),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.any()).optional(),

  // Optional fields from detailed fetch
  nameNative: z.string().optional(),
  nameKanji: z.string().optional(),
  nicknames: z.array(z.string()).optional(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Search Response Schema
 */
export const SearchResponseSchema = z.object({
  success: z.boolean(),
  results: z.array(SearchResultSchema),
  meta: z
    .object({
      query: z.string(),
      count: z.number().int().min(0),
      searchTime: z.number().min(0),
      cached: z.boolean().optional(),
    })
    .optional(),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

/**
 * Details Response Schema
 */
export const DetailsResponseSchema = z.object({
  success: z.boolean(),
  details: SearchResultSchema.nullable(),
});

export type DetailsResponse = z.infer<typeof DetailsResponseSchema>;

/**
 * Character Draft Schema
 */
export const CharacterDraftSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  alternateName: z.string().optional(),
  personality: z.array(z.string()).min(1, 'At least one personality trait required'),
  background: z.string().min(10, 'Background must be at least 10 characters'),
  appearance: z.string().optional(),
  age: z.string().optional(),
  gender: z.string().optional(),
  occupation: z.string().optional(),
  systemPrompt: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  genreId: z.string().optional(),
  subgenreId: z.string().optional(),
  archetypeId: z.string().optional(),
  aiGeneratedFields: z.array(z.string()).optional(),
  userEditedFields: z.array(z.string()).optional(),
  communicationStyle: z.string().optional(),
  catchphrases: z.array(z.string()).optional(),
  likes: z.array(z.string()).optional(),
  dislikes: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  fears: z.array(z.string()).optional(),
  relationships: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  quirks: z.array(z.string()).optional(),
});

export type CharacterDraft = z.infer<typeof CharacterDraftSchema>;

/**
 * Generate Response Schema
 */
export const GenerateResponseSchema = z.object({
  success: z.boolean(),
  characterDraft: CharacterDraftSchema,
  meta: z
    .object({
      generationTime: z.number().min(0),
      method: z.enum(['generated', 'extracted']),
      aiFields: z.number().int().min(0),
      userFields: z.number().int().min(0),
    })
    .optional(),
});

export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

/**
 * Session Schema
 */
export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  currentStep: z.enum(['type', 'search', 'customize', 'review', 'genre']),
  selectedGenre: z.string().optional(),
  selectedSubgenre: z.string().optional(),
  selectedArchetype: z.string().optional(),
  characterType: z.enum(['existing', 'original']).optional(),
  searchResults: z.array(SearchResultSchema).optional(),
  characterDraft: CharacterDraftSchema.optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type Session = z.infer<typeof SessionSchema>;

/**
 * Initialize Response Schema
 */
export const InitializeResponseSchema = z.object({
  success: z.boolean(),
  session: SessionSchema,
  availableGenres: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      icon: z.string().optional(),
    })
  ),
});

export type InitializeResponse = z.infer<typeof InitializeResponseSchema>;

/**
 * Error Response Schema
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  code: z.string().optional(),
  statusCode: z.number().int().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * API Response wrapper - either success or error
 */
export function createAPIResponseSchema<T extends z.ZodTypeAny>(successSchema: T) {
  return z.union([successSchema, ErrorResponseSchema]);
}

/**
 * Validation helpers
 */

/**
 * Safely parse and validate data with Zod schema
 * @param schema Zod schema to validate against
 * @param data Data to validate
 * @param context Context string for error messages
 * @returns Validated data
 * @throws Error with detailed message if validation fails
 */
export function validateData<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context: string = 'Data'
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues
      .map((err: any) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');

    throw new Error(`${context} validation failed: ${errors}`);
  }

  return result.data;
}

/**
 * Validate API response and handle errors gracefully
 * @param schema Success schema
 * @param response Response data
 * @param context Context for error messages
 * @returns Validated data or throws error
 */
export async function validateAPIResponse<T extends z.ZodTypeAny>(
  schema: T,
  response: Response,
  context: string = 'API response'
): Promise<z.infer<T>> {
  // Check if response is ok
  if (!response.ok) {
    let errorMessage = `${context} failed with status ${response.status}`;

    try {
      const errorData = await response.json();
      const errorValidation = ErrorResponseSchema.safeParse(errorData);

      if (errorValidation.success) {
        errorMessage = errorValidation.data.details || errorValidation.data.error || errorMessage;
      }
    } catch {
      // If we can't parse error as JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  // Parse JSON
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`${context}: Failed to parse JSON response`);
  }

  // Validate schema
  return validateData(schema, data, context);
}

/**
 * Partial validation - allows fields to be optional
 * Useful for PATCH/update requests
 */
export function createPartialSchema<T extends z.ZodObject<any>>(schema: T) {
  return schema.partial();
}

/**
 * Array validation helper
 */
export function validateArray<T extends z.ZodTypeAny>(
  itemSchema: T,
  data: unknown,
  context: string = 'Array'
): z.infer<T>[] {
  const arraySchema = z.array(itemSchema);
  return validateData(arraySchema, data, context);
}
