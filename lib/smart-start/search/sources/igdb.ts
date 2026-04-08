/**
 * IGDB (Internet Game Database) Search Source
 * REST API for video game characters
 * Rate limit: 4 requests per second
 * Documentation: https://api-docs.igdb.com/
 */

import { SearchSource, SearchResult, SearchOptions, GenreId } from '../../core/types';

interface IGDBCharacter {
  id: number;
  name: string;
  slug: string;
  description?: string;
  url?: string;
  mug_shot?: number;
  gender?: number; // 0: Male, 1: Female, 2: Other
  species?: number;
  games?: number[];
  akas?: string[];
  country_name?: string;
}

interface IGDBGame {
  id: number;
  name: string;
  slug: string;
  cover?: {
    id: number;
    url: string;
  };
  first_release_date?: number;
  genres?: Array<{ id: number; name: string }>;
}

interface IGDBImage {
  id: number;
  url: string;
  image_id: string;
  width: number;
  height: number;
}

export class IGDBSource implements SearchSource {
  sourceId = 'igdb' as const;
  name = 'Internet Game Database';
  supportedGenres: GenreId[] = ['gaming', 'roleplay', 'friendship'];
  baseUrl = 'https://api.igdb.com/v4';
  clientId = process.env.IGDB_CLIENT_ID || '';
  clientSecret = process.env.IGDB_CLIENT_SECRET || '';
  rateLimit = {
    requests: 4,
    per: 1000, // 1 second
  };

  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private lastRequestTime = 0;
  private requestCount = 0;

