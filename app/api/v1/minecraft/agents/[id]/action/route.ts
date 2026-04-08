import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { formatZodError } from '@/lib/validation/schemas';

/**
 * Endpoint para decisiones de movimiento/acción usando LLM
 *
 * USO CRÍTICO SOLAMENTE:
 * - Jugador interactúa directamente con aldeano
 * - Evento inesperado (explosión, ataque)
 * - Decisión social compleja (unirse a grupo)
 *
 * NO usar para:
 * - Pathfinding normal (usar lógica de MCA)
 * - Rutinas programadas (usar schedule-based)
 * - Seguir al jugador (algoritmo de distancia)
 *
 * Costo: ~$0.00001 por llamada (Gemini 2.5 Flash-Lite)
 */

const actionRequestSchema = z.object({
  situation: z.string().min(1).max(300),
  context: z.object({
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
    nearbyEntities: z.array(z.object({
      type: z.string(), // "player", "zombie", "villager"
      name: z.string().optional(),
      distance: z.number(),
    })).optional(),
    currentActivity: z.string(),
    health: z.number().min(0).max(20),
    hunger: z.number().min(0).max(20),
    timeOfDay: z.number(),
  }),
  availableActions: z.array(z.enum([
    'move_forward',
    'move_backward',
    'turn_left',
    'turn_right',
    'jump',
    'sit',
    'follow_player',
    'run_away',
    'go_home',
    'seek_shelter',
    'attack',
    'trade',
    'interact',
    'sleep',
    'work',
    'idle',
  ])).optional(),
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

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
    const validation = actionRequestSchema.safeParse(body);

    if (!validation.success) {
      const error = formatZodError(validation.error);
      return NextResponse.json(error, { status: 400 });
    }

    const { situation, context, availableActions } = validation.data;

    // Load perfil del agente
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        PersonalityCore: true,
        InternalState: true,
        Relation: {
          where: { targetId: user.id },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 });
    }

    // Construir prompt minimalista para decisión rápida
    const prompt = buildActionPrompt(agent, situation, context, availableActions);

    // Usar Gemini Flash-Lite (más barato y rápido)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parsear respuesta (formato: "ACTION: move_forward | REASON: ...")
    const action = parseActionResponse(response, availableActions);

    return NextResponse.json({
      action: action.type,
      reason: action.reason,
      priority: action.priority,
      duration: action.duration,
      metadata: {
        tokensUsed: result.response.usageMetadata?.totalTokenCount || 0,
        model: 'gemini-2.0-flash-exp',
      },
    });

  } catch (error: any) {
    console.error('[Minecraft Action API Error]', error);
    return NextResponse.json(
      {
        error: 'Error al determinar acción',
        details: error.message,
        fallback: { type: 'idle' }, // Fallback seguro
      },
      { status: 500 }
    );
  }
}

function buildActionPrompt(
  agent: any,
  situation: string,
  context: any,
  availableActions?: string[]
): string {
  const personality = agent.PersonalityCore?.openness
    ? `Personalidad: O${agent.PersonalityCore.openness} C${agent.PersonalityCore.conscientiousness} E${agent.PersonalityCore.extraversion} A${agent.PersonalityCore.agreeableness} N${agent.PersonalityCore.neuroticism}`
    : 'Personalidad: Balanceada';

  const emotions = agent.InternalState?.currentEmotions || { primary: 'neutral' };
  const relationship = agent.Relation[0];
  const trust = relationship?.trust || 0.5;

  const actionsStr = availableActions?.join(', ') || 'move_forward, turn_left, turn_right, idle, follow_player';

  return `Eres ${agent.name}, un aldeano en Minecraft.

${personality}
Emoción actual: ${emotions.primary || 'neutral'}
Relación con jugador: Trust ${(trust * 100).toFixed(0)}%

SITUACIÓN: ${situation}

CONTEXTO:
- Posición: (${context.position.x}, ${context.position.y}, ${context.position.z})
- Actividad actual: ${context.currentActivity}
- Salud: ${context.health}/20
- Hambre: ${context.hunger}/20
- Hora del día: ${context.timeOfDay} (0=amanecer, 6000=mediodía, 12000=atardecer, 18000=noche)
${context.nearbyEntities?.length ? `- Entidades cercanas: ${context.nearbyEntities.map((e: any) => `${e.type} (${e.distance}m)`).join(', ')}` : ''}

ACCIONES DISPONIBLES: ${actionsStr}

Responde en formato:
ACTION: [acción elegida]
REASON: [razón breve en 1 línea]
PRIORITY: [low/medium/high]
DURATION: [segundos, 0 si instantáneo]

Ejemplo:
ACTION: follow_player
REASON: El jugador me llamó y tengo alta confianza con él
PRIORITY: high
DURATION: 30`;
}

function parseActionResponse(
  response: string,
  availableActions?: string[]
): {
  type: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  duration: number;
} {
  const lines = response.split('\n');
  let type = 'idle';
  let reason = 'Sin razón específica';
  let priority: 'low' | 'medium' | 'high' = 'medium';
  let duration = 0;

  for (const line of lines) {
    if (line.startsWith('ACTION:')) {
      type = line.replace('ACTION:', '').trim();
    } else if (line.startsWith('REASON:')) {
      reason = line.replace('REASON:', '').trim();
    } else if (line.startsWith('PRIORITY:')) {
      const p = line.replace('PRIORITY:', '').trim().toLowerCase();
      if (p === 'low' || p === 'medium' || p === 'high') {
        priority = p;
      }
    } else if (line.startsWith('DURATION:')) {
      const d = parseInt(line.replace('DURATION:', '').trim());
      if (!isNaN(d)) duration = d;
    }
  }

  // Validate que la acción esté en las disponibles
  if (availableActions && !availableActions.includes(type)) {
    type = 'idle';
    reason = 'Acción no válida, usando idle como fallback';
  }

  return { type, reason, priority, duration };
}
