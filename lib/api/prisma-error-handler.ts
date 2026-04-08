/**
 * Prisma Error Handler
 *
 * Centralizes Prisma error handling to provide consistent error responses across the API.
 * Handles common Prisma error codes with appropriate HTTP status codes and user-friendly messages.
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('API/PrismaErrorHandler');

/**
 * Maps Prisma error codes to HTTP status codes and error messages
 */
const PRISMA_ERROR_MAP: Record<string, { status: number; message: string }> = {
  // Record not found
  P2025: {
    status: 404,
    message: 'Resource not found',
  },
  // Unique constraint violation
  P2002: {
    status: 409,
    message: 'Resource already exists',
  },
  // Foreign key constraint violation
  P2003: {
    status: 400,
    message: 'Invalid reference - related resource not found',
  },
  // Database constraint violation
  P2004: {
    status: 400,
    message: 'Database constraint violation',
  },
  // Required field missing
  P2011: {
    status: 400,
    message: 'Required field is missing',
  },
  // Record to delete does not exist
  P2016: {
    status: 404,
    message: 'Record to delete does not exist',
  },
  // Required relation violation
  P2018: {
    status: 400,
    message: 'Required relation is missing',
  },
  // Input error
  P2019: {
    status: 400,
    message: 'Invalid input data',
  },
  // Value out of range
  P2020: {
    status: 400,
    message: 'Value out of valid range',
  },
  // Table does not exist
  P2021: {
    status: 500,
    message: 'Internal database error',
  },
  // Column does not exist
  P2022: {
    status: 500,
    message: 'Internal database error',
  },
  // Inconsistent column data
  P2023: {
    status: 500,
    message: 'Internal database error',
  },
  // Connection timeout
  P2024: {
    status: 503,
    message: 'Database connection timeout',
  },
  // Connection pool timeout
  P2034: {
    status: 503,
    message: 'Database is temporarily unavailable',
  },
};

/**
 * Handles Prisma errors and returns appropriate NextResponse
 *
 * @param error - The error to handle (should be PrismaClientKnownRequestError)
 * @param context - Optional context for logging
 * @returns NextResponse with appropriate error message and status code
 *
 * @example
 * ```typescript
 * try {
 *   await prisma.agent.findUniqueOrThrow({ where: { id } });
 * } catch (error) {
 *   return handlePrismaError(error);
 * }
 * ```
 */
export function handlePrismaError(
  error: unknown,
  context?: Record<string, any>
): NextResponse {
  // Only handle Prisma errors
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    log.error({ error, context }, 'Non-Prisma error passed to handlePrismaError');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  const errorConfig = PRISMA_ERROR_MAP[error.code];

  if (errorConfig) {
    // Known Prisma error
    log.warn(
      {
        code: error.code,
        message: error.message,
        meta: error.meta,
        context,
      },
      `Prisma error: ${error.code}`
    );

    // Extract field information for unique constraint violations
    if (error.code === 'P2002' && error.meta?.target) {
      const fields = Array.isArray(error.meta.target)
        ? error.meta.target.join(', ')
        : error.meta.target;

      return NextResponse.json(
        {
          error: errorConfig.message,
          details: `A resource with this ${fields} already exists`,
          field: fields,
        },
        { status: errorConfig.status }
      );
    }

    // Extract field information for foreign key violations
    if (error.code === 'P2003' && error.meta?.field_name) {
      return NextResponse.json(
        {
          error: errorConfig.message,
          details: `Invalid value for field: ${error.meta.field_name}`,
          field: error.meta.field_name,
        },
        { status: errorConfig.status }
      );
    }

    // Generic error response
    return NextResponse.json(
      { error: errorConfig.message },
      { status: errorConfig.status }
    );
  }

  // Unknown Prisma error
  log.error(
    {
      code: error.code,
      message: error.message,
      meta: error.meta,
      context,
    },
    `Unknown Prisma error: ${error.code}`
  );

  return NextResponse.json(
    {
      error: 'Database operation failed',
      code: error.code,
    },
    { status: 500 }
  );
}

/**
 * Type guard to check if error is a Prisma error
 */
export function isPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

/**
 * Checks if error is a specific Prisma error code
 */
export function isPrismaErrorCode(error: unknown, code: string): boolean {
  return isPrismaError(error) && error.code === code;
}
