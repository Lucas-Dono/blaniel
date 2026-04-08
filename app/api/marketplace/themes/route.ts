/**
 * API Routes para Marketplace de Temas
 * GET /api/marketplace/themes - Buscar temas
 * POST /api/marketplace/themes - Publicar nuevo tema
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { MarketplaceThemeService } from '@/lib/services/marketplace-theme.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/themes
 * Buscar temas en el marketplace
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const filters = {
      category: searchParams.get('category') || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      minRating: searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined,
      sortBy: (searchParams.get('sortBy') as 'downloads' | 'rating' | 'recent' | 'featured') || 'downloads',
      isFeatured: searchParams.get('isFeatured') === 'true' ? true : undefined,
      isPremium: searchParams.get('isPremium') === 'true' ? true : undefined,
    };

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const result = await MarketplaceThemeService.searchThemes(filters, page, limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[MARKETPLACE_THEMES_GET]', error);
    return NextResponse.json(
      { error: 'Error al buscar temas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/marketplace/themes
 * Publicar un nuevo tema en el marketplace
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();

    // Validate datos requeridos
    if (!body.name || !body.category) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const theme = await MarketplaceThemeService.publishTheme(user.id, {
      name: body.name,
      description: body.description,
      userBubbleColor: body.userBubbleColor,
      agentBubbleColor: body.agentBubbleColor,
      backgroundColor: body.backgroundColor,
      backgroundGradient: body.backgroundGradient,
      accentColor: body.accentColor,
      textColor: body.textColor,
      backgroundImage: body.backgroundImage,
      category: body.category,
      tags: body.tags || [],
      previewImages: body.previewImages || [],
    });

    return NextResponse.json(theme, { status: 201 });
  } catch (error) {
    console.error('[MARKETPLACE_THEMES_POST]', error);
    return NextResponse.json(
      { error: 'Error al publicar tema' },
      { status: 500 }
    );
  }
}
