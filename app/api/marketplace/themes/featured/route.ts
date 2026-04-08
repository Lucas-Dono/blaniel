/**
 * API Route para Temas Destacados
 * GET /api/marketplace/themes/featured
 */

import { NextRequest, NextResponse } from 'next/server';
import { MarketplaceThemeService } from '@/lib/services/marketplace-theme.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/themes/featured
 * Obtener temas destacados
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    const themes = await MarketplaceThemeService.getFeaturedThemes(limit);

    return NextResponse.json(themes);
  } catch (error) {
    console.error('[MARKETPLACE_THEMES_FEATURED]', error);
    return NextResponse.json(
      { error: 'Error al obtener temas destacados' },
      { status: 500 }
    );
  }
}
