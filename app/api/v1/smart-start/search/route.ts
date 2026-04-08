import { NextRequest, NextResponse } from "next/server";
import { searchCharacterMultiSource } from "@/lib/profile/multi-source-character-search";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { detectGenre } from "@/lib/smart-start/genre-detector";
import { detectContext } from "@/lib/smart-start/context-detector";

// CRITICAL: Configure route timeout for external API calls
// Wikipedia API can take 10-60 seconds to respond
export const maxDuration = 60; // 60 seconds max (supports Free, Hobby, and Pro plans)
export const dynamic = 'force-dynamic'; // Disable static optimization for real-time search

/**
 * GET /api/v1/smart-start/search
 *
 * Search for characters across multiple sources
 * Sources: Wikipedia, Jikan (anime), Fandom Wikis
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user (supports both JWT and NextAuth)
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const query = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "20"); // Increased default limit for better results

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    console.log('[Smart Start Search] Searching for:', query);

    // Search across all sources
    const result = await searchCharacterMultiSource(query, {
      includeWikipedia: true,
      includeAniList: true,
      includeFandom: true,
      limit,
    });

    // Auto-detect context AND archetype for each result (parallel, max 5 to avoid API limits)
    const resultsWithDetection = await Promise.all(
      result.results.slice(0, 5).map(async (character) => {
        try {
          // Step 1: Detect context (Historical, Cultural Icon, Fictional, etc.)
          const contextDetection = await detectContext(character, {
            useAI: true,
            minConfidence: 0.7,
          });

          // Step 2: Detect archetype using context to improve suggestions
          const archetypeDetection = await detectGenre(character, contextDetection, {
            useAI: true,
            minConfidence: 0.7,
          });

          return {
            ...character,
            // Context information
            suggestedContext: contextDetection.category,
            contextSubcategory: contextDetection.subcategory,
            contextConfidence: contextDetection.confidence,
            contextOccupation: contextDetection.occupation,
            contextEra: contextDetection.era,
            // Archetype information
            suggestedArchetype: archetypeDetection.genre,
            archetypeConfidence: archetypeDetection.confidence,
            // Legacy field for backward compatibility
            suggestedGenre: archetypeDetection.genre,
            genreConfidence: archetypeDetection.confidence,
          };
        } catch (error) {
          console.error('[Smart Start Search] Detection error:', error);
          return character; // Return without detection if it fails
        }
      })
    );

    // Add remaining results without detection (to save API calls)
    const finalResults = [
      ...resultsWithDetection,
      ...result.results.slice(5),
    ];

    // Log first result to verify detection
    if (finalResults.length > 0) {
      console.log('[Smart Start Search] Sample result:', {
        name: finalResults[0].name,
        imageUrl: finalResults[0].imageUrl,
        source: finalResults[0].source,
        suggestedContext: (finalResults[0] as any).suggestedContext,
        contextSubcategory: (finalResults[0] as any).contextSubcategory,
        suggestedArchetype: (finalResults[0] as any).suggestedArchetype,
        archetypeConfidence: (finalResults[0] as any).archetypeConfidence,
      });
    }

    return NextResponse.json({
      query: result.query,
      results: finalResults,
      total: result.totalFound,
    });
  } catch (error) {
    console.error("[Smart Start Search] Error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
