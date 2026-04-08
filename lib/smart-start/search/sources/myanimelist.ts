/**
 * MyAnimeList Search Source
 * REST API for anime/manga characters
 * Rate limit: Unspecified, be conservative
 * Documentation: https://myanimelist.net/apiconfig/references/api/v2
 */

import { SearchSource, SearchResult, SearchOptions, GenreId } from '../../core/types';

interface MALCharacter {
  mal_id: number;
  url: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url?: string;
    };
    webp?: {
      image_url: string;
      small_image_url?: string;
    };
  };
  name: string;
  name_kanji?: string;
  nicknames?: string[];
  favorites: number;
  about?: string;
  anime?: Array<{
    mal_id: number;
    url: string;
    images: {
      jpg: {
        image_url: string;
      };
    };
    title: string;
  }>;
  manga?: Array<{
    mal_id: number;
    url: string;
    images: {
      jpg: {
        image_url: string;
      };
    };
    title: string;
  }>;
}

interface MALSearchResponse {
  data: MALCharacter[];
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
  };
}

export class MyAnimeListSource implements SearchSource {
  sourceId = 'mal' as const;
  name = 'MyAnimeList';
  supportedGenres: GenreId[] = ['roleplay', 'romance', 'friendship'];
  baseUrl = 'https://api.jikan.moe/v4'; // Using Jikan API (unofficial MAL API)
  rateLimit = {
    requests: 60,
    per: 60000, // 1 minute
  };

  private lastRequestTime = 0;
  private requestCount = 0;

  /**
   * Search for characters
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.enforceRateLimit();

    const params = new URLSearchParams({
      q: query,
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
      order_by: 'favorites',
      sort: 'desc',
    });

    try {
      const response = await fetch(`${this.baseUrl}/characters?${params}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited, wait and retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.search(query, options);
        }
        throw new Error(`MAL API error: ${response.status} ${response.statusText}`);
      }

      const data: MALSearchResponse = await response.json();

      return data.data.map(char => this.mapToSearchResult(char));
    } catch (error) {
      console.error('MyAnimeList search error:', error);
      throw error;
    }
  }

  /**
   * Get detailed character information
   */
  async getDetails(characterId: string): Promise<SearchResult | null> {
    await this.enforceRateLimit();

    try {
      const response = await fetch(`${this.baseUrl}/characters/${characterId}/full`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.getDetails(characterId);
        }
        throw new Error(`MAL API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data) {
        return null;
      }

      return this.mapToSearchResult(data.data);
    } catch (error) {
      console.error('MyAnimeList getDetails error:', error);
      return null;
    }
  }

  /**
   * Map MAL character to SearchResult
   */
  private mapToSearchResult(char: MALCharacter): SearchResult {
    // Parse "about" field to extract useful information
    const parsedInfo = this.parseAboutField(char.about || '');

    // Get primary anime/manga
    const primaryAnime = char.anime?.[0];
    const primaryManga = char.manga?.[0];
    const primaryMedia = primaryAnime || primaryManga;

    return {
      id: `mal-${char.mal_id}`,
      externalId: char.mal_id.toString(),
      name: char.name,
      alternateName: char.name_kanji,
      description: this.cleanDescription(char.about),
      imageUrl: char.images.jpg.image_url,
      thumbnailUrl: char.images.jpg.small_image_url || char.images.jpg.image_url,
      source: 'myanimelist',
      sourceUrl: char.url,
      metadata: {
        nicknames: char.nicknames,
        popularity: char.favorites,
        ...parsedInfo,
        animeAppearances: char.anime?.length || 0,
        mangaAppearances: char.manga?.length || 0,
        primaryMedia: primaryMedia
          ? {
              title: primaryMedia.title,
              type: primaryAnime ? 'anime' : 'manga',
              url: primaryMedia.url,
            }
          : undefined,
      },
      confidence: this.calculateConfidence(char),
    };
  }

  /**
   * Parse the "about" field to extract structured information
   */
  private parseAboutField(about: string): Record<string, any> {
    const info: Record<string, any> = {};

    // Extract age
    const ageMatch = about.match(/Age:\s*(\d+)/i);
    if (ageMatch) {
      info.age = ageMatch[1];
    }

    // Extract gender
    const genderMatch = about.match(/Gender:\s*(\w+)/i);
    if (genderMatch) {
      info.gender = genderMatch[1];
    }

    // Extract birthday
    const birthdayMatch = about.match(/Birthday:\s*([^\n]+)/i);
    if (birthdayMatch) {
      info.birthday = birthdayMatch[1].trim();
    }

    // Extract height
    const heightMatch = about.match(/Height:\s*([^\n]+)/i);
    if (heightMatch) {
      info.height = heightMatch[1].trim();
    }

    // Extract hair color
    const hairMatch = about.match(/Hair(?:\s+Color)?:\s*([^\n]+)/i);
    if (hairMatch) {
      info.hairColor = hairMatch[1].trim();
    }

    // Extract eye color
    const eyeMatch = about.match(/Eye(?:\s+Color)?:\s*([^\n]+)/i);
    if (eyeMatch) {
      info.eyeColor = eyeMatch[1].trim();
    }

    return info;
  }

  /**
   * Clean description by removing HTML and formatting
   */
  private cleanDescription(about?: string): string | undefined {
    if (!about) return undefined;

    return about
      .replace(/\(Source:.*?\)/gi, '') // Remove source citations
      .replace(/\[Written by.*?\]/gi, '') // Remove attribution
      .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
      .trim();
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(char: MALCharacter): number {
    let score = 0.5;

    // Has description
    if (char.about && char.about.length > 100) {
      score += 0.2;
    }

    // Has image
    if (char.images.jpg.image_url) {
      score += 0.1;
    }

    // Has anime/manga appearances
    if ((char.anime?.length || 0) + (char.manga?.length || 0) > 0) {
      score += 0.1;
    }

    // Popularity
    if (char.favorites > 100) {
      score += 0.05;
    }
    if (char.favorites > 1000) {
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
      const results = await this.search('Naruto', { limit: 1 });
      return results.length > 0;
    } catch {
      return false;
    }
  }
}