  /**
   * Validate that credentials are configured
   * @throws Error if credentials are missing
   */
  private validateCredentials(): void {
    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'IGDB credentials not configured. Please set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET environment variables.'
      );
    }

    if (this.clientId === 'undefined' || this.clientSecret === 'undefined') {
      throw new Error(
        'IGDB credentials are invalid (literal "undefined"). Check your environment variables.'
      );
    }
  }

  /**
   * Authenticate with Twitch to get access token for IGDB
   */
  async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Validate credentials before authentication
    this.validateCredentials();

    try {
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      });

      const response = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Twitch OAuth error: ${response.status}`);
      }

      const data = await response.json();

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + data.expires_in * 1000;

      if (!this.accessToken) {
        throw new Error('Failed to obtain access token from Twitch');
      }

      return this.accessToken;
    } catch (error) {
      console.error('IGDB authentication error:', error);
      throw error;
    }
  }

  /**
   * Search for game characters
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      await this.enforceRateLimit();

      // This will validate credentials and throw if invalid
      const token = await this.authenticate();

      // Validate token is not empty
      if (!token || token === 'undefined') {
        console.error('[IGDB] Authentication failed: invalid token received');
        return [];
      }

      // IGDB uses Apicalypse query language
      const body = `
        search "${query}";
        fields name, slug, description, url, mug_shot, gender, species, games, akas, country_name;
        limit ${options.limit || 10};
        offset ${((options.page || 1) - 1) * (options.limit || 10)};
      `;

      const response = await fetch(`${this.baseUrl}/characters`, {
        method: 'POST',
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain',
        },
        body: body.trim(),
      });

      if (!response.ok) {
        throw new Error(`IGDB API error: ${response.status} ${response.statusText}`);
      }

      const characters: IGDBCharacter[] = await response.json();

      // Get images and games for each character
      const results = await Promise.all(
        characters.map(char => this.enrichCharacterData(char, token))
      );

      return results;
    } catch (error) {
      console.error('[IGDB] Search error:', error);
      // Return empty array on credential errors to allow fallback to other sources
      return [];
    }
  }

  /**
   * Get detailed character information
   */
  async getDetails(characterId: string): Promise<SearchResult | null> {
    try {
      await this.enforceRateLimit();

      // This will validate credentials and throw if invalid
      const token = await this.authenticate();

      if (!token || token === 'undefined') {
        console.error('[IGDB] Authentication failed: invalid token');
        return null;
      }

      const body = `
        fields name, slug, description, url, mug_shot, gender, species, games, akas, country_name;
        where id = ${characterId};
      `;

      const response = await fetch(`${this.baseUrl}/characters`, {
        method: 'POST',
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain',
        },
        body: body.trim(),
      });

      if (!response.ok) {
        throw new Error(`IGDB API error: ${response.status}`);
      }

      const characters: IGDBCharacter[] = await response.json();

      if (characters.length === 0) {
        return null;
      }

      return this.enrichCharacterData(characters[0], token);
    } catch (error) {
      console.error('[IGDB] getDetails error:', error);
      return null;
    }
  }

  /**
   * Enrich character data with images and game information
   */
  private async enrichCharacterData(
    char: IGDBCharacter,
    token: string
  ): Promise<SearchResult> {
    // Get character image
    let imageUrl: string | undefined;
    let thumbnailUrl: string | undefined;

    if (char.mug_shot) {
      const imageData = await this.getImage(char.mug_shot, token);
      if (imageData) {
        imageUrl = `https://images.igdb.com/igdb/image/upload/t_1080p/${imageData.image_id}.jpg`;
        thumbnailUrl = `https://images.igdb.com/igdb/image/upload/t_thumb/${imageData.image_id}.jpg`;
      }
    }

    // Get games the character appears in
    let games: IGDBGame[] = [];
    if (char.games && char.games.length > 0) {
      games = await this.getGames(char.games.slice(0, 5), token);
    }

    return this.mapToSearchResult(char, imageUrl, thumbnailUrl, games);
  }

  /**
   * Get image data
   */
  private async getImage(imageId: number, token: string): Promise<IGDBImage | null> {
    await this.enforceRateLimit();

    const body = `
      fields url, image_id, width, height;
      where id = ${imageId};
    `;

    try {
      const response = await fetch(`${this.baseUrl}/character_mug_shots`, {
        method: 'POST',
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain',
        },
        body: body.trim(),
      });

      if (!response.ok) return null;

      const images: IGDBImage[] = await response.json();
      return images[0] || null;
    } catch (error) {
      console.error('IGDB getImage error:', error);
      return null;
    }
  }

  /**
   * Get game data
   */
  private async getGames(gameIds: number[], token: string): Promise<IGDBGame[]> {
    if (gameIds.length === 0) return [];

    await this.enforceRateLimit();

    const body = `
      fields name, slug, cover.url, first_release_date, genres.name;
      where id = (${gameIds.join(',')});
      limit ${gameIds.length};
    `;

    try {
      const response = await fetch(`${this.baseUrl}/games`, {
        method: 'POST',
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain',
        },
        body: body.trim(),
      });

      if (!response.ok) return [];

      return await response.json();
    } catch (error) {
      console.error('IGDB getGames error:', error);
      return [];
    }
  }

  /**
   * Map IGDB character to SearchResult
   */
  private mapToSearchResult(
    char: IGDBCharacter,
    imageUrl?: string,
    thumbnailUrl?: string,
    games?: IGDBGame[]
  ): SearchResult {
    const primaryGame = games?.[0];

    return {
      id: `igdb-${char.id}`,
      externalId: char.id.toString(),
      name: char.name,
      alternateName: char.akas?.[0],
      description: char.description,
      imageUrl,
      thumbnailUrl,
      source: 'igdb',
      sourceUrl: char.url || `https://www.igdb.com/characters/${char.slug}`,
      metadata: {
        slug: char.slug,
        gender: this.parseGender(char.gender),
        species: char.species,
        alternativeNames: char.akas,
        countryName: char.country_name,
        gamesCount: char.games?.length || 0,
        primaryGame: primaryGame
          ? {
              name: primaryGame.name,
              releaseYear: primaryGame.first_release_date
                ? new Date(primaryGame.first_release_date * 1000).getFullYear()
                : undefined,
              genres: primaryGame.genres?.map(g => g.name),
            }
          : undefined,
        games: games?.map(game => game.name),
      },
      confidence: this.calculateConfidence(char, imageUrl, games),
    };
  }

  /**
   * Parse IGDB gender code
   */
  private parseGender(gender?: number): string | undefined {
    if (gender === undefined) return undefined;
    switch (gender) {
      case 0:
        return 'Male';
      case 1:
        return 'Female';
      case 2:
        return 'Other';
      default:
        return undefined;
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    char: IGDBCharacter,
    imageUrl?: string,
    games?: IGDBGame[]
  ): number {
    let score = 0.5; // Base score

    // Has description
    if (char.description && char.description.length > 100) {
      score += 0.2;
    }

    // Has image
    if (imageUrl) {
      score += 0.15;
    }

    // Has game associations
    if (games && games.length > 0) {
      score += 0.1;
    }

    // Multiple games (popular character)
    if (char.games && char.games.length > 3) {
      score += 0.05;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Enforce rate limiting (4 requests per second)
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
      if (!this.clientId || !this.clientSecret) return false;
      await this.authenticate();
      const results = await this.search('Mario', { limit: 1 });
      return results.length > 0;
    } catch {
      return false;
    }
  }
}
