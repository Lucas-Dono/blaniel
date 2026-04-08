import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const reviews = await prisma.review.findMany({
    where: { agentId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null;

  return NextResponse.json({ reviews, avgRating, total: reviews.length });
}

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
  const { rating, comment } = body;

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  }

  const review = await prisma.review.upsert({
    where: {
      agentId_userId: { agentId: id, userId: user.id },
    },
    create: {
      id: nanoid(),
      updatedAt: new Date(),
      agentId: id,
      userId: user.id,
      rating,
      comment,
    },
    update: { rating, comment, updatedAt: new Date() },
  });

  const reviews = await prisma.review.findMany({ where: { agentId: id } });
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  await prisma.agent.update({
    where: { id },
    data: { rating: avgRating },
  });

  return NextResponse.json({ review, success: true });
}
