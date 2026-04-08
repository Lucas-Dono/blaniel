/**
 * Narrative Arcs Stats API Route
 * Endpoint para obtener estadísticas de arcos narrativos
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { LifeEventsTimelineService } from '@/lib/life-events/timeline.service';

/**
 * GET /api/agents/[id]/narrative-arcs/stats
 * Obtener estadísticas de arcos narrativos
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

    const stats = await LifeEventsTimelineService.getArcStats(agentId, userId);

    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error('Error fetching arc stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch arc stats' },
      { status: 500 }
    );
  }
}
