/**
 * EMOTIONAL SYSTEM ANALYTICS TRACKER
 *
 * Tracks metrics of the hybrid emotional system for:
 * - Monitor performance (Fast vs Deep Path)
 * - Optimize costs
 * - Detect issues (e.g., too much Deep Path)
 * - Usage analytics
 *
 * Tracked metrics:
 * - Path usage (fast/deep)
 * - Processing time
 * - Cost per message
 * - Complexity score distribution
 * - Emotional states frequency
 * - Dyads distribution
 *
 * USAGE:
 * import { analyticsTracker } from "@/lib/emotional-system/analytics-tracker";
 *
 * // Track processing
 * analyticsTracker.track({
 *   agentId,
 *   userId,
 *   path: "fast",
 *   processingTimeMs: 50,
 *   costEstimate: 0,
 *   complexityScore: 0.2,
 * });
 *
 * // Get stats
 * const stats = await analyticsTracker.getStats(agentId);
 */

import { prisma } from "@/lib/prisma";

export interface AnalyticsEvent {
  agentId: string;
  userId: string;
  path: "fast" | "deep";
  processingTimeMs: number;
  costEstimate: number;
  complexityScore: number;
  primaryEmotion?: string;
  activeDyads?: string[];
  emotionalStability?: number;
  timestamp?: Date;
}

export interface AnalyticsStats {
  totalMessages: number;
  pathDistribution: {
    fast: number;
    deep: number;
    fastPercentage: number;
    deepPercentage: number;
  };
  performance: {
    avgProcessingTimeMs: number;
    avgFastPathTimeMs: number;
    avgDeepPathTimeMs: number;
  };
  costs: {
    totalCost: number;
    avgCostPerMessage: number;
    projectedMonthlyCost: number; // Projection for 1000 messages/month
  };
  complexity: {
    avgComplexityScore: number;
    distribution: {
      simple: number; // 0-0.3
      moderate: number; // 0.3-0.7
      complex: number; // 0.7-1.0
    };
  };
  emotions: {
    topPrimaryEmotions: Array<{ emotion: string; count: number }>;
    topDyads: Array<{ dyad: string; count: number }>;
    avgEmotionalStability: number;
  };
  period: {
    start: Date;
    end: Date;
    daysTracked: number;
  };
}

/**
 * Structure to store events in memory before flush to DB
 */
interface InMemoryEvent extends AnalyticsEvent {
  timestamp: Date;
}

export class EmotionalSystemAnalyticsTracker {
  private events: InMemoryEvent[] = [];
  private readonly FLUSH_INTERVAL_MS = 60000; // 1 minuto
  private readonly MAX_EVENTS_IN_MEMORY = 100;
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor() {
    // Periodic auto-flush
    this.startAutoFlush();
  }

  /**
   * Track an emotional processing event
   */
  track(event: AnalyticsEvent): void {
    const timestampedEvent: InMemoryEvent = {
      ...event,
      timestamp: event.timestamp || new Date(),
    };

    this.events.push(timestampedEvent);

    // Flush if we reach the limit
    if (this.events.length >= this.MAX_EVENTS_IN_MEMORY) {
      this.flush();
    }
  }

  /**
   * Flush events to the database
   */
  async flush(): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToFlush = [...this.events];
    this.events = [];

