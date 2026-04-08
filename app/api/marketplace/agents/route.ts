import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const kind = searchParams.get("kind");
  const featured = searchParams.get("featured") === "true";
  const sort = searchParams.get("sort") || "popular";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const where = {
    visibility: "public" as const,
    ...(query && {
      OR: [
        { name: { contains: query, mode: "insensitive" as const } },
        { description: { contains: query, mode: "insensitive" as const } },
      ],
    }),
    ...(kind && { kind }),
    ...(featured && { featured: true }),
  };

  const orderBy =
    sort === "popular" ? { cloneCount: "desc" as const } :
    sort === "rating" ? { rating: "desc" as const } :
    { createdAt: "desc" as const };

  const agents = await prisma.agent.findMany({
    where,
    orderBy,
    take: limit,
    include: {
      User: { select: { name: true, email: true } },
      Review: { select: { rating: true } },
      _count: { select: { Review: true, AgentClone: true } },
    },
  });

  return NextResponse.json({ agents, total: agents.length });
}
