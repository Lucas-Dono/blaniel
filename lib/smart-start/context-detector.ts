/**
 * Context Detection System
 * Automatically detects the context/nature of a character
 *
 * Strategy:
 * 1. Check source metadata (Wikipedia person vs character, source type)
 * 2. Use keyword heuristics on name and description
 * 3. Fallback to Gemini AI for ambiguous cases
 */

import { classifyWithGemini } from '@/lib/ai/gemini';
import type { CharacterSearchResult } from '@/lib/profile/multi-source-character-search';

// Context categories
export type ContextCategory =
  | 'historical'      // Historical figures (pre-2000)
  | 'cultural-icon'   // Contemporary celebrities/public figures
  | 'fictional'       // Fictional characters from media
  | 'real-person'     // Real contemporary people (not famous)
  | 'original';       // Original creations

// Context subcategories
export type ContextSubcategory = string;

export interface ContextDetectionResult {
  category: ContextCategory;
  subcategory: ContextSubcategory;
  confidence: number; // 0-1
  method: 'metadata' | 'heuristic' | 'ai' | 'unknown';
  occupation?: string;
  era?: string; // e.g., "1950s", "Contemporary", "Medieval"
  reasoning?: string; // Why this context was chosen
}

/**
 * Detect context from source metadata
 */
function detectFromMetadata(character: CharacterSearchResult): ContextDetectionResult | null {
  // Jikan / AniList = anime (fictional)
  if (character.source === 'jikan' || character.source === 'anilist' || character.source === 'mal') {
    return {
      category: 'fictional',
      subcategory: 'anime',
      confidence: 1.0,
      method: 'metadata',
      era: 'Various',
    };
  }

  // TMDB / TV database = movies/tv (fictional)
  if (character.source === 'tmdb' || character.source === 'tvmaze') {
    return {
      category: 'fictional',
      subcategory: 'movies', // or tv - would need more info
      confidence: 0.95,
      method: 'metadata',
      era: 'Various',
    };
  }

  // IGDB / game databases = video games (fictional)
  if (character.source === 'igdb') {
    return {
      category: 'fictional',
      subcategory: 'games',
      confidence: 0.95,
      method: 'metadata',
      era: 'Various',
    };
  }

  // Wikipedia requires more analysis (could be historical, cultural icon, or fictional)
  if (character.source === 'wikipedia' && character.url) {
    const url = character.url.toLowerCase();

    // Check for fictional character indicators in URL
    if (url.includes('character') || url.includes('fictional')) {
      return {
        category: 'fictional',
        subcategory: 'literature', // or other media
        confidence: 0.85,
        method: 'metadata',
      };
    }

    // Otherwise Wikipedia is likely a real person - check description for era
    // (will be determined by heuristics)
  }

  // Fandom wikis - check domain for genre
  if (character.source === 'fandom' && character.url) {
    const url = character.url.toLowerCase();

    // Anime/manga wikis
    if (url.includes('naruto') || url.includes('onepiece') || url.includes('dragonball') ||
        url.includes('anime') || url.includes('manga')) {
      return {
        category: 'fictional',
        subcategory: 'anime',
        confidence: 0.95,
        method: 'metadata',
        era: 'Various',
      };
    }

    // Game wikis
    if (url.includes('pokemon') || url.includes('zelda') || url.includes('minecraft') ||
        url.includes('game')) {
      return {
        category: 'fictional',
        subcategory: 'games',
        confidence: 0.95,
        method: 'metadata',
        era: 'Various',
      };
    }

    // Fantasy/Books wikis
    if (url.includes('lotr') || url.includes('harrypotter') || url.includes('gameofthrones')) {
      return {
        category: 'fictional',
        subcategory: 'literature',
        confidence: 0.9,
        method: 'metadata',
        era: 'Fantasy',
      };
    }

    // Movie wikis
    if (url.includes('starwars') || url.includes('startrek') || url.includes('marvel') ||
        url.includes('mcu') || url.includes('dc')) {
      return {
        category: 'fictional',
        subcategory: 'movies',
        confidence: 0.9,
        method: 'metadata',
        era: 'Various',
      };
    }
  }

  return null;
}

