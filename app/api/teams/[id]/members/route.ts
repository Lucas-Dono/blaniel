import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { withTeamPermission } from "@/lib/permissions/middleware";
// GET /api/teams/[id]/members - List team members
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await withTeamPermission(req, id, "members", "read");

  if (!authResult.authorized) {
    return authResult.error;
  }

  const members = await prisma.teamMember.findMany({
    where: { teamId: id },
    include: {
      User: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
  });

  return NextResponse.json({ members });
}

// POST /api/teams/[id]/members - Add member (via invitation acceptance)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { invitationToken } = body;

  if (!invitationToken) {
    return NextResponse.json(
      { error: "Invitation token required" },
      { status: 400 }
    );
  }

  // Find invitation
  const invitation = await prisma.teamInvitation.findUnique({
    where: { token: invitationToken },
    include: { Team: true },
  });

  if (!invitation || invitation.teamId !== id) {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
  }

  if (invitation.acceptedAt) {
    return NextResponse.json(
      { error: "Invitation already accepted" },
      { status: 400 }
    );
  }

  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation expired" }, { status: 400 });
  }

  // Check if user is already a member
  const existingMember = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: id,
        userId: user.id,
      },
    },
  });

  if (existingMember) {
    return NextResponse.json(
      { error: "Already a team member" },
      { status: 400 }
    );
  }

  // Add member and mark invitation as accepted
  const [member] = await prisma.$transaction([
    prisma.teamMember.create({
      data: {
        id: nanoid(),
        teamId: id,
        userId: user.id,
        role: invitation.role,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    }),
    prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ member, success: true }, { status: 201 });
}
