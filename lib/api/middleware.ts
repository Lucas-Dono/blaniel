/**
 * API Middleware Utilities
 *
 * Provides reusable middleware functions for API routes to eliminate code duplication.
 * Implements common patterns: authentication, ownership verification, validation, pagination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';
import {ZodSchema} from 'zod';
import { createLogger } from '@/lib/logger';
import { handlePrismaError, isPrismaError } from './prisma-error-handler';

const log = createLogger('API/Middleware');

/**
 * Authenticated user data returned by middleware
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
}

/**
 * Handler function with authenticated user context
 */
export type AuthenticatedHandler = (
  req: NextRequest,
  context: { params: any; user: AuthenticatedUser }
) => Promise<NextResponse>;

/**
 * Handler function with ownership verification context
 */
export type OwnershipHandler = (
  req: NextRequest,
  context: { params: any; user: AuthenticatedUser; resource: any }
) => Promise<NextResponse>;

/**
 * Handler function with validated body
 */
export type ValidatedHandler<T> = (
  req: NextRequest,
  context: { params: any; user: AuthenticatedUser; body: T }
) => Promise<NextResponse>;

/**
 * Pagination parameters with safe defaults
 */
export interface PaginationParams {
  limit: number;
  offset: number;
}

/**
 * Pagination result for API responses
 */
export interface PaginationResult {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
  returned: number;
}

/**
 * Authentication middleware
 *
 * Verifies user authentication before executing handler.
 * Supports both NextAuth (web) and JWT (mobile) authentication.
 *
 * @param handler - The route handler to execute after authentication
 * @returns Wrapped handler with authentication check
 *
 * @example
 * ```typescript
 * export const GET = withAuth(async (req, { params, user }) => {
 *   // user is guaranteed to be authenticated
 *   return NextResponse.json({ userId: user.id });
 * });
 * ```
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest, { params }: { params: any }) => {
    try {
      const user = await getAuthenticatedUser(req);

      if (!user) {
        log.warn({ path: req.nextUrl.pathname }, 'Unauthorized access attempt');
        return errorResponse('Unauthorized', 401);
      }

      log.debug({ userId: user.id, path: req.nextUrl.pathname }, 'User authenticated');

      return handler(req, { params: await params, user });
    } catch (error) {
      log.error({ error, path: req.nextUrl.pathname }, 'Authentication error');
      return errorResponse('Authentication failed', 500);
    }
  };
}

/**
 * Resource ownership middleware
 *
 * Verifies that a resource belongs to the authenticated user.
 * Automatically handles authentication and resource lookup.
 *
 * @param resourceType - Type of resource to verify ownership ('agent', 'world', 'team', etc.)
 * @param handler - The route handler to execute after ownership verification
 * @param options - Optional configuration
 * @returns Wrapped handler with ownership verification
 *
 * @example
 * ```typescript
 * export const DELETE = withOwnership('agent', async (req, { params, user, resource }) => {
 *   // resource is guaranteed to belong to user
 *   await prisma.agent.delete({ where: { id: resource.id } });
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withOwnership(
  resourceType: 'agent' | 'group' | 'team' | 'post' | 'community' | 'event',
  handler: OwnershipHandler,
  options?: {
    /**
     * Custom field name for the resource ID in params
     * @default 'id'
     */
    idParam?: string;
    /**
     * Allow access if resource is public (only checks if user is owner)
     * @default false
     */
    allowPublic?: boolean;
    /**
     * Custom error message for not found
     */
    notFoundMessage?: string;
    /**
     * Custom error message for forbidden
     */
    forbiddenMessage?: string;
  }
) {
  return withAuth(async (req, context) => {
    const { params, user } = context;
    const idParam = options?.idParam || 'id';
    const resourceId = params[idParam];

    if (!resourceId) {
      return errorResponse(`Missing ${idParam} parameter`, 400);
    }

    try {
      // Map resource type to Prisma model
      const modelMap = {
        agent: prisma.agent,
        group: prisma.group,
        team: prisma.team,
        post: prisma.communityPost,
        community: prisma.community,
        event: prisma.communityEvent,
      };

      const model = modelMap[resourceType];
      if (!model) {
        log.error({ resourceType }, 'Invalid resource type in withOwnership');
        return errorResponse('Internal server error', 500);
      }

      // Fetch resource
      // Type cast to any to avoid union type issues with different model signatures
      const resource = await (model as any).findUnique({
        where: { id: resourceId },
      });

      if (!resource) {
        log.warn({ resourceType, resourceId, userId: user.id }, 'Resource not found');
        return errorResponse(
          options?.notFoundMessage || `${resourceType} not found`,
          404
        );
      }

      // Check ownership
      if ('userId' in resource && resource.userId !== user.id) {
        // Check if public access is allowed
        if (options?.allowPublic && 'visibility' in resource && resource.visibility === 'public') {
          log.debug({ resourceType, resourceId, userId: user.id }, 'Public resource access granted');
        } else {
          log.warn({ resourceType, resourceId, userId: user.id, ownerId: resource.userId }, 'Forbidden access attempt');
          return errorResponse(
            options?.forbiddenMessage || 'You do not have permission to access this resource',
            403
          );
        }
      }

      log.debug({ resourceType, resourceId, userId: user.id }, 'Ownership verified');

      return handler(req, { ...context, resource });
    } catch (error) {
      if (isPrismaError(error)) {
        return handlePrismaError(error, { resourceType, resourceId, userId: user.id });
      }
      throw error;
    }
  });
}

