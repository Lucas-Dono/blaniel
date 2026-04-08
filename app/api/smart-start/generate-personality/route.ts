import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { checkAIGenerationRateLimit } from '@/lib/auth/rate-limit';
import { analyzeBigFive } from '@/lib/smart-start/services/personality-analysis';

export const dynamic = 'force-dynamic';

// Zod schema for input validation
const RequestSchema = z.object({
  personalityText: z.string().min(10, 'Must be at least 10 characters').max(5000, 'Must be less than 5000 characters'),
  context: z.object({
    name: z.string().max(100).optional(),
    age: z.union([z.string(), z.number()]).optional(),
    gender: z.string().max(50).optional(),
    occupation: z.string().max(200).optional(),
    backstory: z.string().max(3000).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = await checkAIGenerationRateLimit(user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please wait a moment before trying again.',
          retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          },
        }
      );
    }

    // Parse and validate input with Zod
    const body = await request.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { personalityText, context } = validation.data;

    const result = await analyzeBigFive(personalityText, context);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Failed to analyze personality' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bigFive: result.data,
      tokensUsed: result.tokensUsed,
    });
  } catch (error) {
    console.error('[API] generate-personality error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
