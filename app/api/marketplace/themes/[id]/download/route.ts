/**
 * API Route para Descargar Tema
 * POST /api/marketplace/themes/[id]/download
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { MarketplaceThemeService } from '@/lib/services/marketplace-theme.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/themes/[id]/download
 * Descargar un tema del marketplace
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
    const platform = body.platform || 'web';

    const theme = await MarketplaceThemeService.downloadTheme(
      (await params).id,
      user.id,
      platform
    );

    if (!theme) {
      return NextResponse.json({ error: 'Tema no encontrado' }, { status: 404 });
    }

    return NextResponse.json(theme);
  } catch (error) {
    console.error('[MARKETPLACE_THEME_DOWNLOAD]', error);
    return NextResponse.json(
      { error: 'Error al descargar tema' },
      { status: 500 }
    );
  }
}
