/**
 * Important Events API Routes
 * Endpoints para gestionar eventos importantes del agente
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { ImportantEventsService } from '@/lib/services/important-events.service';

/**
 * GET /api/agents/[id]/events
 * Listar eventos importantes del agente
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
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const eventHappened = searchParams.get('eventHappened');
    const isRecurring = searchParams.get('isRecurring');
    const upcoming = searchParams.get('upcoming');
    const includeAgentEvents = searchParams.get('includeAgentEvents') === 'true'; // New parameter

    if (upcoming === 'true') {
      const daysAhead = parseInt(searchParams.get('daysAhead') || '30', 10);
      const events = await ImportantEventsService.getUpcomingEvents(
        agentId,
        userId,
        daysAhead
      );
      return NextResponse.json({ events });
    }

    const filters: any = {};
    if (type) filters.type = type;
    if (priority) filters.priority = priority;
    if (eventHappened !== null) filters.eventHappened = eventHappened === 'true';
    if (isRecurring !== null) filters.isRecurring = isRecurring === 'true';
    if (includeAgentEvents) filters.includeAgentEvents = true; // Incluir eventos del agente

    const events = await ImportantEventsService.getEvents(
      agentId,
      userId,
      filters
    );

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/[id]/events
 * Crear nuevo evento importante
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
    if (!body.eventDate || !body.type || !body.description) {
      return NextResponse.json(
        { error: 'Missing required fields: eventDate, type, description' },
        { status: 400 }
      );
    }

    const event = await ImportantEventsService.createEvent(agentId, userId, {
      eventDate: new Date(body.eventDate),
      type: body.type,
      description: body.description,
      priority: body.priority,
      relationship: body.relationship,
      emotionalTone: body.emotionalTone,
      isRecurring: body.isRecurring,
      metadata: body.metadata,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create event' },
      { status: 500 }
    );
  }
}
