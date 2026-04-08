/**
 * Multimedia Status API
 *
 * GET /api/user/multimedia-status
 * - Retorna el estado del trial/límites multimedia para el usuario actual
 * - Útil para mostrar progreso en UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { getFreeMultimediaStatus, getMultimediaStrategyInfo } from '@/lib/multimedia/limits';
import { apiLogger as log } from '@/lib/logging';

export async function GET(req: NextRequest) {
  try {
    // Autenticación
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const userPlan = user.plan || 'free';

    // Si es Plus/Ultra, no hay límites
    if (userPlan !== 'free') {
      return NextResponse.json({
        plan: userPlan,
        hasLimits: false,
        message: 'Sin límites multimedia para tu plan',
      });
    }

    // Get estrategia global
    const strategyInfo = getMultimediaStrategyInfo();

    // Get estado específico del usuario
    const status = await getFreeMultimediaStatus(userId);

    log.info({ userId, strategy: strategyInfo.strategy }, 'Multimedia status retrieved');

    return NextResponse.json({
      plan: 'free',
      hasLimits: true,
      strategyDescription: strategyInfo.description,
      ...status,
      upgradeUrl: '/pricing',
      strategy: strategyInfo.strategy,
    });
  } catch (error) {
    log.error({ error }, 'Failed to get multimedia status');
    return NextResponse.json(
      {
        error: 'Failed to get multimedia status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
