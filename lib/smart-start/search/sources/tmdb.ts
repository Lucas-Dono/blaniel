/**
 * TMDB (The Movie Database) Search Source
 * REST API for movie/TV characters
 * Rate limit: 40 requests per 10 seconds
 * Documentation: https://developers.themoviedb.org/3
 */

import { SearchSource, SearchResult, SearchOptions, GenreId } from '../../core/types';

interface TMDBPerson {
  id: number;
  name: string;
  profile_path?: string;
  known_for_department?: string;
  known_for?: Array<{
    id: number;
    title?: string;
    name?: string;
    media_type: 'movie' | 'tv';
    release_date?: string;
    first_air_date?: string;
    character?: string;
  }>;
  popularity: number;
  gender?: number; // 0: Not specified, 1: Female, 2: Male, 3: Non-binary
  adult?: boolean;
}

interface TMDBPersonDetails {
  id: number;
  name: string;
  also_known_as?: string[];
  biography?: string;
  birthday?: string;
  deathday?: string;
  gender?: number;
  place_of_birth?: string;
  profile_path?: string;
  popularity: number;
  known_for_department?: string;
  adult?: boolean;
  combined_credits?: {
    cast: Array<{
      id: number;
      title?: string;
      name?: string;
      character?: string;
      media_type: 'movie' | 'tv';
      release_date?: string;
      first_air_date?: string;
      vote_average?: number;
      popularity?: number;
    }>;
  };
}

interface TMDBSearchResponse {
  page: number;
  results: TMDBPerson[];
  total_pages: number;
  total_results: number;
}

export class TMDBSource implements SearchSource {
  sourceId = 'tmdb' as const;
  name = 'The Movie Database';
  supportedGenres: GenreId[] = ['roleplay', 'professional', 'friendship'];
  baseUrl = 'https://api.themoviedb.org/3';
  apiKey = process.env.TMDB_API_KEY || '';
  rateLimit = {
    requests: 40,
    per: 10000, // 10 seconds
  };

  private lastRequestTime = 0;
  private requestCount = 0;

