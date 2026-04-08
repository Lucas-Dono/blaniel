/**
 * Narrative Arc Detail API Routes
 * Endpoints para gestionar un arco narrativo específico
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { LifeEventsTimelineService } from '@/lib/life-events/timeline.service';

/**
 * GET /api/agents/[id]/narrative-arcs/[arcId]
 * Obtener detalles de un arco narrativo
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; arcId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { arcId } = await params;
    const userId = user.id;

    const arc = await LifeEventsTimelineService.getArc(arcId, userId);

    if (!arc) {
      return NextResponse.json({ error: 'Arc not found' }, { status: 404 });
    }

    return NextResponse.json({ arc });
  } catch (error: any) {
    console.error('Error fetching arc:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch arc' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/[id]/narrative-arcs/[arcId]
 * Actualizar título/descripción de un arco
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; arcId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { arcId } = await params;
    const userId = user.id;
    const body = await req.json();

    const arc = await LifeEventsTimelineService.updateArc(arcId, userId, {
      title: body.title,
      description: body.description,
    });

    return NextResponse.json({ arc });
  } catch (error: any) {
    console.error('Error updating arc:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update arc' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]/narrative-arcs/[arcId]
 * Marcar arco como abandonado
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; arcId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { arcId } = await params;
    const userId = user.id;

    await LifeEventsTimelineService.markAsAbandoned(arcId, userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error marking arc as abandoned:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to mark arc as abandoned' },
      { status: 500 }
    );
  }
}
