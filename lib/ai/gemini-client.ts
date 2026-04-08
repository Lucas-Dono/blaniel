/**
 * Centralized Gemini Client with API Key Rotation
 *
 * Provides a singleton instance of GoogleGenerativeAI with automatic
 * API key rotation to minimize costs and handle quota limits
 *
 * Supports:
 * - GOOGLE_AI_API_KEY (single key)
 * - GOOGLE_AI_API_KEY_1, GOOGLE_AI_API_KEY_2, ... GOOGLE_AI_API_KEY_10
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiClientManager {
  private clients: GoogleGenerativeAI[] = [];
  private currentKeyIndex: number = 0;
  private apiKeys: string[] = [];

  constructor() {
    this.loadApiKeys();
    this.initializeClients();
  }

  /**
   * Load API keys from environment variables
   * Supports GOOGLE_AI_API_KEY or GOOGLE_AI_API_KEY_1, GOOGLE_AI_API_KEY_2, etc.
   */
  private loadApiKeys(): void {
    const keys: string[] = [];

    // Try GOOGLE_AI_API_KEY (single key)
    const singleKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (singleKey) {
      keys.push(singleKey);
    }

    // Try GOOGLE_AI_API_KEY_1, GOOGLE_AI_API_KEY_2, etc. (up to 10)
    for (let i = 1; i <= 10; i++) {
      const key = process.env[`GOOGLE_AI_API_KEY_${i}`];
      if (key) {
        keys.push(key);
      }
    }

    if (keys.length === 0) {
      console.warn('⚠️  No Gemini API keys found. Please set GOOGLE_AI_API_KEY or GOOGLE_AI_API_KEY_1, etc.');
    } else {
      console.log(`✅ Loaded ${keys.length} Gemini API key(s) for rotation`);
    }

    this.apiKeys = keys;
  }

  /**
   * Initialize GoogleGenerativeAI clients for each API key
   */
  private initializeClients(): void {
    this.clients = this.apiKeys.map(key => new GoogleGenerativeAI(key));
  }

  /**
   * Get the current active Gemini client
   */
  public getClient(): GoogleGenerativeAI {
    if (this.clients.length === 0) {
      throw new Error('No Gemini API keys available. Please configure GOOGLE_AI_API_KEY or GOOGLE_AI_API_KEY_1, etc.');
    }

    return this.clients[this.currentKeyIndex];
  }

  /**
   * Rotate to the next API key
   * Returns true if rotation was successful, false if all keys have been tried
   */
  public rotateKey(): boolean {
    if (this.clients.length <= 1) {
      console.warn('[GeminiClient] Cannot rotate: only one API key available');
      return false;
    }

    const previousIndex = this.currentKeyIndex;
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.clients.length;

    console.log(`[GeminiClient] Rotating API key: ${previousIndex + 1} → ${this.currentKeyIndex + 1}`);

    // If we've cycled back to the first key, all keys have been tried
    return this.currentKeyIndex !== 0;
  }

  /**
   * Get the current API key index (1-based for logging)
   */
  public getCurrentKeyIndex(): number {
    return this.currentKeyIndex + 1;
  }

  /**
   * Get total number of API keys available
   */
  public getTotalKeys(): number {
    return this.apiKeys.length;
  }

  /**
   * Execute a Gemini API call with automatic retry and key rotation on quota errors
   */
  public async executeWithRetry<T>(
    operation: (client: GoogleGenerativeAI) => Promise<T>,
    options: {
      maxRetries?: number;
      onRetry?: (error: Error, keyIndex: number) => void;
    } = {}
  ): Promise<T> {
    const { maxRetries = this.clients.length, onRetry } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const client = this.getClient();
        return await operation(client);
      } catch (error) {
        lastError = error as Error;

        // Check if it's a quota/rate limit error
        const isQuotaError =
          error instanceof Error &&
          (error.message.includes('quota') ||
            error.message.includes('rate limit') ||
            error.message.includes('429') ||
            error.message.includes('Too Many Requests'));

        if (isQuotaError && attempt < maxRetries - 1) {
          console.warn(`[GeminiClient] Quota error on key ${this.getCurrentKeyIndex()}, rotating...`);

          if (onRetry) {
            onRetry(error as Error, this.getCurrentKeyIndex());
          }

          const canRotate = this.rotateKey();
          if (!canRotate) {
            console.error('[GeminiClient] All API keys exhausted');
            break;
          }

          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          // Not a quota error or last attempt, throw immediately
          throw error;
        }
      }
    }

    throw lastError || new Error('Gemini API call failed after all retries');
  }
}

// Singleton instance
const geminiClientManager = new GeminiClientManager();

/**
 * Get the current active Gemini client
 * This client is automatically rotated on quota errors
 */
export function getGeminiClient(): GoogleGenerativeAI {
  return geminiClientManager.getClient();
}

/**
 * Execute a Gemini API call with automatic retry and key rotation
 * Use this for operations that might hit quota limits
 *
 * @example
 * const result = await executeWithRetry(async (client) => {
 *   const model = client.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
 *   return await model.generateContent(prompt);
 * });
 */
export async function executeWithRetry<T>(
  operation: (client: GoogleGenerativeAI) => Promise<T>,
  options?: {
    maxRetries?: number;
    onRetry?: (error: Error, keyIndex: number) => void;
  }
): Promise<T> {
  return geminiClientManager.executeWithRetry(operation, options);
}

/**
 * Rotate to the next API key manually
 * Usually not needed as rotation happens automatically on errors
 */
export function rotateGeminiKey(): boolean {
  return geminiClientManager.rotateKey();
}

/**
 * Get statistics about the Gemini client manager
 */
export function getGeminiClientStats() {
  return {
    currentKeyIndex: geminiClientManager.getCurrentKeyIndex(),
    totalKeys: geminiClientManager.getTotalKeys(),
  };
}

// Export the singleton manager for advanced use cases
export { geminiClientManager };
