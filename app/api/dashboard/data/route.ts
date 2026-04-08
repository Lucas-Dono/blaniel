import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard/data
 * 
 * Optimized endpoint that returns all dashboard data in a single call:
 * - All agents (public and user's)
 * - User's recent agents
 * - Basic statistics
 * 
 * This reduces it from ~5-10 calls to just 1 initial call.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;

    // Forllel queries for maximum speed
    const [
      allAgents,
      recentAgents,
      userStats
    ] = await Promise.all([
      // 1. All agents (public + user's if authenticated)
      prisma.agent.findMany({
        where: {
          OR: [
            { visibility: "public" },
            ...(userId ? [{ userId }] : [])
          ]
        },
        select: {
          id: true,
          name: true,
          kind: true,
          description: true,
          userId: true,
          featured: true,
          cloneCount: true,
          avatar: true,
          createdAt: true,
          rating: true,
          visibility: true,
          nsfwMode: true,
          nsfwLevel: true,
          generationTier: true,
          tags: true,
          categories: true,
          gender: true,
          _count: {
            select: {
              Review: true
            }
          }
        },
        orderBy: [
          { featured: 'desc' },
          { createdAt: 'desc' }
        ],
        // Limitar a cantidad razonable para evitar overhead
        take: 200
      }),

      // 2. Recent agents (only if authenticated)
      userId ? prisma.agent.findMany({
        where: {
          userId,
          Message: {
            some: {
              userId
            }
          }
        },
        select: {
          id: true,
          name: true,
          description: true,
          avatar: true,
          categories: true,
          generationTier: true,
          kind: true,
        },
        orderBy: {
          Message: {
            _count: 'desc'
          }
        },
        take: 10
      }) : Promise.resolve([]),

      // 3. User stats (optional)
      userId ? prisma.user.findUnique({
        where: { id: userId },
        select: {
          plan: true,
          _count: {
            select: {
              Agent: true
            }
          }
        }
      }) : Promise.resolve(null)
    ]);

    return NextResponse.json({
      agents: allAgents,
      recentAgents: recentAgents || [],
      stats: userStats ? {
        plan: userStats.plan,
        totalAgents: userStats._count.Agent
      } : null,
      timestamp: new Date().toISOString(),
      // Cache hint for the client
      cacheHint: {
        maxAge: 300, // 5 minutos
        staleWhileRevalidate: 600 // 10 minutos
      }
    });

  } catch (error) {
    console.error("[API] Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Error al cargar datos del dashboard" },
      { status: 500 }
    );
  }
}
