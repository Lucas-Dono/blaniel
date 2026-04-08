import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { ModerationSuggestionsService } from '@/lib/services/moderation-suggestions.service';

/**
 * GET /api/user/moderation/suggestions - Obtener sugerencias inteligentes
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const suggestions = await ModerationSuggestionsService.getSuggestions(session.user.id);

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Error getting moderation suggestions:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener sugerencias' },
      { status: 400 }
    );
  }
}

/**
 * POST /api/user/moderation/suggestions - Aplicar una sugerencia
 * Body: { suggestionId: string, action: 'apply' | 'dismiss' }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { suggestionId, action } = await request.json();

    if (!suggestionId || !action) {
      return NextResponse.json(
        { error: 'suggestionId y action son requeridos' },
        { status: 400 }
      );
    }

    if (!['apply', 'dismiss'].includes(action)) {
      return NextResponse.json(
        { error: 'action debe ser "apply" o "dismiss"' },
        { status: 400 }
      );
    }

    let result: boolean;

    if (action === 'apply') {
      result = await ModerationSuggestionsService.applySuggestion(
        session.user.id,
        suggestionId
      );
    } else {
      result = await ModerationSuggestionsService.dismissSuggestion(
        session.user.id,
        suggestionId
      );
    }

    return NextResponse.json({
      success: result,
      message: action === 'apply' ? 'Sugerencia aplicada' : 'Sugerencia descartada',
    });
  } catch (error: any) {
    console.error('Error processing suggestion:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar sugerencia' },
      { status: 400 }
    );
  }
}
