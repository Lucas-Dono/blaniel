/**
 * USER TIER SERVICE
 *
 * Obtiene el plan/tier de suscripción del usuario
 */

import { prisma } from "@/lib/prisma";

export type UserTier = "free" | "plus" | "ultra";

export interface UserSubscriptionInfo {
  tier: UserTier;
  isActive: boolean;
  features: {
    maxAgents: number;
    maxMessagesPerDay: number;
    voiceEnabled: boolean;
    imageGenerationEnabled: boolean;
    prioritySupport: boolean;
  };
}

/**
 * Obtiene el tier del usuario desde la base de datos
 */
export async function getUserTier(userId: string): Promise<UserTier> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    if (!user) {
      return "free";
    }

    // Normalizar el plan a tier
    const plan = user.plan.toLowerCase();
    if (plan === "ultra" || plan === "pro") {
      return "ultra";
    } else if (plan === "plus" || plan === "premium") {
      return "plus";
    }

    return "free";
  } catch (error) {
    console.error("[UserTier] Error getting user tier:", error);
    return "free";
  }
}

/**
 * Obtiene información completa de suscripción del usuario
 */
export async function getUserSubscriptionInfo(
  userId: string
): Promise<UserSubscriptionInfo> {
  const tier = await getUserTier(userId);

  // Define features by tier
  const features = {
    free: {
      maxAgents: 3,
      maxMessagesPerDay: 100,
      voiceEnabled: false,
      imageGenerationEnabled: false,
      prioritySupport: false,
    },
    plus: {
      maxAgents: 10,
      maxMessagesPerDay: 1000,
      voiceEnabled: true,
      imageGenerationEnabled: true,
      prioritySupport: false,
    },
    ultra: {
      maxAgents: -1, // ilimitado
      maxMessagesPerDay: -1, // ilimitado
      voiceEnabled: true,
      imageGenerationEnabled: true,
      prioritySupport: true,
    },
  };

  return {
    tier,
    isActive: tier !== "free",
    features: features[tier],
  };
}

/**
 * Verifica si el usuario tiene acceso a una feature específica
 */
export async function userHasFeature(
  userId: string,
  feature: keyof UserSubscriptionInfo["features"]
): Promise<boolean> {
  const info = await getUserSubscriptionInfo(userId);
  return info.features[feature] as boolean;
}
