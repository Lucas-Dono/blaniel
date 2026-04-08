import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";

/**
 * GET /api/groups/user-groups
 * Get simplified list of user's groups for sidebar navigation
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Get grupos del usuario (solo info necesaria para navegación)
    const groups = await prisma.group.findMany({
      where: {
        status: "ACTIVE",
        GroupMember: {
          some: {
            userId: user.id,
            memberType: "user",
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
        lastActivityAt: true,
        GroupMember: {
          select: {
            memberType: true,
          },
        },
        _count: {
          select: {
            GroupMessage: true,
          },
        },
      },
      orderBy: { lastActivityAt: "desc" },
      take: 10, // Limitar a los 10 grupos más recientes
    });

    return NextResponse.json({
      groups,
      total: groups.length,
    });
  } catch (error) {
    console.error("Error fetching user groups:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
