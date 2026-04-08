/**
 * API Route para Reportar Temas
 * POST /api/marketplace/themes/[id]/report - Reportar tema
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { MarketplaceThemeService } from '@/lib/services/marketplace-theme.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/themes/[id]/report
 * Reportar un tema
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

    if (!body.reason) {
      return NextResponse.json(
        { error: 'Se requiere una razón para el reporte' },
        { status: 400 }
      );
    }

    const validReasons = ['inappropriate', 'spam', 'copyright', 'broken', 'other'];
    if (!validReasons.includes(body.reason)) {
      return NextResponse.json(
        { error: 'Razón de reporte inválida' },
        { status: 400 }
      );
    }

    const report = await MarketplaceThemeService.reportTheme(
      (await params).id,
      user.id,
      body.reason,
      body.description
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error('[MARKETPLACE_THEME_REPORT]', error);
    return NextResponse.json(
      { error: 'Error al reportar tema' },
      { status: 500 }
    );
  }
}
