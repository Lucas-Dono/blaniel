/**
 * Smart Start Templates API - Genres
 * GET - Get all available genres with their subgenres and archetypes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGenreService } from '@/lib/smart-start/services/genre-service';

const genreService = getGenreService();

/**
 * GET /api/smart-start/templates/genres - Get all genres
 */
export async function GET(_req: NextRequest) {
  try {
    const genres = genreService.getAllGenres();

    // Map to API response format
    const response = genres.map(genre => ({
      id: genre.id,
      name: genre.name,
      description: genre.description,
      icon: genre.icon,
      gradient: genre.color,
      tags: genre.universalTraits,
      metadata: genre.metadata,
      subGenres: genre.subgenres.map(subGenre => ({
        id: subGenre.id,
        name: subGenre.name,
        description: subGenre.description,
        icon: subGenre.icon,
        systemPromptModifiers: subGenre.systemPromptModifiers,
        archetypes: subGenre.archetypes.map(archetype => ({
          id: archetype.id,
          name: archetype.name,
          description: archetype.description,
          traits: archetype.suggestedTraits,
          personalityTemplate: archetype.personalityTemplate,
        })),
      })),
    }));

    return NextResponse.json({
      success: true,
      genres: response,
      meta: {
        cached: true,
        totalGenres: genres.length,
        totalSubGenres: genres.reduce((acc, g) => acc + g.subgenres.length, 0),
        totalArchetypes: genres.reduce(
          (acc, g) => acc + g.subgenres.reduce((acc2, sg) => acc2 + sg.archetypes.length, 0),
          0
        ),
      },
    });
  } catch (error) {
    console.error('[API] Error fetching genres:', error);
    return NextResponse.json(
      { error: 'Failed to fetch genres' },
      { status: 500 }
    );
  }
}
