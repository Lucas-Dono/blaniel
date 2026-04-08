/**
 * ENDPOINT: Activate Special Event
 *
 * Activa un evento especial para el usuario autenticado.
 *
 * POST /api/events/activate
 *
 * Response:
 * {
 *   success: true,
 *   message: "🎄 ¡JOJOJO! Papa Noel ha llegado!...",
 *   expiresAt: "2025-12-25T23:59:59.000Z",
 *   eventName: "Navidad",
 *   tier: "plus"
 * }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getActiveEvent, activateEventForUser } from '@/lib/usage/special-events';

export async function POST(req: Request) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check si hay un evento activo
    const activeEvent = getActiveEvent();

    if (!activeEvent) {
      return NextResponse.json({
        success: false,
        message: 'No hay eventos activos en este momento',
        hint: 'Los eventos especiales se activan en fechas importantes (Navidad, Año Nuevo, etc.)',
      });
    }

    // Activar el evento para el usuario
    const result = await activateEventForUser(userId, activeEvent);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.message,
      });
    }

    // Éxito
    return NextResponse.json({
      success: true,
      message: result.message,
      expiresAt: result.expiresAt,
      eventName: activeEvent.name,
      eventEmoji: activeEvent.emoji,
      tier: activeEvent.benefits.tempUpgradeTo,
      durationHours: activeEvent.benefits.durationHours,
    });

  } catch (error) {
    console.error('[Events] ❌ Error activating event:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Check if there's an active event
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const activeEvent = getActiveEvent();

    if (!activeEvent) {
      return NextResponse.json({
        hasActiveEvent: false,
        message: 'No hay eventos activos en este momento',
      });
    }

    // Check si el usuario ya activó este evento
    const { isEligibleForEvent } = await import('@/lib/usage/special-events');
    const eligible = await isEligibleForEvent(userId, activeEvent);

    return NextResponse.json({
      hasActiveEvent: true,
      event: {
        id: activeEvent.id,
        name: activeEvent.name,
        emoji: activeEvent.emoji,
        description: activeEvent.description,
        tier: activeEvent.benefits.tempUpgradeTo,
        durationHours: activeEvent.benefits.durationHours,
        endDate: activeEvent.endDate,
      },
      eligible,
      eligibilityMessage: eligible
        ? `¡Puedes activar ${activeEvent.emoji} ${activeEvent.name}!`
        : 'Ya has usado este evento o no eres elegible',
    });

  } catch (error) {
    console.error('[Events] ❌ Error checking event:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
