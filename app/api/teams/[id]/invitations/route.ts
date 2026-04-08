import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { withTeamPermission } from "@/lib/permissions/middleware";
import { randomBytes } from "crypto";

// GET /api/teams/[id]/invitations - List pending invitations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await withTeamPermission(req, id, "members", "invite");

  if (!authResult.authorized) {
    return authResult.error;
  }

  const invitations = await prisma.teamInvitation.findMany({
    where: {
      teamId: id,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invitations });
}

// POST /api/teams/[id]/invitations - Create new invitation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await withTeamPermission(req, id, "members", "invite");

  if (!authResult.authorized) {
    return authResult.error;
  }

  const body = await req.json();
  const { email, role = "member" } = body;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  if (!["admin", "member", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Check if user is already a member
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user) {
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
        { error: "User is already a team member" },
        { status: 400 }
      );
    }
  }

  // Check for existing pending invitation
  const existingInvitation = await prisma.teamInvitation.findFirst({
    where: {
      teamId: id,
      email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (existingInvitation) {
    return NextResponse.json(
      { error: "Invitation already sent" },
      { status: 400 }
    );
  }

  // Generate unique token
  const token = randomBytes(32).toString("hex");

  // Create invitation (expires in 7 days)
  const invitation = await prisma.teamInvitation.create({
    data: {
      id: nanoid(),
      teamId: id,
      email,
      role,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // TODO: Send invitation email
  // await sendInvitationEmail(email, invitation.token, authResult.context.team.name);

  return NextResponse.json({ invitation, success: true }, { status: 201 });
}
