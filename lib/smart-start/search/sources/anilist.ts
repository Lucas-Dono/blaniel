/**
 * AniList Search Source
 * GraphQL API for anime/manga characters
 * Rate limit: 90 requests per minute
 * Documentation: https://anilist.gitbook.io/anilist-apiv2-docs/
 */

import { SearchSource, SearchResult, SearchOptions, GenreId } from '../../core/types';

interface AniListCharacter {
  id: number;
  name: {
    full: string;
    native?: string;
    alternative?: string[];
  };
  image: {
    large: string;
    medium: string;
  };
  description?: string;
  age?: string;
  gender?: string;
  bloodType?: string;
  dateOfBirth?: {
    year?: number;
    month?: number;
    day?: number;
  };
  media?: {
    nodes: Array<{
      id: number;
      title: {
        romaji: string;
        english?: string;
        native?: string;
      };
      type: string;
      format?: string;
      startDate?: {
        year?: number;
      };
    }>;
  };
  favourites?: number;
}

interface AniListResponse {
  data: {
    Page: {
      characters: AniListCharacter[];
      pageInfo: {
        total: number;
        perPage: number;
        currentPage: number;
        lastPage: number;
        hasNextPage: boolean;
      };
    };
  };
}

export class AniListSource implements SearchSource {
  sourceId = 'anilist' as const;
  name = 'AniList';
  supportedGenres: GenreId[] = ['roleplay', 'romance', 'friendship'];
  baseUrl = 'https://graphql.anilist.co';
  rateLimit = {
    requests: 90,
    per: 60000, // 1 minute in ms
  };

  private lastRequestTime = 0;
  private requestCount = 0;

  /**
   * Search for characters
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.enforceRateLimit();

    const graphqlQuery = `
      query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            perPage
            currentPage
            lastPage
            hasNextPage
          }
          characters(search: $search, sort: FAVOURITES_DESC) {
            id
            name {
              full
              native
              alternative
            }
            image {
              large
              medium
            }
            description
            age
            gender
            bloodType
            dateOfBirth {
              year
              month
              day
            }
            media(page: 1, perPage: 5, sort: POPULARITY_DESC) {
              nodes {
                id
                title {
                  romaji
                  english
                  native
                }
                type
                format
                startDate {
                  year
                }
              }
            }
            favourites
          }
        }
      }
    `;

    const variables = {
      search: query,
      page: options.page || 1,
      perPage: options.limit || 10,
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`AniList API error: ${response.status} ${response.statusText}`);
      }

      const data: AniListResponse = await response.json();

      return data.data.Page.characters.map(char => this.mapToSearchResult(char));
    } catch (error) {
      console.error('AniList search error:', error);
      throw error;
    }
  }

  /**
   * Get detailed character information
   */
  async getDetails(characterId: string): Promise<SearchResult | null> {
    await this.enforceRateLimit();

    const graphqlQuery = `
      query ($id: Int) {
        Character(id: $id) {
          id
          name {
            full
            native
            alternative
          }
          image {
            large
            medium
          }
          description
          age
          gender
          bloodType
          dateOfBirth {
            year
            month
            day
          }
          media(page: 1, perPage: 10, sort: POPULARITY_DESC) {
            nodes {
              id
              title {
                romaji
                english
                native
              }
              type
              format
              startDate {
                year
              }
            }
          }
          favourites
        }
      }
    `;

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables: { id: parseInt(characterId, 10) },
        }),
      });

      if (!response.ok) {
        throw new Error(`AniList API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data.Character) {
        return null;
      }

      return this.mapToSearchResult(data.data.Character);
    } catch (error) {
      console.error('AniList getDetails error:', error);
      return null;
    }
  }

  /**
   * Map AniList character to SearchResult
   */
  private mapToSearchResult(char: AniListCharacter): SearchResult {
    // Extract primary media (most popular)
    const primaryMedia = char.media?.nodes[0];
    const mediaList = char.media?.nodes.map(m => ({
      title: m.title.english || m.title.romaji,
      type: m.type,
      year: m.startDate?.year,
    }));

    // Clean HTML from description
    const description = char.description
      ? char.description
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/?[^>]+(>|$)/g, '')
          .replace(/~!.*?!~/g, '') // Remove spoiler tags
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      : undefined;

    return {
      id: `anilist-${char.id}`,
      externalId: char.id.toString(),
      name: char.name.full,
      alternateName: char.name.native,
      description,
      imageUrl: char.image.large,
      thumbnailUrl: char.image.medium,
      source: 'anilist',
      sourceUrl: `https://anilist.co/character/${char.id}`,
      metadata: {
        age: char.age,
        gender: char.gender,
        bloodType: char.bloodType,
        dateOfBirth: char.dateOfBirth,
        alternativeNames: char.name.alternative,
        popularity: char.favourites,
        series: primaryMedia
          ? {
              title: primaryMedia.title.english || primaryMedia.title.romaji,
              type: primaryMedia.type,
              format: primaryMedia.format,
              year: primaryMedia.startDate?.year,
            }
          : undefined,
        mediaList,
      },
      confidence: this.calculateConfidence(char),
    };
  }

  /**
   * Calculate confidence score based on data completeness
   */
  private calculateConfidence(char: AniListCharacter): number {
    let score = 0.5; // Base score

    // Has description
    if (char.description && char.description.length > 100) {
      score += 0.2;
    }

    // Has image
    if (char.image.large) {
      score += 0.1;
    }

    // Has media associations
    if (char.media && char.media.nodes.length > 0) {
      score += 0.1;
    }

    // Has age/gender info
    if (char.age || char.gender) {
      score += 0.05;
    }

    // Has favourites (popularity indicator)
    if (char.favourites && char.favourites > 100) {
      score += 0.05;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Reset counter if more than 1 minute has passed
    if (timeSinceLastRequest > this.rateLimit.per) {
      this.requestCount = 0;
    }

    // If we've hit the rate limit, wait
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
   * Test connection to API
   */
  async testConnection(): Promise<boolean> {
    try {
      const results = await this.search('Naruto', { limit: 1 });
      return results.length > 0;
    } catch {
      return false;
    }
  }
}
