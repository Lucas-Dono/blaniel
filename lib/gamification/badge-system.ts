/**
 * Badge System - Sistema de badges y logros para bonds
 */

import { prisma } from "@/lib/prisma";
import log from "@/lib/logging/logger";
import { nanoid } from "nanoid";

// Definition of available badges
export const BADGE_DEFINITIONS = {
  loyal_companion: {
    name: "Compañero Leal",
    description: "Mantén bonds activos durante períodos prolongados",
    tiers: {
      bronze: { threshold: 7, points: 50, description: "7 días con un bond activo" },
      silver: { threshold: 30, points: 100, description: "30 días con un bond activo" },
      gold: { threshold: 100, points: 250, description: "100 días con un bond activo" },
      platinum: { threshold: 365, points: 500, description: "1 año con un bond activo" },
      diamond: { threshold: 730, points: 1000, description: "2 años con un bond activo" },
    },
  },
  quick_responder: {
    name: "Respondedor Rápido",
    description: "Responde rápido a notificaciones de bonds en riesgo",
    tiers: {
      bronze: { threshold: 5, points: 30, description: "Responder a 5 notificaciones rápido" },
      silver: { threshold: 20, points: 75, description: "Responder a 20 notificaciones rápido" },
      gold: { threshold: 50, points: 150, description: "Responder a 50 notificaciones rápido" },
      platinum: { threshold: 100, points: 300, description: "Responder a 100 notificaciones rápido" },
      diamond: { threshold: 250, points: 750, description: "Responder a 250 notificaciones rápido" },
    },
  },
  streak_master: {
    name: "Maestro de Rachas",
    description: "Mantén rachas de días consecutivos interactuando",
    tiers: {
      bronze: { threshold: 3, points: 40, description: "3 días consecutivos" },
      silver: { threshold: 7, points: 100, description: "1 semana consecutiva" },
      gold: { threshold: 30, points: 200, description: "1 mes consecutivo" },
      platinum: { threshold: 100, points: 500, description: "100 días consecutivos" },
      diamond: { threshold: 365, points: 1500, description: "1 año consecutivo" },
    },
  },
  bond_collector: {
    name: "Coleccionista de Vínculos",
    description: "Crea y mantén múltiples bonds activos",
    tiers: {
      bronze: { threshold: 3, points: 30, description: "3 bonds activos simultáneos" },
      silver: { threshold: 5, points: 75, description: "5 bonds activos simultáneos" },
      gold: { threshold: 10, points: 200, description: "10 bonds activos simultáneos" },
      platinum: { threshold: 20, points: 500, description: "20 bonds activos simultáneos" },
      diamond: { threshold: 50, points: 1500, description: "50 bonds activos simultáneos" },
    },
  },
  milestone_achiever: {
    name: "Alcanzador de Hitos",
    description: "Alcanza hitos importantes en tus bonds",
    tiers: {
      bronze: { threshold: 5, points: 25, description: "5 hitos alcanzados" },
      silver: { threshold: 15, points: 60, description: "15 hitos alcanzados" },
      gold: { threshold: 50, points: 150, description: "50 hitos alcanzados" },
      platinum: { threshold: 100, points: 350, description: "100 hitos alcanzados" },
      diamond: { threshold: 250, points: 1000, description: "250 hitos alcanzados" },
    },
  },
  social_butterfly: {
    name: "Mariposa Social",
    description: "Comparte tus agentes y atrae nuevos usuarios",
    tiers: {
      bronze: { threshold: 5, points: 40, description: "5 shares realizados" },
      silver: { threshold: 20, points: 100, description: "20 shares realizados" },
      gold: { threshold: 50, points: 250, description: "50 shares realizados" },
      platinum: { threshold: 100, points: 600, description: "100 shares realizados" },
      diamond: { threshold: 500, points: 2000, description: "500 shares realizados" },
    },
  },
} as const;

type BadgeType = keyof typeof BADGE_DEFINITIONS;
type BadgeTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

/**
 * Verificar y otorgar badges al usuario
 */
