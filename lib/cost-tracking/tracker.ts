/**
 * Cost Tracker for AI/LLM Operations
 * Handles async tracking with batch inserts for performance
 */

import { prisma } from '@/lib/prisma';
import { calculateLLMCost, calculateEmbeddingCost, calculateImageCost, calculatePaymentFee } from './calculator';

// In-memory buffer for batch inserts
const costBuffer: CostEntry[] = [];
const BUFFER_SIZE = 10;
const FLUSH_INTERVAL = 5000; // 5 seconds

interface CostEntry {
  userId?: string;
  agentId?: string;
  worldId?: string;
  type: 'llm' | 'embedding' | 'image' | 'payment';
  provider: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost: number;
  metadata?: Record<string, any>;
}

interface LLMCallParams {
  userId?: string;
  agentId?: string;
  worldId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost?: number; // Optional: will calculate if not provided
  metadata?: Record<string, any>;
}

interface EmbeddingParams {
  userId?: string;
  agentId?: string;
  worldId?: string;
  provider?: string;
  model: string;
  tokens: number;
  cost?: number; // Optional: will calculate if not provided
  metadata?: Record<string, any>;
}

interface ImageParams {
  userId?: string;
  agentId?: string;
  worldId?: string;
  provider?: string;
  model: string;
  resolution?: string;
  cost?: number; // Optional: will calculate if not provided
  metadata?: Record<string, any>;
}

interface PaymentParams {
  userId?: string;
  gateway: 'stripe' | 'mercadopago';
  amount: number;
  fee?: number; // Optional: will calculate if not provided
  metadata?: Record<string, any>;
}

/**
 * Flush buffer to database
 */
async function flushBuffer() {
  if (costBuffer.length === 0) return;

  const entries = [...costBuffer];
  costBuffer.length = 0; // Clear buffer

  try {
    // Check if costTracking model exists
    if (!(prisma as any).costTracking) {
      console.warn('[CostTracker] CostTracking model not found in Prisma schema - skipping flush');
      return;
    }

    await (prisma as any).costTracking.createMany({
      data: entries.map(entry => ({
        userId: entry.userId,
        agentId: entry.agentId,
        worldId: entry.worldId,
        type: entry.type,
        provider: entry.provider,
        model: entry.model,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        cost: entry.cost,
        metadata: entry.metadata,
      })),
      skipDuplicates: true,
    });

    console.log(`[CostTracker] Flushed ${entries.length} cost entries to database`);
  } catch (error) {
    console.error('[CostTracker] Error flushing buffer:', error);
    // Put entries back in buffer for retry
    costBuffer.push(...entries);
  }
}

/**
 * Add entry to buffer and flush if needed
 */
function addToBuffer(entry: CostEntry) {
  costBuffer.push(entry);

  // Flush if buffer is full
  if (costBuffer.length >= BUFFER_SIZE) {
    // Don't await - fire and forget
    flushBuffer().catch(err =>
      console.error('[CostTracker] Background flush error:', err)
    );
  }
}

/**
 * Track LLM API call
 */
export async function trackLLMCall(params: LLMCallParams): Promise<void> {
  const cost = params.cost ?? calculateLLMCost(
    params.model,
    params.inputTokens,
    params.outputTokens
  );

  const entry: CostEntry = {
    userId: params.userId,
    agentId: params.agentId,
    worldId: params.worldId,
    type: 'llm',
    provider: params.provider,
    model: params.model,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    cost,
    metadata: params.metadata,
  };

  addToBuffer(entry);
}

/**
 * Track embedding generation
 */
export async function trackEmbedding(params: EmbeddingParams): Promise<void> {
  const cost = params.cost ?? calculateEmbeddingCost(
    params.model,
    params.tokens
  );

  const entry: CostEntry = {
    userId: params.userId,
    agentId: params.agentId,
    worldId: params.worldId,
    type: 'embedding',
    provider: params.provider ?? 'qwen',
    model: params.model,
    inputTokens: params.tokens,
    cost,
    metadata: params.metadata,
  };

  addToBuffer(entry);
}

/**
 * Track image generation
 */
export async function trackImageGeneration(params: ImageParams): Promise<void> {
  const cost = params.cost ?? calculateImageCost(
    params.model,
    params.resolution
  );

  const entry: CostEntry = {
    userId: params.userId,
    agentId: params.agentId,
    worldId: params.worldId,
    type: 'image',
    provider: params.provider ?? 'stable-diffusion',
    model: params.model,
    cost,
    metadata: {
      resolution: params.resolution,
      ...params.metadata,
    },
  };

  addToBuffer(entry);
}

/**
 * Track payment gateway fee
 */
export async function trackPaymentFee(params: PaymentParams): Promise<void> {
  const fee = params.fee ?? calculatePaymentFee(
    params.gateway,
    params.amount
  );

  const entry: CostEntry = {
    userId: params.userId,
    type: 'payment',
    provider: params.gateway,
    cost: fee,
    metadata: {
      amount: params.amount,
      ...params.metadata,
    },
  };

  addToBuffer(entry);
}