/**
 * Detect context using keyword heuristics
 */
function detectFromHeuristics(character: CharacterSearchResult): ContextDetectionResult | null {
  const text = `${character.name} ${character.description}`.toLowerCase();

  // Historical Figure Detection (pre-2000, historical keywords)
  const historicalPattern = /\b(1[0-9]{3}|18\d{2}|19\d{2})\b/; // Years 1000-1999
  const hasHistoricalDate = historicalPattern.test(text);

  const historicalKeywords = [
    'historical', 'born', 'died', 'century', 'era', 'reign',
    'ancient', 'medieval', 'renaissance', 'revolutionary'
  ];
  const hasHistoricalKeywords = historicalKeywords.some(kw => text.includes(kw));

  if (hasHistoricalDate || hasHistoricalKeywords) {
    // Determine occupation/subcategory
    let subcategory = 'other';
    let occupation = '';

    if (text.includes('scientist') || text.includes('physicist') || text.includes('chemist') ||
        text.includes('inventor') || text.includes('mathematician')) {
      subcategory = 'scientist';
      occupation = 'Scientist/Inventor';
    } else if (text.includes('artist') || text.includes('painter') || text.includes('musician') ||
               text.includes('composer') || text.includes('actor') || text.includes('actress') ||
               text.includes('performer') || text.includes('singer')) {
      subcategory = 'artist';
      occupation = 'Artist/Performer';
    } else if (text.includes('leader') || text.includes('president') || text.includes('king') ||
               text.includes('queen') || text.includes('emperor') || text.includes('activist') ||
               text.includes('revolutionary') || text.includes('politician')) {
      subcategory = 'leader';
      occupation = 'Leader/Activist';
    } else if (text.includes('writer') || text.includes('author') || text.includes('poet') ||
               text.includes('philosopher') || text.includes('novelist')) {
      subcategory = 'writer';
      occupation = 'Writer/Philosopher';
    } else if (text.includes('explorer') || text.includes('adventurer') || text.includes('navigator')) {
      subcategory = 'explorer';
      occupation = 'Explorer/Adventurer';
    }

    // Extract era if possible
    const yearMatch = text.match(/\b(1[0-9]{3}|18\d{2}|19\d{2})\b/);
    const era = yearMatch ? `${yearMatch[0]}s` : 'Historical';

    return {
      category: 'historical',
      subcategory,
      confidence: hasHistoricalDate ? 0.9 : 0.75,
      method: 'heuristic',
      occupation,
      era,
      reasoning: hasHistoricalDate ? 'Historical date detected' : 'Historical keywords detected',
    };
  }

  // Cultural Icon Detection (contemporary celebrity)
  const culturalIconKeywords = [
    'celebrity', 'famous', 'star', 'icon', 'influencer', 'youtuber', 'streamer',
    'model', 'supermodel', 'athlete', 'sports', 'public figure', 'ceo', 'entrepreneur'
  ];
  const hasCulturalKeywords = culturalIconKeywords.some(kw => text.includes(kw));

  // Check for contemporary indicators
  const contemporaryPattern = /\b(20[0-2]\d)\b/; // Years 2000-2029
  const hasContemporaryDate = contemporaryPattern.test(text);

  const contemporaryKeywords = ['current', 'contemporary', 'modern', 'today', 'recent'];
  const hasContemporaryKeywords = contemporaryKeywords.some(kw => text.includes(kw));

  if (hasCulturalKeywords || (hasContemporaryDate && (text.includes('actor') || text.includes('singer')))) {
    let subcategory = 'celebrity';
    let occupation = '';

    if (text.includes('actor') || text.includes('actress') || text.includes('celebrity')) {
      subcategory = 'celebrity';
      occupation = 'Celebrity/Actor';
    } else if (text.includes('musician') || text.includes('singer') || text.includes('artist') ||
               text.includes('rapper') || text.includes('composer')) {
      subcategory = 'musician';
      occupation = 'Musician/Artist';
    } else if (text.includes('influencer') || text.includes('youtuber') || text.includes('streamer') ||
               text.includes('creator') || text.includes('content creator')) {
      subcategory = 'influencer';
      occupation = 'Influencer/Creator';
    } else if (text.includes('athlete') || text.includes('sports') || text.includes('player') ||
               text.includes('champion')) {
      subcategory = 'athlete';
      occupation = 'Athlete';
    } else if (text.includes('ceo') || text.includes('entrepreneur') || text.includes('founder') ||
               text.includes('politician') || text.includes('activist')) {
      subcategory = 'public-figure';
      occupation = 'Public Figure/Leader';
    }

    return {
      category: 'cultural-icon',
      subcategory,
      confidence: 0.85,
      method: 'heuristic',
      occupation,
      era: 'Contemporary',
      reasoning: 'Contemporary celebrity/public figure indicators detected',
    };
  }

  // Fictional Character Detection
  const fictionalKeywords = [
    'character', 'fictional', 'protagonist', 'antagonist', 'hero', 'villain',
    'anime', 'manga', 'game character', 'video game', 'novel', 'book', 'series',
    'movie', 'film', 'tv show', 'comic', 'superhero'
  ];
  const hasFictionalKeywords = fictionalKeywords.some(kw => text.includes(kw));

  if (hasFictionalKeywords) {
    let subcategory = 'other';

    if (text.includes('anime') || text.includes('manga') || text.includes('japanese animation')) {
      subcategory = 'anime';
    } else if (text.includes('video game') || text.includes('game character') || text.includes('gamer') ||
               text.includes('playstation') || text.includes('nintendo') || text.includes('xbox')) {
      subcategory = 'games';
    } else if (text.includes('movie') || text.includes('film')) {
      subcategory = 'movies';
    } else if (text.includes('tv show') || text.includes('television') || text.includes('series')) {
      subcategory = 'tv';
    } else if (text.includes('novel') || text.includes('book') || text.includes('literature')) {
      subcategory = 'literature';
    } else if (text.includes('comic') || text.includes('superhero') || text.includes('marvel') || text.includes('dc')) {
      subcategory = 'comics';
    }

    return {
      category: 'fictional',
      subcategory,
      confidence: 0.8,
      method: 'heuristic',
      era: 'Various',
      reasoning: 'Fictional character keywords detected',
    };
  }

  // Real Person Detection (contemporary, not famous)
  const realPersonKeywords = [
    'friend', 'person i know', 'someone i met', 'acquaintance', 'classmate',
    'colleague', 'coworker', 'neighbor', 'family member'
  ];
  const hasRealPersonKeywords = realPersonKeywords.some(kw => text.includes(kw));

  if (hasRealPersonKeywords || (hasContemporaryKeywords && !hasCulturalKeywords && !hasFictionalKeywords)) {
    let subcategory = 'friend';

    if (text.includes('crush') || text.includes('love interest') || text.includes('romantic interest')) {
      subcategory = 'crush';
    } else if (text.includes('family') || text.includes('relative') || text.includes('parent') ||
               text.includes('sibling')) {
      subcategory = 'family';
    } else if (text.includes('colleague') || text.includes('coworker') || text.includes('classmate')) {
      subcategory = 'colleague';
    }

    return {
      category: 'real-person',
      subcategory,
      confidence: 0.7,
      method: 'heuristic',
      era: 'Contemporary',
      reasoning: 'Real person keywords detected',
    };
  }

  // Original Creation Detection
  const originalKeywords = [
    'original character', 'oc', 'my character', 'roleplay character', 'custom',
    'fantasy character', 'sci-fi character', 'original creation'
  ];
  const hasOriginalKeywords = originalKeywords.some(kw => text.includes(kw));

  if (hasOriginalKeywords) {
    let subcategory = 'modern';

    if (text.includes('fantasy') || text.includes('medieval') || text.includes('magic') ||
        text.includes('dragon')) {
      subcategory = 'fantasy';
    } else if (text.includes('sci-fi') || text.includes('futuristic') || text.includes('space') ||
               text.includes('cyberpunk')) {
      subcategory = 'sci-fi';
    } else if (text.includes('vampire') || text.includes('werewolf') || text.includes('supernatural')) {
      subcategory = 'supernatural';
    } else if (historicalPattern.test(text)) {
      subcategory = 'historical-setting';
    }

    return {
      category: 'original',
      subcategory,
      confidence: 0.75,
      method: 'heuristic',
      reasoning: 'Original creation keywords detected',
    };
  }

  return null;
}

