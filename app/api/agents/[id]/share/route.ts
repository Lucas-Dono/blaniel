import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logging/logger";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { nanoid } from "nanoid";
/**
 * POST /api/agents/[id]/share
 * Track when an agent is shared
 *
 * Body:
 * - method: "copy_link" | "community" | "twitter" | "facebook" | "linkedin" | "whatsapp"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const body = await request.json();
    const { method } = body;

    // Get user session (optional - can track anonymous shares too)
    const user = await getAuthenticatedUser(request);
    const userId = user?.id;

    // Validate share method
    const validMethods = ["copy_link", "community", "twitter", "facebook", "linkedin", "whatsapp"];
    if (!method || !validMethods.includes(method)) {
      return NextResponse.json(
        { error: "Método de compartir inválido" },
        { status: 400 }
      );
    }

    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agente no encontrado" },
        { status: 404 }
      );
    }

    // Store share event in database for analytics
    const shareEvent = await prisma.shareEvent.create({
      data: {
        id: nanoid(),
        agentId,
        userId: userId || null,
        method,
      },
    });

    // Log the share event
    logger.info(
      {
        shareEventId: shareEvent.id,
        agentId,
        agentName: agent.name,
        userId,
        method,
        timestamp: shareEvent.createdAt.toISOString(),
      },
      "Agent shared"
    );

    return NextResponse.json({
      success: true,
      shareEventId: shareEvent.id,
      agentId,
      method,
      message: "Compartido registrado exitosamente",
    });
  } catch (error) {
    logger.error({ error, agentId: (await params).id }, "Error tracking share");
    return NextResponse.json(
      { error: "Error al registrar compartido" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/[id]/share
 * Get share statistics for an agent
 *
 * Query params:
 * - days: Number of days to look back (default: 30, max: 365)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const days = Math.min(parseInt(searchParams.get("days") || "30"), 365);

    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agente no encontrado" },
        { status: 404 }
      );
    }

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all share events for this agent in the date range
    const shareEvents = await prisma.shareEvent.findMany({
      where: {
        agentId,
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        method: true,
        createdAt: true,
        userId: true,
      },
    });

    // Calculate statistics
    const totalShares = shareEvents.length;
    const sharesByMethod: Record<string, number> = {
      copy_link: 0,
      community: 0,
      twitter: 0,
      facebook: 0,
      linkedin: 0,
      whatsapp: 0,
    };

    const uniqueUsers = new Set<string>();

    shareEvents.forEach((event) => {
      sharesByMethod[event.method] = (sharesByMethod[event.method] || 0) + 1;
      if (event.userId) {
        uniqueUsers.add(event.userId);
      }
    });

    // Calculate percentage for each method
    const sharesByMethodWithPercentage = Object.entries(sharesByMethod).map(([method, count]) => ({
      method,
      count,
      percentage: totalShares > 0 ? Math.round((count / totalShares) * 100) : 0,
    }));

    // Sort by count descending
    sharesByMethodWithPercentage.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      agentId: agent.id,
      agentName: agent.name,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      totalShares,
      uniqueUsers: uniqueUsers.size,
      sharesByMethod,
      sharesByMethodWithPercentage,
      mostPopularMethod: sharesByMethodWithPercentage[0]?.method || null,
    });
  } catch (error) {
    logger.error({ error, agentId: (await params).id }, "Error fetching share stats");
    return NextResponse.json(
      { error: "Error al obtener estadísticas" },
      { status: 500 }
    );
  }
}
