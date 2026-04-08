import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { ReputationService } from '@/lib/services/reputation.service';

/**
 * GET /api/community/reputation/profile?userId=xxx - Obtener reputación de usuario
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let userId = searchParams.get('userId');

    // Si no se especifica userId, usar el del usuario autenticado
    if (!userId) {
      const session = await getAuthSession(request);
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
      userId = session.user.id;
    }

    const reputation = await ReputationService.getUserReputation(userId);
    const stats = await ReputationService.getUserStats(userId);

    return NextResponse.json({ reputation, stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
