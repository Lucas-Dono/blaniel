import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from "@/lib/auth-server";
import { checkAIGenerationRateLimit } from '@/lib/auth/rate-limit';
import { generateAppearanceAttributes } from '@/lib/smart-start/services/appearance-generator';

export const dynamic = 'force-dynamic';

// Zod schema for input validation
const RequestSchema = z.object({
  name: z.string().max(100).optional(),
  age: z.union([z.string(), z.number()]).optional(),
  gender: z.string().max(50).optional(),
  personality: z.string().max(3000).optional(),
  occupation: z.string().max(200).optional(),
  ethnicity: z.string().max(50).optional(),
  style: z.enum(['realistic', 'semi-realistic', 'anime']).optional(),
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

    const { name, age, gender, personality, occupation, ethnicity, style } = validation.data;

    const result = await generateAppearanceAttributes({
      name,
      age,
      gender,
      personality,
      occupation,
      ethnicity,
      style: style || 'realistic',
    });

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate appearance' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hairColor: result.data.hairColor,
      hairStyle: result.data.hairStyle,
      eyeColor: result.data.eyeColor,
      clothing: result.data.clothing,
      skinTone: result.data.skinTone,
      bodyType: result.data.bodyType,
      tokensUsed: result.tokensUsed,
    });
  } catch (error) {
    console.error('[API] generate-appearance error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
