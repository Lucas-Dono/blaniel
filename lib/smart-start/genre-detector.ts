/**
 * Archetype Detection System
 * Automatically detects the relational archetype for a character
 *
 * Archetyp defines the RELATIONSHIP between user and character, not the media type
 *
 * Strategy:
 * 1. Use context to inform archetype suggestions
 * 2. Use keyword heuristics on description
 * 3. Fallback to Gemini AI for ambiguous cases
 */

import { classifyWithGemini } from '@/lib/ai/gemini';
import type { GenreId } from '@circuitpromptai/smart-start-core';
import type { CharacterSearchResult } from '@/lib/profile/multi-source-character-search';
import type { ContextDetectionResult } from '@/lib/smart-start/context-detector';

// Available archetypes (relational, not media-based)
const AVAILABLE_ARCHETYPES: GenreId[] = [
  'romance',      // Romantic/intimate connection
  'friendship',   // Platonic companionship
  'professional', // Learning/guidance/Work/productivity
  'roleplay',     // Narrative/storytelling
  'wellness',     // Mental health/self-care
];

interface GenreDetectionResult {
  genre: GenreId;
  confidence: number; // 0-1
  method: 'metadata' | 'heuristic' | 'ai' | 'unknown';
}

/**
 * Suggest archetype based on detected context
 * Context informs what type of relationship user likely wants
 */
function suggestFromContext(context: ContextDetectionResult): GenreDetectionResult | null {
  if (!context) return null;

  const { category, subcategory } = context;

  // Historical figures - likely mentor/learning relationship
  if (category === 'historical') {
    if (subcategory === 'scientist' || subcategory === 'writer' || subcategory === 'philosopher') {
      return {
        genre: 'professional', // mentor archetype
        confidence: 0.85,
        method: 'metadata',
      };
    }
    if (subcategory === 'artist' || subcategory === 'performer') {
      // Performers like Marilyn could be romance or friendship
      return {
        genre: 'friendship', // or romance, but friendship safer default
        confidence: 0.7,
        method: 'metadata',
      };
    }
    if (subcategory === 'leader') {
      return {
        genre: 'professional', // mentor/professional
        confidence: 0.8,
        method: 'metadata',
      };
    }
  }

  // Cultural icons - varies by subcategory
  if (category === 'cultural-icon') {
    if (subcategory === 'celebrity' || subcategory === 'musician') {
      return {
        genre: 'friendship', // or romance
        confidence: 0.75,
        method: 'metadata',
      };
    }
    if (subcategory === 'influencer') {
      return {
        genre: 'friendship',
        confidence: 0.8,
        method: 'metadata',
      };
    }
    if (subcategory === 'public-figure') {
      return {
        genre: 'professional',
        confidence: 0.75,
        method: 'metadata',
      };
    }
  }

  // Fictional characters - roleplay most common
  if (category === 'fictional') {
    return {
      genre: 'roleplay', // fictional characters = roleplay
      confidence: 0.85,
      method: 'metadata',
    };
  }

  // Real people - depends on subcategory
  if (category === 'real-person') {
    if (subcategory === 'crush') {
      return {
        genre: 'romance',
        confidence: 0.9,
        method: 'metadata',
      };
    }
    if (subcategory === 'friend') {
      return {
        genre: 'friendship',
        confidence: 0.9,
        method: 'metadata',
      };
    }
    if (subcategory === 'colleague') {
      return {
        genre: 'professional',
        confidence: 0.85,
        method: 'metadata',
      };
    }
    if (subcategory === 'family') {
      return {
        genre: 'friendship', // family = platonic
        confidence: 0.8,
        method: 'metadata',
      };
    }
  }

  // Original creation - roleplay default
  if (category === 'original') {
    return {
      genre: 'roleplay',
      confidence: 0.8,
      method: 'metadata',
    };
  }

  return null;
}

/**
 * Detect archetype using keyword heuristics
 * Looks for relationship/dynamic indicators in text
 */
