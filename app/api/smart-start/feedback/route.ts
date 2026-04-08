import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/smart-start/feedback
 * Receives and stores genre detection feedback
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      sessionId,
      searchResultId,
      detectedGenre,
      actualGenre,
      confidence,
      isCorrect,
      timestamp,
      metadata,
    } = body;

    // Validate required fields
    if (!sessionId || detectedGenre === undefined || isCorrect === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Store feedback in database
    await prisma.genreDetectionFeedback.create({
      data: {
        id: nanoid(),
        sessionId,
        searchResultId,
        detectedGenre,
        actualGenre,
        confidence: confidence || 0,
        isCorrect,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        metadata: metadata || {},
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to store feedback:', error);
    return NextResponse.json(
      { error: 'Failed to store feedback' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/smart-start/feedback
 * Retrieves feedback analytics (admin only)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    const feedbacks = await prisma.genreDetectionFeedback.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
    });

    // Calculate statistics
    const total = feedbacks.length;
    const correct = feedbacks.filter(f => f.isCorrect).length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    return NextResponse.json({
      total,
      correct,
      accuracy: Math.round(accuracy * 100) / 100,
      feedbacks,
    });
  } catch (error) {
    console.error('[API] Failed to retrieve feedback:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve feedback' },
      { status: 500 }
    );
  }
}
