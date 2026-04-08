/**
 * API: Agents by Story
 * GET /api/stories/agents - Get historical agents grouped by niche
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { StoryNicheType } from '@/lib/stories/config';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    // Get all public agents (filter by story niche in JS)
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
      take: 100
    });

    // Agrupar por nicho (asignar uno si no tiene)
    const agentsByStory: Record<string, any[]> = {
      war_figures: [],
      pop_culture: [],
      controversial: []
    };

    const storyKeys = Object.keys(agentsByStory);

    allAgents.forEach((agent) => {
      const aiFields = agent.aiGeneratedFields as any;
      let nicheType = aiFields?.storyNiche?.type as StoryNicheType;

      // Si no tiene story niche, asignar uno basado en el hash del nombre
      if (!nicheType || !agentsByStory[nicheType]) {
        let hash = 0;
        for (let i = 0; i < agent.name.length; i++) {
          hash = agent.name.charCodeAt(i) + ((hash << 5) - hash);
        }
        nicheType = storyKeys[Math.abs(hash) % storyKeys.length] as StoryNicheType;
      }

      agentsByStory[nicheType].push(agent);
    });

    return NextResponse.json({
      agentsByStory
    });
  } catch (error) {
    console.error('Error fetching agents by story:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
