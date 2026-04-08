/**
 * Firecrawl Credits Tracker - Redis-based persistent credit tracking
 * Tracks monthly credit usage for Firecrawl API to prevent exceeding limits
 */

import Redis from 'ioredis';

const REDIS_KEY = 'firecrawl:credits';
const REDIS_MONTH_KEY = 'firecrawl:credits:month';

export class FirecrawlCreditsTracker {
  private redis: Redis | null = null;
  private monthlyLimit: number;

  constructor(monthlyLimit: number = 500) {
    this.monthlyLimit = monthlyLimit;

    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL);
      }
    } catch (error) {
      console.warn('[FirecrawlCredits] Redis not available, credits will not be tracked:', error);
    }
  }

  /**
   * Get current month string (YYYY-MM format)
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Get current credits used this month
   */
  async getCreditsUsed(): Promise<number> {
    if (!this.redis) {
      console.warn('[FirecrawlCredits] Redis not available, returning 0');
      return 0;
    }

    try {
      const currentMonth = this.getCurrentMonth();

      // Check if stored month matches current month
      const storedMonth = await this.redis.get(REDIS_MONTH_KEY);

      if (storedMonth !== currentMonth) {
        // New month - reset counter
        console.log('[FirecrawlCredits] New month detected, resetting credits');
        await this.redis.set(REDIS_KEY, '0');
        await this.redis.set(REDIS_MONTH_KEY, currentMonth);
        return 0;
      }

      // Get current credits
      const credits = await this.redis.get(REDIS_KEY);
      return credits ? parseInt(credits, 10) : 0;
    } catch (error) {
      console.error('[FirecrawlCredits] Error getting credits:', error);
      return 0;
    }
  }

  /**
   * Increment credits used
   * @param amount Number of credits to add (default: 1)
   */
  async incrementCredits(amount: number = 1): Promise<number> {
    if (!this.redis) {
      console.warn('[FirecrawlCredits] Redis not available, cannot track credits');
      return 0;
    }

    try {
      const currentMonth = this.getCurrentMonth();

      // Ensure month is set
      const storedMonth = await this.redis.get(REDIS_MONTH_KEY);
      if (storedMonth !== currentMonth) {
        await this.redis.set(REDIS_KEY, '0');
        await this.redis.set(REDIS_MONTH_KEY, currentMonth);
      }

      // Increment credits
      const newTotal = await this.redis.incrby(REDIS_KEY, amount);

      console.log(`[FirecrawlCredits] Credits used: ${newTotal}/${this.monthlyLimit}`);

      // Warn if approaching limit
      if (newTotal >= this.monthlyLimit * 0.9) {
        console.warn(
          `[FirecrawlCredits] WARNING: Approaching monthly limit (${newTotal}/${this.monthlyLimit})`
        );
      }

      return newTotal;
    } catch (error) {
      console.error('[FirecrawlCredits] Error incrementing credits:', error);
      return 0;
    }
  }

  /**
   * Check if credits are available
   */
  async hasCreditsAvailable(): Promise<boolean> {
    const used = await this.getCreditsUsed();
    return used < this.monthlyLimit;
  }

  /**
   * Get credits remaining
   */
  async getCreditsRemaining(): Promise<number> {
    const used = await this.getCreditsUsed();
    return Math.max(0, this.monthlyLimit - used);
  }

  /**
   * Reset credits (admin function)
   */
  async resetCredits(): Promise<void> {
    if (!this.redis) {
      console.warn('[FirecrawlCredits] Redis not available');
      return;
    }

    try {
      await this.redis.set(REDIS_KEY, '0');
      await this.redis.set(REDIS_MONTH_KEY, this.getCurrentMonth());
      console.log('[FirecrawlCredits] Credits reset successfully');
    } catch (error) {
      console.error('[FirecrawlCredits] Error resetting credits:', error);
    }
  }

  /**
   * Get stats for monitoring
   */
  async getStats(): Promise<{
    used: number;
    remaining: number;
    limit: number;
    month: string;
    percentageUsed: number;
  }> {
    const used = await this.getCreditsUsed();
    const remaining = await this.getCreditsRemaining();
    const percentageUsed = (used / this.monthlyLimit) * 100;

    return {
      used,
      remaining,
      limit: this.monthlyLimit,
      month: this.getCurrentMonth(),
      percentageUsed: Math.round(percentageUsed * 100) / 100,
    };
  }
}

// Singleton instance
let trackerInstance: FirecrawlCreditsTracker | null = null;

export function getFirecrawlCreditsTracker(): FirecrawlCreditsTracker {
  if (!trackerInstance) {
    const monthlyLimit = parseInt(process.env.FIRECRAWL_MONTHLY_LIMIT || '500', 10);
    trackerInstance = new FirecrawlCreditsTracker(monthlyLimit);
  }
  return trackerInstance;
}
