import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTeamPermission } from "@/lib/permissions/middleware";
import { canManageRole, TeamRole } from "@/lib/permissions/roles";

// PATCH /api/teams/[id]/members/[memberId] - Update member role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const authResult = await withTeamPermission(req, id, "members", "update_role");

  if (!authResult.authorized) {
    return authResult.error;
  }

  const body = await req.json();
  const { role } = body;

  if (!role || !["admin", "member", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Get target member
  const targetMember = await prisma.teamMember.findUnique({
    where: { id: memberId },
  });

  if (!targetMember || targetMember.teamId !== id) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Check if can manage this role
  if (!canManageRole(authResult.context.role, targetMember.role as TeamRole)) {
    return NextResponse.json(
      { error: "Cannot manage this member's role" },
      { status: 403 }
    );
  }

  // Cannot change owner role
  if (targetMember.role === "owner") {
    return NextResponse.json(
      { error: "Cannot change owner role" },
      { status: 400 }
    );
  }

  const updatedMember = await prisma.teamMember.update({
    where: { id: memberId },
    data: { role },
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
  });

  return NextResponse.json({ member: updatedMember, success: true });
}

// DELETE /api/teams/[id]/members/[memberId] - Remove member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const authResult = await withTeamPermission(req, id, "members", "remove");

  if (!authResult.authorized) {
    return authResult.error;
  }

  // Get target member
  const targetMember = await prisma.teamMember.findUnique({
    where: { id: memberId },
  });

  if (!targetMember || targetMember.teamId !== id) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Cannot remove owner
  if (targetMember.role === "owner") {
    return NextResponse.json(
      { error: "Cannot remove team owner" },
      { status: 400 }
    );
  }

  // Check if can manage this role
  if (!canManageRole(authResult.context.role, targetMember.role as TeamRole)) {
    return NextResponse.json(
      { error: "Cannot remove this member" },
      { status: 403 }
    );
  }

  await prisma.teamMember.delete({
    where: { id: memberId },
  });

  return NextResponse.json({ success: true });
}
