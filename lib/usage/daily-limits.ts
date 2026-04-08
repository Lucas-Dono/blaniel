/**
 * Daily Limits Tracker
 * Tracks daily message limits for free users
 */

import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/mercadopago/config";
import {
  getTierLimits,
  isUnlimited,
  getRemainingQuota,
  buildResourceLimitError,
  type UserTier,
  type ResourceLimits,
} from "./tier-limits";
import { shouldCountMessage } from "./smart-counting";
import { getEffectiveTier } from "./special-events";
import { nanoid } from "nanoid";

interface DailyUsage {
  userId: string;
  date: string; // YYYY-MM-DD
  messagesCount: number;
  worldMessagesCount: number;
  imagesAnalyzed: number;
  voiceMessagesCount: number; // ← ANTI-ABUSE: Daily voice message tracking
  rewardedMessagesUsed: number;
  rewardedImagesUsed: number;
}

// In-memory cache to avoid constant DB hits
const dailyUsageCache = new Map<string, DailyUsage>();

/** Gets the user's daily usage */
async function getDailyUsage(userId: string): Promise<DailyUsage> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const cacheKey = `${userId}-${today}`;

  // Check cache
  const cached = dailyUsageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Search in Usage table
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const usageRecords = await prisma.usage.findMany({
    where: {
      userId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const usage: DailyUsage = {
    userId,
    date: today,
    messagesCount: 0,
    worldMessagesCount: 0,
    imagesAnalyzed: 0,
    voiceMessagesCount: 0,
    rewardedMessagesUsed: 0,
    rewardedImagesUsed: 0,
  };

  for (const record of usageRecords) {
    if (record.resourceType === "message") {
      usage.messagesCount += record.quantity;
    } else if (record.resourceType === "world_message") {
      usage.worldMessagesCount += record.quantity;
    } else if (record.resourceType === "image_analysis") {
      usage.imagesAnalyzed += record.quantity;
    } else if (record.resourceType === "voice_message") {
      usage.voiceMessagesCount += record.quantity;
    } else if (record.resourceType === "rewarded_messages") {
      usage.rewardedMessagesUsed += record.quantity;
    } else if (record.resourceType === "rewarded_images") {
      usage.rewardedImagesUsed += record.quantity;
    }
  }

  // Cachear por 5 minutos
  dailyUsageCache.set(cacheKey, usage);
  setTimeout(() => dailyUsageCache.delete(cacheKey), 5 * 60 * 1000);

  return usage;
}

/**
 * Gets the user's weekly usage for a specific resource
 * ANTI-ABUSE: Additional weekly control to prevent sustained abuse
 * 
 * For tokens, returns the total of input + output tokens
 */
export async function getWeeklyUsage(
  userId: string,
  resourceType: "tokens" | "voice_message" | "image_analysis"
): Promise<number> {
  // Calcular inicio de la semana (domingo)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Lunes, etc.
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  weekEnd.setHours(0, 0, 0, 0);

  // Para tokens, sumar tanto input como output
  if (resourceType === "tokens") {
    const usageRecords = await prisma.usage.findMany({
      where: {
        userId,
        resourceType: {
          in: ["input_tokens", "output_tokens"],
        },
        createdAt: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
    });

    return usageRecords.reduce((total, record) => total + record.quantity, 0);
  }

  // For other resources (voice, images), direct sum
  const usageRecords = await prisma.usage.findMany({
    where: {
      userId,
      resourceType,
      createdAt: {
        gte: weekStart,
        lt: weekEnd,
      },
    },
  });

  return usageRecords.reduce((total, record) => total + record.quantity, 0);
}

/** Checks if the user can send a message (with special events and weekly limits) */
export async function canSendMessage(
  userId: string,
  userPlan: string = "free"
): Promise<{
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  canUseRewarded: boolean;
  effectiveTier?: string;
  tempTierInfo?: {
    eventName: string;
    expiresAt: Date;
  };
}> {
  // Check si tiene un tier temporal activo (eventos especiales)
  const effectiveTier = await getEffectiveTier(userId, userPlan);
  const actualPlan = PLANS[effectiveTier as keyof typeof PLANS] || PLANS.free;

  // Get temp tier info if it exists
  let tempTierInfo;
  if (effectiveTier !== userPlan) {
    const { getActiveTempTier } = await import("./special-events");
    const tempTier = await getActiveTempTier(userId);
    if (tempTier && tempTier.hasTempTier) {
      tempTierInfo = {
        eventName: tempTier.eventName || 'Evento especial',
        expiresAt: tempTier.expiresAt!,
      };
    }
  }

  // Paid/upgraded plans have no daily limit
  if (actualPlan.limits.messagesPerDay === -1) {
    return {
      allowed: true,
      current: 0,
      limit: -1,
      canUseRewarded: false,
      effectiveTier,
      tempTierInfo,
    };
  }

  const usage = await getDailyUsage(userId);
  const limit = actualPlan.limits.messagesPerDay || 20;

  // Verify daily limit
  if (usage.messagesCount >= limit) {
    // Already reached the daily limit, verify if can use rewarded messages
    const rewardedLimit = actualPlan.limits.rewardedMessagesPerVideo || 10;
    const canUseRewarded = usage.rewardedMessagesUsed < rewardedLimit * 10; // Maximum 10 videos/day

    return {
      allowed: false,
      reason: canUseRewarded
        ? "Límite diario alcanzado. Mira un video para obtener más mensajes."
        : "Límite diario alcanzado. Vuelve mañana o actualiza tu plan.",
      current: usage.messagesCount,
      limit,
      canUseRewarded,
      effectiveTier,
      tempTierInfo,
    };
  }

  // ANTI-ABUSE: Weekly limit was removed from the system
  // Only the daily limit is used now

  // Permitido
  return {
    allowed: true,
    current: usage.messagesCount,
    limit,
    canUseRewarded: false,
    effectiveTier,
    tempTierInfo,
  };
}

/**
 * Checks if the user can analyze an image
 * ANTI-ABUSE: Checks daily AND monthly limits to prevent flash abuse
 */
export async function canAnalyzeImage(
  userId: string,
  userPlan: string = "free"
): Promise<{
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  canUseRewarded: boolean;
}> {
  const tierLimits = getTierLimits(userPlan);
  const _plan = PLANS[userPlan as keyof typeof PLANS] || PLANS.free;

  // Plan Ultra: Unlimited
  if (isUnlimited(tierLimits.resources.imageAnalysisPerMonth)) {
    return {
      allowed: true,
      current: 0,
      limit: -1,
      canUseRewarded: false,
    };
  }

  // ANTI-ABUSE STEP 1: Check DAILY limit (prevents abusing the whole month in a day)
  const dailyLimit = tierLimits.resources.imageAnalysisPerDay;
  if (!isUnlimited(dailyLimit) && dailyLimit > 0) {
    const dailyUsage = await getDailyUsage(userId);

    if (dailyUsage.imagesAnalyzed >= dailyLimit) {
      return {
        allowed: false,
        reason: `Límite diario de análisis alcanzado (${dailyLimit}/día). Vuelve mañana o actualiza a Ultra.`,
        current: dailyUsage.imagesAnalyzed,
        limit: dailyLimit,
        canUseRewarded: false,
      };
    }
  }

  // STEP 2: Check MONTHLY limit
  const monthlyUsage = await getMonthlyImageUsage(userId);
  const monthlyLimit = tierLimits.resources.imageAnalysisPerMonth;

  if (monthlyUsage < monthlyLimit) {
    return {
      allowed: true,
      current: monthlyUsage,
      limit: monthlyLimit,
      canUseRewarded: false,
    };
  }

  // Already reached the monthly limit, check rewarded (free only)
  if (userPlan === "free") {
    const rewardedLimit = 60; // Default rewarded limit
    const rewardedUsed = await getMonthlyRewardedImageUsage(userId);
    const canUseRewarded = rewardedUsed < rewardedLimit;

    return {
      allowed: false,
      reason: canUseRewarded
        ? "Límite mensual alcanzado. Mira videos para obtener más análisis."
        : "Límite mensual alcanzado. Actualiza tu plan para más análisis.",
      current: monthlyUsage,
      limit: monthlyLimit,
      canUseRewarded,
    };
  }

  return {
    allowed: false,
    reason: "Límite mensual de análisis de imágenes alcanzado. Actualiza a Ultra para análisis ilimitados.",
    current: monthlyUsage,
    limit: monthlyLimit,
    canUseRewarded: false,
  };
}

/**
 * Registra el uso de un mensaje (con smart counting)
 */
export async function trackMessageUsage(
  userId: string,
  messageContent?: string,
  isRewarded: boolean = false
): Promise<{ counted: boolean; reason?: string }> {
  // Smart counting: Si el mensaje es trivial, no contarlo
  if (messageContent && !isRewarded) {
    const shouldCount = shouldCountMessage(messageContent);

    if (!shouldCount) {
      console.log(`[DailyLimits] Message NOT counted (trivial): "${messageContent.slice(0, 50)}..."`);
      return { counted: false, reason: 'trivial' };
    }
  }

  await prisma.usage.create({
    data: {
      id: nanoid(),
      userId,
      resourceType: isRewarded ? "rewarded_messages" : "message",
      quantity: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        content: messageContent?.slice(0, 100), // Store first 100 chars for debugging
      },
    },
  });

  // Invalidar cache
  const today = new Date().toISOString().split("T")[0];
  dailyUsageCache.delete(`${userId}-${today}`);

  return { counted: true };
}

/** Registers image analysis usage */
export async function trackImageAnalysisUsage(
  userId: string,
  isRewarded: boolean = false
): Promise<void> {
  await prisma.usage.create({
    data: {
      id: nanoid(),
      userId,
      resourceType: isRewarded ? "rewarded_images" : "image_analysis",
      quantity: 1,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    },
  });

  // Invalidar cache
  const today = new Date().toISOString().split("T")[0];
  dailyUsageCache.delete(`${userId}-${today}`);
}

/**
 * Checks if the user can send a voice message
 * ANTI-ABUSE: Checks daily AND monthly limits to prevent flash abuse
 * Voice is EXPENSIVE ($0.17/message), needs strict protection
 */
export async function canSendVoiceMessage(
  userId: string,
  userPlan: string = "free"
): Promise<{
  allowed: boolean;
  reason?: string;
  currentDaily: number;
  dailyLimit: number;
  currentMonthly: number;
  monthlyLimit: number;
}> {
  const tierLimits = getTierLimits(userPlan);

  // Plan Free: Sin acceso a voz
  if (userPlan === "free") {
    return {
      allowed: false,
      reason: "Los mensajes de voz están disponibles en planes Plus y Ultra. Actualiza tu plan.",
      currentDaily: 0,
      dailyLimit: 0,
      currentMonthly: 0,
      monthlyLimit: 0,
    };
  }

  // Ultra Plan: no limits
  if (isUnlimited(tierLimits.resources.voiceMessagesPerMonth)) {
    return {
      allowed: true,
      currentDaily: 0,
      dailyLimit: -1,
      currentMonthly: 0,
      monthlyLimit: -1,
    };
  }

  // ANTI-ABUSE STEP 1: Check DAILY limit (prevents spending $8.50 in a day)
  const dailyLimit = tierLimits.resources.voiceMessagesPerDay;
  const dailyUsage = await getDailyUsage(userId);

  if (dailyUsage.voiceMessagesCount >= dailyLimit) {
    return {
      allowed: false,
      reason: `Límite diario de mensajes de voz alcanzado (${dailyLimit}/día). Los mensajes de voz cuestan $0.17 cada uno. Vuelve mañana o actualiza a Ultra.`,
      currentDaily: dailyUsage.voiceMessagesCount,
      dailyLimit,
      currentMonthly: 0, // Not necessary to calculate monthly if daily already blocked
      monthlyLimit: tierLimits.resources.voiceMessagesPerMonth,
    };
  }

  // STEP 2: Verify MONTHLY limit
  const monthlyUsage = await getMonthlyVoiceUsage(userId);
  const monthlyLimit = tierLimits.resources.voiceMessagesPerMonth;

  if (monthlyUsage < monthlyLimit) {
    return {
      allowed: true,
      currentDaily: dailyUsage.voiceMessagesCount,
      dailyLimit,
      currentMonthly: monthlyUsage,
      monthlyLimit,
    };
  }

  return {
    allowed: false,
    reason: `Límite mensual de mensajes de voz alcanzado (${monthlyLimit}/mes). Actualiza a Ultra para voz ilimitada.`,
    currentDaily: dailyUsage.voiceMessagesCount,
    dailyLimit,
    currentMonthly: monthlyUsage,
    monthlyLimit,
  };
}

/**
 * Registra el uso de un mensaje de voz
 */
export async function trackVoiceMessageUsage(userId: string): Promise<void> {
  await prisma.usage.create({
    data: {
      id: nanoid(),
      userId,
      resourceType: "voice_message",
      quantity: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        cost: 0.17, // Costo real para tracking
      },
    },
  });

  // Invalidar cache
  const today = new Date().toISOString().split("T")[0];
  dailyUsageCache.delete(`${userId}-${today}`);
}

/**
 * Obtiene el uso mensual de mensajes de voz
 */
async function getMonthlyVoiceUsage(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const usage = await prisma.usage.findMany({
    where: {
      userId,
      resourceType: "voice_message",
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  return usage.reduce((sum, record) => sum + record.quantity, 0);
}

/** Grants message credits for watching an ad video */
export async function grantRewardedMessages(
  userId: string,
  userPlan: string = "free"
): Promise<{ success: boolean; messagesGranted: number; reason?: string }> {
  const _plan = PLANS[userPlan as keyof typeof PLANS] || PLANS.free;
  const messagesPerVideo = 10; // Default messages per video

  // Verify daily video limit (maximum 10 videos/day)
  const usage = await getDailyUsage(userId);
  const videosWatchedToday = Math.floor(usage.rewardedMessagesUsed / messagesPerVideo);

  if (videosWatchedToday >= 10) {
    return {
      success: false,
      messagesGranted: 0,
      reason: "Has alcanzado el límite diario de videos (10 videos/día).",
    };
  }

  // Registrar los mensajes rewarded
  for (let i = 0; i < messagesPerVideo; i++) {
    await trackMessageUsage(userId, undefined, true);
  }

  return {
    success: true,
    messagesGranted: messagesPerVideo,
  };
}

/** Grants image analysis credits for watching an ad video */
export async function grantRewardedImages(
  userId: string,
  videoLengthSeconds: number,
  userPlan: string = "free"
): Promise<{ success: boolean; imagesGranted: number; reason?: string }> {
  const _plan = PLANS[userPlan as keyof typeof PLANS] || PLANS.free;
  const imagesPerMinute = 4; // Default images per minute of video
  const rewardedMax = 60; // Default rewarded max

  // Calculate images to grant (4 for every full minute)
  const minutesWatched = Math.floor(videoLengthSeconds / 60);
  const imagesGranted = minutesWatched * imagesPerMinute;

  if (imagesGranted === 0) {
    return {
      success: false,
      imagesGranted: 0,
      reason: "Debes ver al menos 1 minuto completo del video.",
    };
  }

  // Check monthly limit of rewarded images
  const rewardedUsed = await getMonthlyRewardedImageUsage(userId);

  if (rewardedUsed >= rewardedMax) {
    return {
      success: false,
      imagesGranted: 0,
      reason: `Has alcanzado el límite mensual de análisis rewarded (${rewardedMax}/mes).`,
    };
  }

  const actualGranted = Math.min(imagesGranted, rewardedMax - rewardedUsed);

  // Log rewarded analyses
  for (let i = 0; i < actualGranted; i++) {
    await trackImageAnalysisUsage(userId, true);
  }

  return {
    success: true,
    imagesGranted: actualGranted,
  };
}

/** Gets monthly usage of image analysis */
async function getMonthlyImageUsage(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const usage = await prisma.usage.findMany({
    where: {
      userId,
      resourceType: "image_analysis",
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  return usage.reduce((sum, record) => sum + record.quantity, 0);
}

/** Gets monthly usage of analysis of rewarded images */
async function getMonthlyRewardedImageUsage(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const usage = await prisma.usage.findMany({
    where: {
      userId,
      resourceType: "rewarded_images",
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  return usage.reduce((sum, record) => sum + record.quantity, 0);
}

/**
 * Registra el uso de un mensaje en mundo
 */
export async function trackWorldMessageUsage(userId: string): Promise<void> {
  await prisma.usage.create({
    data: {
      id: nanoid(),
      userId,
      resourceType: "world_message",
      quantity: 1,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    },
  });

  // Invalidar cache
  const today = new Date().toISOString().split("T")[0];
  dailyUsageCache.delete(`${userId}-${today}`);
}

/** Gets usage statistics to show to the user */
export async function getUserUsageStats(userId: string, userPlan: string = "free") {
  const plan = PLANS[userPlan as keyof typeof PLANS] || PLANS.free;
  const tierLimits = getTierLimits(userPlan);
  const dailyUsage = await getDailyUsage(userId);
  const monthlyImages = await getMonthlyImageUsage(userId);
  const monthlyRewardedImages = await getMonthlyRewardedImageUsage(userId);
  const monthlyVoice = await getMonthlyVoiceUsage(userId);

  return {
    today: {
      messages: {
        used: dailyUsage.messagesCount,
        limit: plan.limits.messagesPerDay,
        rewarded: dailyUsage.rewardedMessagesUsed,
      },
      worldMessages: {
        used: dailyUsage.worldMessagesCount,
        limit: userPlan === "free" ? 50 : userPlan === "plus" ? 500 : -1,
      },
      images: {
        used: dailyUsage.imagesAnalyzed,
        limit: tierLimits.resources.imageAnalysisPerDay,
      },
      voice: {
        used: dailyUsage.voiceMessagesCount,
        limit: tierLimits.resources.voiceMessagesPerDay,
      },
    },
    thisMonth: {
      images: {
        used: monthlyImages,
        limit: plan.limits.imageAnalysisPerMonth,
        rewarded: monthlyRewardedImages,
        rewardedMax: 60, // Default rewarded max
      },
      voice: {
        used: monthlyVoice,
        limit: tierLimits.resources.voiceMessagesPerMonth,
      },
    },
  };
}

// ============================================================================
// TIER-BASED RESOURCE CHECKING (NEW)
// ============================================================================

/**
 * Check if user can perform an action based on tier limits
 */
export async function checkTierResourceLimit(
  userId: string,
  userPlan: string,
  resource: keyof ResourceLimits
): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  error?: ReturnType<typeof buildResourceLimitError>;
}> {
  const tierLimits = getTierLimits(userPlan);
  const limit = tierLimits.resources[resource];

  // Unlimited resources
  if (isUnlimited(limit)) {
    return {
      allowed: true,
      current: 0,
      limit: -1,
      remaining: -1,
    };
  }

  // Get current usage based on resource type
  let currentUsage = 0;

  switch (resource) {
    // Note: messagesPerDay is handled by canSendMessage(), not here
    // Messages are token-based, so use totalTokensPerDay instead
    case "activeAgents": {
      currentUsage = await prisma.agent.count({
        where: { userId },
      });
      break;
    }
    case "activeWorlds": {
      // NOTA: World model fue migrado a Groups
      // Usar activeGroups en su lugar
      currentUsage = 0;
      break;
    }
    case "charactersInMarketplace": {
      currentUsage = await prisma.marketplaceCharacter.count({
        where: { authorId: userId },
      });
      break;
    }
    case "imageGenerationPerDay": {
      const today = new Date().toISOString().split("T")[0];
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      currentUsage = await prisma.usage.count({
        where: {
          userId,
          resourceType: "image_generation",
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });
      break;
    }
    case "imageAnalysisPerMonth": {
      currentUsage = await getMonthlyImageUsage(userId);
      break;
    }
    case "imageAnalysisPerDay": {
      const usage = await getDailyUsage(userId);
      currentUsage = usage.imagesAnalyzed;
      break;
    }
    case "voiceMessagesPerMonth": {
      currentUsage = await getMonthlyVoiceUsage(userId);
      break;
    }
    case "voiceMessagesPerDay": {
      const usage = await getDailyUsage(userId);
      currentUsage = usage.voiceMessagesCount;
      break;
    }
    default:
      currentUsage = 0;
  }

  const allowed = currentUsage < limit;
  const remaining = getRemainingQuota(currentUsage, limit);

  return {
    allowed,
    current: currentUsage,
    limit,
    remaining,
    error: allowed ? undefined : buildResourceLimitError(
      userPlan as UserTier,
      resource,
      currentUsage,
      limit
    ),
  };
}

/**
 * Check multiple resource limits at once
 */
export async function checkMultipleTierLimits(
  userId: string,
  userPlan: string,
  resources: Array<keyof ResourceLimits>
): Promise<{
  allowed: boolean;
  checks: Record<string, Awaited<ReturnType<typeof checkTierResourceLimit>>>;
  violations: Array<keyof ResourceLimits>;
}> {
  const checks: Record<string, Awaited<ReturnType<typeof checkTierResourceLimit>>> = {};
  const violations: Array<keyof ResourceLimits> = [];

  // Check all resources in parallel
  const results = await Promise.all(
    resources.map(resource => checkTierResourceLimit(userId, userPlan, resource))
  );

  resources.forEach((resource, index) => {
    checks[resource] = results[index];
    if (!results[index].allowed) {
      violations.push(resource);
    }
  });

  return {
    allowed: violations.length === 0,
    checks,
    violations,
  };
}

/**
 * Get comprehensive tier usage summary
 */
export async function getTierUsageSummary(userId: string, userPlan: string) {
  const tierLimits = getTierLimits(userPlan);
  const dailyUsage = await getDailyUsage(userId);
  const monthlyImages = await getMonthlyImageUsage(userId);

  const agentCount = await prisma.agent.count({
    where: { userId },
  });

  // NOTA: World model fue migrado a Groups
  const worldCount = 0;

  const marketplaceCharacters = await prisma.marketplaceCharacter.count({
    where: { authorId: userId },
  });

  return {
    tier: userPlan as UserTier,
    tierLimits,
    usage: {
      messages: {
        current: dailyUsage.messagesCount,
        limit: Math.floor(tierLimits.resources.totalTokensPerDay / 350), // ~350 tokens por mensaje
        remaining: getRemainingQuota(dailyUsage.messagesCount, Math.floor(tierLimits.resources.totalTokensPerDay / 350)),
      },
      agents: {
        current: agentCount,
        limit: tierLimits.resources.activeAgents,
        remaining: getRemainingQuota(agentCount, tierLimits.resources.activeAgents),
      },
      worlds: {
        current: worldCount,
        limit: tierLimits.resources.activeWorlds,
        remaining: getRemainingQuota(worldCount, tierLimits.resources.activeWorlds),
      },
      marketplaceCharacters: {
        current: marketplaceCharacters,
        limit: tierLimits.resources.charactersInMarketplace,
        remaining: getRemainingQuota(marketplaceCharacters, tierLimits.resources.charactersInMarketplace),
      },
      imageAnalysis: {
        current: monthlyImages,
        limit: tierLimits.resources.imageAnalysisPerMonth,
        remaining: getRemainingQuota(monthlyImages, tierLimits.resources.imageAnalysisPerMonth),
      },
    },
  };
}
