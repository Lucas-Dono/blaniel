/**
 * Retention Leaderboard System
 * Sistema de rankings basado en retention y consistencia
 */

import { prisma } from "@/lib/prisma";
import log from "@/lib/logging/logger";
import { nanoid } from "nanoid";

/**
 * Calcular y actualizar el leaderboard de retention
 * Este endpoint debe ser llamado por un cron job diariamente
 */
export async function updateRetentionLeaderboard(): Promise<{
  updated: number;
  period: { start: Date; end: Date };
}> {
  try {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 30); // Últimos 30 días

    log.info({ periodStart, periodEnd: now }, "Updating retention leaderboard");

    // Get todos los usuarios con bonds
    const usersWithBonds = await prisma.user.findMany({
      where: {
        SymbolicBond: {
          some: {},
        },
      },
      select: {
        id: true,
      },
    });

    log.info({ totalUsers: usersWithBonds.length }, "Processing users");

    let updated = 0;

    // Calcular métricas para cada usuario
    for (const user of usersWithBonds) {
      try {
        const metrics = await calculateUserRetentionMetrics(user.id, periodStart, now);

        // Create o actualizar entrada en leaderboard
        await prisma.retentionLeaderboard.upsert({
          where: {
            userId_periodStart_periodEnd: {
              userId: user.id,
              periodStart,
              periodEnd: now,
            },
          },
          update: {
            activeBondsCount: metrics.activeBondsCount,
            averageBondDuration: metrics.averageBondDuration,
            totalInteractions: metrics.totalInteractions,
            consistencyScore: metrics.consistencyScore,
            lastUpdated: now,
          },
          create: {
            id: nanoid(),
            userId: user.id,
            activeBondsCount: metrics.activeBondsCount,
            averageBondDuration: metrics.averageBondDuration,
            totalInteractions: metrics.totalInteractions,
            consistencyScore: metrics.consistencyScore,
            periodStart,
            periodEnd: now,
          },
        });

        updated++;
      } catch (error) {
        log.error({ error, userId: user.id }, "Error processing user for leaderboard");
      }
    }

    // Calcular rankings
    await calculateRankings(periodStart, now);

    log.info({ updated, periodStart, periodEnd: now }, "Retention leaderboard updated");

    return {
      updated,
      period: { start: periodStart, end: now },
    };
  } catch (error) {
    log.error({ error }, "Error updating retention leaderboard");
    throw error;
  }
}

/**
 * Calcular métricas de retention para un usuario
 */
