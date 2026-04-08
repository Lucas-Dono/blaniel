/**
 * Genre Detector - Intelligent genre detection from character data
 * Analyzes search results and suggests best-fit genre/subgenre
 */

import type { SearchResult, GenreId, SubGenreId } from '../core/types';

export interface GenreDetectionResult {
  genre: GenreId;
  subgenre?: SubGenreId;
  confidence: number; // 0.0 - 1.0
  reasoning: string;
  alternativeGenres?: Array<{
    genre: GenreId;
    confidence: number;
    reasoning: string;
  }>;
}

export class GenreDetector {
  /**
   * Detect best-fit genre from search result
   * Enhanced with source-based detection for higher accuracy
   */
  detectFromSearchResult(result: SearchResult): GenreDetectionResult {
    const detections: Array<{ genre: GenreId; confidence: number; reasoning: string }> = [];

    // Analyze metadata
    const metadata = result.metadata || {};
    const source = result.source;

    // PRIORITY 1: Source-based detection (highest confidence)
    if (source === 'anilist' || source === 'myanimelist' || source === 'jikan') {
      detections.push({
        genre: 'roleplay',
        confidence: 0.95,
        reasoning: 'Fuente: Base de datos de anime/manga',
      });
    }

    if (source === 'igdb') {
      detections.push({
        genre: 'gaming',
        confidence: 0.95,
        reasoning: 'Fuente: Base de datos de videojuegos',
      });
    }

    if (source === 'tmdb' || source === 'tvmaze') {
      detections.push({
        genre: 'friendship',
        confidence: 0.85,
        reasoning: 'Fuente: Películas y series de TV',
      });
    }

    // PRIORITY 2: Metadata-based detection
    // 1. Anime/Manga detection → Roleplay
    if (this.isAnimeCharacter(metadata)) {
      detections.push({
        genre: 'roleplay',
        confidence: 0.85,
        reasoning: 'Personaje de anime/manga detectado',
      });
    }

    // 2. Gaming detection
    if (this.isGameCharacter(metadata)) {
      detections.push({
        genre: 'gaming',
        confidence: 0.9,
        reasoning: 'Personaje de videojuego detectado',
      });
    }

    // 3. Professional/Real person detection
    if (this.isProfessional(result, metadata)) {
      detections.push({
        genre: 'professional',
        confidence: 0.8,
        reasoning: 'Persona profesional detectada',
      });
    }

    // PRIORITY 3: Description-based detection (lower confidence)
    // 4. Romance indicators
    if (this.hasRomanceIndicators(result, metadata)) {
      detections.push({
        genre: 'romance',
        confidence: 0.7,
        reasoning: 'Detectados elementos románticos en descripción',
      });
    }

    // 5. Friendship indicators
    if (this.hasFriendshipIndicators(result, metadata)) {
      detections.push({
        genre: 'friendship',
        confidence: 0.65,
        reasoning: 'Personaje con fuertes lazos de amistad',
      });
    }

    // 6. Wellness/Mentor detection
    if (this.isWellnessMentor(result, metadata)) {
      detections.push({
        genre: 'wellness',
        confidence: 0.75,
        reasoning: 'Personaje con rol de mentor o guía',
      });
    }

    // Sort by confidence
    detections.sort((a, b) => b.confidence - a.confidence);

    // Primary detection
    const primary = detections[0] || {
      genre: 'roleplay' as GenreId,
      confidence: 0.5,
      reasoning: 'Clasificación por defecto',
    };

    // Alternative genres (top 2-3)
    const alternatives = detections.slice(1, 3).map(d => ({
      genre: d.genre,
      confidence: d.confidence,
      reasoning: d.reasoning,
    }));

    return {
      genre: primary.genre,
      confidence: primary.confidence,
      reasoning: primary.reasoning,
      alternativeGenres: alternatives.length > 0 ? alternatives : undefined,
    };
  }