/**
 * Detect context using Gemini AI
 */
async function detectWithAI(character: CharacterSearchResult): Promise<ContextDetectionResult | null> {
  try {
    const categories = ['historical', 'cultural-icon', 'fictional', 'real-person', 'original'];

    const context = `You are classifying a character's context/nature.
Character: ${character.name}
Description: ${character.description}

Categories:
- historical: Historical figures from before 2000 (scientists, artists, leaders, etc.)
- cultural-icon: Contemporary celebrities, influencers, public figures
- fictional: Characters from media (anime, movies, TV, games, books)
- real-person: Real contemporary people who aren't famous (friends, acquaintances)
- original: Original character creations

Choose the MOST appropriate category.`;

    const categoryStr = await classifyWithGemini(
      `${character.name}: ${character.description}`,
      categories,
      context
    );

    if (categoryStr && categories.includes(categoryStr)) {
      return {
        category: categoryStr as ContextCategory,
        subcategory: 'other', // AI doesn't determine subcategory
        confidence: 0.85,
        method: 'ai',
        reasoning: 'AI classification',
      };
    }

    return null;
  } catch (error) {
    console.error('[ContextDetector] AI detection error:', error);
    return null;
  }
}

/**
 * Main context detection function
 * Uses metadata → heuristics → AI cascade
 */
