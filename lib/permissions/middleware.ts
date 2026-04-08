import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, TeamRole } from "./roles";

export interface TeamContext {
  userId: string;
  teamId: string;
  role: TeamRole;
  team: any;
}

export async function withTeamPermission(
  req: NextRequest,
  teamId: string,
  resource: string,
  action: string
): Promise<{ authorized: true; context: TeamContext } | { authorized: false; error: NextResponse }> {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user?.id) {
    return {
      authorized: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // Check if user is a member of the team
  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId: session.user.id,
      },
    },
    include: {
      Team: true,
    },
  });

  if (!membership) {
    return {
      authorized: false,
      error: NextResponse.json({ error: "Not a team member" }, { status: 403 }),
    };
  }

  // Check if user has permission
  if (!hasPermission(membership.role as TeamRole, resource, action)) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    context: {
      userId: session.user.id,
      teamId,
      role: membership.role as TeamRole,
      team: membership.Team,
    },
  };
}

export async function getUserTeamRole(
  userId: string,
  teamId: string
): Promise<TeamRole | null> {
  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
  });

  return membership ? (membership.role as TeamRole) : null;
}

export async function isTeamOwner(userId: string, teamId: string): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true },
  });

  return team?.ownerId === userId;
}
