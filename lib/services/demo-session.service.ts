/**
 * Demo Session Service
 *
 * Manages temporary sessions for chat demos without authentication
 * - Ephemeral sessions stored in Redis with 24h TTL
 * - No database persistence
 * - Rate limiting per session and IP
 * - Conversational context maintained in session
 */

import { redis, isRedisAvailable } from '@/lib/redis/config';
import { createLogger } from '@/lib/logger';
import { randomUUID } from 'crypto';
import crypto from 'crypto';

const log = createLogger('DemoSessionService');

// Configuration from environment variables
const DEMO_SESSION_TTL = parseInt(process.env.DEMO_SESSION_TTL || '86400'); // 24 hours
const DEMO_MAX_MESSAGES = parseInt(process.env.DEMO_MAX_MESSAGES || '3');
const DEMO_MAX_SESSIONS_PER_IP = parseInt(process.env.DEMO_MAX_SESSIONS_PER_IP || '10');

export interface DemoMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface DemoEmotionalState {
  mood: string;
  emotions: Record<string, number>;
  valence?: number;
  arousal?: number;
  dominance?: number;
}

export interface DemoSession {
  id: string;
  createdAt: number;
  ip: string;
  messageCount: number;
  lastMessageAt: number;
  emotionalState: DemoEmotionalState;
  history: DemoMessage[];
}

class DemoSessionService {
  private readonly sessionPrefix = 'demo:session:';
  private readonly ipPrefix = 'demo:ip:';
  private readonly inMemorySessions = new Map<string, DemoSession>();
  private readonly inMemoryIpCounts = new Map<string, number>();

  /**
   * Hash IP for privacy
   */
  private hashIp(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex');
  }

