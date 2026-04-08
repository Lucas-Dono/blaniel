/**
 * Wikipedia Search Source
 * REST API for Wikipedia articles
 * Rate limit: No hard limit, be reasonable
 * Documentation: https://www.mediawiki.org/wiki/API:Main_page
 */

import { SearchSource, SearchResult, SearchOptions, GenreId } from '../../core/types';

interface WikipediaSearchResult {
  pageid: number;
  title: string;
  snippet: string;
}

interface WikipediaPage {
  pageid: number;
  title: string;
  extract: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  pageimage?: string;
  categories?: Array<{
    title: string;
  }>;
  coordinates?: {
    lat: number;
    lon: number;
  };
}

interface WikipediaSearchResponse {
  query: {
    search: WikipediaSearchResult[];
    searchinfo: {
      totalhits: number;
    };
  };
}

interface WikipediaPageResponse {
  query: {
    pages: {
      [key: string]: WikipediaPage;
    };
  };
}

export class WikipediaSource implements SearchSource {
  sourceId = 'wikipedia' as const;
  name = 'Wikipedia';
  supportedGenres: GenreId[] = [
    'roleplay',
    'professional',
    'friendship',
    'gaming',
    'wellness',
    'romance',
  ];
  baseUrl = 'https://en.wikipedia.org/w/api.php';
  rateLimit = {
    requests: 100,
    per: 60000, // Be conservative even though there's no hard limit
  };

  private lastRequestTime = 0;
  private requestCount = 0;

