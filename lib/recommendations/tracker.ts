/**
 * Sistema de tracking de interacciones estilo Netflix/YouTube
 * Captura todas las interacciones del usuario para alimentar el sistema de recomendación
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

export interface TrackInteractionParams {
  userId: string;
  itemType: "agent" | "world";
  itemId: string;
  interactionType: "view" | "chat" | "message" | "rating" | "like" | "share" | "finish";
  duration?: number;
  messageCount?: number;
  completionRate?: number;
  rating?: number;
  liked?: boolean;
  shared?: boolean;
  metadata?: Record<string, any>;
  userAgent?: string;
}

/**
 * Detecta el tipo de dispositivo desde el user-agent
 */
function detectDeviceType(userAgent?: string): "mobile" | "tablet" | "desktop" {
  if (!userAgent) return "desktop";

  const ua = userAgent.toLowerCase();

  // Detectar tablet
  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
    return "tablet";
  }

  // Detectar mobile
  if (/mobile|iphone|ipod|android|blackberry|opera mini|opera mobi|skyfire|maemo|windows phone|palm|iemobile|symbian|symbianos|fennec/i.test(ua)) {
    return "mobile";
  }

  // Por defecto desktop
  return "desktop";
}

/**
 * Trackea una interacción del usuario
 */
export async function trackInteraction(params: TrackInteractionParams) {
  try {
    // Get contexto temporal
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    const timeOfDay =
      hour >= 5 && hour < 12
        ? "morning"
        : hour >= 12 && hour < 18
        ? "afternoon"
        : hour >= 18 && hour < 22
        ? "evening"
        : "night";

    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayOfWeek = daysOfWeek[day];

    // Create interacción
    const interaction = await prisma.userInteraction.create({
      data: {
        id: nanoid(),
        userId: params.userId,
        itemType: params.itemType,
        itemId: params.itemId,
        interactionType: params.interactionType,
        duration: params.duration || 0,
        messageCount: params.messageCount,
        completionRate: params.completionRate,
        rating: params.rating,
        liked: params.liked,
        shared: params.shared || false,
        timeOfDay,
        dayOfWeek,
        deviceType: detectDeviceType(params.userAgent),
        metadata: params.metadata || {},
      },
    });

    // Update perfil del usuario (agregados)
    await updateUserProfile(params.userId);

    return interaction;
  } catch (error) {
    console.error("Error tracking interaction:", error);
    // No fallar la aplicación por errores de tracking
    return null;
  }
}

/**
 * Actualiza el perfil del usuario con agregados
 */
async function updateUserProfile(userId: string) {
  try {
    // Get o crear perfil
    let profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          id: nanoid(),
          userId,
          updatedAt: new Date(),
        },
      });
    }

    // Calcular métricas agregadas
    const interactions = await prisma.userInteraction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100, // Últimas 100 interacciones
    });

    if (interactions.length === 0) return;

    // Calcular promedios
    const totalDuration = interactions.reduce((sum, i) => sum + i.duration, 0);
    const avgSessionDuration = Math.floor(totalDuration / interactions.length);

    const ratingsGiven = interactions.filter((i) => i.rating !== null);
    const avgRating = ratingsGiven.length > 0
      ? ratingsGiven.reduce((sum, i) => sum + (i.rating || 0), 0) / ratingsGiven.length
      : null;

    const completions = interactions.filter((i) => i.completionRate !== null);
    const avgCompletionRate = completions.length > 0
      ? completions.reduce((sum, i) => sum + (i.completionRate || 0), 0) / completions.length
      : 0.5;

    // Tiempo de día más común
    const timeOfDayCount: Record<string, number> = {};
    interactions.forEach((i) => {
      if (i.timeOfDay) {
        timeOfDayCount[i.timeOfDay] = (timeOfDayCount[i.timeOfDay] || 0) + 1;
      }
    });
    const preferredTimeOfDay = Object.entries(timeOfDayCount).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Categorías favoritas (extraer de metadata de los items)
    const itemIds = [...new Set(interactions.map((i) => i.itemId))];
    const agents = await prisma.agent.findMany({
      where: { id: { in: itemIds } },
      select: { tags: true, kind: true },
    });

    const categoryCount: Record<string, number> = {};
    const tagCount: Record<string, number> = {};
    const typeCount: Record<string, number> = {};

    agents.forEach((agent) => {
      // Tags
      if (agent.tags && Array.isArray(agent.tags)) {
        (agent.tags as string[]).forEach((tag) => {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
      }

      // Kind
      typeCount[agent.kind] = (typeCount[agent.kind] || 0) + 1;
    });

    const favoriteCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((e) => e[0]);

    const favoriteTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map((e) => e[0]);

    const preferredAgentTypes = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0]);

    // Update perfil
    await prisma.userProfile.update({
      where: { userId },
      data: {
        avgSessionDuration,
        avgRating,
        avgCompletionRate,
        preferredTimeOfDay,
        interactionCount: interactions.length,
        totalTimeSpent: totalDuration,
        favoriteCategories,
        favoriteTags,
        preferredAgentTypes,
        lastInteractionAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
  }
}

/**
 * Obtiene el historial de interacciones del usuario
 */
export async function getUserInteractionHistory(
  userId: string,
  limit: number = 50
) {
  return prisma.userInteraction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      User: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Obtiene el perfil del usuario
 */
export async function getUserProfile(userId: string) {
  let profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    profile = await prisma.userProfile.create({
      data: {
        id: nanoid(),
        userId,
        updatedAt: new Date(),
      },
    });
  }

  return profile;
}
