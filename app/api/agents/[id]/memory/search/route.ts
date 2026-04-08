/**
 * Memory Search API
 * Semantic search through agent memories
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { createMemoryManager } from "@/lib/memory/manager";

/**
 * @swagger
 * /api/agents/{id}/memory/search:
 *   post:
 *     summary: Search memories
 *     description: Perform semantic search through stored memories
 *     tags: [Memory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 example: "What did we talk about last week?"
 *               limit:
 *                 type: number
 *                 example: 10
 *                 default: 10
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       content:
 *                         type: string
 *                       role:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       similarity:
 *                         type: number
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: agentId } = await params;
    const userId = user.id;

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const body = await req.json();
    const { query, limit = 10 } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Search memories
    const memoryManager = createMemoryManager(agentId, userId);
    const results = await memoryManager.searchMemories(query, limit);

    return NextResponse.json({
      query,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error("Error searching memories:", error);
    return NextResponse.json(
      { error: "Failed to search memories" },
      { status: 500 }
    );
  }
}
