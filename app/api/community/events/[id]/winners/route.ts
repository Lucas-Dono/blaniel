import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { EventService } from '@/lib/services/event.service';

/**
 * POST /api/community/events/[id]/winners - Declarar ganadores (solo organizador)
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

    const { winners } = await request.json();
    const result = await EventService.declareWinners(
      (await params).id,
      session.user.id,
      winners
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
