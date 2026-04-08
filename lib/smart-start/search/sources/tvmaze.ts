/**
 * TVMaze Search Source
 * REST API for TV show characters
 * Rate limit: Unlimited, be reasonable
 * Documentation: https://www.tvmaze.com/api
 */

import { SearchSource, SearchResult, SearchOptions, GenreId } from '../../core/types';

interface TVMazeCharacter {
  id: number;
  url: string;
  name: string;
  image?: {
    medium: string;
    original: string;
  };
  _links?: {
    self: {
      href: string;
    };
  };
}

interface TVMazePerson {
  id: number;
  url: string;
  name: string;
  country?: {
    name: string;
    code: string;
  };
  birthday?: string;
  deathday?: string;
  gender?: string;
  image?: {
    medium: string;
    original: string;
  };
  _embedded?: {
    castcredits: Array<{
      _links: {
        show: {
          href: string;
        };
        character: {
          href: string;
        };
      };
      _embedded?: {
        show: {
          id: number;
          name: string;
          premiered?: string;
          genres?: string[];
        };
        character: {
          id: number;
          name: string;
          image?: {
            medium: string;
            original: string;
          };
        };
      };
    }>;
  };
}

interface TVMazeShow {
  id: number;
  url: string;
  name: string;
  premiered?: string;
  genres?: string[];
  summary?: string;
  image?: {
    medium: string;
    original: string;
  };
  _embedded?: {
    cast: Array<{
      person: {
        id: number;
        name: string;
        image?: {
          medium: string;
          original: string;
        };
      };
      character: {
        id: number;
        name: string;
        image?: {
          medium: string;
          original: string;
        };
      };
    }>;
  };
}

export class TVMazeSource implements SearchSource {
  sourceId = 'tvmaze' as const;
  name = 'TVMaze';
  supportedGenres: GenreId[] = ['roleplay', 'professional', 'friendship'];
  baseUrl = 'https://api.tvmaze.com';
  rateLimit = {
    requests: 20,
    per: 10000, // Be conservative even though unlimited
  };

  private lastRequestTime = 0;
  private requestCount = 0;