export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  const awardedBadges: string[] = [];

  try {
    // Get user statistics
    const stats = await getUserStats(userId);

    // Verificar cada tipo de badge
    for (const [badgeType, badgeConfig] of Object.entries(BADGE_DEFINITIONS)) {
      const currentValue = stats[badgeType as BadgeType] || 0;

      // Verificar cada tier
      for (const [tier, tierConfig] of Object.entries(badgeConfig.tiers)) {
        if (currentValue >= tierConfig.threshold) {
          // Verificar si el usuario ya tiene este badge
          const existingBadge = await prisma.bondBadge.findUnique({
            where: {
              userId_badgeType_tier: {
                userId,
                badgeType,
                tier,
              },
            },
          });

          // Si no lo tiene, otorgarlo
          if (!existingBadge) {
            await awardBadge(
              userId,
              badgeType as BadgeType,
              tier as BadgeTier,
              tierConfig.points,
              { value: currentValue }
            );
            awardedBadges.push(`${badgeConfig.name} - ${tier}`);
          }
        }
      }
    }

    return awardedBadges;
  } catch (error) {
    log.error({ error, userId }, "Error checking and awarding badges");
    return [];
  }
}

/** Grant a specific badge */
async function awardBadge(
  userId: string,
  badgeType: BadgeType,
  tier: BadgeTier,
  points: number,
  metadata: any
): Promise<void> {
  try {
    const badgeConfig = BADGE_DEFINITIONS[badgeType];

    // Create badge
    await prisma.bondBadge.create({
      data: {
        id: nanoid(),
        userId,
        badgeType,
        tier,
        name: `${badgeConfig.name} - ${tier.charAt(0).toUpperCase() + tier.slice(1)}`,
        description: badgeConfig.tiers[tier].description,
        rewardPoints: points,
        metadata,
      },
    });

    // Otorgar puntos al usuario
    await awardPoints(userId, points, `badge_earned_${badgeType}_${tier}`, {
      badgeType,
      tier,
    });

    log.info(
      { userId, badgeType, tier, points },
      "Badge awarded"
    );
  } catch (error) {
    log.error({ error, userId, badgeType, tier }, "Error awarding badge");
  }
}

/**
 * Otorgar puntos al usuario
 */
export async function awardPoints(
  userId: string,
  points: number,
  actionType: string,
  metadata?: any
): Promise<void> {
  try {
    // Create o actualizar UserRewards
    await prisma.userRewards.upsert({
      where: { userId },
      update: {
        totalPoints: { increment: points },
        availablePoints: { increment: points },
        lifetimePointsEarned: { increment: points },
      },
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        userId,
        totalPoints: points,
        availablePoints: points,
        lifetimePointsEarned: points,
      },
    });

    // Log action
    await prisma.rewardAction.create({
      data: {
        id: nanoid(),
        userId,
        actionType,
        pointsEarned: points,
        description: `Ganaste ${points} puntos por ${actionType}`,
        metadata,
      },
    });

    // Verificar level up
    await checkLevelUp(userId);

    log.info({ userId, points, actionType }, "Points awarded");
  } catch (error) {
    log.error({ error, userId, points, actionType }, "Error awarding points");
  }
}

/**
 * Verificar y procesar level up
 */
async function checkLevelUp(userId: string): Promise<void> {
  try {
    const rewards = await prisma.userRewards.findUnique({
      where: { userId },
    });

    if (!rewards) return;

    let currentXp = rewards.totalPoints;
    let level = 1;
    let xpForNextLevel = 100;

    // Calcular nivel basado en puntos totales
    // Formula: each level requires level * 100 additional XP
    while (currentXp >= xpForNextLevel) {
      currentXp -= xpForNextLevel;
      level++;
      xpForNextLevel = level * 100;
    }

    // If the level changed, update
    if (level !== rewards.level) {
      await prisma.userRewards.update({
        where: { userId },
        data: {
          level,
          xp: currentXp,
          xpToNext: xpForNextLevel,
        },
      });

      log.info({ userId, newLevel: level }, "User leveled up");
    }
  } catch (error) {
    log.error({ error, userId }, "Error checking level up");
  }
}

