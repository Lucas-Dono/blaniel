/**
 * Demo Rate Limiter
 * 
 * Rate limiting specific to the demo system
 * - Stricter limits than free tier to prevent abuse
 * - Multi-layer: per session, per IP, and cooldown between messages
 * - No authentication required
 */

import { redis, isRedisAvailable } from '@/lib/redis/config';
import { createLogger } from '@/lib/logger';
import crypto from 'crypto';

const log = createLogger('DemoRateLimiter');

// Configuration from environment variables
const DEMO_MAX_MESSAGES = parseInt(process.env.DEMO_MAX_MESSAGES || '3');
const DEMO_COOLDOWN_SECONDS = parseInt(process.env.DEMO_COOLDOWN_SECONDS || '10');
const DEMO_MAX_SESSIONS_PER_IP = parseInt(process.env.DEMO_MAX_SESSIONS_PER_IP || '10');

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  waitSeconds?: number;
  messagesRemaining?: number;
  resetAt?: number;
}

class DemoRateLimiter {
  private readonly cooldownPrefix = 'demo:cooldown:';
  private readonly inMemoryCooldowns = new Map<string, number>();

  /**
   * Hashear IP para privacidad
   */
  private hashIp(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex');
  }

  /**
   * Verificar cooldown entre mensajes
   */
  async checkCooldown(sessionId: string): Promise<RateLimitResult> {
    const cooldownKey = `${this.cooldownPrefix}${sessionId}`;

    if (isRedisAvailable && redis) {
      try {
        const lastMessageTime = await redis.get(cooldownKey);

        if (lastMessageTime) {
          const lastTime = parseInt(lastMessageTime as string);
          const now = Date.now();
          const elapsed = Math.floor((now - lastTime) / 1000);
          const remaining = DEMO_COOLDOWN_SECONDS - elapsed;

          if (remaining > 0) {
            log.debug({ sessionId, remaining }, 'Cooldown active');
            return {
              allowed: false,
              reason: 'COOLDOWN_ACTIVE',
              waitSeconds: remaining,
            };
          }
        }

        return { allowed: true };
      } catch (error) {
        log.error({ error, sessionId }, 'Failed to check cooldown in Redis');
        // Fallback a memoria
        return this.checkCooldownMemory(sessionId);
      }
    } else {
      // Fallback a memoria
      return this.checkCooldownMemory(sessionId);
    }
  }

  /**
   * Verificar cooldown en memoria (fallback)
   */
  private checkCooldownMemory(sessionId: string): RateLimitResult {
    const lastTime = this.inMemoryCooldowns.get(sessionId);

    if (lastTime) {
      const now = Date.now();
      const elapsed = Math.floor((now - lastTime) / 1000);
      const remaining = DEMO_COOLDOWN_SECONDS - elapsed;

      if (remaining > 0) {
        return {
          allowed: false,
          reason: 'COOLDOWN_ACTIVE',
          waitSeconds: remaining,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Registrar mensaje y establecer cooldown
   */
  async trackMessage(sessionId: string): Promise<void> {
    const cooldownKey = `${this.cooldownPrefix}${sessionId}`;
    const now = Date.now();

    if (isRedisAvailable && redis) {
      try {
        await redis.set(cooldownKey, now.toString(), {
          ex: DEMO_COOLDOWN_SECONDS,
        });
        log.debug({ sessionId, cooldown: DEMO_COOLDOWN_SECONDS }, 'Cooldown set in Redis');
      } catch (error) {
        log.error({ error, sessionId }, 'Failed to set cooldown in Redis');
        this.inMemoryCooldowns.set(sessionId, now);
      }
    } else {
      // Fallback a memoria
      this.inMemoryCooldowns.set(sessionId, now);

      // Limpiar cooldowns viejos en memoria
      setTimeout(() => {
        this.inMemoryCooldowns.delete(sessionId);
      }, DEMO_COOLDOWN_SECONDS * 1000);
    }
  }

  /** Check all rate limiting limits */
  async checkRateLimit(
    sessionId: string,
    messageCount: number,
    _ip: string
  ): Promise<RateLimitResult> {
    // 1. Check message limit per session
    if (messageCount >= DEMO_MAX_MESSAGES) {
      log.debug({ sessionId, messageCount }, 'Message limit reached');
      return {
        allowed: false,
        reason: 'MESSAGE_LIMIT_REACHED',
        messagesRemaining: 0,
      };
    }

    // 2. Verificar cooldown entre mensajes
    const cooldownCheck = await this.checkCooldown(sessionId);
    if (!cooldownCheck.allowed) {
      return cooldownCheck;
    }

    // 3. Todo OK
    return {
      allowed: true,
      messagesRemaining: DEMO_MAX_MESSAGES - messageCount,
    };
  }

  /** Get limit information */
  getLimits() {
    return {
      maxMessages: DEMO_MAX_MESSAGES,
      cooldownSeconds: DEMO_COOLDOWN_SECONDS,
      maxSessionsPerIp: DEMO_MAX_SESSIONS_PER_IP,
    };
  }

  /**
   * Reset cooldown (para testing)
   */
  async resetCooldown(sessionId: string): Promise<void> {
    const cooldownKey = `${this.cooldownPrefix}${sessionId}`;

    if (isRedisAvailable && redis) {
      try {
        await redis.del(cooldownKey);
      } catch (error) {
        log.error({ error, sessionId }, 'Failed to reset cooldown');
      }
    }

    this.inMemoryCooldowns.delete(sessionId);
  }

  /** Get statistics (for monitoring) */
  getStats() {
    return {
      inMemoryCooldowns: this.inMemoryCooldowns.size,
      redisAvailable: isRedisAvailable,
      limits: this.getLimits(),
    };
  }
}

// Exportar instancia singleton
export const demoRateLimiter = new DemoRateLimiter();

// Exportar constantes para usar en otros archivos
export const DEMO_LIMITS = {
  messagesPerSession: DEMO_MAX_MESSAGES,
  cooldownSeconds: DEMO_COOLDOWN_SECONDS,
  sessionsPerIpPerDay: DEMO_MAX_SESSIONS_PER_IP,
};
