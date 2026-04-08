import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAPIAuth } from "@/lib/api/auth";

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   get:
 *     summary: Get agent by ID
 *     description: Retrieve a specific agent's details
 *     tags: [Agents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       404:
 *         description: Agent not found
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id } = await params;

    const agent = await prisma.agent.findFirst({
      where: { id, userId },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json(agent);
  });
}

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   put:
 *     summary: Update agent
 *     description: Update an agent's properties
 *     tags: [Agents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               personality:
 *                 type: string
 *               purpose:
 *                 type: string
 *               tone:
 *                 type: string
 *               visibility:
 *                 type: string
 *                 enum: [private, world, public]
 *     responses:
 *       200:
 *         description: Agent updated
 *       404:
 *         description: Agent not found
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id } = await params;
    const body = await req.json();

    const agent = await prisma.agent.findFirst({
      where: { id, userId },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const updated = await prisma.agent.update({
      where: { id },
      data: {
        name: body.name,
        personality: body.personality,
        purpose: body.purpose,
        tone: body.tone,
        visibility: body.visibility,
      },
    });

    return NextResponse.json(updated);
  });
}

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   delete:
 *     summary: Delete agent
 *     description: Permanently delete an agent
 *     tags: [Agents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent deleted
 *       404:
 *         description: Agent not found
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPIAuth(req, async (userId) => {
    const { id } = await params;

    const agent = await prisma.agent.findFirst({
      where: { id, userId },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    await prisma.agent.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Agent deleted" });
  });
}
