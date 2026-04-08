import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";

/**
 * GET /api/groups/[id]/messages/search
 * Search messages in a group
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // 1. Check membership
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        memberType: "user",
        isActive: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "No eres miembro de este grupo" },
        { status: 403 }
      );
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 3) {
      return NextResponse.json(
        { error: "Query debe tener al menos 3 caracteres" },
        { status: 400 }
      );
    }

    // 3. Search messages
    // Using Prisma's contains (case-insensitive search)
    const messages = await prisma.groupMessage.findMany({
      where: {
        groupId,
        content: {
          contains: query,
          mode: "insensitive",
        },
        isSystemMessage: false, // Exclude system messages
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit results
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        Agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json({
      results: messages,
      total: messages.length,
      query,
    });
  } catch (error) {
    console.error("Error searching messages:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
