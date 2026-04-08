/**
 * API Routes for Individual Theme
 * GET /api/marketplace/themes/[id] - Get theme by ID
 * PUT /api/marketplace/themes/[id] - Update theme
 * DELETE /api/marketplace/themes/[id] - Delete theme
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { MarketplaceThemeService } from '@/lib/services/marketplace-theme.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/themes/[id]
 * Obtener detalles de un tema
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const theme = await MarketplaceThemeService.getThemeById((await params).id);

    if (!theme) {
      return NextResponse.json({ error: 'Tema no encontrado' }, { status: 404 });
    }

    return NextResponse.json(theme);
  } catch (error) {
    console.error('[MARKETPLACE_THEME_GET]', error);
    return NextResponse.json(
      { error: 'Error al obtener tema' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/marketplace/themes/[id]
 * Actualizar un tema
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();

    const theme = await MarketplaceThemeService.updateTheme(
      (await params).id,
      user.id,
      body
    );

    return NextResponse.json(theme);
  } catch (error: any) {
    console.error('[MARKETPLACE_THEME_PUT]', error);

    if (error.message.includes('permiso')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Error al actualizar tema' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/marketplace/themes/[id]
 * Eliminar un tema
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    await MarketplaceThemeService.deleteTheme((await params).id, user.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[MARKETPLACE_THEME_DELETE]', error);

    if (error.message.includes('permiso')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Error al eliminar tema' },
      { status: 500 }
    );
  }
}
