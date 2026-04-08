/**
 * Smart Start Generate API
 * POST - Generate character from search result or from scratch
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { getSmartStartOrchestrator } from '@/lib/smart-start/core/orchestrator';

const orchestrator = getSmartStartOrchestrator();

/**
 * POST /api/smart-start/generate - Generate character
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      sessionId,
      searchResultId, // Legacy support
      searchResult, // New: accept complete result directly
      fromScratch = false,
      customizations = {}
    } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // Verify session
    const smartStartSession = await orchestrator.getSession(sessionId);
    if (!smartStartSession || smartStartSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const startTime = Date.now();
    let characterDraft;

    if (fromScratch) {
      // Generate completely new character
      characterDraft = await orchestrator.generateCharacter(sessionId);
    } else if (searchResult) {
      // NEW: Use complete search result directly (includes enriched data from getDetails)
      try {
        console.log('[API] Using complete search result:', searchResult.name);
        characterDraft = await orchestrator.selectSearchResult(sessionId, searchResult);
      } catch (extractError) {
        console.error('[API] Character extraction failed:', extractError);
        return NextResponse.json(
          {
            error: 'Failed to extract character data',
            details: extractError instanceof Error ? extractError.message : 'Unknown extraction error',
          },
          { status: 500 }
        );
      }
    } else if (searchResultId) {
      // LEGACY: Look up result by ID in session (fallback)
      const searchResults = smartStartSession.searchResults as any[] || [];
      const selectedResult = searchResults.find((r: any) => r.id === searchResultId);

      if (!selectedResult) {
        console.error('[API] Search result not found:', {
          searchResultId,
          availableIds: searchResults.map((r: any) => r.id),
        });
        return NextResponse.json(
          {
            error: 'Search result not found',
            details: `Result with ID ${searchResultId} not found in session`,
            availableResults: searchResults.length,
          },
          { status: 404 }
        );
      }

      try {
        characterDraft = await orchestrator.selectSearchResult(sessionId, selectedResult);
      } catch (extractError) {
        console.error('[API] Character extraction failed:', extractError);
        return NextResponse.json(
          {
            error: 'Failed to extract character data',
            details: extractError instanceof Error ? extractError.message : 'Unknown extraction error',
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Must provide searchResult, searchResultId, or set fromScratch=true' },
        { status: 400 }
      );
    }

    // Apply customizations if provided
    if (Object.keys(customizations).length > 0) {
      characterDraft = await orchestrator.applyCustomizations(
        sessionId,
        characterDraft,
        customizations
      );
    }

    const generationTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      characterDraft: {
        name: characterDraft.name,
        alternateName: characterDraft.alternateName,
        personality: characterDraft.personality,
        ...(characterDraft as any).background && { background: (characterDraft as any).background },
        ...(characterDraft as any).appearance && { appearance: (characterDraft as any).appearance },
        age: characterDraft.age,
        gender: characterDraft.gender,
        occupation: characterDraft.occupation,
        systemPrompt: characterDraft.systemPrompt,
        imageUrl: characterDraft.imageUrl,
        thumbnailUrl: characterDraft.thumbnailUrl,
        genreId: characterDraft.genreId,
        subgenreId: characterDraft.subgenreId,
        archetypeId: characterDraft.archetypeId,
        aiGeneratedFields: characterDraft.aiGeneratedFields,
        userEditedFields: characterDraft.userEditedFields,
        communicationStyle: characterDraft.communicationStyle,
        catchphrases: characterDraft.catchphrases,
        likes: characterDraft.likes,
        dislikes: characterDraft.dislikes,
        skills: characterDraft.skills,
        fears: characterDraft.fears,
      },
      meta: {
        generationTime,
        method: fromScratch ? 'generated' : 'extracted',
        aiFields: characterDraft.aiGeneratedFields?.length || 0,
        userFields: characterDraft.userEditedFields?.length || 0,
      },
    });
  } catch (error) {
    console.error('[API] Error generating character:', error);
    return NextResponse.json(
      {
        error: 'Generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
