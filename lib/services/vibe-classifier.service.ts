/**
 * Vibe Classification Service
 * 100% deterministic rule-based system (NO LLM)
 * - Priority 1: Direct category mapping
 * - Priority 2: Keyword analysis
 * - Priority 3: personalityVariant heuristic
 */

import { VIBE_CONFIGS, type VibeType } from '@/lib/vibes/config';

export interface VibeClassificationResult {
  primary: VibeType;
  secondary?: VibeType;
  confidence: number;
  reasoning?: string;
}

export interface AgentToClassify {
  name: string;
  description?: string | null;
  personality?: string | null;
  personalityVariant?: string | null;
  categories?: string[];
}

// Category to vibe mapping (highest weight)
const CATEGORY_TO_VIBE_MAP: Record<string, VibeType> = {
  // Love and Connection
  'romance': 'love_connection',
  'romantic': 'love_connection',
  'love': 'love_connection',
  'sensual': 'love_connection',
  'passionate': 'love_connection',

  // Adventure
  'adventure': 'adventure',
  'explorer': 'adventure',
  'traveler': 'adventure',
  'bold': 'adventure',
  'daring': 'adventure',

  // Chaotic Energy
  'chaotic': 'chaotic_energy',
  'playful': 'chaotic_energy',
  'wild': 'chaotic_energy',
  'unpredictable': 'chaotic_energy',
  'funny': 'chaotic_energy',
  'comedian': 'chaotic_energy',

  // Comfort Zone
  'calm': 'comfort_zone',
  'peaceful': 'comfort_zone',
  'gentle': 'comfort_zone',
  'wise': 'comfort_zone',
  'philosopher': 'comfort_zone',
  'mentor': 'comfort_zone'
};

export class VibeClassifierService {
  /**
   * Classifies an agent using ONLY deterministic rules (NO LLM)
   * Faster, cheaper, more predictable
   */
  static async classifyAgent(agent: AgentToClassify): Promise<VibeClassificationResult> {
    // Purely rule-based classification system
    return this.ruleBasedClassification(agent);
  }


  /**
   * Classification based on deterministic rules
   * PRIORITY 1: Explicit categories
   * PRIORITY 2: Keywords in description/personality
   * PRIORITY 3: personalityVariant heuristic
   */
  private static ruleBasedClassification(agent: AgentToClassify): VibeClassificationResult {
    // PRIORITY 1: Check character categories
    const categoryVibe = this.getVibeFromCategories(agent.categories);
    if (categoryVibe) {
      return {
        primary: categoryVibe,
        confidence: 0.85,
        reasoning: 'Classification based on character categories'
      };
    }

    // PRIORITY 2: Keywords in text
    const text = `${agent.name} ${agent.description} ${agent.personality} ${agent.personalityVariant}`.toLowerCase();

    // Count matches per vibe
    const scores: Record<VibeType, number> = {
      chaotic_energy: 0,
      comfort_zone: 0,
      love_connection: 0,
      adventure: 0
    };

    Object.entries(VIBE_CONFIGS).forEach(([vibe, config]) => {
      config.keywords.forEach(keyword => {
        if (text.includes(keyword.toLowerCase())) {
          scores[vibe as VibeType]++;
        }
      });
    });

    // Sort by score
    const sortedVibes = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([vibe]) => vibe as VibeType);

    // If no matches, use personalityVariant heuristic
    let primary = sortedVibes[0];
    if (scores[primary] === 0) {
      primary = this.guessVibeByVariant(agent.personalityVariant);
    }

    const secondary = scores[sortedVibes[1]] > 0 ? sortedVibes[1] : undefined;
    const maxScore = scores[primary];
    const confidence = maxScore > 0 ? Math.min(0.3 + (maxScore * 0.1), 0.9) : 0.5;

    return {
      primary,
      secondary,
      confidence,
      reasoning: 'Fallback classification based on keywords'
    };
  }

  /**
   * Get vibe based on character categories
   */
  private static getVibeFromCategories(categories?: string[]): VibeType | null {
    if (!categories || categories.length === 0) return null;

    // Find first category with a direct mapping
    for (const category of categories) {
      const categoryLower = category.toLowerCase();
      if (CATEGORY_TO_VIBE_MAP[categoryLower]) {
        return CATEGORY_TO_VIBE_MAP[categoryLower];
      }
    }

    return null;
  }

  /**
   * Guess vibe by personalityVariant
   */
  private static guessVibeByVariant(variant?: string | null): VibeType {
    if (!variant) return 'comfort_zone';

    const variantLower = variant.toLowerCase();

    if (variantLower.includes('playful') || variantLower.includes('chaotic')) {
      return 'chaotic_energy';
    }
    if (variantLower.includes('romantic') || variantLower.includes('sensual')) {
      return 'love_connection';
    }
    if (variantLower.includes('extroverted') || variantLower.includes('adventurous')) {
      return 'adventure';
    }

    return 'comfort_zone'; // Default
  }

  /**
   * Classify multiple agents in batch
   */
  static async classifyBatch(
    agents: AgentToClassify[],
    onProgress?: (current: number, total: number) => void
  ): Promise<Map<string, VibeClassificationResult>> {
    const results = new Map<string, VibeClassificationResult>();

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];

      try {
        const result = await this.classifyAgent(agent);
        results.set(agent.name, result);

        if (onProgress) {
          onProgress(i + 1, agents.length);
        }

        // Small delay to avoid overwhelming the LLM
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error classifying ${agent.name}:`, error);
      }
    }

    return results;
  }
}
