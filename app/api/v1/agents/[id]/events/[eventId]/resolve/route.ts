import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAPIAuth } from "@/lib/api/auth";
import { resolveEvent } from "@/lib/events/event-resolver";

/**
 * POST /api/v1/agents/:id/events/:eventId/resolve
 * Resolve a scheduled event (roll dice, determine outcome, apply consequences)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId, eventId } = await params;

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId,
      },
      include: {
        PersonalityCore: true,
        InternalState: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found or access denied" },
        { status: 404 }
      );
    }

    // Get event
    const event = await prisma.scheduledEvent.findFirst({
      where: {
        id: eventId,
        agentId,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Check if already resolved
    if (event.resolved) {
      return NextResponse.json(
        { error: "Event already resolved", event },
        { status: 400 }
      );
    }

    // Optional: Check if it's time to resolve
    // (You might want to allow manual resolution for testing)
    const body = await req.json();
    const forceResolve = body.force === true;

    if (!forceResolve && new Date() < new Date(event.scheduledFor)) {
      return NextResponse.json(
        {
          error: "Event is not yet scheduled to occur",
          scheduledFor: event.scheduledFor,
          currentTime: new Date(),
        },
        { status: 400 }
      );
    }

    // Resolve the event
    try {
      // Map Prisma relation names to expected format
      const agentWithRelations = {
        ...agent,
        personalityCore: agent.PersonalityCore,
        internalState: agent.InternalState,
      };
      const resolvedEvent = await resolveEvent(event, agentWithRelations as any);

      return NextResponse.json({
        success: true,
        event: resolvedEvent,
        wasSuccess: resolvedEvent.wasSuccess,
        outcome: resolvedEvent.actualOutcome,
      });
    } catch (error) {
      console.error("Error resolving event:", error);
      return NextResponse.json(
        {
          error: "Failed to resolve event",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  });
}
