/**
 * API Endpoint for Proactive Messaging
 *
 * POST /api/proactive/process - Process proactive messages for all agents (cron trigger)
 * POST /api/proactive/process/:agentId - Process for specific agent
 * GET /api/proactive/config/:agentId - Get config for agent
 * PATCH /api/proactive/config/:agentId - Update config for agent
 * GET /api/proactive/stats/:agentId - Get stats for agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { processAllAgents, processAgent, getProactiveStats, updateProactiveConfig } from '@/lib/proactive/proactive-service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/proactive
 * Process proactive messages for all agents or specific agent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { agentId, userId } = body;

    // Process specific agent or all agents
    if (agentId && userId) {
      const result = await processAgent(agentId, userId);
      return NextResponse.json({ success: true, result });
    } else {
      await processAllAgents();
      return NextResponse.json({ success: true, message: 'All agents processed' });
    }
  } catch (error) {
    console.error('Error processing proactive messages:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/proactive?agentId=xxx
 * Get proactive config for agent
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      );
    }

    // Get config
    const config = await prisma.proactiveConfig.findUnique({
      where: { agentId },
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Config not found' },
        { status: 404 }
      );
    }

    // Get stats
    const stats = await getProactiveStats(agentId);

    return NextResponse.json({ config, stats });
  } catch (error) {
    console.error('Error getting proactive config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/proactive
 * Update proactive config
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, ...updates } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      );
    }

    const config = await updateProactiveConfig(agentId, updates);

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Error updating proactive config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