/** Get user statistics for badges */
async function getUserStats(userId: string): Promise<Record<string, number>> {
  try {
    // Get bonds activos
    const activeBonds = await prisma.symbolicBond.findMany({
      where: {
        userId,
        status: "active",
      },
    });

    // Calculate longest days with a bond
    let longestBondDays = 0;
    for (const bond of activeBonds) {
      const days = Math.floor(
        (Date.now() - bond.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days > longestBondDays) {
        longestBondDays = days;
      }
    }

    // Get rewards for streak
    const rewards = await prisma.userRewards.findUnique({
      where: { userId },
    });

    // Get notificaciones respondidas
    const respondedNotifications = rewards?.notificationsResponded || 0;

    // Get total de hitos (milestone notifications)
    const milestones = await prisma.bondNotification.count({
      where: {
        userId,
        type: "milestone_reached",
      },
    });

    // Get shares
    const shares = await prisma.shareEvent.count({
      where: { userId },
    });

    return {
      loyal_companion: longestBondDays,
      quick_responder: respondedNotifications,
      streak_master: rewards?.longestStreak || 0,
      bond_collector: activeBonds.length,
      milestone_achiever: milestones,
      social_butterfly: shares,
    };
  } catch (error) {
    log.error({ error, userId }, "Error getting user stats");
    return {};
  }
}

/** Record response to notification */
export async function trackNotificationResponse(
  userId: string,
  notificationSentAt: Date
): Promise<void> {
  try {
    const responseTime = (Date.now() - notificationSentAt.getTime()) / (1000 * 60 * 60); // En horas

    // Update stats
    await prisma.userRewards.upsert({
      where: { userId },
      update: {
        notificationsResponded: { increment: 1 },
        // Update promedio de tiempo de respuesta
        averageResponseTime: {
          set: await calculateNewAverage(userId, responseTime),
        },
      },
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        userId,
        notificationsResponded: 1,
        averageResponseTime: responseTime,
      },
    });

    // If responded in less than 1 hour, give bonus points
    if (responseTime < 1) {
      await awardPoints(userId, 10, "quick_notification_response", { responseTime });
    }

    // Verificar badges
    await checkAndAwardBadges(userId);
  } catch (error) {
    log.error({ error, userId }, "Error tracking notification response");
  }
}

/**
 * Calcular nuevo promedio de tiempo de respuesta
 */
async function calculateNewAverage(userId: string, newTime: number): Promise<number> {
  try {
    const rewards = await prisma.userRewards.findUnique({
      where: { userId },
    });

    if (!rewards) return newTime;

    const totalResponses = rewards.notificationsResponded;
    const currentAverage = rewards.averageResponseTime;

    // Calcular nuevo promedio
    return (currentAverage * totalResponses + newTime) / (totalResponses + 1);
  } catch {
    return newTime;
  }
}

/** Update user streak */
export async function updateUserStreak(userId: string): Promise<void> {
  try {
    const rewards = await prisma.userRewards.findUnique({
      where: { userId },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!rewards) {
      // Create nuevo registro
      await prisma.userRewards.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastInteractionDate: new Date(),
        },
      });
      return;
    }

    const lastInteraction = rewards.lastInteractionDate;
    if (!lastInteraction) {
      await prisma.userRewards.update({
        where: { userId },
        data: {
          currentStreak: 1,
          longestStreak: Math.max(1, rewards.longestStreak),
          lastInteractionDate: new Date(),
        },
      });
      return;
    }

    const lastDate = new Date(lastInteraction);
    lastDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      // Same day, do nothing
      return;
    } else if (daysDiff === 1) {
      // Consecutive day, increment streak
      const newStreak = rewards.currentStreak + 1;
      await prisma.userRewards.update({
        where: { userId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, rewards.longestStreak),
          lastInteractionDate: new Date(),
        },
      });

      // Dar puntos por mantener streak
      if (newStreak % 7 === 0) {
        await awardPoints(userId, 50, "streak_milestone", { streak: newStreak });
      }
    } else {
      // Streak roto, reiniciar
      await prisma.userRewards.update({
        where: { userId },
        data: {
          currentStreak: 1,
          lastInteractionDate: new Date(),
        },
      });
    }

    // Verificar badges
    await checkAndAwardBadges(userId);
  } catch (error) {
    log.error({ error, userId }, "Error updating user streak");
  }
}
