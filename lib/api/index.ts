/**
 * API Utilities - Centralized API helpers
 *
 * This module exports all API utilities for building consistent, secure, and maintainable API routes.
 *
 * @example
 * ```typescript
 * import { withAuth, withOwnership, errorResponse } from '@/lib/api';
 *
 * export const GET = withAuth(async (req, { user }) => {
 *   return NextResponse.json({ userId: user.id });
 * });
 * ```
 */

// Middleware utilities
export {
  withAuth,
  withOwnership,
  withValidation,
  errorResponse,
  parsePagination,
  createPaginationResult,
  type AuthenticatedUser,
  type AuthenticatedHandler,
  type OwnershipHandler,
  type ValidatedHandler,
  type PaginationParams,
  type PaginationResult,
} from './middleware';

// Prisma error handling
export {
  handlePrismaError,
  isPrismaError,
  isPrismaErrorCode,
} from './prisma-error-handler';
