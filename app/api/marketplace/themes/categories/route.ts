/**
 * API Route for Categories and Tags
 * GET /api/marketplace/themes/categories
 */

import { NextRequest, NextResponse } from 'next/server';
import { MarketplaceThemeService } from '@/lib/services/marketplace-theme.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/themes/categories
 * Get available categories and popular tags
 */
export async function GET(_request: NextRequest) {
  try {
    const [categories, tags] = await Promise.all([
      MarketplaceThemeService.getCategories(),
      MarketplaceThemeService.getPopularTags(30),
    ]);

    return NextResponse.json({
      categories,
      tags,
    });
  } catch (error) {
    console.error('[MARKETPLACE_THEMES_CATEGORIES]', error);
    return NextResponse.json(
      { error: 'Error al obtener categorías' },
      { status: 500 }
    );
  }
}
