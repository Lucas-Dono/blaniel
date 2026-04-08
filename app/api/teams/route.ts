import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

// GET /api/teams - List user's teams
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { TeamMember: { some: { userId: user.id } } },
      ],
    },
    include: {
      User: { select: { name: true, email: true, image: true } },
      _count: {
        select: { TeamMember: true, Agent: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ teams });
}

// POST /api/teams - Create new team
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, description } = body;

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }

  // Create team and add owner as member
  const team = await prisma.team.create({
    data: {
      id: nanoid(),
      updatedAt: new Date(),
      name,
      description,
      ownerId: user.id,
      TeamMember: {
        create: {
          id: nanoid(),
          userId: user.id,
          role: "owner",
        },
      },
    },
    include: {
      User: { select: { name: true, email: true, image: true } },
      _count: {
        select: { TeamMember: true, Agent: true },
      },
    },
  });

  return NextResponse.json({ team, success: true }, { status: 201 });
}
