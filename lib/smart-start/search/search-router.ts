/**
 * Search Router - Intelligent source selection and fallback system
 * Routes searches to the most appropriate source based on genre and query
 * Implements fallback chain for resilience
 */

import { SearchSource, SearchResult, SearchOptions, GenreId } from '../core/types';
import { AniListSource } from './sources/anilist';
import { MyAnimeListSource } from './sources/myanimelist';
import { JikanSource } from './sources/jikan';
import { TVMazeSource } from './sources/tvmaze';
import { TMDBSource } from './sources/tmdb';
import { IGDBSource } from './sources/igdb';
import { WikipediaSource } from './sources/wikipedia';
import { FirecrawlSource } from './sources/firecrawl';
import { calculateMatchScore } from '../utils/string-similarity';
import Redis from 'ioredis';

// Timeout configuration
const SEARCH_TIMEOUT_MS = 10000; // 10 seconds per source
const DETAILS_TIMEOUT_MS = 5000; // 5 seconds for getDetails calls

/**
 * Execute a promise with a timeout
 * @param promise Promise to execute
 * @param timeoutMs Timeout in milliseconds
 * @param timeoutError Error message if timeout occurs
 * @returns Promise result or throws timeout error
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
    ),
  ]);
}

// Cache interface
export interface SearchCache {
  get(query: string, genre: GenreId): Promise<{ results: SearchResult[]; cached: true } | null>;
  set(query: string, genre: GenreId, results: SearchResult[], ttl?: number): Promise<void>;
}

// Redis-based cache implementation
class RedisSearchCache implements SearchCache {
  private redis: Redis | null = null;

  constructor() {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL);
      }
    } catch (error) {
      console.warn('Redis cache not available:', error);
    }
  }

  async get(query: string, genre: GenreId): Promise<{ results: SearchResult[]; cached: true } | null> {
    if (!this.redis) return null;

    try {
      const key = this.getCacheKey(query, genre);
      const cached = await this.redis.get(key);
      if (!cached) return null;

      const results = JSON.parse(cached);
      return { results, cached: true };
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(
    query: string,
    genre: GenreId,
    results: SearchResult[],
    ttl: number = 86400
  ): Promise<void> {
    if (!this.redis) return;

    try {
      const key = this.getCacheKey(query, genre);
      await this.redis.setex(key, ttl, JSON.stringify(results));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  private getCacheKey(query: string, genre: GenreId): string {
    const normalizedQuery = query.toLowerCase().trim();
    return `smart-start:search:${genre}:${normalizedQuery}`;
  }
}

// Source priority configuration per genre
interface SourceConfig {
  source: SearchSource;
  priority: number;
}

export class SearchRouter {
  private sources: Map<string, SearchSource>;
  private cache: SearchCache;
  private sourcesByGenre: Map<GenreId, SourceConfig[]>;

  constructor() {
    this.cache = new RedisSearchCache();
    this.sources = new Map();
    this.sourcesByGenre = new Map();

    this.initializeSources();
    this.configureGenrePriorities();
  }

  /**
   * Initialize all search sources
   */
  private initializeSources(): void {
    const sources: SearchSource[] = [
      new AniListSource(),
      new MyAnimeListSource(),
      new JikanSource(),
      new TVMazeSource(),
      new TMDBSource(),
      new IGDBSource(),
      new WikipediaSource(),
      new FirecrawlSource(),
    ];

    for (const source of sources) {
      this.sources.set(source.sourceId, source);
    }
  }

  /**
   * Configure source priorities per genre
   */
  private configureGenrePriorities(): void {
    // Romance: Anime sources first, then general
    this.sourcesByGenre.set('romance', [
      { source: this.sources.get('anilist')!, priority: 10 },
      { source: this.sources.get('mal')!, priority: 9 },
      { source: this.sources.get('jikan')!, priority: 8 },
      { source: this.sources.get('tmdb')!, priority: 5 },
      { source: this.sources.get('tvmaze')!, priority: 4 },
      { source: this.sources.get('wikipedia')!, priority: 3 },
      { source: this.sources.get('firecrawl')!, priority: 1 },
    ]);

    // Roleplay: All sources, anime first
    this.sourcesByGenre.set('roleplay', [
      { source: this.sources.get('anilist')!, priority: 10 },
      { source: this.sources.get('mal')!, priority: 9 },
      { source: this.sources.get('igdb')!, priority: 8 },
      { source: this.sources.get('tmdb')!, priority: 7 },
      { source: this.sources.get('tvmaze')!, priority: 6 },
      { source: this.sources.get('wikipedia')!, priority: 5 },
      { source: this.sources.get('firecrawl')!, priority: 1 },
    ]);

    // Gaming: IGDB first
    this.sourcesByGenre.set('gaming', [
      { source: this.sources.get('igdb')!, priority: 10 },
      { source: this.sources.get('wikipedia')!, priority: 5 },
      { source: this.sources.get('anilist')!, priority: 3 },
      { source: this.sources.get('firecrawl')!, priority: 1 },
    ]);

    // Professional: Real people sources
    this.sourcesByGenre.set('professional', [
      { source: this.sources.get('wikipedia')!, priority: 10 },
      { source: this.sources.get('tmdb')!, priority: 8 },
      { source: this.sources.get('tvmaze')!, priority: 7 },
      { source: this.sources.get('firecrawl')!, priority: 1 },
    ]);

    // Friendship: Balanced
    this.sourcesByGenre.set('friendship', [
      { source: this.sources.get('anilist')!, priority: 9 },
      { source: this.sources.get('mal')!, priority: 8 },
      { source: this.sources.get('tvmaze')!, priority: 7 },
      { source: this.sources.get('tmdb')!, priority: 6 },
      { source: this.sources.get('wikipedia')!, priority: 5 },
      { source: this.sources.get('firecrawl')!, priority: 1 },
    ]);

    // Wellness: Real people focus
    this.sourcesByGenre.set('wellness', [
      { source: this.sources.get('wikipedia')!, priority: 10 },
      { source: this.sources.get('firecrawl')!, priority: 1 },
    ]);
  }

  /**
   * Main search method - tries sources in priority order with fallback
   * Returns results array (for backward compatibility)
   */
  async search(
    query: string,
    genre: GenreId,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // 1. Check cache
    const cacheData = await this.cache.get(query, genre);
    if (cacheData && cacheData.results.length > 0) {
      console.log(`[SearchRouter] Cache hit for "${query}" in ${genre}`);
      // Enrich cached results with fresh match scores
      const enrichedResults = this.enrichWithMatchScores(query, cacheData.results);
      return enrichedResults;
    }

    // 2. Get prioritized sources for this genre
    const sourcesConfig = this.sourcesByGenre.get(genre) || [];
    const sortedSources = sourcesConfig
      .filter(config => config.source)
      .sort((a, b) => b.priority - a.priority);

    console.log(
      `[SearchRouter] Searching "${query}" in ${genre} with ${sortedSources.length} sources`
    );

    // 3. Try each source in priority order with timeout
    const errors: Array<{ source: string; error: any }> = [];

    for (const config of sortedSources) {
      try {
        console.log(`[SearchRouter] Trying ${config.source.sourceId}...`);
        const startTime = Date.now();

        // Execute search with timeout
        const results = await withTimeout(
          config.source.search(query, options),
          SEARCH_TIMEOUT_MS,
          `Search timeout (${SEARCH_TIMEOUT_MS}ms) for ${config.source.sourceId}`
        );

        const searchTime = Date.now() - startTime;
        console.log(`[SearchRouter] ${config.source.sourceId} completed in ${searchTime}ms`);

        if (results.length > 0) {
          console.log(
            `[SearchRouter] Found ${results.length} results from ${config.source.sourceId}`
          );

          // Enrich results with match scores
          const enrichedResults = this.enrichWithMatchScores(query, results);

          // Cache successful results
          await this.cache.set(query, genre, enrichedResults, 86400); // 24 hours

          return enrichedResults;
        }

        console.log(`[SearchRouter] No results from ${config.source.sourceId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTimeout = errorMessage.includes('timeout');

        console.error(
          `[SearchRouter] ${config.source.sourceId} ${isTimeout ? 'timed out' : 'failed'}:`,
          errorMessage
        );
        errors.push({ source: config.source.sourceId, error });
        // Continue to next source
      }
    }

    // 4. If all sources failed or returned empty, try fallback
    console.log('[SearchRouter] All sources exhausted, trying fallback...');

    const fallbackResults = await this.fallbackSearch(query, genre);

    if (fallbackResults.length > 0) {
      const enrichedFallback = this.enrichWithMatchScores(query, fallbackResults);
      await this.cache.set(query, genre, enrichedFallback, 86400);
      return enrichedFallback;
    }

    return [];
  }

  /**
   * Fallback search using Firecrawl with timeout
   */
  private async fallbackSearch(query: string, _genre: GenreId): Promise<SearchResult[]> {
    const firecrawl = this.sources.get('firecrawl');
    if (!firecrawl) return [];

    try {
      console.log('[SearchRouter] Using Firecrawl fallback...');
      const startTime = Date.now();

      const results = await withTimeout(
        firecrawl.search(query, { limit: 5 }),
        SEARCH_TIMEOUT_MS,
        `Firecrawl fallback timeout (${SEARCH_TIMEOUT_MS}ms)`
      );

      const searchTime = Date.now() - startTime;
      console.log(`[SearchRouter] Firecrawl fallback completed in ${searchTime}ms`);

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage.includes('timeout');

      console.error(
        `[SearchRouter] Firecrawl fallback ${isTimeout ? 'timed out' : 'failed'}:`,
        errorMessage
      );
      return [];
    }
  }

  /**
   * Get details from a specific source with timeout
   */
  async getDetails(sourceId: string, externalId: string): Promise<SearchResult | null> {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Unknown source: ${sourceId}`);
    }

    try {
      console.log(`[SearchRouter] Fetching details from ${sourceId} for ${externalId}`);
      const startTime = Date.now();

      // Execute getDetails with timeout
      const details = await withTimeout(
        source.getDetails(externalId),
        DETAILS_TIMEOUT_MS,
        `getDetails timeout (${DETAILS_TIMEOUT_MS}ms) for ${sourceId}`
      );

      const fetchTime = Date.now() - startTime;
      console.log(`[SearchRouter] Details fetched from ${sourceId} in ${fetchTime}ms`);

      return details;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage.includes('timeout');

      console.error(
        `[SearchRouter] getDetails ${isTimeout ? 'timed out' : 'failed'} for ${sourceId}:`,
        errorMessage
      );
      return null;
    }
  }

  /**
   * Search multiple sources in parallel (for comparison)
   */
  async searchParallel(
    query: string,
    genre: GenreId,
    options: SearchOptions = {}
  ): Promise<Map<string, SearchResult[]>> {
    const sourcesConfig = this.sourcesByGenre.get(genre) || [];
    const results = new Map<string, SearchResult[]>();

    const promises = sourcesConfig.map(async config => {
      try {
        const sourceResults = await config.source.search(query, options);
        return { sourceId: config.source.sourceId, results: sourceResults };
      } catch (error) {
        console.error(`[SearchRouter] Parallel search error in ${config.source.sourceId}:`, error);
        return { sourceId: config.source.sourceId, results: [] };
      }
    });

    const settled = await Promise.all(promises);

    for (const { sourceId, results: sourceResults } of settled) {
      results.set(sourceId, sourceResults);
    }

    return results;
  }

  /**
   * Aggregate and deduplicate results from multiple sources
   */
  async searchAggregated(
    query: string,
    genre: GenreId,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const parallelResults = await this.searchParallel(query, genre, options);

    // Flatten all results
    const allResults: SearchResult[] = [];
    for (const [_sourceId, results] of parallelResults) {
      allResults.push(...results);
    }

    // Deduplicate by name similarity
    const deduplicated = this.deduplicateResults(allResults);

    // Enrich with match scores and sort
    const enriched = this.enrichWithMatchScores(query, deduplicated);

    return enriched.slice(0, options.limit || 10);
  }

  /**
   * Deduplicate results based on name similarity
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const unique: SearchResult[] = [];
    const seen = new Set<string>();

    for (const result of results) {
      const normalizedName = result.name.toLowerCase().trim();

      if (!seen.has(normalizedName)) {
        seen.add(normalizedName);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * Enrich results with match scores based on query
   */
  private enrichWithMatchScores(query: string, results: SearchResult[]): SearchResult[] {
    return results.map(result => {
      // Collect alternate names from various fields
      const alternateNames: string[] = [];

      if (result.alternateName) alternateNames.push(result.alternateName);
      if (result.nameNative) alternateNames.push(result.nameNative);
      if (result.nameKanji) alternateNames.push(result.nameKanji);
      if (result.nicknames) alternateNames.push(...result.nicknames);

      // Calculate match score
      const matchScore = calculateMatchScore(query, result.name, alternateNames);

      // Store in confidence field (which is already part of SearchResult type)
      return {
        ...result,
        confidence: matchScore,
      };
    }).sort((a, b) => (b.confidence || 0) - (a.confidence || 0)); // Sort by match score descending
  }

  /**
   * Test all sources connectivity
   */
  async testAllSources(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [sourceId, source] of this.sources) {
      try {
        const isConnected = await source.testConnection();
        results.set(sourceId, isConnected);
      } catch {
        results.set(sourceId, false);
      }
    }

    return results;
  }

  /**
   * Get source by ID
   */
  getSource(sourceId: string): SearchSource | undefined {
    return this.sources.get(sourceId);
  }

  /**
   * Get all available sources
   */
  getAllSources(): SearchSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get sources for a specific genre
   */
  getSourcesForGenre(genre: GenreId): SearchSource[] {
    const config = this.sourcesByGenre.get(genre) || [];
    return config
      .sort((a, b) => b.priority - a.priority)
      .map(c => c.source)
      .filter(Boolean);
  }
}

// Singleton instance
let searchRouterInstance: SearchRouter | null = null;

export function getSearchRouter(): SearchRouter {
  if (!searchRouterInstance) {
    searchRouterInstance = new SearchRouter();
  }
  return searchRouterInstance;
}

export const searchRouter = getSearchRouter();
