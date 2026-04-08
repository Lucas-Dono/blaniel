/**
 * Smart Start Search API
 * POST - Perform character search
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { getSmartStartOrchestrator } from '@/lib/smart-start/core/orchestrator';

const orchestrator = getSmartStartOrchestrator();

/**
 * POST /api/smart-start/search - Search for characters
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, query, limit = 10 } = body;

    if (!sessionId || !query) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify session belongs to user
    const smartStartSession = await orchestrator.getSession(sessionId);
    if (!smartStartSession || smartStartSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Perform search (orchestrator.performSearch now returns {results, cached})
    const startTime = Date.now();
    const searchData = await orchestrator.performSearch(sessionId, query, limit);
    const searchTime = Date.now() - startTime;

    // Handle both old format (array) and new format ({results, cached})
    const results = Array.isArray(searchData) ? searchData : (searchData as any).results || searchData;
    const cached = Array.isArray(searchData) ? false : (searchData as any).cached || false;

    return NextResponse.json({
      success: true,
      results: results.map((r: any) => ({
        id: r.id,
        externalId: r.externalId,
        name: r.name,
        alternateName: r.alternateName,
        description: r.description,
        imageUrl: r.imageUrl,
        thumbnailUrl: r.thumbnailUrl,
        source: r.source,
        sourceUrl: r.sourceUrl,
        metadata: r.metadata,
        confidence: r.confidence,
      })),
      meta: {
        query,
        count: results.length,
        searchTime,
        cached, // Cache detection now implemented via SearchRouter
      },
    });
  } catch (error) {
    console.error('[API] Error performing search:', error);
    return NextResponse.json(
      {
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
