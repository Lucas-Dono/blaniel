import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { withOwnership, errorResponse } from "@/lib/api/middleware";
import { apiLogger as log } from "@/lib/logging/loggers";
import { z } from "zod";
import { getSocketServer } from "@/lib/socket/server";
import { redis } from "@/lib/redis/config";

/**
 * GET /api/agents/[id]
 * Get agent details (requires ownership or public visibility)
 */
export const GET = withOwnership(
  'agent',
  async (req, { resource }) => {
    try {
      log.info({ agentId: resource.id }, 'Fetching agent details');

      const agent = await prisma.agent.findUnique({
        where: { id: resource.id },
        include: {
          Message: {
            orderBy: { createdAt: "asc" },
            take: 50,
          },
        },
      });

      if (!agent) {
        log.warn({ agentId: resource.id }, 'Agent not found');
        return errorResponse("Agent not found", 404);
      }

      // Get review count separately
      const reviewCount = await prisma.review.count({
        where: { agentId: resource.id },
      });

      // Health check: verify that critical services are available
      let systemStatus: 'active' | 'degraded' = 'active';
      try {
        // Check Socket.IO
        const socketIO = getSocketServer();
        if (!socketIO) {
          log.warn('Socket.IO not available');
          systemStatus = 'degraded';
        }

        // Verify Redis (critical for BullMQ queue)
        if (redis) {
          await redis.ping();
        }
      } catch (healthError) {
        log.warn({ err: healthError }, 'System health check failed');
        systemStatus = 'degraded';
      }

      // Map agent to include isPublic, reviewCount and system status
      const mappedAgent = {
        ...agent,
        isPublic: agent.visibility === 'public',
        reviewCount,
        status: systemStatus, // Health del sistema para UX preventiva
      };

      log.info({ agentId: resource.id, visibility: agent.visibility, status: systemStatus }, 'Agent details fetched successfully');
      return NextResponse.json(mappedAgent);
    } catch (error) {
      log.error({ err: error, agentId: resource.id }, 'Error fetching agent');
      return errorResponse("Failed to fetch agent", 500);
    }
  },
  { allowPublic: true } // Allow access to public agents
)

/**
 * DELETE /api/agents/[id]
 * Delete an agent (requires ownership)
 */
export const DELETE = withOwnership('agent', async (req, { resource }) => {
  try {
    log.info({ agentId: resource.id }, 'Deleting agent');

    // Delete the agent (this will also delete relationships by CASCADE)
    await prisma.agent.delete({
      where: { id: resource.id },
    });

    log.info({ agentId: resource.id }, 'Agent deleted successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error, agentId: resource.id }, 'Error deleting agent');
    return errorResponse("Failed to delete agent", 500);
  }
});

/**
 * PATCH /api/agents/[id]
 * Update agent details (requires ownership)
 */
const patchAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  personality: z.string().optional(),
  purpose: z.string().optional(),
  tone: z.string().optional(),
  description: z.string().optional(),
});

export const PATCH = withOwnership('agent', async (req, { resource }) => {
  try {
    log.info({ agentId: resource.id }, 'Updating agent');

    // Get and validate body data
    const body = await req.json();
    const validation = patchAgentSchema.safeParse(body);

    if (!validation.success) {
      log.warn({ agentId: resource.id, errors: validation.error.issues }, 'Validation failed');
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { name, personality, purpose, tone, description } = validation.data;

    log.debug({ agentId: resource.id, updates: { name, personality, purpose, tone, description } }, 'Update data validated');

    // Update el agente
    const updatedAgent = await prisma.agent.update({
      where: { id: resource.id },
      data: {
        ...(name && { name }),
        ...(personality && { personality }),
        ...(purpose && { purpose }),
        ...(tone && { tone }),
        ...(description && { description }),
      },
    });

    log.info({ agentId: resource.id }, 'Agent updated successfully');

    return NextResponse.json(updatedAgent);
  } catch (error) {
    log.error({ err: error, agentId: resource.id }, 'Error updating agent');
    return errorResponse("Failed to update agent", 500);
  }
});
