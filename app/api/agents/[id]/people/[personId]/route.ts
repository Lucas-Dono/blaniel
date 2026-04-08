/**
 * Important People API Routes - Single Person
 * Endpoints para gestionar una persona individual
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { ImportantPeopleService } from '@/lib/services/important-people.service';

/**
 * GET /api/agents/[id]/people/[personId]
 * Obtener persona específica
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; personId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { personId } = await params;
    const userId = user.id;

    const person = await ImportantPeopleService.getPerson(personId, userId);

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    return NextResponse.json({ person });
  } catch (error: any) {
    console.error('Error fetching person:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch person' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/[id]/people/[personId]
 * Actualizar persona
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; personId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { personId } = await params;
    const userId = user.id;
    const body = await req.json();

    // Convertir birthday si existe
    if (body.birthday) {
      body.birthday = new Date(body.birthday);
    }

    const person = await ImportantPeopleService.updatePerson(
      personId,
      userId,
      body
    );

    return NextResponse.json({ person });
  } catch (error: any) {
    console.error('Error updating person:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update person' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]/people/[personId]
 * Eliminar persona
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; personId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { personId } = await params;
    const userId = user.id;

    await ImportantPeopleService.deletePerson(personId, userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting person:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete person' },
      { status: 500 }
    );
  }
}
