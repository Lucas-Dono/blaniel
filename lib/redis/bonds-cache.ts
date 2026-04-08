/**
 * REDIS CACHE LAYER FOR SYMBOLIC BONDS
 * 
 * Caches frequently accessed data to reduce DB load:
 * - Active bonds per user
 * - Global rankings
 * - Agent configurations
 * - Aggregated stats
 */

import { Redis } from "ioredis";
import type {AgentBondConfig} from "@prisma/client";

// Configurar Redis (usa URL de env o default local)
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

// TTLs (en segundos)
const TTL = {
  USER_BONDS: 60 * 5, // 5 minutos
  AGENT_CONFIG: 60 * 30, // 30 minutos
  LEADERBOARD: 60 * 10, // 10 minutos
  RARITY_RANKINGS: 60 * 60, // 1 hora
  QUEUE_POSITION: 60 * 2, // 2 minutos
  STATS: 60 * 15, // 15 minutos
};

// Prefixes para keys
const KEY = {
  userBonds: (userId: string) => `bonds:user:${userId}`,
  agentConfig: (agentId: string) => `bonds:agent-config:${agentId}`,
  leaderboard: (tier: string) => `bonds:leaderboard:${tier}`,
  rarityRankings: (agentId: string, tier: string) =>
    `bonds:rarity:${agentId}:${tier}`,
  queuePosition: (userId: string, agentId: string, tier: string) =>
    `bonds:queue:${userId}:${agentId}:${tier}`,
  globalStats: () => `bonds:stats:global`,
  agentStats: (agentId: string) => `bonds:stats:agent:${agentId}`,
};

/** Active user bonds cache */
export async function getCachedUserBonds(userId: string) {
  try {
    const cached = await redis.get(KEY.userBonds(userId));
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("Redis getCachedUserBonds error:", error);
    return null;
  }
}

export async function setCachedUserBonds(
  userId: string,
  bonds: any[],
  ttl: number = TTL.USER_BONDS
) {
  try {
    await redis.setex(KEY.userBonds(userId), ttl, JSON.stringify(bonds));
  } catch (error) {
    console.error("Redis setCachedUserBonds error:", error);
  }
}

export async function invalidateUserBonds(userId: string) {
  try {
    await redis.del(KEY.userBonds(userId));
  } catch (error) {
    console.error("Redis invalidateUserBonds error:", error);
  }
}

/** Agent configuration cache */
export async function getCachedAgentConfig(agentId: string) {
  try {
    const cached = await redis.get(KEY.agentConfig(agentId));
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("Redis getCachedAgentConfig error:", error);
    return null;
  }
}

export async function setCachedAgentConfig(
  agentId: string,
  config: AgentBondConfig,
  ttl: number = TTL.AGENT_CONFIG
) {
  try {
    await redis.setex(KEY.agentConfig(agentId), ttl, JSON.stringify(config));
  } catch (error) {
    console.error("Redis setCachedAgentConfig error:", error);
  }
}

/**
 * Cache de leaderboards
 */
export async function getCachedLeaderboard(tier: string) {
  try {
    const cached = await redis.get(KEY.leaderboard(tier));
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("Redis getCachedLeaderboard error:", error);
    return null;
  }
}

export async function setCachedLeaderboard(
  tier: string,
  bonds: any[],
  ttl: number = TTL.LEADERBOARD
) {
  try {
    await redis.setex(KEY.leaderboard(tier), ttl, JSON.stringify(bonds));
  } catch (error) {
    console.error("Redis setCachedLeaderboard error:", error);
  }
}

export async function invalidateAllLeaderboards() {
  try {
    const keys = await redis.keys("bonds:leaderboard:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error("Redis invalidateAllLeaderboards error:", error);
  }
}

/**
 * Cache de rarity rankings
 */
export async function getCachedRarityRankings(agentId: string, tier: string) {
  try {
    const cached = await redis.get(KEY.rarityRankings(agentId, tier));
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("Redis getCachedRarityRankings error:", error);
    return null;
  }
}

export async function setCachedRarityRankings(
  agentId: string,
  tier: string,
  rankings: any[],
  ttl: number = TTL.RARITY_RANKINGS
) {
  try {
    await redis.setex(
      KEY.rarityRankings(agentId, tier),
      ttl,
      JSON.stringify(rankings)
    );
  } catch (error) {
    console.error("Redis setCachedRarityRankings error:", error);
  }
}

/** Queue position cache */
export async function getCachedQueuePosition(
  userId: string,
  agentId: string,
  tier: string
) {
  try {
    const cached = await redis.get(KEY.queuePosition(userId, agentId, tier));
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("Redis getCachedQueuePosition error:", error);
    return null;
  }
}

export async function setCachedQueuePosition(
  userId: string,
  agentId: string,
  tier: string,
  position: any,
  ttl: number = TTL.QUEUE_POSITION
) {
  try {
    await redis.setex(
      KEY.queuePosition(userId, agentId, tier),
      ttl,
      JSON.stringify(position)
    );
  } catch (error) {
    console.error("Redis setCachedQueuePosition error:", error);
  }
}

/**
 * Cache de stats globales
 */
export async function getCachedGlobalStats() {
  try {
    const cached = await redis.get(KEY.globalStats());
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("Redis getCachedGlobalStats error:", error);
    return null;
  }
}

export async function setCachedGlobalStats(
  stats: any,
  ttl: number = TTL.STATS
) {
  try {
    await redis.setex(KEY.globalStats(), ttl, JSON.stringify(stats));
  } catch (error) {
    console.error("Redis setCachedGlobalStats error:", error);
  }
}

/** Bulk invalidation when there are major changes */
export async function invalidateBondCache(bondId: string, userId: string, agentId?: string) {
  try {
    // Invalidate user bonds
    await invalidateUserBonds(userId);

    // Invalidar leaderboards (todos)
    await invalidateAllLeaderboards();

    // Invalidar stats globales
    await redis.del(KEY.globalStats());

    // Si sabemos el agente, invalidar sus stats
    if (agentId) {
      await redis.del(KEY.agentStats(agentId));

      // Invalidar rankings de rareza de ese agente
      const rarityKeys = await redis.keys(`bonds:rarity:${agentId}:*`);
      if (rarityKeys.length > 0) {
        await redis.del(...rarityKeys);
      }
    }
  } catch (error) {
    console.error("Redis invalidateBondCache error:", error);
  }
}

/**
 * Health check de Redis
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error("Redis health check failed:", error);
    return false;
  }
}

/**
 * Conectar Redis al inicio
 */
export async function connectRedis() {
  try {
    await redis.connect();
    console.log("✅ Redis connected successfully");
    return true;
  } catch (error) {
    console.error("❌ Redis connection failed:", error);
    console.warn("⚠️  Running without Redis cache");
    return false;
  }
}

/**
 * Desconectar Redis
 */
export async function disconnectRedis() {
  try {
    await redis.quit();
    console.log("Redis disconnected");
  } catch (error) {
    console.error("Redis disconnect error:", error);
  }
}

// Exportar Redis client para uso directo si es necesario
export default redis;