  /**
   * Search for characters (fictional) and people (actors)
   * Prioritizes fictional characters over real actors
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = options.limit || 10;

    try {
      // Search fictional characters first (from TV shows)
      const characterResults = await this.searchCharacters(query, { limit });

      // If we have enough character results, return them
      if (characterResults.length >= limit) {
        return characterResults.slice(0, limit);
      }

      // Otherwise, also search for actors/people to fill the gap
      const peopleResults = await this.searchPeople(query, {
        limit: limit - characterResults.length,
      });

      // Combine results, prioritizing characters
      return [...characterResults, ...peopleResults].slice(0, limit);
    } catch (error) {
      console.error('TVMaze search error:', error);
      throw error;
    }
  }

  /**
   * Search for fictional characters in TV shows
   */
  private async searchCharacters(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    await this.enforceRateLimit();

    try {
      // Search for shows that might contain the character
      const showResponse = await fetch(
        `${this.baseUrl}/search/shows?q=${encodeURIComponent(query)}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!showResponse.ok) {
        throw new Error(`TVMaze API error: ${showResponse.status}`);
      }

      const shows: Array<{ score: number; show: TVMazeShow }> = await showResponse.json();

      // Get cast for each show and search for matching characters
      const results: SearchResult[] = [];
      const queryLower = query.toLowerCase();

      for (const { show } of shows.slice(0, 5)) {
        // Limit show searches to save API calls
        await this.enforceRateLimit();

        try {
          const castResponse = await fetch(`${this.baseUrl}/shows/${show.id}/cast`, {
            headers: {
              Accept: 'application/json',
            },
          });

          if (!castResponse.ok) continue;

          const cast: Array<{
            person: TVMazePerson;
            character: TVMazeCharacter;
          }> = await castResponse.json();

          // Find characters matching the query
          const matchingCharacters = cast.filter(
            ({ character }) =>
              character.name && character.name.toLowerCase().includes(queryLower)
          );

          // Map matching characters to SearchResults
          for (const { person, character } of matchingCharacters) {
            results.push(this.mapCharacterToSearchResult(character, person, show));

            if (results.length >= (options.limit || 10)) {
              return results;
            }
          }
        } catch (error) {
          console.error(`Error fetching cast for show ${show.id}:`, error);
          continue;
        }
      }

      return results;
    } catch (error) {
      console.error('TVMaze searchCharacters error:', error);
      return [];
    }
  }

  /**
   * Search for people (actors)
   */
  private async searchPeople(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    await this.enforceRateLimit();

    try {
      const response = await fetch(
        `${this.baseUrl}/search/people?q=${encodeURIComponent(query)}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`TVMaze API error: ${response.status}`);
      }

      const data: Array<{ score: number; person: TVMazePerson }> = await response.json();

      // Get detailed information for each person
      const results: SearchResult[] = [];

      for (const item of data.slice(0, options.limit || 10)) {
        const detailed = await this.getPersonWithCastCredits(item.person.id);
        if (detailed) {
          results.push(detailed);
        }
      }

      return results;
    } catch (error) {
      console.error('TVMaze searchPeople error:', error);
      return [];
    }
  }

  /**
   * Get detailed person information with cast credits
   */
  private async getPersonWithCastCredits(personId: number): Promise<SearchResult | null> {
    await this.enforceRateLimit();

    try {
      const response = await fetch(
        `${this.baseUrl}/people/${personId}?embed=castcredits`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const person: TVMazePerson = await response.json();

      return this.mapToSearchResult(person);
    } catch (error) {
      console.error('TVMaze getPersonWithCastCredits error:', error);
      return null;
    }
  }

  /**
   * Get details by person ID
   */
  async getDetails(personId: string): Promise<SearchResult | null> {
    return this.getPersonWithCastCredits(parseInt(personId, 10));
  }

  /**
   * Map TVMaze character (fictional) to SearchResult
   */
  private mapCharacterToSearchResult(
    character: TVMazeCharacter,
    actor: TVMazePerson,
    show: TVMazeShow
  ): SearchResult {
    // Extract show summary without HTML tags
    const cleanSummary = show.summary
      ?.replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);

    const description = cleanSummary
      ? `${character.name} from ${show.name}. ${cleanSummary}`
      : `Character from ${show.name}`;

    return {
      id: `tvmaze-character-${character.id}`,
      externalId: character.id.toString(),
      name: character.name,
      description,
      imageUrl: character.image?.original || show.image?.original,
      thumbnailUrl: character.image?.medium || show.image?.medium,
      source: 'tvmaze',
      sourceUrl: character.url || show.url,
      metadata: {
        type: 'fictional_character',
        franchise: show.name,
        premiered: show.premiered,
        genres: show.genres || [],
        portrayedBy: actor.name,
        actorId: actor.id,
        showId: show.id,
        showUrl: show.url,
      },
      confidence: this.calculateCharacterConfidence(character, show),
    };
  }

  /**
   * Map TVMaze person (actor) to SearchResult
   */
  private mapToSearchResult(person: TVMazePerson): SearchResult {
    const castCredits = person._embedded?.castcredits || [];
    const topRoles = castCredits
      .filter(credit => credit._embedded?.show && credit._embedded?.character)
      .slice(0, 10);

    const primaryRole = topRoles[0];

    // Build description from roles
    let description = '';
    if (topRoles.length > 0) {
      const rolesList = topRoles
        .map(
          role => `${role._embedded!.character.name} in ${role._embedded!.show.name}`
        )
        .join(', ');
      description = `Actor known for playing: ${rolesList}`;
    } else {
      description = 'Professional actor';
    }

    return {
      id: `tvmaze-person-${person.id}`,
      externalId: person.id.toString(),
      name: person.name,
      description,
      imageUrl: person.image?.original,
      thumbnailUrl: person.image?.medium,
      source: 'tvmaze',
      sourceUrl: person.url,
      metadata: {
        type: 'real_person',
        profession: 'actor',
        country: person.country?.name,
        countryCode: person.country?.code,
        birthday: person.birthday,
        deathday: person.deathday,
        gender: person.gender,
        rolesCount: castCredits.length,
        primaryRole: primaryRole
          ? {
              character: primaryRole._embedded!.character.name,
              show: primaryRole._embedded!.show.name,
              premiered: primaryRole._embedded!.show.premiered,
              genres: primaryRole._embedded!.show.genres,
            }
          : undefined,
        topRoles: topRoles.map(role => ({
          character: role._embedded!.character.name,
          show: role._embedded!.show.name,
          premiered: role._embedded!.show.premiered,
        })),
      },
      confidence: this.calculatePersonConfidence(person, castCredits),
    };
  }

  /**
   * Calculate confidence score for fictional characters
   */
  private calculateCharacterConfidence(character: TVMazeCharacter, show: TVMazeShow): number {
    let score = 0.6; // Higher base for fictional characters (what users usually want)

    // Has character image
    if (character.image) score += 0.2;
    // Has show image as fallback
    else if (show.image) score += 0.1;

    // Show has good metadata
    if (show.genres && show.genres.length > 0) score += 0.1;
    if (show.summary && show.summary.length > 100) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate confidence score for real people (actors)
   */
  private calculatePersonConfidence(person: TVMazePerson, castCredits: any[]): number {
    let score = 0.4; // Lower base for actors (usually not what users want)

    if (person.image) score += 0.15;
    if (castCredits.length > 0) score += 0.15;
    if (castCredits.length > 5) score += 0.1;
    if (person.birthday || person.country) score += 0.1;

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

    // Add small delay between requests to be respectful
    if (timeSinceLastRequest < 100) {
      await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastRequest));
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const results = await this.search('Bryan Cranston', { limit: 1 });
      return results.length > 0;
    } catch {
      return false;
    }
  }
}
