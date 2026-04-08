/**
 * Sentry API Middleware for automatic performance monitoring
 *
 * Wraps API route handlers to automatically track performance and errors
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { captureAPIError } from "./custom-error";
import { trackAPICall } from "./breadcrumbs";

export interface APIHandlerContext {
  params?: Record<string, string>;
}

export type APIHandler = (
  request: NextRequest,
  context?: APIHandlerContext
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps an API route handler with Sentry monitoring
 */
export function withSentryMonitoring(
  handler: APIHandler,
  options?: {
    operationName?: string;
    trackPerformance?: boolean;
    trackErrors?: boolean;
  }
) {
  const {
    operationName,
    trackPerformance = true,
    trackErrors = true,
  } = options || {};

  return async (
    request: NextRequest,
    context?: APIHandlerContext
  ): Promise<NextResponse> => {
    const startTime = Date.now();
    const method = request.method;
    const pathname = new URL(request.url).pathname;
    const transactionName = operationName || `${method} ${pathname}`;

    if (trackPerformance) {
      // Start performance span
      return await Sentry.startSpan(
        {
          name: transactionName,
          op: "http.server",
          attributes: {
            method,
            pathname,
          },
        },
        async () => {
          try {
            // Execute the handler
            const response = await handler(request, context);
            const duration = Date.now() - startTime;
            const statusCode = response.status;

            // Track successful API call
            trackAPICall(method, pathname, statusCode, duration);

            return response;
          } catch (error) {
            const duration = Date.now() - startTime;

            // Track failed API call
            trackAPICall(method, pathname, 500, duration);

            if (trackErrors && error instanceof Error) {
              // Capture error with API context
              captureAPIError(error, {
                endpoint: pathname,
                method,
                statusCode: 500,
                userId: await getUserIdFromRequest(request),
              });
            }

            // Re-throw to let Next.js handle it
            throw error;
          }
        }
      );
    } else {
      // No performance tracking, just execute
      try {
        const response = await handler(request, context);
        const duration = Date.now() - startTime;
        trackAPICall(method, pathname, response.status, duration);
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        trackAPICall(method, pathname, 500, duration);

        if (trackErrors && error instanceof Error) {
          captureAPIError(error, {
            endpoint: pathname,
            method,
            statusCode: 500,
            userId: await getUserIdFromRequest(request),
          });
        }

        throw error;
      }
    }
  };
}

/**
 * Helper to extract user ID from request (if authenticated)
 */
async function getUserIdFromRequest(
  request: NextRequest
): Promise<string | undefined> {
  try {
    // Try to get from auth header or session
    // This is a simplified version - adjust based on your auth implementation
    const authHeader = request.headers.get("authorization");
    if (authHeader) {
      // Parse JWT or session token to get user ID
      // Implementation depends on your auth system
    }
  } catch {
    // Ignore errors in user ID extraction
  }
  return undefined;
}

/**
 * Performance monitoring decorator for specific operations
 */
export function monitorPerformance(operationName: string) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return await Sentry.startSpan(
        {
          name: `${target.constructor.name}.${propertyKey}`,
          op: operationName,
        },
        async () => {
          return await originalMethod.apply(this, args);
        }
      );
    };

    return descriptor;
  };
}

/**
 * Tracks database query performance
 */
export async function withDatabaseMonitoring<T>(
  operation: string,
  model: string,
  query: () => Promise<T>
): Promise<T> {
  const span = Sentry.startSpan(
    {
      name: `db.${operation}`,
      op: "db.query",
      attributes: {
        "db.operation": operation,
        "db.model": model,
      },
    },
    async (span) => {
      try {
        const result = await query();
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.setStatus({ code: 2 }); // ERROR
        throw error;
      }
    }
  );

  return span;
}

/**
 * Tracks LLM/AI operation performance
 */
export async function withAIMonitoring<T>(
  provider: string,
  model: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const span = Sentry.startSpan(
    {
      name: `ai.${operation}`,
      op: "ai.inference",
      attributes: {
        "ai.provider": provider,
        "ai.model": model,
        "ai.operation": operation,
      },
    },
    async (span) => {
      try {
        const result = await fn();
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.setStatus({ code: 2 }); // ERROR
        throw error;
      }
    }
  );

  return span;
}
