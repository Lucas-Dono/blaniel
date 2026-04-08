/**
 * Feature Flags Service
 * Sistema robusto de feature flags con caching Redis
 */

import { prisma } from "@/lib/prisma";
import { redis, getCacheKey, CACHE_TTL, isRedisConfigured } from "@/lib/redis/config";
import {
  Feature,
  UserTier,
  FeatureCheckResult,
  FeatureLimits,
  FeatureUsage,
} from "./types";
import {
  TIER_CONFIGS,
  FEATURE_METADATA,
  isTierSufficient,
  getNextTier,
  getUpgradeUrl,
} from "./config";

/**
 * In-memory cache fallback (cuando Redis no está disponible)
 */
const inMemoryCache = new Map<
  string,
  { data: any; expiresAt: number }
>();

function inMemoryCacheGet<T>(key: string): T | null {
  const cached = inMemoryCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    inMemoryCache.delete(key);
    return null;
  }
  return cached.data as T;
}

function inMemoryCacheSet<T>(key: string, data: T, ttlSeconds: number): void {
  inMemoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Get user tier from database with caching
 */
export async function getUserTier(userId: string): Promise<UserTier> {
  const cacheKey = getCacheKey("user-tier", userId);

  // Try Redis cache first
  if (isRedisConfigured()) {
    try {
      const cached = await redis.get(cacheKey) as string | null;
      if (cached && Object.values(UserTier).includes(cached as UserTier)) {
        return cached as UserTier;
      }
    } catch (error) {
      console.error("Redis cache error:", error);
    }
  }

  // Try in-memory cache
  const memCached = inMemoryCacheGet<string>(cacheKey);
  if (memCached && Object.values(UserTier).includes(memCached as UserTier)) {
    return memCached as UserTier;
  }

  // Fetch from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const tier = (user?.plan as UserTier) || UserTier.FREE;

  // Cache result
  if (isRedisConfigured()) {
    try {
      await redis.set(cacheKey, tier, { ex: CACHE_TTL.user });
    } catch (error) {
      console.error("Redis cache set error:", error);
    }
  }

  inMemoryCacheSet(cacheKey, tier, CACHE_TTL.user);

  return tier;
}

/**
 * Check if user has access to a feature
 */
export async function hasFeature(
  userId: string,
  feature: Feature
): Promise<boolean> {
  const userTier = await getUserTier(userId);
  const config = TIER_CONFIGS[userTier];
  return config.features.includes(feature);
}

/**
 * Check feature with detailed result
 */
export async function checkFeature(
  userId: string,
  feature: Feature
): Promise<FeatureCheckResult> {
  const userTier = await getUserTier(userId);
  const hasAccess = await hasFeature(userId, feature);
  const metadata = FEATURE_METADATA[feature];

  if (hasAccess) {
    return {
      hasAccess: true,
      feature,
      userTier,
    };
  }

  // User doesn't have access - provide upgrade info
  const requiredTier = metadata.minTier;
  const nextTier = getNextTier(userTier);
  const targetTier = nextTier && isTierSufficient(nextTier, requiredTier)
    ? nextTier
    : requiredTier;

  return {
    hasAccess: false,
    feature,
    userTier,
    requiredTier,
    reason: metadata.upgradeMessage,
    upgradeUrl: getUpgradeUrl(targetTier),
  };
}

/**
 * Get all enabled features for a user
 */
export async function getEnabledFeatures(userId: string): Promise<Feature[]> {
  const userTier = await getUserTier(userId);
  const config = TIER_CONFIGS[userTier];
  return config.features;
}

/**
 * Get feature limits for a user
 */
export async function getFeatureLimits(userId: string): Promise<FeatureLimits> {
  const userTier = await getUserTier(userId);
  const config = TIER_CONFIGS[userTier];
  return config.limits;
}

/**
 * Get specific limit value
 */
export async function getLimit(
  userId: string,
  limitKey: keyof FeatureLimits
): Promise<number> {
  const limits = await getFeatureLimits(userId);
  return limits[limitKey];
}

/**
 * Check if user is within a specific limit
 */
export async function checkLimit(
  userId: string,
  limitKey: keyof FeatureLimits,
  currentUsage: number
): Promise<{
  withinLimit: boolean;
  limit: number;
  current: number;
  remaining: number;
}> {
  const limit = await getLimit(userId, limitKey);

  // -1 means unlimited
  if (limit === -1) {
    return {
      withinLimit: true,
      limit: -1,
      current: currentUsage,
      remaining: -1,
    };
  }

  const withinLimit = currentUsage < limit;
  const remaining = Math.max(0, limit - currentUsage);

  return {
    withinLimit,
    limit,
    current: currentUsage,
    remaining,
  };
}

/**
 * Track feature usage (for daily/monthly limits)
 */
export async function trackFeatureUsage(
  userId: string,
  feature: Feature,
  count: number = 1
): Promise<FeatureUsage> {
  const today = new Date().toISOString().split("T")[0];
  const key = `usage:${feature}:${userId}:${today}`;

  let currentCount = 0;

  if (isRedisConfigured()) {
    try {
      currentCount = (await redis.get(key) as number | null) || 0;
      await redis.set(key, currentCount + count, { ex: 86400 }); // 24h TTL
    } catch (error) {
      console.error("Redis usage tracking error:", error);
    }
  }

  // Also track in memory
  const memKey = getCacheKey("usage", key);
  const memCached = inMemoryCacheGet<number>(memKey) || 0;
  inMemoryCacheSet(memKey, memCached + count, 86400);

  const limits = await getFeatureLimits(userId);
  let limit = -1; // Default unlimited

  // Map feature to limit
  switch (feature) {
    case Feature.IMAGE_GENERATION:
      limit = limits.imageGenerationsPerDay;
      break;
    case Feature.API_ACCESS:
      limit = limits.apiCallsPerDay;
      break;
    // Add more mappings as needed
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  return {
    userId,
    feature,
    count: currentCount + count,
    limit,
    resetAt: tomorrow,
  };
}

/**
 * Get feature usage for a user
 */
export async function getFeatureUsage(
  userId: string,
  feature: Feature
): Promise<FeatureUsage> {
  const today = new Date().toISOString().split("T")[0];
  const key = `usage:${feature}:${userId}:${today}`;

  let currentCount = 0;

  if (isRedisConfigured()) {
    try {
      currentCount = (await redis.get(key) as number | null) || 0;
    } catch (error) {
      console.error("Redis usage get error:", error);
    }
  }

  if (currentCount === 0) {
    const memKey = getCacheKey("usage", key);
    currentCount = inMemoryCacheGet<number>(memKey) || 0;
  }

  const limits = await getFeatureLimits(userId);
  let limit = -1;

  switch (feature) {
    case Feature.IMAGE_GENERATION:
      limit = limits.imageGenerationsPerDay;
      break;
    case Feature.API_ACCESS:
      limit = limits.apiCallsPerDay;
      break;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  return {
    userId,
    feature,
    count: currentCount,
    limit,
    resetAt: tomorrow,
  };
}

/**
 * Check if user can use a feature (considering usage limits)
 */
export async function canUseFeature(
  userId: string,
  feature: Feature
): Promise<{
  canUse: boolean;
  reason?: string;
  upgradeUrl?: string;
  usage?: FeatureUsage;
}> {
  // First check if feature is enabled
  const featureCheck = await checkFeature(userId, feature);

  if (!featureCheck.hasAccess) {
    return {
      canUse: false,
      reason: featureCheck.reason,
      upgradeUrl: featureCheck.upgradeUrl,
    };
  }

  // Check usage limits
  const usage = await getFeatureUsage(userId, feature);

  // -1 means unlimited
  if (usage.limit === -1) {
    return {
      canUse: true,
      usage,
    };
  }

  // Check if within limit
  if (usage.count >= usage.limit) {
    const userTier = await getUserTier(userId);
    const nextTier = getNextTier(userTier);

    return {
      canUse: false,
      reason: `Has alcanzado el límite diario de ${usage.limit}. ${
        nextTier
          ? `Actualiza a ${TIER_CONFIGS[nextTier].name} para más.`
          : "Vuelve mañana."
      }`,
      upgradeUrl: nextTier ? getUpgradeUrl(nextTier) : undefined,
      usage,
    };
  }

  return {
    canUse: true,
    usage,
  };
}

/**
 * Invalidate user tier cache (call when plan changes)
 */
export async function invalidateUserTierCache(userId: string): Promise<void> {
  const cacheKey = getCacheKey("user-tier", userId);

  if (isRedisConfigured()) {
    try {
      await redis.del(cacheKey);
    } catch (error) {
      console.error("Redis cache invalidation error:", error);
    }
  }

  inMemoryCache.delete(cacheKey);
}

/**
 * Log feature access attempt (for analytics)
 */
export async function logFeatureAccess(
  userId: string,
  feature: Feature,
  granted: boolean,
  reason?: string
): Promise<void> {
  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[FeatureFlags] User ${userId} ${granted ? "GRANTED" : "DENIED"} access to ${feature}`,
      reason ? `- ${reason}` : ""
    );
  }

  // In production, you might want to log to a proper logging service
  // or store in database for analytics
}

// Clean up in-memory cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of inMemoryCache.entries()) {
    if (value.expiresAt < now) {
      inMemoryCache.delete(key);
    }
  }
}, 60000); // Every minute