  /**
   * Detect from character name and description only
   */
  detectFromBasicInfo(name: string, description?: string): GenreDetectionResult {
    // Quick heuristics based on name/description
    const lowerName = name.toLowerCase();
    const lowerDesc = description?.toLowerCase() || '';

    // Anime character patterns
    if (this.hasAnimeNamePattern(lowerName) || lowerDesc.includes('anime')) {
      return {
        genre: 'roleplay',
        confidence: 0.7,
        reasoning: 'Patrón de nombre de anime detectado',
      };
    }

    // Professional titles in name
    if (this.hasProfessionalTitle(lowerName)) {
      return {
        genre: 'professional',
        confidence: 0.75,
        reasoning: 'Título profesional en nombre',
      };
    }

    // Default
    return {
      genre: 'roleplay',
      confidence: 0.5,
      reasoning: 'Clasificación por defecto (información limitada)',
    };
  }

  // ============================================================================
  // Detection helpers
  // ============================================================================

  private isAnimeCharacter(metadata: Record<string, unknown>): boolean {
    return !!(
      metadata.malId ||
      metadata.animeAppearances ||
      metadata.show?.toString().includes('anime') ||
      metadata.series
    );
  }

  private isGameCharacter(metadata: Record<string, unknown>): boolean {
    return !!(metadata.games || metadata.igdbId);
  }

  private isProfessional(result: SearchResult, metadata: Record<string, unknown>): boolean {
    // Wikipedia entries for real people
    if (metadata.wikipediaUrl && !this.isAnimeCharacter(metadata)) {
      return true;
    }

    return false;
  }

  private hasRomanceIndicators(result: SearchResult, _metadata: Record<string, unknown>): boolean {
    const description = result.description?.toLowerCase() || '';
    const romanceKeywords = [
      'love',
      'romance',
      'romantic',
      'heart',
      'relationship',
      'amor',
      'romántico',
      'corazón',
    ];

    return romanceKeywords.some(keyword => description.includes(keyword));
  }

  private hasFriendshipIndicators(result: SearchResult, _metadata: Record<string, unknown>): boolean {
    const description = result.description?.toLowerCase() || '';
    const friendshipKeywords = [
      'friend',
      'loyalty',
      'team',
      'companion',
      'amigo',
      'leal',
      'equipo',
    ];

    return friendshipKeywords.some(keyword => description.includes(keyword));
  }

  private isWellnessMentor(result: SearchResult, _metadata: Record<string, unknown>): boolean {
    const description = result.description?.toLowerCase() || '';

    const mentorKeywords = [
      'mentor',
      'teacher',
      'guide',
      'wise',
      'master',
      'sensei',
      'maestro',
      'sabio',
      'coach',
    ];

    return mentorKeywords.some(keyword => description.includes(keyword));
  }

  private hasAnimeNamePattern(name: string): boolean {
    // Common anime name patterns
    const patterns = [
      /uzumaki/i,
      /uchiha/i,
      /sensei/i,
      /chan$/i,
      /kun$/i,
      /sama$/i,
      /senpai/i,
    ];

    return patterns.some(pattern => pattern.test(name));
  }

  private hasProfessionalTitle(name: string): boolean {
    const titles = ['dr.', 'prof.', 'ceo', 'director', 'president', 'manager'];
    return titles.some(title => name.includes(title));
  }

  /**
   * Get suggested subgenre based on genre and character data
   */
  suggestSubgenre(
    genre: GenreId,
    result: SearchResult
  ): { subgenre: string; confidence: number } | null {
    const description = result.description?.toLowerCase() || '';

    switch (genre) {
      case 'romance':
        if (description.includes('caring') || description.includes('sweet')) {
          return { subgenre: 'emotional-connection', confidence: 0.7 };
        }
        break;

      case 'gaming':
        if (description.includes('competitive') || description.includes('pro')) {
          return { subgenre: 'competitive-play', confidence: 0.75 };
        }
        break;

      case 'professional':
        if (description.includes('career') || description.includes('professional')) {
          return { subgenre: 'career-mentor', confidence: 0.8 };
        }
        break;

      default:
        return null;
    }

    return null;
  }
}

// Singleton instance
let detectorInstance: GenreDetector | null = null;

export function getGenreDetector(): GenreDetector {
  if (!detectorInstance) {
    detectorInstance = new GenreDetector();
  }
  return detectorInstance;
}

export const genreDetector = getGenreDetector();
