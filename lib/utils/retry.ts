/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any, attempt: number) => boolean;
  onRetry?: (error: any, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "shouldRetry" | "onRetry">> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2
};

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries,
    initialDelay,
    maxDelay,
    backoffMultiplier,
    shouldRetry = () => true,
    onRetry
  } = { ...DEFAULT_OPTIONS, ...options };

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if we've exhausted attempts or if shouldRetry returns false
      if (attempt >= maxRetries || !shouldRetry(error, attempt + 1)) {
        throw error;
      }

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(error, attempt + 1);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Wrapper to add retry logic to fetch calls
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(url, options);

      // Only retry on network errors or 5xx server errors
      if (!response.ok && response.status >= 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    },
    {
      shouldRetry: (error, _attempt) => {
        // Don't retry on client errors (4xx)
        if (error.message && error.message.includes("HTTP 4")) {
          return false;
        }
        return true;
      },
      ...retryOptions
    }
  );
}

/**
 * Creates a retry wrapper for SWR fetchers
 */
export function createRetryFetcher<T>(
  fetcher: (...args: any[]) => Promise<T>,
  retryOptions?: RetryOptions
) {
  return async (...args: any[]): Promise<T> => {
    return withRetry(() => fetcher(...args), retryOptions);
  };
}

/**
 * Utility to check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true;
  }

  // Timeout errors
  if (error.name === "AbortError" || error.message.includes("timeout")) {
    return true;
  }

  // Server errors (5xx)
  if (error.status && error.status >= 500 && error.status < 600) {
    return true;
  }

  // Rate limit (429)
  if (error.status === 429) {
    return true;
  }

  return false;
}
