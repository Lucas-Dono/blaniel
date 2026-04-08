/**
 * Genre Service - In-memory cache service for genre taxonomy
 * Loads at startup for instant access without Redis
 */

import { Genre, SubGenre, Archetype, GenreId, SubGenreId, ArchetypeId } from '../core/types';
import { GENRE_TAXONOMY } from './genre-taxonomy';
import { Agent } from '@prisma/client';

export class GenreService {
  private cache: Map<GenreId, Genre>;
  private initialized: boolean = false;

  constructor() {
    this.cache = new Map();
    this.initialize();
  }

  /**
   * Initialize cache with taxonomy data
   */
  private initialize(): void {
    if (this.initialized) return;

    for (const genre of Object.values(GENRE_TAXONOMY)) {
      this.cache.set(genre.id, genre);
    }

    this.initialized = true;
  }

  /**
   * Get all available genres
   */
  getAllGenres(): Genre[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get a specific genre by ID
   */
  getGenre(id: GenreId): Genre | null {
    return this.cache.get(id) || null;
  }

  /**
   * Get a specific subgenre within a genre
   */
  getSubGenre(genreId: GenreId, subgenreId: SubGenreId): SubGenre | null {
    const genre = this.getGenre(genreId);
    if (!genre) return null;

    return genre.subgenres.find(sg => sg.id === subgenreId) || null;
  }

  /**
   * Get a specific archetype within a subgenre
   */
  getArchetype(
    genreId: GenreId,
    subgenreId: SubGenreId,
    archetypeId: ArchetypeId
  ): Archetype | null {
    const subgenre = this.getSubGenre(genreId, subgenreId);
    if (!subgenre) return null;

    return subgenre.archetypes.find(a => a.id === archetypeId) || null;
  }

  /**
   * Search genres by query (fuzzy search)
   * Searches in: name, description, tags, subgenres, archetypes
   */
  searchGenres(query: string): Genre[] {
    const normalizedQuery = query.toLowerCase().trim();
    const results: Array<{ genre: Genre; score: number }> = [];

    for (const genre of this.cache.values()) {
      let score = 0;

      // Direct name match (highest priority)
      if (genre.name.toLowerCase().includes(normalizedQuery)) {
        score += 100;
      }

      // Description match
      if (genre.description.toLowerCase().includes(normalizedQuery)) {
        score += 50;
      }

      // Subgenre name match
      for (const subgenre of genre.subgenres) {
        if (subgenre.name.toLowerCase().includes(normalizedQuery)) {
          score += 40;
        }
        if (subgenre.description.toLowerCase().includes(normalizedQuery)) {
          score += 20;
        }
      }

      // Archetype match
      for (const subgenre of genre.subgenres) {
        for (const archetype of subgenre.archetypes) {
          if (archetype.name.toLowerCase().includes(normalizedQuery)) {
            score += 25;
          }
          if (archetype.description.toLowerCase().includes(normalizedQuery)) {
            score += 10;
          }
        }
      }

      if (score > 0) {
        results.push({ genre, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.map(r => r.genre);
  }

  /**
   * Get default genre for user based on preferences or history
   * Returns null if no preference found
   */
  async getDefaultGenreForUser(_userId: string): Promise<GenreId | null> {
    // TODO: Implement user preference lookup from database
    // For now, return null (no default)
    return null;
  }

  /**
   * Get suggested genres based on user's character creation history
   * Analyzes patterns in previously created characters
   */
  getSuggestedGenres(userHistory: Agent[]): GenreId[] {
    if (userHistory.length === 0) {
      // Return popular genres as default suggestions
      return ['romance', 'roleplay', 'friendship'];
    }

    // Count genre occurrences in user history
    const genreCounts = new Map<GenreId, number>();

    for (const agent of userHistory) {
      if (agent.genreId) {
        const genreId = agent.genreId as GenreId;
        genreCounts.set(genreId, (genreCounts.get(genreId) || 0) + 1);
      }
    }

    // Sort by count descending
    const sorted = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([genreId]) => genreId);

    // Return top 3 most used genres
    return sorted.slice(0, 3);
  }

  /**
   * Get recommended subgenres for a genre based on user preferences
   */
  getRecommendedSubGenres(genreId: GenreId, userHistory: Agent[]): SubGenre[] {
    const genre = this.getGenre(genreId);
    if (!genre) return [];

    // If no history, return all subgenres in their original order
    if (userHistory.length === 0) {
      return [...genre.subgenres];
    }

    // Count subgenre occurrences in user history for this genre
    const subgenreCounts = new Map<SubGenreId, number>();

    for (const agent of userHistory) {
      if (agent.genreId === genreId && agent.subgenreId) {
        const subgenreId = agent.subgenreId as SubGenreId;
        subgenreCounts.set(subgenreId, (subgenreCounts.get(subgenreId) || 0) + 1);
      }
    }

    // Sort by usage frequency
    const scored = genre.subgenres.map(subgenre => ({
      subgenre,
      score: (subgenreCounts.get(subgenre.id) || 0) * 10,
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.map(s => s.subgenre);
  }

  /**
   * Get recommended archetypes for a subgenre
   */
  getRecommendedArchetypes(
    genreId: GenreId,
    subgenreId: SubGenreId,
    userHistory: Agent[]
  ): Archetype[] {
    const subgenre = this.getSubGenre(genreId, subgenreId);
    if (!subgenre) return [];

    // If no history, return all archetypes in their original order
    if (userHistory.length === 0) {
      return [...subgenre.archetypes];
    }

    // Count archetype occurrences
    const archetypeCounts = new Map<ArchetypeId, number>();

    for (const agent of userHistory) {
      if (
        agent.genreId === genreId &&
        agent.subgenreId === subgenreId &&
        agent.archetypeId
      ) {
        const archetypeId = agent.archetypeId as ArchetypeId;
        archetypeCounts.set(archetypeId, (archetypeCounts.get(archetypeId) || 0) + 1);
      }
    }

    // Sort by usage frequency
    const scored = subgenre.archetypes.map(archetype => ({
      archetype,
      score: (archetypeCounts.get(archetype.id) || 0) * 10,
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.map(s => s.archetype);
  }

  /**
   * Validate that a genre/subgenre/archetype combination exists
   */
  validateCombination(
    genreId: GenreId,
    subgenreId?: SubGenreId,
    archetypeId?: ArchetypeId
  ): boolean {
    const genre = this.getGenre(genreId);
    if (!genre) return false;

    if (subgenreId) {
      const subgenre = this.getSubGenre(genreId, subgenreId);
      if (!subgenre) return false;

      if (archetypeId) {
        const archetype = this.getArchetype(genreId, subgenreId, archetypeId);
        return archetype !== null;
      }
    }

    return true;
  }

  /**
   * Get genre statistics
   */
  getStatistics() {
    const genres = this.getAllGenres();

    let totalSubGenres = 0;
    let totalArchetypes = 0;

    for (const genre of genres) {
      totalSubGenres += genre.subgenres.length;
      for (const subgenre of genre.subgenres) {
        totalArchetypes += subgenre.archetypes.length;
      }
    }

    return {
      totalGenres: genres.length,
      totalSubGenres,
      totalArchetypes,
      averageSubGenresPerGenre: totalSubGenres / genres.length,
      averageArchetypesPerSubGenre: totalArchetypes / totalSubGenres,
    };
  }

  /**
   * Clear cache and reinitialize (useful for hot reloading in dev)
   */
  refresh(): void {
    this.cache.clear();
    this.initialized = false;
    this.initialize();
  }
}

// Singleton instance
let genreServiceInstance: GenreService | null = null;

export function getGenreService(): GenreService {
  if (!genreServiceInstance) {
    genreServiceInstance = new GenreService();
  }
  return genreServiceInstance;
}

// Export convenience functions
export const genreService = getGenreService();
