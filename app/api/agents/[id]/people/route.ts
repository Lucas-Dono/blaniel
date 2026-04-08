/**
 * Important People API Routes
 * Endpoints para gestionar personas importantes del agente
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { ImportantPeopleService } from '@/lib/services/important-people.service';

/**
 * GET /api/agents/[id]/people
 * Listar personas importantes del agente
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: agentId } = await params;
    const userId = user.id;

    // Query params
    const searchParams = req.nextUrl.searchParams;
    const relationship = searchParams.get('relationship');
    const importance = searchParams.get('importance');
    const sortBy = searchParams.get('sortBy') as any;
    const order = searchParams.get('order') as 'asc' | 'desc';
    const upcomingBirthdays = searchParams.get('upcomingBirthdays');
    const includeAgentPeople = searchParams.get('includeAgentPeople') === 'true'; // New parameter

    if (upcomingBirthdays === 'true') {
      const daysAhead = parseInt(searchParams.get('daysAhead') || '30', 10);
      const people = await ImportantPeopleService.getUpcomingBirthdays(
        agentId,
        userId,
        daysAhead
      );
      return NextResponse.json({ people });
    }

    const filters: any = {};
    if (relationship) filters.relationship = relationship;
    if (importance) filters.importance = importance;
    if (sortBy) filters.sortBy = sortBy;
    if (order) filters.order = order;
    if (includeAgentPeople) filters.includeAgentPeople = true; // Incluir personas del agente

    const people = await ImportantPeopleService.getImportantPeople(
      agentId,
      userId,
      filters
    );

    return NextResponse.json({ people });
  } catch (error: any) {
    console.error('Error fetching people:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch people' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/[id]/people
 * Agregar nueva persona importante
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: agentId } = await params;
    const userId = user.id;
    const body = await req.json();

    // Validaciones
    if (!body.name || !body.relationship) {
      return NextResponse.json(
        { error: 'Missing required fields: name, relationship' },
        { status: 400 }
      );
    }

    // Convertir birthday si existe
    if (body.birthday) {
      body.birthday = new Date(body.birthday);
    }

    const person = await ImportantPeopleService.addPerson(agentId, userId, {
      name: body.name,
      relationship: body.relationship,
      age: body.age,
      gender: body.gender,
      description: body.description,
      interests: body.interests,
      healthInfo: body.healthInfo,
      birthday: body.birthday,
      importance: body.importance,
      metadata: body.metadata,
    });

    return NextResponse.json({ person }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating person:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create person' },
      { status: 500 }
    );
  }
}