    try {
      // Save to analytics table
      // (Assuming `EmotionalAnalytics` table exists)
      await prisma.$executeRaw`
        INSERT INTO "EmotionalAnalytics" (
          "agentId",
          "userId",
          "path",
          "processingTimeMs",
          "costEstimate",
          "complexityScore",
          "primaryEmotion",
          "activeDyads",
          "emotionalStability",
          "timestamp"
        )
        VALUES ${eventsToFlush.map((e) => ({
          agentId: e.agentId,
          userId: e.userId,
          path: e.path,
          processingTimeMs: e.processingTimeMs,
          costEstimate: e.costEstimate,
          complexityScore: e.complexityScore,
          primaryEmotion: e.primaryEmotion || null,
          activeDyads: e.activeDyads || [],
          emotionalStability: e.emotionalStability || null,
          timestamp: e.timestamp,
        }))}
      `;

      console.log(`[Analytics] Flushed ${eventsToFlush.length} events to DB`);
    } catch (error) {
      // If it fails, save as JSON in an alternative field
      console.error("[Analytics] Error flushing to DB:", error);

      try {
        // TODO: Fallback mechanism disabled - InternalState schema doesn't have metadata field
        // If analytics persistence is needed, add a dedicated field to InternalState schema
        console.log(
          `[Analytics] Fallback save skipped (${eventsToFlush.length} events) - schema not configured`
        );
      } catch (fallbackError) {
        console.error("[Analytics] Fallback also failed:", fallbackError);
        // Restore events to memory to avoid losing them
        this.events = [...eventsToFlush, ...this.events];
      }
    }
  }

  /** Gets statistics from the emotional system */
  async getStats(
    agentId: string,
    daysBack: number = 30
  ): Promise<AnalyticsStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Try to get from dedicated table first
    let events: InMemoryEvent[] = [];

    try {
      // If EmotionalAnalytics table exists
      const dbEvents = await prisma.$queryRaw<any[]>`
        SELECT * FROM "EmotionalAnalytics"
        WHERE "agentId" = ${agentId}
          AND "timestamp" >= ${startDate}
        ORDER BY "timestamp" DESC
      `;

      events = dbEvents.map((e) => ({
        agentId: e.agentId,
        userId: e.userId,
        path: e.path,
        processingTimeMs: e.processingTimeMs,
        costEstimate: e.costEstimate,
        complexityScore: e.complexityScore,
        primaryEmotion: e.primaryEmotion,
        activeDyads: e.activeDyads,
        emotionalStability: e.emotionalStability,
        timestamp: new Date(e.timestamp),
      }));
    } catch {
      // TODO: Fallback storage disabled - InternalState schema doesn't have metadata field
      console.log("[Analytics] Fallback storage not available - using in-memory events only");
    }

    // Add in-memory events
    const inMemoryForAgent = this.events.filter((e) => e.agentId === agentId);
    events = [...events, ...inMemoryForAgent];

    // Calculate statistics
    return this.calculateStats(events, startDate, new Date());
  }

  /** Calculates statistics from events */
  private calculateStats(
    events: InMemoryEvent[],
    startDate: Date,
    endDate: Date
  ): AnalyticsStats {
    if (events.length === 0) {
      return this.getEmptyStats(startDate, endDate);
    }

    // Path distribution
    const fastPathEvents = events.filter((e) => e.path === "fast");
    const deepPathEvents = events.filter((e) => e.path === "deep");

    const pathDistribution = {
      fast: fastPathEvents.length,
      deep: deepPathEvents.length,
      fastPercentage: (fastPathEvents.length / events.length) * 100,
      deepPercentage: (deepPathEvents.length / events.length) * 100,
    };

    // Performance
    const avgProcessingTimeMs =
      events.reduce((sum, e) => sum + e.processingTimeMs, 0) / events.length;
    const avgFastPathTimeMs =
      fastPathEvents.length > 0
        ? fastPathEvents.reduce((sum, e) => sum + e.processingTimeMs, 0) /
          fastPathEvents.length
        : 0;
    const avgDeepPathTimeMs =
      deepPathEvents.length > 0
        ? deepPathEvents.reduce((sum, e) => sum + e.processingTimeMs, 0) /
          deepPathEvents.length
        : 0;

    const performance = {
      avgProcessingTimeMs,
      avgFastPathTimeMs,
      avgDeepPathTimeMs,
    };

    // Costs
    const totalCost = events.reduce((sum, e) => sum + e.costEstimate, 0);
    const avgCostPerMessage = totalCost / events.length;
    const projectedMonthlyCost = avgCostPerMessage * 1000; // 1000 messages/month

    const costs = {
      totalCost,
      avgCostPerMessage,
      projectedMonthlyCost,
    };

    // Complexity
    const avgComplexityScore =
      events.reduce((sum, e) => sum + e.complexityScore, 0) / events.length;
    const simple = events.filter((e) => e.complexityScore < 0.3).length;
    const moderate = events.filter(
      (e) => e.complexityScore >= 0.3 && e.complexityScore < 0.7
    ).length;
    const complex = events.filter((e) => e.complexityScore >= 0.7).length;

    const complexity = {
      avgComplexityScore,
      distribution: { simple, moderate, complex },
    };

    // Emotions
    const emotionCounts: Record<string, number> = {};
    const dyadCounts: Record<string, number> = {};
    let totalStability = 0;
    let stabilityCount = 0;

    for (const event of events) {
      if (event.primaryEmotion) {
        emotionCounts[event.primaryEmotion] =
          (emotionCounts[event.primaryEmotion] || 0) + 1;
      }

      if (event.activeDyads) {
        for (const dyad of event.activeDyads) {
          dyadCounts[dyad] = (dyadCounts[dyad] || 0) + 1;
        }
      }

      if (event.emotionalStability !== undefined) {
        totalStability += event.emotionalStability;
        stabilityCount++;
      }
    }

    const topPrimaryEmotions = Object.entries(emotionCounts)
      .map(([emotion, count]) => ({ emotion, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topDyads = Object.entries(dyadCounts)
      .map(([dyad, count]) => ({ dyad, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const avgEmotionalStability =
      stabilityCount > 0 ? totalStability / stabilityCount : 0.5;

    const emotions = {
      topPrimaryEmotions,
      topDyads,
      avgEmotionalStability,
    };

    // Period
    const daysTracked = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      totalMessages: events.length,
      pathDistribution,
      performance,
      costs,
      complexity,
      emotions,
      period: {
        start: startDate,
        end: endDate,
        daysTracked,
      },
    };
  }

  /** Empty stats */
  private getEmptyStats(startDate: Date, endDate: Date): AnalyticsStats {
    return {
      totalMessages: 0,
      pathDistribution: {
        fast: 0,
        deep: 0,
        fastPercentage: 0,
        deepPercentage: 0,
      },
      performance: {
        avgProcessingTimeMs: 0,
        avgFastPathTimeMs: 0,
        avgDeepPathTimeMs: 0,
      },
      costs: {
        totalCost: 0,
        avgCostPerMessage: 0,
        projectedMonthlyCost: 0,
      },
      complexity: {
        avgComplexityScore: 0,
        distribution: { simple: 0, moderate: 0, complex: 0 },
      },
      emotions: {
        topPrimaryEmotions: [],
        topDyads: [],
        avgEmotionalStability: 0.5,
      },
      period: {
        start: startDate,
        end: endDate,
        daysTracked: Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        ),
      },
    };
  }

  /** Periodic auto-flush */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Stop auto-flush (cleanup)
   */
  stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
  }

  /**
   * Convenient API: Generates text report
   */
  async generateReport(agentId: string, daysBack: number = 30): Promise<string> {
    const stats = await this.getStats(agentId, daysBack);

    if (stats.totalMessages === 0) {
      return `No analytics data available for the last ${daysBack} days.`;
    }

    return `
📊 ANALYTICS REPORT - Hybrid Emotional System
══════════════════════════════════════════════════════

Period: ${stats.period.start.toLocaleDateString()} - ${stats.period.end.toLocaleDateString()} (${stats.period.daysTracked} days)
Total messages: ${stats.totalMessages}

🛤️  PATH DISTRIBUTION
  Fast Path: ${stats.pathDistribution.fast} (${stats.pathDistribution.fastPercentage.toFixed(1)}%)
  Deep Path: ${stats.pathDistribution.deep} (${stats.pathDistribution.deepPercentage.toFixed(1)}%)

⚡ PERFORMANCE
  Average time: ${stats.performance.avgProcessingTimeMs.toFixed(0)}ms
  Fast Path average: ${stats.performance.avgFastPathTimeMs.toFixed(0)}ms
  Deep Path average: ${stats.performance.avgDeepPathTimeMs.toFixed(0)}ms

💰 COSTS
  Total cost: $${stats.costs.totalCost.toFixed(4)}
  Average cost/message: $${stats.costs.avgCostPerMessage.toFixed(6)}
  Monthly projection (1000 msgs): $${stats.costs.projectedMonthlyCost.toFixed(2)}

📈 COMPLEXITY
  Average score: ${stats.complexity.avgComplexityScore.toFixed(2)}
  Distribution:
    - Simple (0-0.3): ${stats.complexity.distribution.simple}
    - Moderate (0.3-0.7): ${stats.complexity.distribution.moderate}
    - Complex (0.7-1.0): ${stats.complexity.distribution.complex}

🎭 EMOTIONS
  Average emotional stability: ${(stats.emotions.avgEmotionalStability * 100).toFixed(0)}%

  Top primary emotions:
${stats.emotions.topPrimaryEmotions.map((e) => `    - ${e.emotion}: ${e.count}`).join("\n")}

  Top dyads:
${stats.emotions.topDyads.map((d) => `    - ${d.dyad}: ${d.count}`).join("\n")}
    `.trim();
  }
}

/**
 * Singleton instance
 */
export const analyticsTracker = new EmotionalSystemAnalyticsTracker();

// Cleanup on exit
process.on("beforeExit", () => {
  analyticsTracker.flush();
  analyticsTracker.stopAutoFlush();
});
