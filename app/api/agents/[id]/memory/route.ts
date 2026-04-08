/**
 * Memory Management API
 * Endpoints for viewing, searching, and managing agent memories
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { createMemoryManager } from "@/lib/memory/manager";

/**
 * @swagger
 * /api/agents/{id}/memory:
 *   get:
 *     summary: Get memory statistics
 *     description: Retrieve statistics about stored memories for this agent
 *     tags: [Memory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Memory statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalMemories:
 *                   type: number
 *                 oldestMemory:
 *                   type: string
 *                   format: date-time
 *                 newestMemory:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
export async function GET(
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

    // Get memory stats
    const memoryManager = createMemoryManager(agentId, userId);
    const stats = await memoryManager.getStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error getting memory stats:", error);
    return NextResponse.json(
      { error: "Failed to get memory statistics" },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/agents/{id}/memory:
 *   delete:
 *     summary: Clear all memories
 *     description: Delete all stored memories for this agent
 *     tags: [Memory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Memories cleared
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
export async function DELETE(
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

    // Clear memories
    const memoryManager = createMemoryManager(agentId, userId);
    await memoryManager.clearMemories();

    return NextResponse.json({
      success: true,
      message: "Memories cleared successfully",
    });
  } catch (error) {
    console.error("Error clearing memories:", error);
    return NextResponse.json(
      { error: "Failed to clear memories" },
      { status: 500 }
    );
  }
}
