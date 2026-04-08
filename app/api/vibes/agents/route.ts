/**
 * API: Agents by Vibe
 * GET /api/vibes/agents - Get agents grouped by vibe with custom sorting
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DEFAULT_VIBE_ORDER, type VibeType } from '@/lib/vibes/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id;

    // Get all public agents (we will filter by vibes in JS)
    const allAgents = await prisma.agent.findMany({
      where: {
        visibility: 'public'
      },
      select: {
        id: true,
        name: true,
        description: true,
        avatar: true,
        categories: true,
        generationTier: true,
        aiGeneratedFields: true,
        kind: true
      },
      take: 200
    });

    // Agrupar por vibe (asignar uno si no tiene)
    const agentsByVibe: Record<string, any[]> = {
      chaotic_energy: [],
      comfort_zone: [],
      love_connection: [],
      adventure: []
    };

    const vibeKeys = Object.keys(agentsByVibe);

    allAgents.forEach((agent, _index) => {
      const aiFields = agent.aiGeneratedFields as any;
      let primaryVibe = aiFields?.vibes?.primary;

      // If it has no vibe, assign one based on the name hash for consistency
      if (!primaryVibe || !agentsByVibe[primaryVibe]) {
        let hash = 0;
        for (let i = 0; i < agent.name.length; i++) {
          hash = agent.name.charCodeAt(i) + ((hash << 5) - hash);
        }
        primaryVibe = vibeKeys[Math.abs(hash) % vibeKeys.length];
      }

      agentsByVibe[primaryVibe].push(agent);
    });

    // Get optimal order based on user interactions
    let orderedVibes: VibeType[];

    if (userId) {
      orderedVibes = await getOptimalVibeOrder(userId);
    } else {
      orderedVibes = DEFAULT_VIBE_ORDER;
    }

    return NextResponse.json({
      orderedVibes,
      agentsByVibe
    });
  } catch (error) {
    console.error('Error fetching agents by vibe:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** Get optimal order of vibes based on user interactions */
async function getOptimalVibeOrder(userId: string): Promise<VibeType[]> {
  try {
    // Get last 50 user interactions
    const interactions = await prisma.userInteraction.findMany({
      where: {
        userId,
        itemType: 'agent'
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        itemId: true
      }
    });

    if (interactions.length === 0) {
      return DEFAULT_VIBE_ORDER;
    }

    // Get agentes de esas interacciones
    const agentIds = interactions.map(i => i.itemId);
    const agents = await prisma.agent.findMany({
      where: {
        id: { in: agentIds }
      },
      select: {
        id: true,
        aiGeneratedFields: true
      }
    });

    // Count interacciones por vibe
    const vibeCount: Record<string, number> = {};

    agents.forEach(agent => {
      const aiFields = agent.aiGeneratedFields as any;
      const vibe = aiFields?.vibes?.primary;

      if (vibe) {
        vibeCount[vibe] = (vibeCount[vibe] || 0) + 1;
      }
    });

    // Sort por frecuencia
    const sortedVibes = Object.entries(vibeCount)
      .sort((a, b) => b[1] - a[1])
      .map(([vibe]) => vibe as VibeType);

    // Agregar vibes faltantes al final
    const allVibes: VibeType[] = ['chaotic_energy', 'comfort_zone', 'love_connection', 'adventure'];
    allVibes.forEach(vibe => {
      if (!sortedVibes.includes(vibe)) {
        sortedVibes.push(vibe);
      }
    });

    return sortedVibes;
  } catch (error) {
    console.error('Error calculating optimal vibe order:', error);
    return DEFAULT_VIBE_ORDER;
  }
}
