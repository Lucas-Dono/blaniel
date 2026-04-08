/**
 * Firecrawl Search Source - Universal fallback scraper
 * Uses Firecrawl API to scrape and extract character data from any website
 * Rate limit: 500 credits/month on free tier
 * Documentation: https://docs.firecrawl.dev/
 */

import { SearchSource, SearchResult, SearchOptions, GenreId } from '../../core/types';
import { getFirecrawlCreditsTracker } from '@/lib/redis/firecrawl-credits';

interface FirecrawlScrapeResponse {
  success: boolean;
  data: {
    content: string;
    markdown: string;
    html?: string;
    metadata: {
      title: string;
      description?: string;
      language?: string;
      sourceURL: string;
      ogImage?: string;
    };
  };
}

interface FirecrawlSearchResponse {
  success: boolean;
  data: Array<{
    url: string;
    title: string;
    description?: string;
  }>;
}

export class FirecrawlSource implements SearchSource {
  sourceId = 'firecrawl' as const;
  name = 'Firecrawl (Universal)';
  supportedGenres: GenreId[] = [
    'roleplay',
    'romance',
    'friendship',
    'gaming',
    'professional',
    'wellness',
  ];
  baseUrl = 'https://api.firecrawl.dev/v0';
  apiKey = process.env.FIRECRAWL_API_KEY || '';
  rateLimit = {
    requests: 10,
    per: 60000, // Conservative, depends on plan
  };

  private lastRequestTime = 0;
  private requestCount = 0;
  private creditsTracker = getFirecrawlCreditsTracker();

