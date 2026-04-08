import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { withAPIAuth } from "@/lib/api/auth";

/**
 * GET /api/v1/agents/:id/goals
 * List all goals for an agent
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId } = await params;

    // Verify agent exists and user has access
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        OR: [
          { userId },
          { visibility: "public" },
        ],
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found or access denied" },
        { status: 404 }
      );
    }

    // Get query parameters for filtering
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status"); // active, paused, completed, abandoned, failed
    const category = searchParams.get("category"); // career, personal, relationship, etc.
    const timeScale = searchParams.get("timeScale"); // short, medium, long

    // Build where clause
    const where: any = { agentId };
    if (status) where.status = status;
    if (category) where.category = category;
    if (timeScale) where.timeScale = timeScale;

    // Fetch goals
    const goals = await prisma.personalGoal.findMany({
      where,
      orderBy: [
        { importance: "desc" },
        { progress: "asc" },
        { createdAt: "desc" },
      ],
    });

    // Calculate statistics
    const stats = {
      total: goals.length,
      active: goals.filter((g) => g.status === "active").length,
      completed: goals.filter((g) => g.status === "completed").length,
      avgProgress: goals.length > 0
        ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
        : 0,
    };

    return NextResponse.json({
      goals,
      stats,
    });
  });
}

/**
 * POST /api/v1/agents/:id/goals
 * Create a new goal for an agent
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id: agentId } = await params;

    // Verify agent exists and user owns it
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
      timeScale,
      importance,
      emotionalInvestment,
      intrinsic,
      motivation,
      obstacles,
      milestones,
      targetCompletionDate,
    } = body;

    // Validate required fields
    if (!title || !description || !category || !timeScale) {
      return NextResponse.json(
        { error: "title, description, category, and timeScale are required" },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = [
      "career",
      "personal",
      "relationship",
      "health",
      "creative",
      "financial",
      "learning",
      "social",
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate timeScale
    const validTimeScales = ["short", "medium", "long"];
    if (!validTimeScales.includes(timeScale)) {
      return NextResponse.json(
        { error: `timeScale must be one of: ${validTimeScales.join(", ")}` },
        { status: 400 }
      );
    }

    // Create goal
    const goal = await prisma.personalGoal.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        agentId,
        title,
        description,
        category,
        timeScale,
        importance: importance ?? 50,
        emotionalInvestment: emotionalInvestment ?? 50,
        intrinsic: intrinsic ?? true,
        motivation: motivation || "",
        obstacles: obstacles || [],
        milestones: milestones || [],
        targetCompletionDate: targetCompletionDate
          ? new Date(targetCompletionDate)
          : null,
        progress: 0,
        status: "active",
        daysSinceProgress: 0,
        progressHistory: [],
      },
    });

    return NextResponse.json(goal, { status: 201 });
  });
}
