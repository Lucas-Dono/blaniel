/**
 * API Route para Temas en Tendencia
 * GET /api/marketplace/themes/trending
 */

import { NextRequest, NextResponse } from 'next/server';
import { MarketplaceThemeService } from '@/lib/services/marketplace-theme.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/themes/trending
 * Obtener temas más descargados (trending)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    const themes = await MarketplaceThemeService.getTrendingThemes(limit);

    return NextResponse.json(themes);
  } catch (error) {
    console.error('[MARKETPLACE_THEMES_TRENDING]', error);
    return NextResponse.json(
      { error: 'Error al obtener temas trending' },
      { status: 500 }
    );
  }
}
