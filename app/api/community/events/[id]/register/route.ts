import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { EventService } from '@/lib/services/event.service';

/**
 * POST /api/community/events/[id]/register - Registrarse en evento
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { teamName } = await request.json();
    const registration = await EventService.registerForEvent(
      (await params).id,
      session.user.id,
      teamName
    );

    return NextResponse.json(registration, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * DELETE /api/community/events/[id]/register - Cancelar registro
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const result = await EventService.unregisterFromEvent((await params).id, session.user.id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
