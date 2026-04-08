import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { formatZodError } from '@/lib/validation/schemas';

/**
 * POST /api/v1/minecraft/agents/[id]/sync
 * 
 * Synchronizes the agent state between Minecraft and the database
 * 
 * Use this to:
 * - Update agent position in the world
 * - Sync current activity
 * - Report events (death, damage, interactions)
 * - Get updated emotional state
 * 
 * Recommended frequency: every 5-10 seconds, NOT every tick
 */

const syncSchema = z.object({
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    world: z.string(), // "overworld", "nether", "end"
    dimension: z.string().optional(), // "minecraft:overworld"
  }).optional(),
  activity: z.enum([
    'idle',
    'following_player',
    'working',
    'sleeping',
    'walking',
    'running',
    'trading',
    'fighting',
    'eating',
    'sitting',
  ]).optional(),
  health: z.number().min(0).max(20).optional(),
  hunger: z.number().min(0).max(20).optional(),
  nearbyPlayers: z.array(z.string()).optional(),
  events: z.array(z.object({
    type: z.enum([
      'damage_taken',
      'healed',
      'fed',
      'interacted',
      'died',
      'respawned',
      'attacked_entity',
      'item_given',
      'item_taken',
    ]),
    data: z.record(z.string(), z.any()).optional(),
    timestamp: z.number().optional(),
  })).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const validation = syncSchema.safeParse(body);

    if (!validation.success) {
      const error = formatZodError(validation.error);
      return NextResponse.json(error, { status: 400 });
    }

    const { position, activity, health, hunger, nearbyPlayers, events } = validation.data;

    // Check que el agente pertenece al usuario
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        InternalState: true,
        Relation: {
          where: { targetId: user.id },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 });
    }

    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Process eventos si hay
    if (events && events.length > 0) {
      await processEvents(agentId, events, agent);
    }

    // Update agent metadata with Minecraft state
    const currentMetadata = agent.metadata as any || {};
    const minecraftState = {
      ...currentMetadata.minecraft,
      position,
      activity,
      health,
      hunger,
      nearbyPlayers,
      lastSync: Date.now(),
    };

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        metadata: {
          ...currentMetadata,
          minecraft: minecraftState,
        },
      },
    });

    // Return updated agent state
    const currentEmotion = agent.InternalState?.currentEmotions as any;
    const relationship = agent.Relation[0];

    return NextResponse.json({
      success: true,
      state: {
        emotion: {
          primary: currentEmotion?.primary || 'neutral',
          intensity: currentEmotion?.intensity || 0.5,
          animation: mapEmotionToAnimation(currentEmotion?.primary),
        },
        relationship: relationship
          ? {
              trust: relationship.trust,
              affinity: relationship.affinity,
              stage: relationship.stage,
            }
          : null,
        mood: agent.InternalState ? {
          pleasure: agent.InternalState.moodValence,
          arousal: agent.InternalState.moodArousal,
          dominance: agent.InternalState.moodDominance,
        } : { pleasure: 0, arousal: 0, dominance: 0 },
        // Sugerencias de comportamiento basadas en estado
        suggestions: generateBehaviorSuggestions(agent, { health, hunger, activity }),
      },
    });

  } catch (error: any) {
    console.error('[Minecraft Sync API Error]', error);
    return NextResponse.json(
      {
        error: 'Error al sincronizar estado',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Procesa eventos reportados desde Minecraft
 */
async function processEvents(agentId: string, events: any[], _agent: any) {
  for (const event of events) {
    switch (event.type) {
      case 'damage_taken':
        // Update estado emocional (fear, anger)
        // Register in episodic memory
        await recordEpisodicMemory(agentId, {
          content: `Recibí daño en Minecraft (${event.data?.damage || 'desconocido'})`,
          importance: 0.6,
          emotionalValence: -0.7,
        });
        break;

      case 'healed':
      case 'fed':
        // Emociones positivas
        await recordEpisodicMemory(agentId, {
          content: `Fui ${event.type === 'healed' ? 'curado' : 'alimentado'} en Minecraft`,
          importance: 0.4,
          emotionalValence: 0.5,
        });
        break;

      case 'interacted':
        // Register social interaction
        await recordEpisodicMemory(agentId, {
          content: `Interactué con ${event.data?.playerName || 'alguien'} en Minecraft`,
          importance: 0.5,
          emotionalValence: 0.3,
          tags: ['minecraft', 'social', 'interaction'],
        });
        break;

      case 'died':
        // Evento significativo
        await recordEpisodicMemory(agentId, {
          content: `Morí en Minecraft por ${event.data?.cause || 'causa desconocida'}`,
          importance: 0.9,
          emotionalValence: -0.9,
          tags: ['minecraft', 'death', 'trauma'],
        });
        break;

      case 'item_given':
        // Gift received, affects relationship
        await recordEpisodicMemory(agentId, {
          content: `${event.data?.playerName || 'Alguien'} me dio ${event.data?.itemName || 'algo'} en Minecraft`,
          importance: 0.6,
          emotionalValence: 0.7,
          tags: ['minecraft', 'gift', 'social'],
        });
        break;
    }
  }
}

/** Records episodic memory */
async function recordEpisodicMemory(agentId: string, data: any) {
  try {
    await prisma.episodicMemory.create({
      data: {
        id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agentId,
        event: data.content,
        importance: data.importance || 0.5,
        emotionalValence: data.emotionalValence || 0,
        metadata: {
          tags: data.tags || [],
          source: 'minecraft',
        },
      },
    });
  } catch (error) {
    console.error('[Error recording episodic memory]', error);
  }
}

/** Generates behavior suggestions based on state */
function generateBehaviorSuggestions(agent: any, state: any) {
  const suggestions: string[] = [];

  // Salud baja
  if (state.health !== undefined && state.health < 10) {
    suggestions.push('seek_healing');
    suggestions.push('avoid_combat');
  }

  // Hambre
  if (state.hunger !== undefined && state.hunger < 10) {
    suggestions.push('seek_food');
  }

  // Actividad actual
  if (state.activity === 'fighting' && state.health && state.health < 15) {
    suggestions.push('retreat');
  }

  // Relationship with player
  const relationship = agent.Relation?.[0];
  if (relationship && relationship.trust > 0.7) {
    suggestions.push('stay_near_player');
  }

  return suggestions;
}

/**
 * Mapea emociones a animaciones de Minecraft
 */
function mapEmotionToAnimation(emotion?: string): string {
  const animationMap: Record<string, string> = {
    joy: 'wave',
    sadness: 'cry',
    anger: 'shake_fist',
    fear: 'cower',
    surprise: 'shocked',
    disgust: 'turn_away',
    anticipation: 'look_around',
    trust: 'nod',
    love: 'heart_eyes',
    neutral: 'idle',
  };

  return animationMap[emotion || 'neutral'] || 'idle';
}