async function calculateUserRetentionMetrics(
  userId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  activeBondsCount: number;
  averageBondDuration: number;
  totalInteractions: number;
  consistencyScore: number;
}> {
  // Get bonds activos
  const activeBonds = await prisma.symbolicBond.findMany({
    where: {
      userId,
      status: "active",
    },
  });

  // Calcular duración promedio de bonds
  let totalDuration = 0;
  for (const bond of activeBonds) {
    const duration = Math.floor(
      (Date.now() - bond.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    totalDuration += duration;
  }

  const averageBondDuration =
    activeBonds.length > 0 ? totalDuration / activeBonds.length : 0;

  // Contar interacciones en el período
  const totalInteractions = await prisma.message.count({
    where: {
      userId,
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
  });

  // Calcular consistency score
  const consistencyScore = calculateConsistencyScore(
    activeBonds.length,
    averageBondDuration,
    totalInteractions,
    periodStart,
    periodEnd
  );

  return {
    activeBondsCount: activeBonds.length,
    averageBondDuration: Math.round(averageBondDuration * 10) / 10,
    totalInteractions,
    consistencyScore: Math.round(consistencyScore * 10) / 10,
  };
}

/**
 * Calcular score de consistencia (0-100)
 */
function calculateConsistencyScore(
  activeBondsCount: number,
  averageBondDuration: number,
  totalInteractions: number,
  periodStart: Date,
  periodEnd: Date
): number {
  const periodDays = Math.floor(
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Componentes del score
  const bondsScore = Math.min(activeBondsCount * 5, 30); // Máx 30 puntos
  const durationScore = Math.min(averageBondDuration / 3, 30); // Máx 30 puntos (100 días = 30 puntos)
  const interactionsScore = Math.min((totalInteractions / periodDays) * 10, 40); // Máx 40 puntos

  return Math.min(bondsScore + durationScore + interactionsScore, 100);
}

/**
 * Calcular rankings globales, semanales y mensuales
 */
async function calculateRankings(periodStart: Date, periodEnd: Date): Promise<void> {
  try {
    // Global ranking (basado en consistency score)
    const entries = await prisma.retentionLeaderboard.findMany({
      where: {
        periodStart,
        periodEnd,
      },
      orderBy: [
        { consistencyScore: "desc" },
        { activeBondsCount: "desc" },
        { totalInteractions: "desc" },
      ],
    });

    // Asignar rankings globales
    for (let i = 0; i < entries.length; i++) {
      await prisma.retentionLeaderboard.update({
        where: { id: entries[i].id },
        data: { globalRank: i + 1 },
      });
    }

    // Weekly ranking (últimos 7 días)
    const weekStart = new Date(periodEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const weeklyEntries = await prisma.retentionLeaderboard.findMany({
      where: {
        periodStart: { gte: weekStart },
        periodEnd,
      },
      orderBy: [
        { totalInteractions: "desc" },
        { consistencyScore: "desc" },
      ],
    });

    for (let i = 0; i < weeklyEntries.length; i++) {
      await prisma.retentionLeaderboard.update({
        where: { id: weeklyEntries[i].id },
        data: { weeklyRank: i + 1 },
      });
    }

    // Monthly ranking
    const monthStart = new Date(periodEnd);
    monthStart.setDate(monthStart.getDate() - 30);

    const monthlyEntries = await prisma.retentionLeaderboard.findMany({
      where: {
        periodStart: { gte: monthStart },
        periodEnd,
      },
      orderBy: [
        { consistencyScore: "desc" },
        { averageBondDuration: "desc" },
      ],
    });

    for (let i = 0; i < monthlyEntries.length; i++) {
      await prisma.retentionLeaderboard.update({
        where: { id: monthlyEntries[i].id },
        data: { monthlyRank: i + 1 },
      });
    }

    log.info(
      {
        globalEntries: entries.length,
        weeklyEntries: weeklyEntries.length,
        monthlyEntries: monthlyEntries.length,
      },
      "Rankings calculated"
    );
  } catch (error) {
    log.error({ error }, "Error calculating rankings");
  }
}

/**
 * Obtener leaderboard con filtros
 */
export async function getRetentionLeaderboard(options: {
  type?: "global" | "weekly" | "monthly";
  limit?: number;
  userId?: string;
}): Promise<any[]> {
  const { type = "global", limit = 50, userId } = options;

  try {
    // Get most recent period
    const latestEntry = await prisma.retentionLeaderboard.findFirst({
      orderBy: { lastUpdated: "desc" },
    });

    if (!latestEntry) {
      return [];
    }

    const rankField =
      type === "global"
        ? "globalRank"
        : type === "weekly"
        ? "weeklyRank"
        : "monthlyRank";

    // Get entradas del leaderboard
    const entries = await prisma.retentionLeaderboard.findMany({
      where: {
        periodStart: latestEntry.periodStart,
        periodEnd: latestEntry.periodEnd,
        [rankField]: { not: null },
      },
      orderBy: { [rankField]: "asc" },
      take: limit,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Si se pidió un usuario específico, incluirlo aunque no esté en top
    if (userId) {
      const userEntry = await prisma.retentionLeaderboard.findFirst({
        where: {
          userId,
          periodStart: latestEntry.periodStart,
          periodEnd: latestEntry.periodEnd,
        },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      if (userEntry && !entries.find((e) => e.userId === userId)) {
        entries.push(userEntry);
      }
    }

    return entries.map((entry) => ({
      userId: entry.userId,
      userName: entry.User?.name || "Usuario Anónimo",
      userImage: entry.User?.image,
      rank: entry[rankField],
      activeBondsCount: entry.activeBondsCount,
      averageBondDuration: entry.averageBondDuration,
      totalInteractions: entry.totalInteractions,
      consistencyScore: entry.consistencyScore,
      isCurrentUser: entry.userId === userId,
    }));
  } catch (error) {
    log.error({ error, options }, "Error getting retention leaderboard");
    return [];
  }
}

/**
 * Obtener posición del usuario en el leaderboard
 */
export async function getUserLeaderboardPosition(userId: string): Promise<{
  global: number | null;
  weekly: number | null;
  monthly: number | null;
  percentile: number;
  metrics: any;
} | null> {
  try {
    // Get user's most recent entry
    const entry = await prisma.retentionLeaderboard.findFirst({
      where: { userId },
      orderBy: { lastUpdated: "desc" },
    });

    if (!entry) {
      return null;
    }

    // Calcular percentile
    const totalUsers = await prisma.retentionLeaderboard.count({
      where: {
        periodStart: entry.periodStart,
        periodEnd: entry.periodEnd,
      },
    });

    const percentile = entry.globalRank
      ? Math.round(((totalUsers - entry.globalRank) / totalUsers) * 100)
      : 0;

    return {
      global: entry.globalRank,
      weekly: entry.weeklyRank,
      monthly: entry.monthlyRank,
      percentile,
      metrics: {
        activeBondsCount: entry.activeBondsCount,
        averageBondDuration: entry.averageBondDuration,
        totalInteractions: entry.totalInteractions,
        consistencyScore: entry.consistencyScore,
      },
    };
  } catch (error) {
    log.error({ error, userId }, "Error getting user leaderboard position");
    return null;
  }
}
