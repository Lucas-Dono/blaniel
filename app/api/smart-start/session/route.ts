/**
 * Smart Start Session API
 * POST - Create new session
 * PATCH - Update session state
 * GET - Get session by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getSmartStartOrchestrator } from '@/lib/smart-start/core/orchestrator';
import { getGenreService } from '@/lib/smart-start/services/genre-service';

const orchestrator = getSmartStartOrchestrator();
const genreService = getGenreService();

/**
 * POST /api/smart-start/session - Create new session
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create Smart Start session
    const smartStartSession = await orchestrator.createSession(user.id);

    // Get available genres for selection
    const genres = genreService.getAllGenres();

    return NextResponse.json({
      success: true,
      session: {
        id: smartStartSession.id,
        currentStep: smartStartSession.currentStep,
        startedAt: smartStartSession.startedAt,
      },
      availableGenres: genres.map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        icon: g.icon,
        gradient: g.color,
        tags: g.universalTraits,
        subGenres: g.subgenres.map(sg => ({
          id: sg.id,
          name: sg.name,
          description: sg.description,
          archetypes: sg.archetypes.map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
          })),
        })),
      })),
    });
  } catch (error) {
    console.error('[API] Error creating Smart Start session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/smart-start/session - Update session state
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, action } = body;

    if (!sessionId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify session belongs to user
    const existingSession = await orchestrator.getSession(sessionId);
    if (!existingSession || existingSession.userId !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Progress session
    const updated = await orchestrator.progressSession(sessionId, action);

    return NextResponse.json({
      success: true,
      session: {
        id: updated.id,
        currentStep: updated.currentStep,
        genre: updated.selectedGenre,
        subgenre: updated.selectedSubgenre,
        archetype: updated.selectedArchetype,
        source: updated.characterType,
      },
    });
  } catch (error) {
    console.error('[API] Error updating Smart Start session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/smart-start/session?id=xxx - Get session details
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    const smartStartSession = await orchestrator.getSession(sessionId);

    if (!smartStartSession || smartStartSession.userId !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      session: smartStartSession,
    });
  } catch (error) {
    console.error('[API] Error fetching Smart Start session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