  /**
   * Search for characters (actually searches people/actors)
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.apiKey) {
      console.warn('TMDB API key not configured');
      return [];
    }

    await this.enforceRateLimit();

    const params = new URLSearchParams({
      api_key: this.apiKey,
      query,
      page: (options.page || 1).toString(),
      include_adult: 'false',
    });

    try {
      const response = await fetch(`${this.baseUrl}/search/person?${params}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
      }

      const data: TMDBSearchResponse = await response.json();

      // For each result, we could fetch detailed character roles
      // but that would use too many API calls
      // Instead, we use the known_for data
      const results = data.results
        .filter(person => !person.adult)
        .slice(0, options.limit || 10)
        .map(person => this.mapToSearchResult(person));

      return results;
    } catch (error) {
      console.error('TMDB search error:', error);
      throw error;
    }
  }

  /**
   * Get detailed person information including their character roles
   */
  async getDetails(personId: string): Promise<SearchResult | null> {
    if (!this.apiKey) {
      return null;
    }

    await this.enforceRateLimit();

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        append_to_response: 'combined_credits',
      });

      const response = await fetch(`${this.baseUrl}/person/${personId}?${params}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status}`);
      }

      const person: TMDBPersonDetails = await response.json();

      return this.mapDetailsToSearchResult(person);
    } catch (error) {
      console.error('TMDB getDetails error:', error);
      return null;
    }
  }

  /**
   * Search for a specific character in a movie/TV show
   */
  async searchCharacter(
    characterName: string,
    movieOrTvShowName?: string
  ): Promise<SearchResult[]> {
    if (!this.apiKey) {
      return [];
    }

    await this.enforceRateLimit();

    // Search for the movie/TV show first
    const mediaResults = await this.searchMedia(movieOrTvShowName || characterName);

    const characterResults: SearchResult[] = [];

    // For each media result, get credits and look for the character
    for (const media of mediaResults.slice(0, 3)) {
      const credits = await this.getCredits(media.id, media.media_type);

      const matchingCharacters = credits.filter(credit =>
        credit.character.toLowerCase().includes(characterName.toLowerCase())
      );

      for (const char of matchingCharacters) {
        const personDetails = await this.getDetails(char.id.toString());
        if (personDetails) {
          characterResults.push({
            ...personDetails,
            metadata: {
              ...personDetails.metadata,
              specificCharacter: char.character,
              specificMedia: media.title || media.name,
            },
          });
        }
      }
    }

    return characterResults;
  }

  /**
   * Search for movies/TV shows
   */
  private async searchMedia(
    query: string
  ): Promise<Array<{ id: number; title?: string; name?: string; media_type: 'movie' | 'tv' }>> {
    await this.enforceRateLimit();

    const params = new URLSearchParams({
      api_key: this.apiKey,
      query,
      page: '1',
    });

    const response = await fetch(`${this.baseUrl}/search/multi?${params}`);
    const data = await response.json();

    return data.results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
  }

  /**
   * Get credits for a movie/TV show
   */
  private async getCredits(
    mediaId: number,
    mediaType: 'movie' | 'tv'
  ): Promise<
    Array<{
      id: number;
      name: string;
      character: string;
      profile_path?: string;
    }>
  > {
    await this.enforceRateLimit();

    const params = new URLSearchParams({
      api_key: this.apiKey,
    });

    const response = await fetch(`${this.baseUrl}/${mediaType}/${mediaId}/credits?${params}`);
    const data = await response.json();

    return data.cast || [];
  }

  /**
   * Map TMDB person to SearchResult
   */
  private mapToSearchResult(person: TMDBPerson): SearchResult {
    const primaryRole = person.known_for?.[0];

    return {
      id: `tmdb-${person.id}`,
      externalId: person.id.toString(),
      name: person.name,
      description: primaryRole
        ? `Known for playing ${primaryRole.character || 'roles'} in ${
            primaryRole.title || primaryRole.name
          }`
        : undefined,
      imageUrl: person.profile_path
        ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
        : undefined,
      thumbnailUrl: person.profile_path
        ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
        : undefined,
      source: 'tmdb',
      sourceUrl: `https://www.themoviedb.org/person/${person.id}`,
      metadata: {
        department: person.known_for_department,
        gender: this.parseGender(person.gender),
        popularity: person.popularity,
        knownFor: person.known_for?.map(media => ({
          title: media.title || media.name,
          character: media.character,
          type: media.media_type,
          year: media.release_date || media.first_air_date,
        })),
      },
      confidence: this.calculateConfidence(person),
    };
  }

  /**
   * Map detailed TMDB person to SearchResult
   */
  private mapDetailsToSearchResult(person: TMDBPersonDetails): SearchResult {
    const topRoles = person.combined_credits?.cast
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10);

    const primaryRole = topRoles?.[0];

    return {
      id: `tmdb-${person.id}`,
      externalId: person.id.toString(),
      name: person.name,
      alternateName: person.also_known_as?.[0],
      description: person.biography || undefined,
      imageUrl: person.profile_path
        ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
        : undefined,
      thumbnailUrl: person.profile_path
        ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
        : undefined,
      source: 'tmdb',
      sourceUrl: `https://www.themoviedb.org/person/${person.id}`,
      metadata: {
        department: person.known_for_department,
        gender: this.parseGender(person.gender),
        birthday: person.birthday,
        deathday: person.deathday,
        placeOfBirth: person.place_of_birth,
        alsoKnownAs: person.also_known_as,
        popularity: person.popularity,
        topRoles: topRoles?.map(role => ({
          title: role.title || role.name,
          character: role.character,
          type: role.media_type,
          year: role.release_date || role.first_air_date,
          rating: role.vote_average,
        })),
        primaryRole: primaryRole
          ? {
              title: primaryRole.title || primaryRole.name,
              character: primaryRole.character,
            }
          : undefined,
      },
      confidence: this.calculateConfidenceFromDetails(person),
    };
  }

  /**
   * Parse TMDB gender code
   */
  private parseGender(gender?: number): string | undefined {
    if (gender === undefined) return undefined;
    switch (gender) {
      case 1:
        return 'Female';
      case 2:
        return 'Male';
      case 3:
        return 'Non-binary';
      default:
        return undefined;
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(person: TMDBPerson): number {
    let score = 0.4; // Lower base for actor profiles

    if (person.profile_path) score += 0.1;
    if (person.known_for && person.known_for.length > 0) score += 0.2;
    if (person.popularity > 10) score += 0.1;
    if (person.popularity > 50) score += 0.1;
    if (person.known_for_department === 'Acting') score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate confidence from detailed data
   */
  private calculateConfidenceFromDetails(person: TMDBPersonDetails): number {
    let score = 0.4;

    if (person.profile_path) score += 0.1;
    if (person.biography && person.biography.length > 100) score += 0.15;
    if (person.combined_credits?.cast && person.combined_credits.cast.length > 5) score += 0.15;
    if (person.popularity > 10) score += 0.1;
    if (person.popularity > 50) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest > this.rateLimit.per) {
      this.requestCount = 0;
    }

    if (this.requestCount >= this.rateLimit.requests) {
      const waitTime = this.rateLimit.per - timeSinceLastRequest;
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
      }
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;
      const results = await this.search('Tom Hanks', { limit: 1 });
      return results.length > 0;
    } catch {
      return false;
    }
  }
}
