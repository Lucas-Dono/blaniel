import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { withTeamPermission } from "@/lib/permissions/middleware";

// GET /api/teams/[id] - Get team details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const team = await prisma.team.findFirst({
    where: {
      id,
      OR: [
        { ownerId: user.id },
        { TeamMember: { some: { userId: user.id } } },
      ],
    },
    include: {
      User: { select: { id: true, name: true, email: true, image: true } },
      TeamMember: {
        include: {
          User: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
      Agent: {
        select: {
          id: true,
          name: true,
          kind: true,
          description: true,
          avatar: true,
          createdAt: true,
        },
      },
      _count: {
        select: { TeamMember: true, Agent: true, TeamInvitation: true },
      },
    },
  });

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  return NextResponse.json({ team });
}

// PATCH /api/teams/[id] - Update team
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await withTeamPermission(req, id, "team", "update");

  if (!authResult.authorized) {
    return authResult.error;
  }

  const body = await req.json();
  const { name, description, metadata } = body;

  const team = await prisma.team.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(metadata && { metadata }),
    },
    include: {
      User: { select: { name: true, email: true, image: true } },
      _count: {
        select: { TeamMember: true, Agent: true },
      },
    },
  });

  return NextResponse.json({ team, success: true });
}

// DELETE /api/teams/[id] - Delete team
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await withTeamPermission(req, id, "team", "delete");

  if (!authResult.authorized) {
    return authResult.error;
  }

  // Only owners can delete teams
  if (authResult.context.role !== "owner") {
    return NextResponse.json(
      { error: "Only team owners can delete teams" },
      { status: 403 }
    );
  }

  await prisma.team.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