  /**
   * Search for characters/people
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.enforceRateLimit();

    // Enhance query with character-related terms
    const enhancedQuery = `${query} character OR person OR figure`;

    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: enhancedQuery,
      srlimit: (options.limit || 10).toString(),
      sroffset: (((options.page || 1) - 1) * (options.limit || 10)).toString(),
      format: 'json',
      origin: '*',
    });

    try {
      const response = await fetch(`${this.baseUrl}?${params}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'SmartStartCharacterCreator/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status} ${response.statusText}`);
      }

      const data: WikipediaSearchResponse = await response.json();

      // Get details for each result
      const pageIds = data.query.search.map(r => r.pageid);
      const detailedResults = await this.getPagesByIds(pageIds);

      return detailedResults;
    } catch (error) {
      console.error('Wikipedia search error:', error);
      throw error;
    }
  }

  /**
   * Get detailed page information by page ID
   */
  async getDetails(pageId: string): Promise<SearchResult | null> {
    await this.enforceRateLimit();

    try {
      const params = new URLSearchParams({
        action: 'query',
        pageids: pageId,
        prop: 'extracts|pageimages|categories|coordinates',
        exintro: 'true',
        explaintext: 'true',
        exsectionformat: 'plain',
        piprop: 'thumbnail',
        pithumbsize: '500',
        cllimit: '50',
        format: 'json',
        origin: '*',
      });

      const response = await fetch(`${this.baseUrl}?${params}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'SmartStartCharacterCreator/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`);
      }

      const data: WikipediaPageResponse = await response.json();
      const page = Object.values(data.query.pages)[0];

      if (!page || page.pageid === -1) {
        return null;
      }

      return this.mapToSearchResult(page);
    } catch (error) {
      console.error('Wikipedia getDetails error:', error);
      return null;
    }
  }

  /**
   * Get multiple pages by their IDs
   */
  private async getPagesByIds(pageIds: number[]): Promise<SearchResult[]> {
    if (pageIds.length === 0) return [];

    await this.enforceRateLimit();

    const params = new URLSearchParams({
      action: 'query',
      pageids: pageIds.join('|'),
      prop: 'extracts|pageimages|categories',
      exintro: 'true',
      explaintext: 'true',
      exsectionformat: 'plain',
      piprop: 'thumbnail',
      pithumbsize: '500',
      cllimit: '50',
      format: 'json',
      origin: '*',
    });

    try {
      const response = await fetch(`${this.baseUrl}?${params}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'SmartStartCharacterCreator/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`);
      }

      const data: WikipediaPageResponse = await response.json();
      const pages = Object.values(data.query.pages);

      return pages
        .filter(page => page.pageid !== -1)
        .map(page => this.mapToSearchResult(page));
    } catch (error) {
      console.error('Wikipedia getPagesByIds error:', error);
      return [];
    }
  }

  /**
   * Map Wikipedia page to SearchResult
   */
  private mapToSearchResult(page: WikipediaPage): SearchResult {
    // Parse categories to determine if this is a fictional character
    const categories = page.categories?.map(c => c.title.toLowerCase()) || [];
    const isFictional = this.isFictionalCharacter(categories);
    const isReal = this.isRealPerson(categories, page.extract);
    const characterInfo = this.extractCharacterInfo(page.extract, categories);

    return {
      id: `wikipedia-${page.pageid}`,
      externalId: page.pageid.toString(),
      name: page.title,
      description: this.cleanExtract(page.extract),
      imageUrl: page.thumbnail?.source,
      thumbnailUrl: page.thumbnail?.source,
      source: 'wikipedia',
      sourceUrl: `https://en.wikipedia.org/?curid=${page.pageid}`,
      metadata: {
        isFictional,
        isRealPerson: isReal,
        categories: categories.slice(0, 10),
        ...characterInfo,
        coordinates: page.coordinates,
      },
      confidence: this.calculateConfidence(page, isFictional, isReal, characterInfo),
    };
  }

  /**
   * Comprehensive fictional character detection
   */
  private isFictionalCharacter(categories: string[]): boolean {
    // Expanded fictional character indicators
    const fictionalKeywords = [
      // General fiction
      'fictional character',
      'fictional',
      'fictitious',
      'imaginary character',

      // Media types
      'anime',
      'manga',
      'comic',
      'comics',
      'graphic novel',
      'video game',
      'video games',
      'film character',
      'movie character',
      'television character',
      'tv character',
      'novel character',
      'literary character',
      'book character',
      'radio character',
      'web series',

      // Character types
      'protagonist',
      'antagonist',
      'superhero',
      'supervillain',
      'villain',
      'hero',
      'antihero',
      'supporting character',
      'main character',

      // Franchises and universes
      'marvel comics',
      'dc comics',
      'star wars',
      'star trek',
      'disney',
      'pixar',
      'dreamworks',
      'studio ghibli',
      'nintendo',
      'pokemon',
      'final fantasy',
      'dragon ball',
      'one piece',
      'naruto',
      'bleach',
      'harry potter',
      'lord of the rings',
      'game of thrones',
      'the witcher',

      // Story elements
      'fantasy',
      'science fiction',
      'sci-fi',
      'dystopian',
      'cyberpunk',
      'steampunk',
      'supernatural',
      'mythology',
      'folklore',

      // Creation and portrayal
      'created by',
      'portrayed by',
      'voiced by',
      'designed by',
      'character design',
    ];

    // Real person indicators (negative signals)
    const realPersonKeywords = [
      'births',
      'deaths',
      'living people',
      'american people',
      'british people',
      'people from',
      'alumni',
      'graduates',
      'politicians',
      'scientists',
      'inventors',
      'businesspeople',
      'entrepreneurs',
      'activists',
      'journalists',
      'historians',
      'philosophers',
      'economists',
      'military personnel',
      'religious figures',
      'clergy',
      'nobel laureates',
      'academy award',
      'grammy',
      'emmy',
      'olympic',
      'sportspeople',
      'athletes',
    ];

    const categoryText = categories.join(' ').toLowerCase();

    // Check for fictional indicators
    const hasFictionalIndicators = fictionalKeywords.some(keyword =>
      categoryText.includes(keyword.toLowerCase())
    );

    // Check for real person indicators
    const hasRealPersonIndicators = realPersonKeywords.some(keyword =>
      categoryText.includes(keyword.toLowerCase())
    );

    // Fictional if has fictional indicators and no strong real person indicators
    // Exception: "portrayed by" can appear in both, so we allow it
    if (hasFictionalIndicators && !hasRealPersonIndicators) {
      return true;
    }

    // Edge case: has both indicators - use scoring
    if (hasFictionalIndicators && hasRealPersonIndicators) {
      const fictionalScore = fictionalKeywords.filter(k =>
        categoryText.includes(k.toLowerCase())
      ).length;
      const realScore = realPersonKeywords.filter(k =>
        categoryText.includes(k.toLowerCase())
      ).length;

      // If fictional score is significantly higher, consider it fictional
      return fictionalScore > realScore * 1.5;
    }

    return false;
  }

  /**
   * Detect if this is a real person (not fictional)
   * Used to filter out unwanted real people results
   */
  private isRealPerson(categories: string[], extract: string): boolean {
    const categoryText = categories.join(' ').toLowerCase();
    const _extractLower = extract.toLowerCase();

    // Strong real person indicators
    const strongIndicators = [
      categoryText.includes('births') && categoryText.includes('deaths'),
      categoryText.includes('living people'),
      /\b(born|died)\s+\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i.test(
        extract
      ),
    ];

    return strongIndicators.some(indicator => indicator);
  }

  /**
   * Extract character information from the text extract
   */
  private extractCharacterInfo(extract: string, categories: string[]): Record<string, any> {
    const info: Record<string, any> = {};

    // Check if it's about a person
    const isPerson =
      categories.some(c => c.includes('births') || c.includes('deaths')) ||
      extract.match(/\b(born|died)\b/i);

    if (isPerson) {
      info.type = 'real_person';

      // Extract birth/death years
      const birthMatch = extract.match(/\bborn[:\s]+.*?(\d{4})/i);
      if (birthMatch) {
        info.birthYear = birthMatch[1];
      }

      const deathMatch = extract.match(/\bdied[:\s]+.*?(\d{4})/i);
      if (deathMatch) {
        info.deathYear = deathMatch[1];
      }

      // Extract nationality
      const nationalityMatch = extract.match(
        /\b(American|British|Canadian|Australian|Japanese|Korean|Chinese|French|German|Italian|Spanish)\b/i
      );
      if (nationalityMatch) {
        info.nationality = nationalityMatch[1];
      }

      // Extract profession
      const professionMatch = extract.match(
        /\b(actor|actress|writer|director|musician|artist|scientist|politician|athlete|philosopher)\b/i
      );
      if (professionMatch) {
        info.profession = professionMatch[1];
      }
    } else {
      info.type = 'fictional_character';

      // Try to extract the franchise/series
      const franchiseMatch = extract.match(/(?:from|in|of)\s+(?:the\s+)?([A-Z][^.]+?)(?:series|franchise|film|game)/i);
      if (franchiseMatch) {
        info.franchise = franchiseMatch[1].trim();
      }
    }

    return info;
  }

  /**
   * Clean the extract text
   */
  private cleanExtract(extract: string): string {
    return (
      extract
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        // Limit to first 500 characters for preview
        .slice(0, 500)
        .trim()
    );
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    page: WikipediaPage,
    isFictional: boolean,
    isRealPerson: boolean,
    characterInfo: Record<string, any>
  ): number {
    let score = 0.3; // Base score (reduced from 0.4 - be more conservative)

    // Has image
    if (page.thumbnail) {
      score += 0.15;
    }

    // Has substantial content
    if (page.extract && page.extract.length > 200) {
      score += 0.1;
    }

    // Very substantial content
    if (page.extract && page.extract.length > 500) {
      score += 0.05;
    }

    // Character type clarity bonus
    if (isFictional) {
      score += 0.25; // High bonus for clearly fictional characters
    } else if (isRealPerson && characterInfo.type === 'real_person') {
      score += 0.15; // Moderate bonus for real people (depends on genre context)
    } else {
      // Neither clearly fictional nor clearly real - reduce confidence
      score -= 0.1;
    }

    // Has detailed character info
    if (characterInfo.franchise) {
      score += 0.1; // Has franchise info (good for fictional)
    }

    if (characterInfo.profession || characterInfo.birthYear) {
      score += 0.05; // Has biographical info (good for real people)
    }

    // Penalty for ambiguous pages (might be concepts, places, etc.)
    if (!isFictional && !isRealPerson && !characterInfo.type) {
      score -= 0.15;
    }

    return Math.max(0.1, Math.min(score, 1.0)); // Clamp between 0.1 and 1.0
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
      const results = await this.search('Albert Einstein', { limit: 1 });
      return results.length > 0;
    } catch {
      return false;
    }
  }
}
