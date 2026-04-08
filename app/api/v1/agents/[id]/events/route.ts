import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { withAPIAuth } from "@/lib/api/auth";

/**
 * GET /api/v1/agents/:id/events
 * List all scheduled events for an agent
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId } = await params;

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

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const resolved = searchParams.get("resolved"); // "true" or "false"
    const category = searchParams.get("category");
    const upcoming = searchParams.get("upcoming"); // "true" to get only future events

    // Build where clause
    const where: any = { agentId };
    if (resolved !== null) {
      where.resolved = resolved === "true";
    }
    if (category) {
      where.category = category;
    }
    if (upcoming === "true") {
      where.scheduledFor = {
        gte: new Date(),
      };
      where.resolved = false;
    }

    // Fetch events
    const events = await prisma.scheduledEvent.findMany({
      where,
      orderBy: [
        { resolved: "asc" },
        { scheduledFor: "asc" },
      ],
    });

    // Calculate statistics
    const stats = {
      total: events.length,
      upcoming: events.filter((e) => !e.resolved && new Date(e.scheduledFor) > new Date()).length,
      resolved: events.filter((e) => e.resolved).length,
      successful: events.filter((e) => e.resolved && e.wasSuccess).length,
      failed: events.filter((e) => e.resolved && e.wasSuccess === false).length,
    };

    return NextResponse.json({
      events,
      stats,
    });
  });
}

/**
 * POST /api/v1/agents/:id/events
 * Create a new scheduled event for an agent
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId } = await params;

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

    const body = await req.json();
    const {
      title,
      description,
      category,
      eventType,
      scheduledFor,
      successProbability,
      probabilityFactors,
      possibleOutcomes,
      relatedGoalId,
      isRecurring,
      recurringPattern,
    } = body;

    // Validate required fields
    if (!title || !description || !category || !scheduledFor || !possibleOutcomes) {
      return NextResponse.json(
        { error: "title, description, category, scheduledFor, and possibleOutcomes are required" },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = [
      "external_random",
      "skill_based",
      "social",
      "routine_based",
      "goal_related",
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate possibleOutcomes is an array
    if (!Array.isArray(possibleOutcomes) || possibleOutcomes.length === 0) {
      return NextResponse.json(
        { error: "possibleOutcomes must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate related goal if provided
    if (relatedGoalId) {
      const goal = await prisma.personalGoal.findFirst({
        where: {
          id: relatedGoalId,
          agentId,
        },
      });

      if (!goal) {
        return NextResponse.json(
          { error: "Related goal not found" },
          { status: 404 }
        );
      }
    }

    // Create event
    const event = await prisma.scheduledEvent.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        agentId,
        title,
        description,
        category,
        eventType: eventType || "other",
        scheduledFor: new Date(scheduledFor),
        successProbability: successProbability ?? null,
        probabilityFactors: probabilityFactors || null,
        possibleOutcomes,
        relatedGoalId: relatedGoalId || null,
        isRecurring: isRecurring || false,
        recurringPattern: recurringPattern || null,
        resolved: false,
      },
    });

    return NextResponse.json(event, { status: 201 });
  });
}
