import { NextRequest, NextResponse } from 'next/server';
import { searchRouter } from '@/lib/smart-start/search/search-router';

/**
 * POST /api/smart-start/details
 * Fetch complete details for a character from a specific source
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sourceId, externalId } = body;

    // Validate request
    if (!sourceId || typeof sourceId !== 'string') {
      return NextResponse.json(
        { error: 'sourceId is required and must be a string' },
        { status: 400 }
      );
    }

    if (!externalId || typeof externalId !== 'string') {
      return NextResponse.json(
        { error: 'externalId is required and must be a string' },
        { status: 400 }
      );
    }

    console.log(`[Details API] Fetching details for ${sourceId}:${externalId}`);

    // Fetch complete details from source
    const details = await searchRouter.getDetails(sourceId, externalId);

    if (!details) {
      return NextResponse.json(
        { error: 'Character not found or source unavailable' },
        { status: 404 }
      );
    }

    console.log(`[Details API] Successfully fetched details for ${details.name}`);

    return NextResponse.json({
      success: true,
      details,
    });
  } catch (error) {
    console.error('[Details API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch character details',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