function detectFromHeuristics(character: CharacterSearchResult): GenreDetectionResult | null {
  const text = `${character.name} ${character.description}`.toLowerCase();

  // Romance keywords (romantic/intimate relationship)
  if (
    text.includes('romance') ||
    text.includes('romantic') ||
    text.includes('dating') ||
    text.includes('lover') ||
    text.includes('girlfriend') ||
    text.includes('boyfriend') ||
    text.includes('crush') ||
    text.includes('love interest') ||
    text.includes('passionate') ||
    text.includes('intimate')
  ) {
    return { genre: 'romance', confidence: 0.85, method: 'heuristic' };
  }

  // Friendship keywords (platonic companionship)
  if (
    text.includes('friend') ||
    text.includes('companion') ||
    text.includes('buddy') ||
    text.includes('pal') ||
    text.includes('supportive') ||
    text.includes('confidant') ||
    text.includes('platonic')
  ) {
    return { genre: 'friendship', confidence: 0.8, method: 'heuristic' };
  }

  // Mentor/Professional keywords (learning, guidance, work)
  if (
    text.includes('mentor') ||
    text.includes('teacher') ||
    text.includes('guide') ||
    text.includes('coach') ||
    text.includes('advisor') ||
    text.includes('therapist') ||
    text.includes('counselor') ||
    text.includes('professional') ||
    text.includes('business') ||
    text.includes('career') ||
    text.includes('expert')
  ) {
    return { genre: 'professional', confidence: 0.8, method: 'heuristic' };
  }

  // Roleplay keywords (narrative, storytelling)
  if (
    text.includes('roleplay') ||
    text.includes('role play') ||
    text.includes('rp') ||
    text.includes('adventure') ||
    text.includes('quest') ||
    text.includes('story') ||
    text.includes('narrative') ||
    text.includes('fantasy setting') ||
    text.includes('fictional world')
  ) {
    return { genre: 'roleplay', confidence: 0.75, method: 'heuristic' };
  }

  // Wellness keywords (mental health, self-care)
  if (
    text.includes('wellness') ||
    text.includes('mindfulness') ||
    text.includes('meditation') ||
    text.includes('self-care') ||
    text.includes('mental health') ||
    text.includes('therapeutic') ||
    text.includes('healing') ||
    text.includes('motivational')
  ) {
    return { genre: 'wellness', confidence: 0.8, method: 'heuristic' };
  }

  return null;
}

/**
 * Detect archetype using Gemini AI
 */
async function detectWithAI(character: CharacterSearchResult): Promise<GenreDetectionResult | null> {
  try {
    const context = `You are determining the best RELATIONSHIP archetype for a character.
Character: ${character.name}
Description: ${character.description}

Archetypes (relationship types):
- romance: Romantic/intimate connection
- friendship: Platonic companionship and support
- professional: Learning, mentorship, work, career guidance
- roleplay: Narrative storytelling and adventure
- wellness: Mental health, self-care, therapeutic support

Choose the MOST appropriate archetype for how a user would likely interact with this character.`;

    const archetypeStr = await classifyWithGemini(
      `${character.name}: ${character.description}`,
      AVAILABLE_ARCHETYPES,
      context
    );

    if (archetypeStr && AVAILABLE_ARCHETYPES.includes(archetypeStr as GenreId)) {
      return {
        genre: archetypeStr as GenreId,
        confidence: 0.85,
        method: 'ai',
      };
    }

    return null;
  } catch (error) {
    console.error('[ArchetypeDetector] AI detection error:', error);
    return null;
  }
}

/**
 * Main archetype detection function
 * Uses context → heuristics → AI cascade
 *
 * @param character - The character to detect archetype for
 * @param context - Optional context detection result to inform suggestions
 * @param options - Detection options
 */
export async function detectGenre(
  character: CharacterSearchResult,
  context?: ContextDetectionResult | null,
  options: {
    useAI?: boolean; // Default: true
    minConfidence?: number; // Minimum confidence to use AI (default: 0.7)
  } = {}
): Promise<GenreDetectionResult> {
  const { useAI = true, minConfidence = 0.7 } = options;

  console.log(`[ArchetypeDetector] Detecting archetype for: ${character.name}`);

  // 1. Try context-based suggestion (highest priority if confidence is high)
  if (context) {
    const contextResult = suggestFromContext(context);
    if (contextResult && contextResult.confidence >= 0.85) {
      console.log(`[ArchetypeDetector] ✅ Context: ${contextResult.genre} (${contextResult.confidence})`);
      return contextResult;
    }
  }

  // 2. Try heuristics (keyword-based)
  const heuristicResult = detectFromHeuristics(character);
  if (heuristicResult && heuristicResult.confidence >= minConfidence) {
    console.log(`[ArchetypeDetector] ✅ Heuristic: ${heuristicResult.genre} (${heuristicResult.confidence})`);
    return heuristicResult;
  }

  // 3. Try context-based suggestion again with lower threshold
  if (context) {
    const contextResult = suggestFromContext(context);
    if (contextResult && contextResult.confidence >= 0.6) {
      console.log(`[ArchetypeDetector] ✅ Context (lower threshold): ${contextResult.genre} (${contextResult.confidence})`);
      return contextResult;
    }
  }

  // 4. Try AI if enabled and previous methods had low confidence
  if (useAI) {
    console.log('[ArchetypeDetector] 🤖 Using AI detection...');
    const aiResult = await detectWithAI(character);
    if (aiResult) {
      console.log(`[ArchetypeDetector] ✅ AI: ${aiResult.genre} (${aiResult.confidence})`);
      return aiResult;
    }
  }

  // 5. Fallback to best guess or 'friendship' (most generic/safe)
  const fallback = heuristicResult || (context && suggestFromContext(context)) || {
    genre: 'friendship' as GenreId, // friendship is safest default
    confidence: 0.4,
    method: 'unknown' as const,
  };

  console.log(`[ArchetypeDetector] ⚠️  Fallback: ${fallback.genre} (${fallback.confidence})`);
  return fallback;
}
