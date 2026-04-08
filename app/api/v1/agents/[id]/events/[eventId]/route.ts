import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAPIAuth } from "@/lib/api/auth";

/**
 * GET /api/v1/agents/:id/events/:eventId
 * Get a specific event
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId, eventId } = await params;

    // Verify agent access
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        OR: [{ userId }, { visibility: "public" }],
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

    return NextResponse.json(event);
  });
}

/**
 * PATCH /api/v1/agents/:id/events/:eventId
 * Update an event (before it's resolved)
 */
export async function PATCH(
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
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found or access denied" },
        { status: 404 }
      );
    }

    // Verify event exists
    const existingEvent = await prisma.scheduledEvent.findFirst({
      where: {
        id: eventId,
        agentId,
      },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Cannot update resolved events
    if (existingEvent.resolved) {
      return NextResponse.json(
        { error: "Cannot update a resolved event" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      scheduledFor,
      successProbability,
      probabilityFactors,
      possibleOutcomes,
    } = body;

    // Prepare update data
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (scheduledFor !== undefined)
      updateData.scheduledFor = new Date(scheduledFor);
    if (successProbability !== undefined)
      updateData.successProbability = successProbability;
    if (probabilityFactors !== undefined)
      updateData.probabilityFactors = probabilityFactors;
    if (possibleOutcomes !== undefined)
      updateData.possibleOutcomes = possibleOutcomes;

    // Update event
    const event = await prisma.scheduledEvent.update({
      where: { id: eventId },
      data: updateData,
    });

    return NextResponse.json(event);
  });
}

/**
 * DELETE /api/v1/agents/:id/events/:eventId
 * Delete an event (before it's resolved)
 */
export async function DELETE(
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
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found or access denied" },
        { status: 404 }
      );
    }

    // Verify event exists
    const existingEvent = await prisma.scheduledEvent.findFirst({
      where: {
        id: eventId,
        agentId,
      },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Cannot delete resolved events (keep for history)
    if (existingEvent.resolved) {
      return NextResponse.json(
        { error: "Cannot delete a resolved event" },
        { status: 400 }
      );
    }

    // Delete event
    await prisma.scheduledEvent.delete({
      where: { id: eventId },
    });

    return NextResponse.json({ success: true });
  });
}
