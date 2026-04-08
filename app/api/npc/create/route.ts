/**
 * POST /api/npc/create
 *
 * Endpoint simplificado para crear NPCs desde consola, frontend o cualquier cliente
 * Este endpoint es público en la versión open source para facilitar la creación de NPCs
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

// Templates disponibles
const TEMPLATES = {
  merchant: {
    kind: 'npc',
    personality: 'Amigable, astuto en los negocios, siempre buscando una buena oferta',
    purpose: 'Vender objetos y comerciar con los jugadores',
    tone: 'Profesional pero cercano, usa jerga comercial',
  },
  guard: {
    kind: 'npc',
    personality: 'Serio, protector, leal a su deber',
    purpose: 'Proteger la ciudad y mantener el orden',
    tone: 'Formal y autoritario, pero justo',
  },
  villager: {
    kind: 'npc',
    personality: 'Amable, trabajador, conoce todos los chismes del pueblo',
    purpose: 'Compartir información sobre el pueblo y sus habitantes',
    tone: 'Casual y conversador',
  },
  'quest-giver': {
    kind: 'npc',
    personality: 'Misterioso, sabio, con problemas que resolver',
    purpose: 'Dar misiones y recompensas a los jugadores',
    tone: 'Enigmático pero claro',
  },
  companion: {
    kind: 'companion',
    personality: 'Leal, valiente, siempre dispuesto a ayudar',
    purpose: 'Acompañar al jugador en sus aventuras',
    tone: 'Amistoso y motivador',
  },
  enemy: {
    kind: 'npc',
    personality: 'Hostil, amenazante, pero con honor',
    purpose: 'Ser un adversario desafiante pero justo',
    tone: 'Intimidante pero respetuoso',
  },
  friendly: {
    kind: 'companion',
    personality: 'Extremadamente amigable, optimista, siempre positivo',
    purpose: 'Hacer compañía y alegrar el día del jugador',
    tone: 'Alegre y entusiasta',
  },
  'rpg-npc': {
    kind: 'npc',
    personality: 'Variado según la situación, adaptable',
    purpose: 'NPC genérico para juegos RPG',
    tone: 'Neutral pero expresivo',
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, template, kind, personality, purpose, tone } = body;

    // Validación básica
    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Si se usa template, aplicarlo
    let npcData = {
      kind: kind || 'npc',
      personality: personality || '',
      purpose: purpose || '',
      tone: tone || 'neutral',
    };

    if (template && TEMPLATES[template as keyof typeof TEMPLATES]) {
      npcData = {
        ...TEMPLATES[template as keyof typeof TEMPLATES],
        ...npcData, // Permite override
      };
    }

    // Validar que al menos tenga personalidad o propósito
    if (!npcData.personality && !npcData.purpose) {
      return NextResponse.json(
        {
          error: 'Se requiere personalidad o propósito (o usa un template)',
          availableTemplates: Object.keys(TEMPLATES),
        },
        { status: 400 }
      );
    }

    // Generar profile y systemPrompt básicos
    const profile = {
      occupation: npcData.purpose,
      traits: [],
      hobbies: [],
    };

    const systemPrompt = `Eres ${name}. ${npcData.personality}. ${npcData.purpose}.`;

    // Crear el NPC
    const npc = await prisma.agent.create({
      data: {
        id: nanoid(),
        userId: null, // NPCs públicos
        kind: npcData.kind,
        name,
        description: npcData.personality,
        personality: npcData.personality,
        purpose: npcData.purpose,
        tone: npcData.tone,
        profile: profile as any,
        systemPrompt,
        visibility: 'public',
        nsfwMode: false,
        updatedAt: new Date(),
      },
    });

    // Crear relación inicial (necesaria para el sistema)
    await prisma.relation.create({
      data: {
        id: nanoid(),
        subjectId: npc.id,
        targetId: 'system', // Relación con el sistema
        targetType: 'user',
        trust: 0.5,
        affinity: 0.5,
        respect: 0.5,
        privateState: {},
        visibleState: {},
        updatedAt: new Date(),
      },
    });

    console.log(`✅ NPC creado: ${npc.name} (${npc.id})`);

    return NextResponse.json({
      success: true,
      npc: {
        id: npc.id,
        name: npc.name,
        kind: npc.kind,
        personality: npc.personality,
        purpose: npc.purpose,
      },
      usage: {
        api: `/api/v1/agents/${npc.id}/chat`,
        sdk: `blaniel npc chat ${npc.id} "mensaje"`,
        minecraft: '/summon blaniel-mc:blaniel_villager',
      },
    });
  } catch (error) {
    console.error('Error creando NPC:', error);
    return NextResponse.json(
      {
        error: 'Error al crear NPC',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET: Listar templates disponibles y NPCs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Listar templates
    if (action === 'templates') {
      return NextResponse.json({
        templates: Object.entries(TEMPLATES).map(([key, value]) => ({
          id: key,
          ...value,
        })),
      });
    }

    // Listar NPCs
    const npcs = await prisma.agent.findMany({
      where: {
        userId: null, // Solo NPCs públicos
      },
      select: {
        id: true,
        name: true,
        kind: true,
        personality: true,
        purpose: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ npcs, count: npcs.length });
  } catch (error) {
    console.error('Error obteniendo NPCs:', error);
    return NextResponse.json(
      { error: 'Error al obtener NPCs' },
      { status: 500 }
    );
  }
}
