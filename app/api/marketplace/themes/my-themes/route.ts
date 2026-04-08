/**
 * API Route para Mis Temas
 * GET /api/marketplace/themes/my-themes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { MarketplaceThemeService } from '@/lib/services/marketplace-theme.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/themes/my-themes
 * Obtener temas publicados por el usuario actual
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const themes = await MarketplaceThemeService.getUserThemes(user.id);

    return NextResponse.json(themes);
  } catch (error) {
    console.error('[MARKETPLACE_MY_THEMES]', error);
    return NextResponse.json(
      { error: 'Error al obtener tus temas' },
      { status: 500 }
    );
  }
}