/**
 * Input validation middleware
 *
 * Validates request body against a Zod schema before executing handler.
 * Automatically handles authentication and validation errors.
 *
 * @param schema - Zod schema to validate request body
 * @param handler - The route handler to execute after validation
 * @returns Wrapped handler with body validation
 *
 * @example
 * ```typescript
 * const createAgentSchema = z.object({
 *   name: z.string().min(1).max(100),
 *   personality: z.string(),
 * });
 *
 * export const POST = withValidation(createAgentSchema, async (req, { user, body }) => {
 *   // body is typed and validated
 *   const agent = await prisma.agent.create({
 *     data: { ...body, userId: user.id }
 *   });
 *   return NextResponse.json(agent);
 * });
 * ```
 */
export function withValidation<T>(
  schema: ZodSchema<T>,
  handler: ValidatedHandler<T>
) {
  return withAuth(async (req, context) => {
    try {
      // Parse request body
      let rawBody: any;
      try {
        rawBody = await req.json();
      } catch (error) {
        log.warn({ error }, 'Invalid JSON in request body');
        return errorResponse('Invalid JSON in request body', 400);
      }

      // Validate with Zod
      const result = schema.safeParse(rawBody);

      if (!result.success) {
        log.warn({ errors: result.error.issues }, 'Validation failed');
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: result.error.issues.map(issue => ({
              field: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            })),
          },
          { status: 400 }
        );
      }

      log.debug({ path: req.nextUrl.pathname }, 'Body validation successful');

      return handler(req, { ...context, body: result.data });
    } catch (error) {
      log.error({ error }, 'Validation middleware error');
      return errorResponse('Validation failed', 500);
    }
  });
}

/**
 * Creates a consistent error response
 *
 * @param message - Error message to return
 * @param status - HTTP status code
 * @returns NextResponse with error
 *
 * @example
 * ```typescript
 * if (!agent) {
 *   return errorResponse('Agent not found', 404);
 * }
 * ```
 */
export function errorResponse(
  message: string,
  status: number = 400,
  details?: Record<string, any>
): NextResponse {
  const body: any = { error: message };

  if (details) {
    body.details = details;
  }

  return NextResponse.json(body, { status });
}

/**
 * Parses pagination parameters from URL search params with safe defaults
 *
 * @param searchParams - URLSearchParams from request
 * @param options - Optional configuration
 * @returns Validated pagination parameters
 *
 * @example
 * ```typescript
 * export const GET = withAuth(async (req, { user }) => {
 *   const { limit, offset } = parsePagination(new URL(req.url).searchParams);
 *
 *   const items = await prisma.item.findMany({
 *     where: { userId: user.id },
 *     skip: offset,
 *     take: limit,
 *   });
 *
 *   return NextResponse.json({ items });
 * });
 * ```
 */
export function parsePagination(
  searchParams: URLSearchParams,
  options?: {
    /**
     * Default limit if not provided
     * @default 50
     */
    defaultLimit?: number;
    /**
     * Maximum allowed limit
     * @default 100
     */
    maxLimit?: number;
    /**
     * Default offset if not provided
     * @default 0
     */
    defaultOffset?: number;
  }
): PaginationParams {
  const defaultLimit = options?.defaultLimit ?? 50;
  const maxLimit = options?.maxLimit ?? 100;
  const defaultOffset = options?.defaultOffset ?? 0;

  // Parse limit
  const limitParam = searchParams.get('limit');
  let limit = defaultLimit;

  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, maxLimit);
    }
  }

  // Parse offset
  const offsetParam = searchParams.get('offset');
  let offset = defaultOffset;

  if (offsetParam) {
    const parsed = parseInt(offsetParam, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      offset = parsed;
    }
  }

  return { limit, offset };
}

/**
 * Creates pagination metadata for API responses
 *
 * @param params - Pagination parameters used in query
 * @param total - Total count of items
 * @param returned - Number of items returned in current response
 * @returns Pagination metadata object
 *
 * @example
 * ```typescript
 * const { limit, offset } = parsePagination(searchParams);
 * const items = await prisma.item.findMany({ skip: offset, take: limit });
 * const total = await prisma.item.count();
 *
 * return NextResponse.json({
 *   items,
 *   pagination: createPaginationResult({ limit, offset }, total, items.length)
 * });
 * ```
 */
export function createPaginationResult(
  params: PaginationParams,
  total: number,
  returned: number
): PaginationResult {
  return {
    limit: params.limit,
    offset: params.offset,
    total,
    hasMore: params.offset + returned < total,
    returned,
  };
}
