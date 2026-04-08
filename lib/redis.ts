/**
 * Redis Client Configuration
 *
 * Uses Upstash Redis REST API for serverless-friendly caching
 */

import { Redis } from '@upstash/redis';

// Create Redis client with Upstash REST API
// This is serverless-friendly and works with Vercel/edge functions
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Export type for convenience
export type RedisClient = typeof redis;

// Helper to check if Redis is configured
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// Helper to safely get from cache (returns null if Redis is not configured)
export async function safeGet(key: string): Promise<string | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    return await redis.get(key);
  } catch (error) {
    console.warn(`Redis get failed for key ${key}:`, error);
    return null;
  }
}

// Helper to safely set in cache (fails silently if Redis is not configured)
export async function safeSet(key: string, value: string, expirationSeconds?: number): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    if (expirationSeconds) {
      await redis.setex(key, expirationSeconds, value);
    } else {
      await redis.set(key, value);
    }
  } catch (error) {
    console.warn(`Redis set failed for key ${key}:`, error);
  }
}
