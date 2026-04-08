/**
 * Narrative Arcs API Routes
 * Endpoints para gestionar arcos narrativos del agente
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { LifeEventsTimelineService } from '@/lib/life-events/timeline.service';
import { NarrativeCategory } from '@/lib/life-events/narrative-arc-detector';

/**
 * GET /api/agents/[id]/narrative-arcs
 * Listar arcos narrativos del agente
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
    const category = searchParams.get('category') as NarrativeCategory | null;
    const status = searchParams.get('status') as 'active' | 'completed' | 'abandoned' | null;
    const limit = searchParams.get('limit');
    const timeline = searchParams.get('timeline') === 'true';

    if (timeline) {
      // Get timeline completo
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const categoriesParam = searchParams.get('categories');

      const filters: any = {};
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      if (categoriesParam) {
        filters.categories = categoriesParam.split(',') as NarrativeCategory[];
      }

      const arcs = await LifeEventsTimelineService.getTimeline(
        agentId,
        userId,
        filters
      );
      return NextResponse.json({ arcs });
    }

    // Get arcos con filtros
    const filters: any = {};
    if (category) filters.category = category;
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit, 10);

    const arcs = await LifeEventsTimelineService.getArcs(
      agentId,
      userId,
      filters
    );

    return NextResponse.json({ arcs });
  } catch (error: any) {
    console.error('Error fetching narrative arcs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch narrative arcs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/[id]/narrative-arcs/process
 * Procesar mensaje del usuario para detectar eventos narrativos
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
    if (!body.message) {
      return NextResponse.json(
        { error: 'Missing required field: message' },
        { status: 400 }
      );
    }

    // Process mensaje
    await LifeEventsTimelineService.processMessage({
      message: body.message,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      agentId,
      userId,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error processing message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process message' },
      { status: 500 }
    );
  }
}
