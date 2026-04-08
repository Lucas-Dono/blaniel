import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

/**
 * Intelligent Availability System
 *
 * Prevents abuse of "interruptions" like in Character.AI
 * - Cooldowns based on relationship level
 * - Real blocking when it says "I can't answer"
 * - Spaced responses if the user insists
 */

export interface AvailabilityStatus {
  available: boolean;
  reason?: string;
  blockedUntil?: Date;
  canRespondSpaced?: boolean; // Can respond but with spacing
  nextResponseAt?: Date; // When the next spaced message can be responded
}

export interface ActivityUnavailability {
  activity: string;
  durationMinutes: number; // How long the unavailability lasts
  allowSpacedResponses: boolean; // If it allows spaced responses
  spacedInterval: number; // Minutes between spaced responses
}

// Duration of unavailability based on activity
const ACTIVITY_DURATIONS: Record<string, ActivityUnavailability> = {
  sleeping: {
    activity: "sleeping",
    durationMinutes: 480, // 8 hours
    allowSpacedResponses: false, // Does NOT respond while sleeping
    spacedInterval: 0,
  },
  working_focused: {
    activity: "working (focused)",
    durationMinutes: 90,
    allowSpacedResponses: true, // Responds every 5 min
    spacedInterval: 5,
  },
  meeting: {
    activity: "in a meeting",
    durationMinutes: 60,
    allowSpacedResponses: true, // Responds every 10 min
    spacedInterval: 10,
  },
  exercising: {
    activity: "exercising",
    durationMinutes: 45,
    allowSpacedResponses: true, // Responds every 5 min
    spacedInterval: 5,
  },
  eating: {
    activity: "eating",
    durationMinutes: 30,
    allowSpacedResponses: true, // Responds every 3 min
    spacedInterval: 3,
  },
  shower: {
    activity: "in the shower",
    durationMinutes: 20,
    allowSpacedResponses: false,
    spacedInterval: 0,
  },
  driving: {
    activity: "driving",
    durationMinutes: 45,
    allowSpacedResponses: false, // Safety first
    spacedInterval: 0,
  },
};

// Cooldowns based on relationship level (minutes)
const RELATIONSHIP_COOLDOWNS: Record<string, number> = {
  stranger: 30, // 30 minutos
  acquaintance: 20,
  friend: 10,
  close_friend: 5,
  intimate: 1, // Solo 1 minuto
};

/**
 * Marks the agent as temporarily unavailable
 */
export async function markUnavailable(
  agentId: string,
  activity: string,
  customDuration?: number
): Promise<void> {
  const activityConfig = ACTIVITY_DURATIONS[activity];

  if (!activityConfig && !customDuration) {
    throw new Error(`Unknown activity: ${activity}`);
  }

  const durationMs = (customDuration || activityConfig?.durationMinutes || 30) * 60 * 1000;
  const blockedUntil = new Date(Date.now() + durationMs);

  await prisma.agentAvailability.upsert({
    where: { agentId },
    create: {
      id: nanoid(),
      updatedAt: new Date(),
      agentId,
      available: false,
      blockedUntil,
      currentActivity: activity,
      allowSpacedResponses: activityConfig?.allowSpacedResponses ?? false,
      spacedIntervalMinutes: activityConfig?.spacedInterval ?? 0,
    },
    update: {
      available: false,
      blockedUntil,
      currentActivity: activity,
      allowSpacedResponses: activityConfig?.allowSpacedResponses ?? false,
      spacedIntervalMinutes: activityConfig?.spacedInterval ?? 0,
      lastUnavailableAt: new Date(),
    },
  });
}

/**
 * Checks if the agent can respond
 */
export async function checkAvailability(
  agentId: string,
  relationshipStage: string
): Promise<AvailabilityStatus> {
  const availability = await prisma.agentAvailability.findUnique({
    where: { agentId },
  });

  // If there is no record, it is available
  if (!availability) {
    return { available: true };
  }

  // If marked as available
  if (availability.available) {
    return { available: true };
  }

  // Check if the lockout time has passed
  const now = new Date();
  if (availability.blockedUntil && now >= availability.blockedUntil) {
    // Auto-release
    await prisma.agentAvailability.update({
      where: { agentId },
      data: {
        available: true,
        blockedUntil: null,
        currentActivity: null,
      },
    });

    return { available: true };
  }

  // Still blocked
  const _cooldownMinutes = RELATIONSHIP_COOLDOWNS[relationshipStage] || 20;

  // Check if can respond with spacing
  if (availability.allowSpacedResponses) {
    // Check if the interval since the last response has passed
    const lastResponseTime = availability.lastSpacedResponseAt?.getTime() || 0;
    const intervalMs = (availability.spacedIntervalMinutes || 3) * 60 * 1000;
    const nextResponseTime = lastResponseTime + intervalMs;

    if (now.getTime() >= nextResponseTime) {
      return {
        available: true, // Can respond now (spaced)
        canRespondSpaced: true,
      };
    }

    // Still cannot respond (too soon)
    return {
      available: false,
      reason: `The character is ${availability.currentActivity}. Can respond occasionally.`,
      blockedUntil: availability.blockedUntil ?? undefined,
      canRespondSpaced: true,
      nextResponseAt: new Date(nextResponseTime),
    };
  }

  // Cannot respond at all (blocking activity)
  return {
    available: false,
    reason: `The character is ${availability.currentActivity} and cannot respond now.`,
    blockedUntil: availability.blockedUntil ?? undefined,
    canRespondSpaced: false,
  };
}

/** Logs that the agent responded with spacing */
export async function recordSpacedResponse(agentId: string): Promise<void> {
  await prisma.agentAvailability.update({
    where: { agentId },
    data: {
      lastSpacedResponseAt: new Date(),
    },
  });
}

/**
 * Marks the agent as available again
 */
export async function markAvailable(agentId: string): Promise<void> {
  await prisma.agentAvailability.upsert({
    where: { agentId },
    create: {
      id: nanoid(),
      updatedAt: new Date(),
      agentId,
      available: true,
    },
    update: {
      available: true,
      blockedUntil: null,
      currentActivity: null,
      allowSpacedResponses: false,
      spacedIntervalMinutes: 0,
    },
  });
}

/** Applies cooldown based on the relationship */
export async function applyCooldown(
  agentId: string,
  relationshipStage: string
): Promise<void> {
  const cooldownMinutes = RELATIONSHIP_COOLDOWNS[relationshipStage] || 20;
  const blockedUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);

  await prisma.agentAvailability.upsert({
    where: { agentId },
    create: {
      id: nanoid(),
      updatedAt: new Date(),
      agentId,
      available: false,
      blockedUntil,
      currentActivity: "ocupado/a",
      allowSpacedResponses: false,
    },
    update: {
      available: false,
      blockedUntil,
      lastUnavailableAt: new Date(),
    },
  });
}
