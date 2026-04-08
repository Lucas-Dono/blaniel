/**
 * API Route para Rating de Temas
 * POST /api/marketplace/themes/[id]/rating - Dejar rating
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { MarketplaceThemeService } from '@/lib/services/marketplace-theme.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/themes/[id]/rating
 * Dejar un rating y review para un tema
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.rating || body.rating < 1 || body.rating > 5) {
      return NextResponse.json(
        { error: 'Rating debe estar entre 1 y 5' },
        { status: 400 }
      );
    }

    const rating = await MarketplaceThemeService.rateTheme(
      (await params).id,
      user.id,
      body.rating,
      body.review
    );

    return NextResponse.json(rating);
  } catch (error: any) {
    console.error('[MARKETPLACE_THEME_RATING]', error);

    if (error.message.includes('Rating debe estar')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Error al dejar rating' },
      { status: 500 }
    );
  }
}
