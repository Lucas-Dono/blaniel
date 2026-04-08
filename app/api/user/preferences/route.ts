import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { UserPreferenceService } from '@/lib/services/user-preference.service';

/**
 * GET /api/user/preferences - Obtener preferencias del usuario
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get preferencias
    const preferences = await UserPreferenceService.getUserPreferences(userId);

    return NextResponse.json({ preferences });
  } catch (error: any) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener preferencias' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/user/preferences - Resetear preferencias del usuario
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Resetear preferencias
    await UserPreferenceService.resetPreferences(userId);

    return NextResponse.json({
      success: true,
      message: 'Preferencias reseteadas correctamente'
    });
  } catch (error: any) {
    console.error('Error resetting preferences:', error);
    return NextResponse.json(
      { error: error.message || 'Error al resetear preferencias' },
      { status: 400 }
    );
  }
}
