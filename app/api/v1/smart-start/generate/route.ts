import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { generateSmartStartProfile } from "@/lib/smart-start/services/smart-start-generation.service";
import type { SmartStartGenerationInput } from "@/lib/smart-start/services/smart-start-generation.service";
import { prisma } from "@/lib/prisma";
import { getDefaultDepthForTier, canAccessDepth, type DepthLevelId } from '@circuitpromptai/smart-start-core';

/**
 * POST /api/v1/smart-start/generate
 *
 * Generate a deep, comprehensive character profile using AI
 * Based on context + archetype selections from Smart Start wizard
 *
 * Request body:
 * - name: string (required)
 * - context: ContextCategoryId (required)
 * - archetype: GenreId (required)
 * - depthLevel?: DepthLevelId (optional - defaults to user's tier default)
 * - contextSubcategory?: string
 * - contextOccupation?: string
 * - contextEra?: string
 * - searchResult?: SearchResult (if based on existing character)
 * - customDescription?: string
 * - age?: number
 * - gender?: 'male' | 'female' | 'other' | 'unknown'
 * - language?: 'es' | 'en'
 *
 * Response:
 * - Complete SmartStartGeneratedProfile with all sections
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user (supports both JWT and NextAuth)
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Get user's plan/tier for appropriate generation depth
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true }
    });

    const tier = (userRecord?.plan || 'free') as 'free' | 'plus' | 'ultra';

    // Parse request body
    const body = await req.json();
    const {
      name,
      context,
      archetype,
      depthLevel: requestedDepth,
      contextSubcategory,
      contextOccupation,
      contextEra,
      searchResult,
      customDescription,
      age,
      gender,
      language = 'es',
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!context || typeof context !== 'string') {
      return NextResponse.json(
        { error: "context is required and must be a valid ContextCategoryId" },
        { status: 400 }
      );
    }

    if (!archetype || typeof archetype !== 'string') {
      return NextResponse.json(
        { error: "archetype is required and must be a valid GenreId" },
        { status: 400 }
      );
    }

    // Validate context is one of the allowed values
    const validContexts = ['historical', 'cultural-icon', 'fictional', 'real-person', 'original'];
    if (!validContexts.includes(context)) {
      return NextResponse.json(
        { error: `context must be one of: ${validContexts.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate archetype is one of the allowed values
    const validArchetypes = ['romance', 'friendship', 'professional', 'roleplay', 'wellness'];
    if (!validArchetypes.includes(archetype)) {
      return NextResponse.json(
        { error: `archetype must be one of: ${validArchetypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Determine depth level
    // 1. If user explicitly requested a depth, validate they have access
    // 2. Otherwise, use default for their tier
    let depthLevel: DepthLevelId;

    if (requestedDepth) {
      // Validate depth level is valid
      const validDepths = ['basic', 'realistic', 'ultra'];
      if (!validDepths.includes(requestedDepth)) {
        return NextResponse.json(
          { error: `depthLevel must be one of: ${validDepths.join(', ')}` },
          { status: 400 }
        );
      }

      // Check if user has access to requested depth
      if (!canAccessDepth(tier, requestedDepth as DepthLevelId)) {
        return NextResponse.json(
          {
            error: `Depth level '${requestedDepth}' requires a higher tier subscription`,
            requiredTier: requestedDepth === 'ultra' ? 'ultra' : 'plus',
            currentTier: tier
          },
          { status: 403 }
        );
      }

      depthLevel = requestedDepth as DepthLevelId;
    } else {
      // Use default depth for user's tier
      depthLevel = getDefaultDepthForTier(tier);
    }

    console.log('[Smart Start Generate] Generating profile for:', {
      name,
      context,
      contextSubcategory,
      archetype,
      tier,
      depthLevel,
      language,
    });

    // Build generation input
    const generationInput: SmartStartGenerationInput = {
      name: name.trim(),
      context: context as any, // Already validated above
      archetype: archetype as any, // Already validated above
      tier,
      depthLevel, // Use validated depth level
      language: language as 'es' | 'en',
    };

    // Add optional fields if provided
    if (contextSubcategory) generationInput.contextSubcategory = contextSubcategory;
    if (contextOccupation) generationInput.contextOccupation = contextOccupation;
    if (contextEra) generationInput.contextEra = contextEra;
    if (searchResult) generationInput.searchResult = searchResult;
    if (customDescription) generationInput.customDescription = customDescription;
    if (age) generationInput.age = age;
    if (gender) generationInput.gender = gender;

    // Generate profile using AI service
    const startTime = Date.now();
    const generatedProfile = await generateSmartStartProfile(generationInput);
    const generationTime = Date.now() - startTime;

    console.log('[Smart Start Generate] Profile generated successfully in', generationTime, 'ms');
    console.log('[Smart Start Generate] Profile sections:', {
      basicInfo: !!generatedProfile.basicInfo,
      description: !!generatedProfile.description,
      personality: !!generatedProfile.personality,
      emotionalProfile: !!generatedProfile.emotionalProfile,
      backstory: !!generatedProfile.backstory,
      interests: !!generatedProfile.interests,
      communication: !!generatedProfile.communication,
      relationshipStyle: !!generatedProfile.relationshipStyle,
      innerWorld: !!generatedProfile.innerWorld,
      specificDetails: !!generatedProfile.specificDetails,
    });

    // Return generated profile
    return NextResponse.json(
      {
        success: true,
        profile: generatedProfile,
        generationTime,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Smart Start Generate] Error:", error);

    // Provide more specific error message if possible
    let errorMessage = "Failed to generate character profile";
    let statusCode = 500;

    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('API key')) {
        errorMessage = "AI service configuration error";
        statusCode = 500;
      } else if (error.message.includes('rate limit')) {
        errorMessage = "AI service rate limit exceeded. Please try again later.";
        statusCode = 429;
      } else if (error.message.includes('timeout')) {
        errorMessage = "Generation timeout. Please try again.";
        statusCode = 504;
      } else if (error.message.includes('JSON')) {
        errorMessage = "Invalid generation output. Please try again.";
        statusCode = 500;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined
      },
      { status: statusCode }
    );
  }
}