export async function detectContext(
  character: CharacterSearchResult,
  options: {
    useAI?: boolean;
    minConfidence?: number;
  } = {}
): Promise<ContextDetectionResult> {
  const { useAI = true, minConfidence = 0.7 } = options;

  console.log(`[ContextDetector] Detecting context for: ${character.name}`);

  // 1. Try metadata
  const metadataResult = detectFromMetadata(character);
  if (metadataResult && metadataResult.confidence >= 0.9) {
    console.log(`[ContextDetector] ✅ Metadata: ${metadataResult.category} / ${metadataResult.subcategory} (${metadataResult.confidence})`);
    return metadataResult;
  }

  // 2. Try heuristics
  const heuristicResult = detectFromHeuristics(character);
  if (heuristicResult && heuristicResult.confidence >= minConfidence) {
    console.log(`[ContextDetector] ✅ Heuristic: ${heuristicResult.category} / ${heuristicResult.subcategory} (${heuristicResult.confidence})`);
    return heuristicResult;
  }

  // 3. Try AI if enabled and previous methods had low confidence
  if (useAI) {
    console.log('[ContextDetector] �� Using AI detection...');
    const aiResult = await detectWithAI(character);
    if (aiResult) {
      console.log(`[ContextDetector] ✅ AI: ${aiResult.category} / ${aiResult.subcategory} (${aiResult.confidence})`);
      return aiResult;
    }
  }

  // 4. Fallback to best guess or 'original' (most generic)
  const fallback = heuristicResult || metadataResult || {
    category: 'original' as ContextCategory,
    subcategory: 'modern',
    confidence: 0.3,
    method: 'unknown' as const,
    reasoning: 'No clear indicators detected',
  };

  console.log(`[ContextDetector] ⚠️  Fallback: ${fallback.category} / ${fallback.subcategory} (${fallback.confidence})`);
  return fallback;
}