/**
 * Get cost summary for a user or global
 */
export async function getCostSummary(
  userId?: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: any = {};

  if (userId) {
    where.userId = userId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  // Get total cost
  const totalResult = await (prisma as any).costTracking.aggregate({
    where,
    _sum: {
      cost: true,
    },
    _count: true,
  });

  // Get breakdown by type
  const byType = await (prisma as any).costTracking.groupBy({
    by: ['type'],
    where,
    _sum: {
      cost: true,
    },
    _count: true,
  });

  // Get breakdown by provider
  const byProvider = await (prisma as any).costTracking.groupBy({
    by: ['provider'],
    where,
    _sum: {
      cost: true,
    },
    _count: true,
  });

  // Get breakdown by model (top 10)
  const byModel = await (prisma as any).costTracking.groupBy({
    by: ['model'],
    where: {
      ...where,
      model: { not: null },
    },
    _sum: {
      cost: true,
    },
    _count: true,
    orderBy: {
      _sum: {
        cost: 'desc',
      },
    },
    take: 10,
  });

  return {
    total: totalResult._sum.cost ?? 0,
    callCount: totalResult._count,
    byType: byType.map((item: any) => ({
      type: item.type,
      cost: item._sum.cost ?? 0,
      count: item._count,
    })),
    byProvider: byProvider.map((item: any) => ({
      provider: item.provider,
      cost: item._sum.cost ?? 0,
      count: item._count,
    })),
    byModel: byModel.map((item: any) => ({
      model: item.model!,
      cost: item._sum.cost ?? 0,
      count: item._count,
    })),
  };
}

/**
 * Get daily costs for chart
 */
export async function getDailyCosts(
  userId?: string,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const where: any = {
    createdAt: {
      gte: startDate,
    },
  };

  if (userId) {
    where.userId = userId;
  }

  // Group by date
  const costs = await prisma.$queryRaw<Array<{ date: Date; cost: number; count: number }>>`
    SELECT
      DATE(created_at) as date,
      SUM(cost) as cost,
      COUNT(*) as count
    FROM "CostTracking"
    WHERE ${userId ? prisma.$queryRaw`user_id = ${userId} AND` : prisma.$queryRaw``}
      created_at >= ${startDate}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  return costs;
}

/**
 * Get top users by cost
 */
export async function getTopUsers(
  limit: number = 10,
  startDate?: Date,
  endDate?: Date
) {
  const where: any = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const topUsers = await (prisma as any).costTracking.groupBy({
    by: ['userId'],
    where: {
      ...where,
      userId: { not: null },
    },
    _sum: {
      cost: true,
    },
    _count: true,
    orderBy: {
      _sum: {
        cost: 'desc',
      },
    },
    take: limit,
  });

  return topUsers.map((item: any) => ({
    userId: item.userId!,
    cost: item._sum.cost ?? 0,
    count: item._count,
  }));
}

/**
 * Get cost projection for end of month
 */
export async function getCostProjection(userId?: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = endOfMonth.getDate();
  const daysPassed = now.getDate();

  // Get costs for this month so far
  const summary = await getCostSummary(userId, startOfMonth, now);

  // Calculate daily average
  const dailyAverage = summary.total / daysPassed;

  // Project to end of month
  const projected = dailyAverage * daysInMonth;

  // Get last 7 days average for trend
  const last7DaysStart = new Date();
  last7DaysStart.setDate(last7DaysStart.getDate() - 7);
  const last7Summary = await getCostSummary(userId, last7DaysStart, now);
  const last7DaysAverage = last7Summary.total / 7;

  // Calculate trend (growth/decline)
  const trend = last7DaysAverage > dailyAverage ? 'increasing' : 'decreasing';
  const trendPercentage = ((last7DaysAverage - dailyAverage) / dailyAverage) * 100;

  return {
    currentMonthCost: summary.total,
    dailyAverage,
    projectedMonthEnd: projected,
    daysInMonth,
    daysPassed,
    daysRemaining: daysInMonth - daysPassed,
    trend,
    trendPercentage,
    last7DaysAverage,
  };
}

/**
 * Force flush buffer (call before app shutdown)
 */
export async function forceFlush() {
  await flushBuffer();
}

// Auto-flush every interval
if (typeof window === 'undefined') {
  // Only run in Node.js environment
  setInterval(() => {
    flushBuffer().catch(err =>
      console.error('[CostTracker] Auto-flush error:', err)
    );
  }, FLUSH_INTERVAL);
}

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  let isShuttingDown = false;

  const handleShutdown = async (signal: string) => {
    // Avoid multiple simultaneous shutdowns
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log(`[CostTracker] ${signal} received, flushing buffer...`);

    try {
      await Promise.race([
        forceFlush(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Flush timeout')), 2000))
      ]);
      console.log('[CostTracker] Buffer flushed successfully');
    } catch (error) {
      console.error('[CostTracker] Error during shutdown flush:', error);
    } finally {
      // Siempre terminar el proceso, incluso si el flush falla
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}