  /**
   * Get current date in YYYY-MM-DD format
   */
  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return randomUUID();
  }

  /**
   * Create new demo session
   */
  async createSession(ip: string): Promise<DemoSession> {
    const sessionId = this.generateSessionId();
    const hashedIp = this.hashIp(ip);

    const session: DemoSession = {
      id: sessionId,
      createdAt: Date.now(),
      ip: hashedIp,
      messageCount: 0,
      lastMessageAt: 0,
      emotionalState: {
        mood: 'friendly',
        emotions: {
          joy: 0.7,
          anticipation: 0.6,
        },
      },
      // Pre-populate with Luna's initial message to maintain context
      history: [
        {
          role: 'assistant',
          content: 'Hi! I\'m Luna 🌙. I\'m here to accompany you and listen to you. How are you today?',
          timestamp: Date.now(),
        },
      ],
    };

    if (isRedisAvailable && redis) {
      try {
        // Save session in Redis with TTL
        const key = `${this.sessionPrefix}${sessionId}`;
        await redis.set(key, JSON.stringify(session), {
          ex: DEMO_SESSION_TTL,
        });

        // Increment IP counter
        const ipKey = `${this.ipPrefix}${hashedIp}:${this.getToday()}`;
        await redis.incr(ipKey);
        await redis.expire(ipKey, DEMO_SESSION_TTL);

        log.info({ sessionId, hashedIp }, 'Demo session created in Redis');
      } catch (error) {
        log.error({ error, sessionId }, 'Failed to create session in Redis, using in-memory');
        this.inMemorySessions.set(sessionId, session);
      }
    } else {
      // Fallback to memory
      this.inMemorySessions.set(sessionId, session);
      log.info({ sessionId }, 'Demo session created in memory (Redis not available)');
    }

    return session;
  }

  /**
   * Get existing session
   */
  async getSession(sessionId: string): Promise<DemoSession | null> {
    if (isRedisAvailable && redis) {
      try {
        const key = `${this.sessionPrefix}${sessionId}`;
        const data = await redis.get(key);

        if (!data) {
          log.debug({ sessionId }, 'Session not found in Redis');
          return null;
        }

        return JSON.parse(data as string) as DemoSession;
      } catch (error) {
        log.error({ error, sessionId }, 'Failed to get session from Redis');
        // Try memory fallback
        return this.inMemorySessions.get(sessionId) || null;
      }
    } else {
      // Fallback to memory
      return this.inMemorySessions.get(sessionId) || null;
    }
  }

  /**
   * Update existing session
   */
  async updateSession(sessionId: string, data: Partial<DemoSession>): Promise<void> {
    const currentSession = await this.getSession(sessionId);

    if (!currentSession) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updatedSession = {
      ...currentSession,
      ...data,
    };

    if (isRedisAvailable && redis) {
      try {
        const key = `${this.sessionPrefix}${sessionId}`;
        await redis.set(key, JSON.stringify(updatedSession), {
          ex: DEMO_SESSION_TTL,
        });
        log.debug({ sessionId }, 'Session updated in Redis');
      } catch (error) {
        log.error({ error, sessionId }, 'Failed to update session in Redis');
        this.inMemorySessions.set(sessionId, updatedSession);
      }
    } else {
      // Fallback to memory
      this.inMemorySessions.set(sessionId, updatedSession);
    }
  }

  /**
   * Check if message can be sent (within limit)
   */
  async canSendMessage(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return false;
    }

    return session.messageCount < DEMO_MAX_MESSAGES;
  }

  /**
   * Increment message counter
   */
  async incrementMessageCount(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await this.updateSession(sessionId, {
      messageCount: session.messageCount + 1,
      lastMessageAt: Date.now(),
    });
  }

  /**
   * Check session limit per IP
   */
  async checkIpLimit(ip: string): Promise<boolean> {
    const hashedIp = this.hashIp(ip);
    const ipKey = `${this.ipPrefix}${hashedIp}:${this.getToday()}`;

    if (isRedisAvailable && redis) {
      try {
        const count = await redis.get(ipKey);
        const sessionCount = count ? parseInt(count as string) : 0;

        log.debug({ hashedIp, sessionCount, limit: DEMO_MAX_SESSIONS_PER_IP }, 'Checking IP limit');

        return sessionCount < DEMO_MAX_SESSIONS_PER_IP;
      } catch (error) {
        log.error({ error, hashedIp }, 'Failed to check IP limit in Redis');
        // Try memory fallback
        const count = this.inMemoryIpCounts.get(`${hashedIp}:${this.getToday()}`) || 0;
        return count < DEMO_MAX_SESSIONS_PER_IP;
      }
    } else {
      // Fallback to memory
      const key = `${hashedIp}:${this.getToday()}`;
      const count = this.inMemoryIpCounts.get(key) || 0;
      this.inMemoryIpCounts.set(key, count);
      return count < DEMO_MAX_SESSIONS_PER_IP;
    }
  }

  /**
   * Get or create session
   */
  async getOrCreateSession(sessionId: string | null, ip: string): Promise<DemoSession> {
    // If sessionId exists, try to recover
    if (sessionId) {
      const existing = await this.getSession(sessionId);
      if (existing) {
        log.debug({ sessionId }, 'Existing session found');
        return existing;
      }
      log.debug({ sessionId }, 'Session ID provided but not found, creating new');
    }

    // Check IP limit before creating
    const canCreate = await this.checkIpLimit(ip);
    if (!canCreate) {
      throw new Error('IP session limit exceeded');
    }

    // Create new session
    return await this.createSession(ip);
  }

  /**
   * Add message to history
   */
  async addMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const message: DemoMessage = {
      role,
      content,
      timestamp: Date.now(),
    };

    session.history.push(message);

    await this.updateSession(sessionId, {
      history: session.history,
    });
  }

  /**
   * Get remaining messages
   */
  async getMessagesRemaining(sessionId: string): Promise<number> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return 0;
    }

    return Math.max(0, DEMO_MAX_MESSAGES - session.messageCount);
  }

  /**
   * Delete session (for testing or manual cleanup)
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (isRedisAvailable && redis) {
      try {
        const key = `${this.sessionPrefix}${sessionId}`;
        await redis.del(key);
        log.info({ sessionId }, 'Session deleted from Redis');
      } catch (error) {
        log.error({ error, sessionId }, 'Failed to delete session from Redis');
      }
    }

    this.inMemorySessions.delete(sessionId);
  }

  /**
   * Get session statistics (for monitoring)
   */
  getStats() {
    return {
      inMemorySessionCount: this.inMemorySessions.size,
      inMemoryIpCount: this.inMemoryIpCounts.size,
      redisAvailable: isRedisAvailable,
      config: {
        sessionTTL: DEMO_SESSION_TTL,
        maxMessages: DEMO_MAX_MESSAGES,
        maxSessionsPerIp: DEMO_MAX_SESSIONS_PER_IP,
      },
    };
  }
}

// Export singleton instance
export const demoSessionService = new DemoSessionService();
