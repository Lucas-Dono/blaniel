/**
 * Server-Side Analytics Tracking
 *
 * Utility for event tracking from API routes and server components.
 * Used for events that occur on the backend (signup, conversions, etc.)
 */

import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";
import type {
  TrackServerEventParams,
  EventType,
  EventMetadata,
  ConversionEventMetadata,
} from "./types";

// Initialize Prisma client
const prisma = new PrismaClient();

// ============================================================================
// SERVER EVENT TRACKING
// ============================================================================

/**
 * Tracks an event from the server
 *
 * This function saves directly to the database via Prisma.
 * Used for events that occur in API routes (signup, conversions, etc.)
 *
 * @example
 * ```ts
 * import { trackServerEvent, ConversionEventType } from '@/lib/analytics/track-server';
 *
 * // In signup API route
 * await trackServerEvent({
 *   userId: user.id,
 *   eventType: ConversionEventType.SIGNUP,
 *   metadata: {
 *     signupMethod: 'email',
 *     fromDemo: true
 *   }
 * });
 * ```
 */
export async function trackServerEvent({
  userId,
  eventType,
  metadata = {},
}: TrackServerEventParams): Promise<void> {
  try {
    // Enrich metadata with timestamp and userId
    const enrichedMetadata: EventMetadata = {
      ...metadata,
      userId,
      timestamp: new Date().toISOString(),
    };

    // Save to database
    await prisma.analyticsEvent.create({
      data: {
        id: nanoid(),
        eventType,
        metadata: enrichedMetadata as any,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    // Log error but don't throw exception
    // We don't want the main flow to fail due to an analytics error
    console.error("[Analytics Server] Error tracking event:", error);
  }
}

/**
 * Tracks multiple events in batch (more efficient)
 *
 * @example
 * ```ts
 * await trackServerEventsBatch([
 *   { userId: 'user1', eventType: ConversionEventType.SIGNUP, metadata: {...} },
 *   { userId: 'user1', eventType: ConversionEventType.FIRST_AGENT, metadata: {...} }
 * ]);
 * ```
 */
export async function trackServerEventsBatch(
  events: TrackServerEventParams[]
): Promise<void> {
  try {
    await prisma.analyticsEvent.createMany({
      data: events.map((event) => ({
        id: nanoid(),
        eventType: event.eventType,
        metadata: {
          ...event.metadata,
          userId: event.userId,
          timestamp: new Date().toISOString(),
        } as any,
        timestamp: new Date(),
      })),
    });
  } catch (error) {
    console.error("[Analytics Server] Error tracking events batch:", error);
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS FOR COMMON EVENTS
// ============================================================================

/**
 * Trackea signup de usuario
 */
export async function trackSignup(
  userId: string,
  metadata: Partial<ConversionEventMetadata> = {}
): Promise<void> {
  return trackServerEvent({
    userId,
    eventType: "conversion.signup" as EventType,
    metadata: {
      signupMethod: metadata.signupMethod || "email",
      ...metadata,
    } as any,
  });
}

/**
 * Trackea creación del primer agente
 */
export async function trackFirstAgent(
  userId: string,
  metadata: {
    agentId: string;
    agentTier?: string;
    timeSinceSignup?: number;
  }
): Promise<void> {
  return trackServerEvent({
    userId,
    eventType: "conversion.first_agent" as EventType,
    metadata: metadata as any,
  });
}

/**
 * Trackea primer mensaje enviado
 */
export async function trackFirstMessage(
  userId: string,
  metadata: {
    agentId: string;
    timeToFirstMessage?: number;
  }
): Promise<void> {
  return trackServerEvent({
    userId,
    eventType: "conversion.first_message" as EventType,
    metadata: metadata as any,
  });
}

/**
 * Trackea upgrade de plan
 */
export async function trackPlanUpgrade(
  userId: string,
  metadata: {
    oldPlan: "free" | "plus" | "ultra";
    newPlan: "free" | "plus" | "ultra";
    amount?: number;
    daysSinceSignup?: number;
    triggerType?: string;
  }
): Promise<void> {
  // Determine conversion type
  let eventType: string = "conversion.free_to_plus";

  if (metadata.oldPlan === "free" && metadata.newPlan === "plus") {
    eventType = "conversion.free_to_plus";
  } else if (metadata.oldPlan === "free" && metadata.newPlan === "ultra") {
    eventType = "conversion.free_to_ultra";
  } else if (metadata.oldPlan === "plus" && metadata.newPlan === "ultra") {
    eventType = "conversion.plus_to_ultra";
  }

  return trackServerEvent({
    userId,
    eventType: eventType as EventType,
    metadata: metadata as any,
  });
}

/**
 * Trackea cuando un usuario alcanza un límite (trigger de conversión)
 */
export async function trackLimitReached(
  userId: string,
  metadata: {
    limitReached: string;
    currentPlan: "free" | "plus" | "ultra";
  }
): Promise<void> {
  return trackServerEvent({
    userId,
    eventType: "conversion.limit_reached" as EventType,
    metadata: metadata as any,
  });
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Obtiene eventos de un usuario específico
 */
export async function getUserEvents(
  userId: string,
  options: {
    eventTypes?: EventType[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}
) {
  const { eventTypes, startDate, endDate, limit = 100 } = options;

  return prisma.analyticsEvent.findMany({
    where: {
      metadata: {
        path: ["userId"],
        equals: userId,
      },
      ...(eventTypes && {
        eventType: {
          in: eventTypes,
        },
      }),
      ...(startDate || endDate
        ? {
            timestamp: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    },
    orderBy: {
      timestamp: "desc",
    },
    take: limit,
  });
}

/**
 * Cuenta eventos por tipo en un rango de fechas
 */
export async function countEventsByType(
  eventType: EventType,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  return prisma.analyticsEvent.count({
    where: {
      eventType,
      ...(startDate || endDate
        ? {
            timestamp: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    },
  });
}

/**
 * Obtiene métricas de conversión de un usuario
 */
export async function getUserConversionMetrics(userId: string) {
  const events = await prisma.analyticsEvent.findMany({
    where: {
      metadata: {
        path: ["userId"],
        equals: userId,
      },
      eventType: {
        in: [
          "conversion.signup",
          "conversion.first_agent",
          "conversion.first_message",
          "conversion.free_to_plus",
          "conversion.free_to_ultra",
          "conversion.plus_to_ultra",
        ],
      },
    },
    orderBy: {
      timestamp: "asc",
    },
  });

  const signupEvent = events.find((e) => e.eventType === "conversion.signup");
  const firstAgentEvent = events.find((e) => e.eventType === "conversion.first_agent");
  const firstMessageEvent = events.find((e) => e.eventType === "conversion.first_message");
  const upgradeEvents = events.filter((e) =>
    e.eventType.startsWith("conversion.") && e.eventType.includes("_to_")
  );

  return {
    signupAt: signupEvent?.timestamp,
    firstAgentAt: firstAgentEvent?.timestamp,
    firstMessageAt: firstMessageEvent?.timestamp,
    upgrades: upgradeEvents.map((e) => ({
      type: e.eventType,
      timestamp: e.timestamp,
      metadata: e.metadata,
    })),
    // Calcular tiempos
    timeToFirstAgent: signupEvent && firstAgentEvent
      ? (firstAgentEvent.timestamp.getTime() - signupEvent.timestamp.getTime()) / 1000
      : null,
    timeToFirstMessage: signupEvent && firstMessageEvent
      ? (firstMessageEvent.timestamp.getTime() - signupEvent.timestamp.getTime()) / 1000
      : null,
  };
}
