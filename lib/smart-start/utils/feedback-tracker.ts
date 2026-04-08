/**
 * Feedback Tracker - Captures user feedback on genre detection
 * Used to improve detection accuracy over time
 */

export interface GenreFeedback {
  sessionId: string;
  searchResultId?: string;
  detectedGenre: string;
  actualGenre?: string;
  confidence: number;
  isCorrect: boolean;
  timestamp: Date;
  metadata?: {
    source?: string;
    reasoning?: string;
    [key: string]: unknown;
  };
}

/**
 * Track genre detection feedback
 */
export async function trackGenreFeedback(feedback: Omit<GenreFeedback, 'timestamp'>): Promise<void> {
  try {
    const response = await fetch('/api/smart-start/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...feedback,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error('[FeedbackTracker] Failed to send feedback');
    }
  } catch (error) {
    console.error('[FeedbackTracker] Error tracking feedback:', error);
    // Don't throw - feedback is non-critical
  }
}

/**
 * Calculate detection accuracy from feedback data
 */
export function calculateAccuracy(feedbacks: GenreFeedback[]): {
  overall: number;
  byGenre: Record<string, number>;
  bySource: Record<string, number>;
  byConfidenceRange: Record<string, number>;
} {
  if (feedbacks.length === 0) {
    return {
      overall: 0,
      byGenre: {},
      bySource: {},
      byConfidenceRange: {},
    };
  }

  const correct = feedbacks.filter(f => f.isCorrect).length;
  const overall = correct / feedbacks.length;

  // By genre
  const byGenre: Record<string, { correct: number; total: number }> = {};
  feedbacks.forEach(f => {
    if (!byGenre[f.detectedGenre]) {
      byGenre[f.detectedGenre] = { correct: 0, total: 0 };
    }
    byGenre[f.detectedGenre].total++;
    if (f.isCorrect) {
      byGenre[f.detectedGenre].correct++;
    }
  });

  const byGenreAccuracy: Record<string, number> = {};
  Object.entries(byGenre).forEach(([genre, stats]) => {
    byGenreAccuracy[genre] = stats.correct / stats.total;
  });

  // By source
  const bySource: Record<string, { correct: number; total: number }> = {};
  feedbacks.forEach(f => {
    const source = f.metadata?.source as string || 'unknown';
    if (!bySource[source]) {
      bySource[source] = { correct: 0, total: 0 };
    }
    bySource[source].total++;
    if (f.isCorrect) {
      bySource[source].correct++;
    }
  });

  const bySourceAccuracy: Record<string, number> = {};
  Object.entries(bySource).forEach(([source, stats]) => {
    bySourceAccuracy[source] = stats.correct / stats.total;
  });

  // By confidence range
  const ranges = {
    'high (0.9+)': { correct: 0, total: 0 },
    'medium (0.7-0.9)': { correct: 0, total: 0 },
    'low (<0.7)': { correct: 0, total: 0 },
  };

  feedbacks.forEach(f => {
    let range: keyof typeof ranges;
    if (f.confidence >= 0.9) range = 'high (0.9+)';
    else if (f.confidence >= 0.7) range = 'medium (0.7-0.9)';
    else range = 'low (<0.7)';

    ranges[range].total++;
    if (f.isCorrect) {
      ranges[range].correct++;
    }
  });

  const byConfidenceRange: Record<string, number> = {};
  Object.entries(ranges).forEach(([range, stats]) => {
    byConfidenceRange[range] = stats.total > 0 ? stats.correct / stats.total : 0;
  });

  return {
    overall,
    byGenre: byGenreAccuracy,
    bySource: bySourceAccuracy,
    byConfidenceRange,
  };
}