  /**
   * Search using Firecrawl (scrape search engine results)
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.apiKey) {
      console.warn('Firecrawl API key not configured');
      return [];
    }

    // Check credit limit from Redis
    const hasCredits = await this.creditsTracker.hasCreditsAvailable();
    if (!hasCredits) {
      const stats = await this.creditsTracker.getStats();
      console.warn(
        `Firecrawl monthly credit limit reached: ${stats.used}/${stats.limit} (${stats.percentageUsed}%)`
      );
      return [];
    }

    await this.enforceRateLimit();

    // Use Google search as a source
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' character wiki')}`;

    try {
      // First, get search results
      const searchResults = await this.scrapeSearchResults(searchUrl);

      // Then scrape the most promising URLs
      const results: SearchResult[] = [];

      for (const result of searchResults.slice(0, options.limit || 3)) {
        try {
          const scrapedData = await this.scrapeUrl(result.url);
          if (scrapedData) {
            results.push(scrapedData);
          }
        } catch (error) {
          console.error(`Failed to scrape ${result.url}:`, error);
          // Continue with next URL
        }
      }

      return results;
    } catch (error) {
      console.error('Firecrawl search error:', error);
      throw error;
    }
  }

  /**
   * Scrape a specific URL
   */
  async scrapeUrl(url: string): Promise<SearchResult | null> {
    await this.enforceRateLimit();

    // Check credit limit from Redis
    const hasCredits = await this.creditsTracker.hasCreditsAvailable();
    if (!hasCredits) {
      console.warn('Firecrawl credits exhausted, cannot scrape URL');
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          pageOptions: {
            onlyMainContent: true,
            includeHtml: false,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Firecrawl API error: ${response.status}`);
      }

      const data: FirecrawlScrapeResponse = await response.json();

      if (!data.success) {
        return null;
      }

      // Increment credits in Redis (each scrape costs 1 credit)
      await this.creditsTracker.incrementCredits(1);

      return this.mapToSearchResult(data.data, url);
    } catch (error) {
      console.error('Firecrawl scrapeUrl error:', error);
      return null;
    }
  }

  /**
   * Get details (same as scrapeUrl for this source)
   */
  async getDetails(url: string): Promise<SearchResult | null> {
    return this.scrapeUrl(url);
  }

  /**
   * Scrape search engine results
   */
  private async scrapeSearchResults(
    searchUrl: string
  ): Promise<Array<{ url: string; title: string; description?: string }>> {
    await this.enforceRateLimit();

    try {
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url: searchUrl,
          pageOptions: {
            onlyMainContent: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Firecrawl API error: ${response.status}`);
      }

      const data: FirecrawlScrapeResponse = await response.json();

      if (!data.success) {
        return [];
      }

      // Increment credits in Redis
      await this.creditsTracker.incrementCredits(1);

      // Parse the search results from the markdown/content
      return this.parseSearchResults(data.data.markdown);
    } catch (error) {
      console.error('Firecrawl scrapeSearchResults error:', error);
      return [];
    }
  }

  /**
   * Parse search results from markdown content
   */
  private parseSearchResults(
    markdown: string
  ): Array<{ url: string; title: string; description?: string }> {
    const results: Array<{ url: string; title: string; description?: string }> = [];

    // Extract links from markdown
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(markdown)) !== null) {
      const title = match[1];
      const url = match[2];

      // Filter out unwanted URLs (Google's own pages, etc.)
      if (
        url.startsWith('http') &&
        !url.includes('google.com') &&
        !url.includes('youtube.com')
      ) {
        results.push({ url, title });
      }
    }

    return results;
  }

  /**
   * Map scraped data to SearchResult
   */
  private mapToSearchResult(
    data: FirecrawlScrapeResponse['data'],
    url: string
  ): SearchResult {
    // Extract character information from the content using heuristics
    const characterInfo = this.extractCharacterInfo(data.markdown);

    return {
      id: `firecrawl-${Buffer.from(url).toString('base64').slice(0, 16)}`,
      externalId: url,
      name: characterInfo.name || data.metadata.title,
      description: characterInfo.description || data.metadata.description || data.content.slice(0, 500),
      imageUrl: data.metadata.ogImage,
      thumbnailUrl: data.metadata.ogImage,
      source: 'firecrawl',
      sourceUrl: url,
      metadata: {
        language: data.metadata.language,
        scrapedAt: new Date().toISOString(),
        ...characterInfo,
      },
      confidence: this.calculateConfidence(data, characterInfo),
    };
  }

  /**
   * Enhanced character information extraction with robust pattern matching
   */
  private extractCharacterInfo(markdown: string): Record<string, any> {
    const info: Record<string, any> = {};
    const lowerContent = markdown.toLowerCase();

    // Extract name from first heading (multiple formats)
    const namePatterns = [
      /^#\s+(.+)$/m,
      /^##\s+(.+)$/m,
      /\*\*name[:\s]+(.+?)\*\*/i,
      /name[:\s]+\*\*(.+?)\*\*/i,
      /^(.+?)(?:\s*\(|$)/m, // First line before parenthesis
    ];

    for (const pattern of namePatterns) {
      const match = markdown.match(pattern);
      if (match && match[1] && !match[1].includes('http') && match[1].length < 100) {
        info.name = match[1].trim();
        break;
      }
    }

    // Extract age (multiple formats)
    const agePatterns = [
      /age[:\s]+(\d+)(?:\s*years?\s*old)?/i,
      /(\d+)[\s-]years?[\s-]old/i,
      /aged\s+(\d+)/i,
      /\bborn.*?(\d{4})/i, // Extract birth year
    ];

    for (const pattern of agePatterns) {
      const match = markdown.match(pattern);
      if (match && match[1]) {
        const value = match[1];
        // If it's a year (4 digits), calculate age
        if (value.length === 4) {
          const birthYear = parseInt(value);
          const currentYear = new Date().getFullYear();
          if (birthYear > 1900 && birthYear < currentYear) {
            info.age = (currentYear - birthYear).toString();
            info.birthYear = value;
          }
        } else {
          info.age = value;
        }
        break;
      }
    }

    // Extract gender (expanded detection)
    const genderPatterns = [
      /gender[:\s]+(male|female|non-binary|nonbinary|agender|genderfluid|other)/i,
      /\b(he|him|his)\b.*\b(male)\b/i,
      /\b(she|her|hers)\b.*\b(female)\b/i,
      /\b(they|them|their)\b.*\b(non-binary|nonbinary)\b/i,
      /pronouns?[:\s]+(he\/him|she\/her|they\/them)/i,
    ];

    for (const pattern of genderPatterns) {
      const match = markdown.match(pattern);
      if (match && match[1]) {
        info.gender = match[1].toLowerCase();
        break;
      }
    }

    // Extract occupation/role (expanded patterns)
    const occupationPatterns = [
      /occupation[:\s]+([^\n.]{3,50})/i,
      /profession[:\s]+([^\n.]{3,50})/i,
      /role[:\s]+([^\n.]{3,50})/i,
      /job[:\s]+([^\n.]{3,50})/i,
      /works?\s+as\s+(?:a\s+)?([^\n.]{3,50})/i,
      /\bis\s+(?:a\s+|an\s+)?(student|teacher|doctor|nurse|engineer|artist|musician|writer|developer|designer|manager|director|ceo|founder|entrepreneur|scientist|researcher)(?:\b|\s)/i,
    ];

    for (const pattern of occupationPatterns) {
      const match = markdown.match(pattern);
      if (match && match[1]) {
        info.occupation = match[1].trim();
        break;
      }
    }

    // Extract species/race (for fictional characters)
    const speciesPatterns = [
      /species[:\s]+([^\n.]{3,30})/i,
      /race[:\s]+([^\n.]{3,30})/i,
      /\b(human|elf|dwarf|orc|goblin|dragon|vampire|werewolf|demon|angel|robot|android|alien|cyborg)\b/i,
    ];

    for (const pattern of speciesPatterns) {
      const match = markdown.match(pattern);
      if (match && match[1]) {
        info.species = match[1].trim();
        break;
      }
    }

    // Extract appearance (enhanced)
    const appearancePatterns = [
      /appearance[:\s]+([^\n]{30,200})/i,
      /physical\s+description[:\s]+([^\n]{30,200})/i,
      /looks?[:\s]+([^\n]{30,200})/i,
      /description[:\s]+([^\n]{30,200})/i,
      /(hair[:\s]+[^\n]{10,}|eyes?[:\s]+[^\n]{10,}|height[:\s]+[^\n]{10,})/i,
    ];

    for (const pattern of appearancePatterns) {
      const match = markdown.match(pattern);
      if (match && match[1]) {
        info.appearance = match[1].trim().slice(0, 300);
        break;
      }
    }

    // Extract personality (enhanced with multiple descriptors)
    const personalityPatterns = [
      /personality[:\s]+([^\n]{30,300})/i,
      /character\s+traits?[:\s]+([^\n]{30,300})/i,
      /temperament[:\s]+([^\n]{30,300})/i,
    ];

    const personalityTraits: string[] = [];

    for (const pattern of personalityPatterns) {
      const match = markdown.match(pattern);
      if (match && match[1]) {
        info.personalityDescription = match[1].trim();

        // Extract individual traits
        const traits = match[1]
          .split(/[,;]/)
          .map(t => t.trim())
          .filter(t => t.length > 2 && t.length < 30);
        personalityTraits.push(...traits);
        break;
      }
    }

    // Extract abilities/skills
    const skillsPatterns = [
      /(?:skills?|abilities|powers?|talents?)[:\s]+([^\n]{20,200})/gi,
    ];

    const skills: string[] = [];
    for (const pattern of skillsPatterns) {
      const matches = markdown.matchAll(pattern);
      for (const match of matches) {
        if (match && match[1]) {
          const extracted = match[1]
            .split(/[,;]/)
            .map(s => s.trim())
            .filter(s => s.length > 2 && s.length < 50);
          skills.push(...extracted);
        }
      }
    }

    if (skills.length > 0) {
      info.skills = skills.slice(0, 10); // Limit to 10
    }

    if (personalityTraits.length > 0) {
      info.personality = personalityTraits.slice(0, 10); // Limit to 10
    }

    // Extract relationships
    const relationshipPatterns = [
      /(?:family|relatives?|parents?|siblings?|spouse|partner|children)[:\s]+([^\n]{10,100})/gi,
      /(?:friends?|allies|companions?|teammates?)[:\s]+([^\n]{10,100})/gi,
    ];

    const relationships: string[] = [];
    for (const pattern of relationshipPatterns) {
      const matches = markdown.matchAll(pattern);
      for (const match of matches) {
        if (match && match[1]) {
          relationships.push(match[1].trim());
        }
      }
    }

    if (relationships.length > 0) {
      info.relationships = relationships.slice(0, 5);
    }

    // Extract background/origin
    const backgroundPatterns = [
      /(?:background|origin|history|backstory)[:\s]+([^\n]{30,500})/i,
      /(?:from|born in|hails from)[:\s]+([^\n]{10,100})/i,
    ];

    for (const pattern of backgroundPatterns) {
      const match = markdown.match(pattern);
      if (match && match[1] && !info.background) {
        info.background = match[1].trim().slice(0, 500);
        break;
      }
    }

    // Extract description (first substantial paragraph that's not a heading)
    const paragraphs = markdown.split(/\n{2,}/);
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (
        trimmed.length > 100 &&
        !trimmed.startsWith('#') &&
        !trimmed.includes('http://') &&
        !trimmed.includes('https://') &&
        !info.description
      ) {
        info.description = trimmed.slice(0, 500);
        break;
      }
    }

    // Detect fictional vs real
    const fictionalIndicators = [
      'fictional',
      'character from',
      'protagonist',
      'antagonist',
      'appears in',
      'created by',
      'fantasy',
      'sci-fi',
      'anime',
      'manga',
      'video game',
    ];

    const hasFictionalIndicators = fictionalIndicators.some(indicator =>
      lowerContent.includes(indicator)
    );

    if (hasFictionalIndicators) {
      info.type = 'fictional_character';

      // Try to extract franchise/series
      const franchiseMatch = markdown.match(
        /(?:from|in|of|appears in)\s+(?:the\s+)?([A-Z][^.\n]{3,50})(?:\s+series|\s+franchise|\s+game|\s+anime|\s+manga|$)/i
      );
      if (franchiseMatch && franchiseMatch[1]) {
        info.franchise = franchiseMatch[1].trim();
      }
    }

    return info;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    data: FirecrawlScrapeResponse['data'],
    characterInfo: Record<string, any>
  ): number {
    let score = 0.3; // Lower base for scraped content

    // Has structured character info
    if (characterInfo.age || characterInfo.gender || characterInfo.occupation) {
      score += 0.2;
    }

    // Has substantial content
    if (data.content.length > 500) {
      score += 0.15;
    }

    // Has image
    if (data.metadata.ogImage) {
      score += 0.1;
    }

    // Has description
    if (characterInfo.description && characterInfo.description.length > 100) {
      score += 0.15;
    }

    // Content seems character-related
    if (
      data.content.toLowerCase().includes('character') ||
      data.content.toLowerCase().includes('personality') ||
      data.content.toLowerCase().includes('appearance')
    ) {
      score += 0.1;
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
   * Get credits usage from Redis
   */
  async getCreditsUsage(): Promise<{ used: number; limit: number; remaining: number; month: string; percentageUsed: number }> {
    return await this.creditsTracker.getStats();
  }

  /**
   * Reset monthly credits (admin function - usually handled automatically by Redis tracker)
   */
  async resetMonthlyCredits(): Promise<void> {
    await this.creditsTracker.resetCredits();
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;
      const result = await this.scrapeUrl('https://example.com');
      return result !== null;
    } catch {
      return false;
    }
  }
}
