/**
 * Important Events API Routes - Single Event
 * Endpoints para gestionar un evento individual
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { ImportantEventsService } from '@/lib/services/important-events.service';

/**
 * GET /api/agents/[id]/events/[eventId]
 * Obtener evento específico
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const userId = user.id;

    const event = await ImportantEventsService.getEvent(eventId, userId);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error: any) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/[id]/events/[eventId]
 * Actualizar evento
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const userId = user.id;
    const body = await req.json();

    // Convertir eventDate si existe
    if (body.eventDate) {
      body.eventDate = new Date(body.eventDate);
    }

    const event = await ImportantEventsService.updateEvent(
      eventId,
      userId,
      body
    );

    return NextResponse.json({ event });
  } catch (error: any) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update event' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]/events/[eventId]
 * Eliminar evento
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const userId = user.id;

    await ImportantEventsService.deleteEvent(eventId, userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete event' },
      { status: 500 }
    );
  }
}
