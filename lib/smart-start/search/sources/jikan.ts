/**
 * Jikan Search Source (Unofficial MyAnimeList API)
 * REST API for anime/manga data
 * Rate limit: 60 requests per minute, 3 per second
 * Documentation: https://docs.api.jikan.moe/
 */

import { SearchSource, SearchResult, SearchOptions, GenreId } from '../../core/types';

// Jikan v4 types
interface JikanCharacter {
  mal_id: number;
  url: string;
  images: {
    jpg: {
      image_url: string;
    };
    webp: {
      image_url: string;
      small_image_url: string;
    };
  };
  name: string;
  name_kanji?: string;
  nicknames: string[];
  favorites: number;
  about?: string;
}

interface JikanCharacterFull extends JikanCharacter {
  anime: Array<{
    role: string;
    anime: {
      mal_id: number;
      url: string;
      images: {
        jpg: {
          image_url: string;
          small_image_url: string;
          large_image_url: string;
        };
      };
      title: string;
    };
  }>;
  manga: Array<{
    role: string;
    manga: {
      mal_id: number;
      url: string;
      images: {
        jpg: {
          image_url: string;
          small_image_url: string;
          large_image_url: string;
        };
      };
      title: string;
    };
  }>;
  voices: Array<{
    language: string;
    person: {
      mal_id: number;
      url: string;
      images: {
        jpg: {
          image_url: string;
        };
      };
      name: string;
    };
  }>;
}

export class JikanSource implements SearchSource {
  sourceId = 'jikan' as const;
  name = 'Jikan (MyAnimeList)';
  supportedGenres: GenreId[] = ['roleplay', 'romance', 'friendship'];
  baseUrl = 'https://api.jikan.moe/v4';
  rateLimit = {
    requests: 3,
    per: 1000, // 3 per second
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
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.search(query, options);
        }
        throw new Error(`Jikan API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return data.data.map((char: JikanCharacter) => this.mapToSearchResult(char));
    } catch (error) {
      console.error('Jikan search error:', error);
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
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.getDetails(characterId);
        }
        throw new Error(`Jikan API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data) {
        return null;
      }

      return this.mapFullToSearchResult(data.data);
    } catch (error) {
      console.error('Jikan getDetails error:', error);
      return null;
    }
  }

  /**
   * Map Jikan character to SearchResult (basic)
   */
  private mapToSearchResult(char: JikanCharacter): SearchResult {
    const parsedInfo = this.parseAboutField(char.about || '');

    return {
      id: `jikan-${char.mal_id}`,
      externalId: char.mal_id.toString(),
      name: char.name,
      alternateName: char.name_kanji,
      description: this.cleanDescription(char.about),
      imageUrl: char.images.jpg.image_url,
      thumbnailUrl: char.images.webp.small_image_url,
      source: 'jikan',
      sourceUrl: char.url,
      metadata: {
        nicknames: char.nicknames,
        popularity: char.favorites,
        ...parsedInfo,
      },
      confidence: this.calculateConfidence(char),
    };
  }

  /**
   * Map full Jikan character to SearchResult (detailed)
   */
  private mapFullToSearchResult(char: JikanCharacterFull): SearchResult {
    const parsedInfo = this.parseAboutField(char.about || '');

    const primaryAnime = char.anime?.[0];
    const primaryManga = char.manga?.[0];
    const primaryVoice = char.voices?.find(v => v.language === 'Japanese');

    return {
      id: `jikan-${char.mal_id}`,
      externalId: char.mal_id.toString(),
      name: char.name,
      alternateName: char.name_kanji,
      description: this.cleanDescription(char.about),
      imageUrl: char.images.jpg.image_url,
      thumbnailUrl: char.images.webp.small_image_url,
      source: 'jikan',
      sourceUrl: char.url,
      metadata: {
        nicknames: char.nicknames,
        popularity: char.favorites,
        ...parsedInfo,
        animeAppearances: char.anime?.length || 0,
        mangaAppearances: char.manga?.length || 0,
        primaryAnime: primaryAnime
          ? {
              title: primaryAnime.anime.title,
              role: primaryAnime.role,
              url: primaryAnime.anime.url,
            }
          : undefined,
        primaryManga: primaryManga
          ? {
              title: primaryManga.manga.title,
              role: primaryManga.role,
              url: primaryManga.manga.url,
            }
          : undefined,
        voiceActor: primaryVoice
          ? {
              name: primaryVoice.person.name,
              language: primaryVoice.language,
            }
          : undefined,
        topAnime: char.anime?.slice(0, 5).map(a => ({
          title: a.anime.title,
          role: a.role,
        })),
        topManga: char.manga?.slice(0, 5).map(m => ({
          title: m.manga.title,
          role: m.role,
        })),
      },
      confidence: this.calculateConfidenceFull(char),
    };
  }

  /**
   * Parse about field for structured data
   */
  private parseAboutField(about: string): Record<string, any> {
    const info: Record<string, any> = {};

    const ageMatch = about.match(/Age[:\s]+(\d+)/i);
    if (ageMatch) info.age = ageMatch[1];

    const genderMatch = about.match(/Gender[:\s]+(Male|Female)/i);
    if (genderMatch) info.gender = genderMatch[1];

    const birthdayMatch = about.match(/Birthday[:\s]+([^\n]+)/i);
    if (birthdayMatch) info.birthday = birthdayMatch[1].trim();

    const heightMatch = about.match(/Height[:\s]+([^\n]+)/i);
    if (heightMatch) info.height = heightMatch[1].trim();

    const weightMatch = about.match(/Weight[:\s]+([^\n]+)/i);
    if (weightMatch) info.weight = weightMatch[1].trim();

    const hairMatch = about.match(/Hair[:\s]+([^\n]+)/i);
    if (hairMatch) info.hairColor = hairMatch[1].trim();

    const eyesMatch = about.match(/Eyes?[:\s]+([^\n]+)/i);
    if (eyesMatch) info.eyeColor = eyesMatch[1].trim();

    return info;
  }

  /**
   * Clean description
   */
  private cleanDescription(about?: string): string | undefined {
    if (!about) return undefined;

    return about
      .replace(/\(Source:.*?\)/gi, '')
      .replace(/\[Written by.*?\]/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Calculate confidence (basic)
   */
  private calculateConfidence(char: JikanCharacter): number {
    let score = 0.5;

    if (char.about && char.about.length > 100) score += 0.2;
    if (char.images.jpg.image_url) score += 0.1;
    if (char.favorites > 100) score += 0.1;
    if (char.favorites > 1000) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate confidence (full)
   */
  private calculateConfidenceFull(char: JikanCharacterFull): number {
    let score = 0.5;

    if (char.about && char.about.length > 100) score += 0.15;
    if (char.images.jpg.image_url) score += 0.1;
    if (char.anime && char.anime.length > 0) score += 0.1;
    if (char.manga && char.manga.length > 0) score += 0.05;
    if (char.voices && char.voices.length > 0) score += 0.05;
    if (char.favorites > 100) score += 0.05;

    return Math.min(score, 1.0);
  }

  /**
   * Enforce rate limiting (3 requests per second)
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
      const results = await this.search('Luffy', { limit: 1 });
      return results.length > 0;
    } catch {
      return false;
    }
  }
}
