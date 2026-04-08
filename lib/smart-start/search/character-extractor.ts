/**
 * Character Extractor - Extracts structured character data from search results
 * Uses AI to parse unstructured data into character profiles
 */

import { SearchResult } from '../core/types';
import { AIService, getAIService } from '../services/ai-service';

export interface ExtractedCharacter {
  name: string;
  alternateName?: string;
  personality: string[];
  background: string;
  appearance?: string;
  age?: string;
  gender?: string;
  occupation?: string;
  relationships?: string[];
  goals?: string[];
  quirks?: string[];
  communicationStyle?: string;
  catchphrases?: string[];
  likes?: string[];
  dislikes?: string[];
  skills?: string[];
  fears?: string[];
  metadata: {
    source: string;
    extractedFrom: string;
    confidence: number;
    hasStructuredData: boolean;
  };
}

export class CharacterExtractor {
  private aiService: AIService;

  constructor() {
    this.aiService = getAIService();
  }

  /**
   * Extract character profile from search result
   */
  async extract(searchResult: SearchResult, genreContext?: string): Promise<ExtractedCharacter> {
    // Check if we have structured data that can be directly mapped
    if (this.hasStructuredData(searchResult)) {
      return this.mapStructuredData(searchResult);
    }

    // Otherwise, use AI to extract from unstructured data
    return this.extractWithAI(searchResult, genreContext);
  }

  /**
   * Check if search result has sufficient structured data
   */
  private hasStructuredData(result: SearchResult): boolean {
    const metadata = result.metadata || {};

    // Need at least name and some character info
    return Boolean(
      result.name &&
        result.description &&
        (metadata.personality ||
          metadata.age ||
          metadata.occupation ||
          metadata.gender ||
          metadata.appearance)
    );
  }

  /**
   * Map structured data directly
   */
  private mapStructuredData(result: SearchResult): ExtractedCharacter {
    const metadata = result.metadata || {};
    const personality = this.extractPersonalityFromStructured(result);
    const background = this.extractBackgroundFromStructured(result);
    const appearance = metadata.appearance || this.extractAppearanceFromDescription(result);

    // Calculate confidence based on data completeness and quality
    const confidence = this.calculateConfidence({
      hasName: Boolean(result.name),
      hasDescription: Boolean(result.description) && (result.description?.length ?? 0) > 50,
      hasPersonality: personality.length >= 3,
      hasBackground: background.length > 100,
      hasAppearance: Boolean(appearance),
      hasAge: Boolean(metadata.age),
      hasGender: Boolean(metadata.gender),
      hasOccupation: Boolean(metadata.occupation || metadata.profession),
      hasRelationships: Array.isArray(metadata.relationships) && metadata.relationships.length > 0,
      hasGoals: Array.isArray(metadata.goals) && metadata.goals.length > 0,
      hasQuirks: Array.isArray(metadata.quirks) && metadata.quirks.length > 0,
      hasSkills: Array.isArray(metadata.skills) && metadata.skills.length > 0,
      descriptionLength: result.description?.length || 0,
      personalityCount: personality.length,
    });

    return {
      name: result.name,
      alternateName: result.alternateName,
      personality,
      background,
      appearance: typeof appearance === 'string' ? appearance : undefined,
      age: metadata.age ? String(metadata.age) : undefined,
      gender: typeof metadata.gender === 'string' ? metadata.gender : undefined,
      occupation: typeof (metadata.occupation || metadata.profession) === 'string' ? (metadata.occupation || metadata.profession) as string : undefined,
      relationships: Array.isArray(metadata.relationships) ? metadata.relationships.map(r => String(r)) : [],
      goals: Array.isArray(metadata.goals) ? metadata.goals.map(g => String(g)) : [],
      quirks: Array.isArray(metadata.quirks) ? metadata.quirks.map(q => String(q)) : [],
      communicationStyle: typeof metadata.communicationStyle === 'string' ? metadata.communicationStyle : undefined,
      catchphrases: Array.isArray(metadata.catchphrases) ? metadata.catchphrases.map(c => String(c)) : [],
      likes: Array.isArray(metadata.likes) ? metadata.likes.map(l => String(l)) : [],
      dislikes: Array.isArray(metadata.dislikes) ? metadata.dislikes.map(d => String(d)) : [],
      skills: Array.isArray(metadata.skills) ? metadata.skills.map(s => String(s)) : [],
      fears: Array.isArray(metadata.fears) ? metadata.fears.map(f => String(f)) : [],
      metadata: {
        source: result.source,
        extractedFrom: result.sourceUrl || result.id,
        confidence,
        hasStructuredData: true,
      },
    };
  }

  /**
   * Calculate confidence score based on data completeness and quality
   */
  private calculateConfidence(factors: {
    hasName: boolean;
    hasDescription: boolean;
    hasPersonality: boolean;
    hasBackground: boolean;
    hasAppearance: boolean;
    hasAge: boolean;
    hasGender: boolean;
    hasOccupation: boolean;
    hasRelationships: boolean;
    hasGoals: boolean;
    hasQuirks: boolean;
    hasSkills: boolean;
    descriptionLength: number;
    personalityCount: number;
  }): number {
    let score = 0;

    // Core fields (40% of total score)
    if (factors.hasName) score += 0.1;
    if (factors.hasDescription) score += 0.15;
    if (factors.hasPersonality) score += 0.15;

    // Important fields (30% of total score)
    if (factors.hasBackground) score += 0.1;
    if (factors.hasAppearance) score += 0.1;
    if (factors.hasOccupation) score += 0.1;

    // Supporting fields (20% of total score)
    if (factors.hasAge) score += 0.05;
    if (factors.hasGender) score += 0.05;
    if (factors.hasRelationships) score += 0.05;
    if (factors.hasGoals) score += 0.05;

    // Bonus fields (10% of total score)
    if (factors.hasQuirks) score += 0.03;
    if (factors.hasSkills) score += 0.03;

    // Quality bonuses (up to +0.1)
    if (factors.descriptionLength > 200) score += 0.05;
    if (factors.personalityCount >= 5) score += 0.05;

    // Penalties for poor quality
    if (factors.descriptionLength < 50) score -= 0.1;
    if (factors.personalityCount < 2) score -= 0.1;

    // Clamp between 0.2 and 1.0
    return Math.max(0.2, Math.min(1.0, score));
  }

  /**
   * Comprehensive personality descriptor database with synonyms and variations
   */
  private readonly PERSONALITY_DESCRIPTORS = {
    // Social traits
    social: {
      extroverted: ['extroverted', 'extrovert', 'outgoing', 'sociable', 'gregarious', 'social'],
      introverted: ['introverted', 'introvert', 'reserved', 'withdrawn', 'solitary', 'private'],
      charismatic: ['charismatic', 'charming', 'magnetic', 'captivating', 'alluring', 'enchanting'],
      friendly: ['friendly', 'warm', 'welcoming', 'approachable', 'amiable', 'cordial'],
      aloof: ['aloof', 'distant', 'detached', 'cold', 'standoffish', 'remote'],
    },
    // Emotional traits
    emotional: {
      passionate: ['passionate', 'fervent', 'ardent', 'intense', 'fiery', 'zealous'],
      calm: ['calm', 'composed', 'serene', 'tranquil', 'peaceful', 'collected'],
      emotional: ['emotional', 'sensitive', 'empathetic', 'feeling', 'sympathetic'],
      stoic: ['stoic', 'unemotional', 'impassive', 'unflappable', 'controlled'],
      optimistic: ['optimistic', 'hopeful', 'positive', 'upbeat', 'cheerful', 'bright'],
      pessimistic: ['pessimistic', 'cynical', 'negative', 'gloomy', 'doubtful', 'skeptical'],
      anxious: ['anxious', 'nervous', 'worried', 'apprehensive', 'tense', 'uneasy'],
    },
    // Behavioral traits
    behavioral: {
      energetic: ['energetic', 'active', 'dynamic', 'vigorous', 'lively', 'spirited'],
      lazy: ['lazy', 'idle', 'sluggish', 'lethargic', 'inactive', 'indolent'],
      adventurous: ['adventurous', 'daring', 'bold', 'fearless', 'audacious', 'venturesome'],
      cautious: ['cautious', 'careful', 'wary', 'prudent', 'circumspect', 'guarded'],
      impulsive: ['impulsive', 'spontaneous', 'rash', 'hasty', 'reckless', 'impetuous'],
      methodical: ['methodical', 'systematic', 'organized', 'meticulous', 'deliberate'],
      playful: ['playful', 'fun-loving', 'mischievous', 'lighthearted', 'whimsical'],
      serious: ['serious', 'grave', 'solemn', 'earnest', 'sober', 'stern'],
    },
    // Moral traits
    moral: {
      kind: ['kind', 'benevolent', 'compassionate', 'caring', 'gentle', 'tender'],
      cruel: ['cruel', 'ruthless', 'heartless', 'merciless', 'brutal', 'savage'],
      honest: ['honest', 'truthful', 'sincere', 'genuine', 'trustworthy', 'forthright'],
      deceitful: ['deceitful', 'dishonest', 'lying', 'manipulative', 'cunning', 'scheming'],
      loyal: ['loyal', 'faithful', 'devoted', 'dedicated', 'steadfast', 'true'],
      treacherous: ['treacherous', 'disloyal', 'unfaithful', 'traitorous', 'backstabbing'],
      just: ['just', 'fair', 'righteous', 'moral', 'ethical', 'principled'],
      corrupt: ['corrupt', 'immoral', 'unethical', 'dishonest', 'crooked'],
    },
    // Intellectual traits
    intellectual: {
      intelligent: ['intelligent', 'smart', 'clever', 'bright', 'brilliant', 'genius'],
      wise: ['wise', 'sage', 'insightful', 'perceptive', 'astute', 'shrewd'],
      creative: ['creative', 'imaginative', 'inventive', 'innovative', 'artistic', 'original'],
      analytical: ['analytical', 'logical', 'rational', 'systematic', 'methodical'],
      curious: ['curious', 'inquisitive', 'interested', 'questioning', 'probing'],
      ignorant: ['ignorant', 'naive', 'uninformed', 'unaware', 'clueless'],
      strategic: ['strategic', 'tactical', 'calculating', 'planning', 'shrewd'],
    },
    // Strength traits
    strength: {
      brave: ['brave', 'courageous', 'fearless', 'valiant', 'heroic', 'gallant', 'bold'],
      cowardly: ['cowardly', 'timid', 'fearful', 'afraid', 'scared', 'spineless'],
      confident: ['confident', 'self-assured', 'poised', 'assertive', 'bold', 'sure'],
      insecure: ['insecure', 'uncertain', 'doubtful', 'hesitant', 'self-conscious'],
      determined: ['determined', 'resolute', 'persistent', 'tenacious', 'steadfast'],
      "weak-willed": ['weak-willed', 'irresolute', 'indecisive', 'wavering', 'vacillating'],
      disciplined: ['disciplined', 'controlled', 'restrained', 'self-controlled'],
      undisciplined: ['undisciplined', 'uncontrolled', 'wild', 'unrestrained'],
    },
    // Leadership traits
    leadership: {
      leader: ['leader', 'commanding', 'authoritative', 'dominant', 'powerful'],
      follower: ['follower', 'submissive', 'obedient', 'compliant', 'subservient'],
      independent: ['independent', 'self-reliant', 'autonomous', 'self-sufficient'],
      dependent: ['dependent', 'reliant', 'needy', 'clinging'],
      ambitious: ['ambitious', 'driven', 'motivated', 'aspiring', 'goal-oriented'],
      humble: ['humble', 'modest', 'unassuming', 'meek', 'unpretentious'],
      arrogant: ['arrogant', 'proud', 'haughty', 'conceited', 'egotistical', 'vain'],
    },
    // Temperament traits
    temperament: {
      patient: ['patient', 'tolerant', 'forbearing', 'understanding', 'lenient'],
      impatient: ['impatient', 'restless', 'eager', 'hurried', 'hasty'],
      aggressive: ['aggressive', 'hostile', 'combative', 'belligerent', 'violent'],
      peaceful: ['peaceful', 'gentle', 'mild', 'non-violent', 'pacific'],
      stubborn: ['stubborn', 'obstinate', 'headstrong', 'inflexible', 'unyielding'],
      flexible: ['flexible', 'adaptable', 'versatile', 'accommodating', 'adjustable'],
      forgiving: ['forgiving', 'merciful', 'lenient', 'pardoning', 'compassionate'],
      vengeful: ['vengeful', 'vindictive', 'spiteful', 'retaliatory', 'unforgiving'],
    },
    // Relationship traits
    relationship: {
      romantic: ['romantic', 'loving', 'affectionate', 'tender', 'amorous', 'passionate'],
      protective: ['protective', 'guarding', 'defensive', 'watchful', 'sheltering'],
      jealous: ['jealous', 'envious', 'possessive', 'covetous', 'resentful'],
      supportive: ['supportive', 'encouraging', 'helpful', 'nurturing', 'caring'],
      competitive: ['competitive', 'rival', 'challenging', 'antagonistic'],
      cooperative: ['cooperative', 'collaborative', 'team-oriented', 'helpful'],
    },
    // Unique traits
    unique: {
      eccentric: ['eccentric', 'quirky', 'unusual', 'odd', 'peculiar', 'unconventional'],
      mysterious: ['mysterious', 'enigmatic', 'cryptic', 'secretive', 'elusive'],
      charming: ['charming', 'delightful', 'engaging', 'winning', 'appealing'],
      intimidating: ['intimidating', 'frightening', 'menacing', 'threatening', 'scary'],
      sophisticated: ['sophisticated', 'refined', 'cultured', 'elegant', 'polished'],
      rebellious: ['rebellious', 'defiant', 'disobedient', 'contrary', 'insurgent'],
    },
  };

  /**
   * Extract personality traits from structured data with improved matching
   */
  private extractPersonalityFromStructured(result: SearchResult): string[] {
    const metadata = result.metadata || {};

    // If we have explicit personality traits
    if (metadata.personality && Array.isArray(metadata.personality)) {
      return metadata.personality;
    }

    // Extract from description using comprehensive matching
    const description = result.description?.toLowerCase() || '';
    const matchedTraits = new Map<string, number>(); // trait -> confidence score

    // Search through all personality categories
    for (const category of Object.values(this.PERSONALITY_DESCRIPTORS)) {
      for (const [trait, synonyms] of Object.entries(category)) {
        let matchCount = 0;
        let exactMatch = false;

        // Check for exact word matches (highest confidence)
        for (const synonym of synonyms) {
          const regex = new RegExp(`\\b${synonym}\\b`, 'i');
          if (regex.test(description)) {
            matchCount++;
            if (synonym === trait) {
              exactMatch = true;
            }
          }
        }

        // Calculate confidence score for this trait
        if (matchCount > 0) {
          // Base score on number of synonym matches
          let score = matchCount * 0.3;

          // Bonus for exact trait name match
          if (exactMatch) score += 0.4;

          // Bonus for multiple synonym matches (stronger evidence)
          if (matchCount >= 2) score += 0.3;

          matchedTraits.set(trait, Math.min(score, 1.0));
        }
      }
    }

    // Sort by confidence and extract top traits
    const sortedTraits = Array.from(matchedTraits.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by confidence descending
      .map(([trait]) => trait);

    // Return top 5-7 traits if we found enough
    if (sortedTraits.length >= 3) {
      return sortedTraits.slice(0, 7);
    }

    // If not enough traits found, return generic ones with low confidence indicator
    const fallbackTraits = ['determined', 'capable', 'complex'];
    return [...sortedTraits, ...fallbackTraits].slice(0, 5);
  }

  /**
   * Extract background from structured data
   */
  private extractBackgroundFromStructured(result: SearchResult): string {
    const metadata = result.metadata || {};

    // If we have explicit background
    if (metadata.background && typeof metadata.background === 'string') {
      return metadata.background;
    }

    // Build from description and available metadata
    let background = result.description || '';

    // Enhance with metadata
    if (metadata.birthYear || metadata.birthday) {
      background += ` Born ${metadata.birthYear || metadata.birthday}.`;
    }

    if (metadata.occupation) {
      background += ` Works as ${metadata.occupation}.`;
    }

    if (metadata.franchise || metadata.series) {
      background += ` From ${metadata.franchise || metadata.series}.`;
    }

    // Limit to reasonable length
    return background.slice(0, 500).trim();
  }

  /**
   * Extract appearance from description
   */
  private extractAppearanceFromDescription(result: SearchResult): string | undefined {
    const description = result.description || '';

    // Look for appearance-related keywords
    const appearanceKeywords = [
      'hair',
      'eyes',
      'tall',
      'short',
      'wears',
      'appearance',
      'looks',
      'features',
    ];

    const sentences = description.split(/[.!?]+/);

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (appearanceKeywords.some(keyword => lower.includes(keyword))) {
        return sentence.trim();
      }
    }

    return undefined;
  }

  /**
   * Extract using AI for unstructured data
   */
  private async extractWithAI(
    result: SearchResult,
    genreContext?: string
  ): Promise<ExtractedCharacter> {
    try {
      const extracted = await this.aiService.extractCharacterFromSearchResult(
        result,
        genreContext
      );

      return {
        name: result.name,
        alternateName: result.alternateName,
        ...extracted,
        metadata: {
          source: result.source,
          extractedFrom: result.sourceUrl || result.id,
          confidence: result.confidence || 0.5, // Lower confidence for AI extraction
          hasStructuredData: false,
        },
      };
    } catch (error) {
      console.error('[CharacterExtractor] AI extraction failed:', error);

      // Fallback to basic extraction
      return this.extractBasicData(result);
    }
  }

  /**
   * Fallback basic extraction
   */
  private extractBasicData(result: SearchResult): ExtractedCharacter {
    return {
      name: result.name,
      alternateName: result.alternateName,
      personality: ['mysterious', 'interesting', 'unique'],
      background: result.description || 'A fascinating character with an intriguing story.',
      appearance: this.extractAppearanceFromDescription(result),
      metadata: {
        source: result.source,
        extractedFrom: result.sourceUrl || result.id,
        confidence: 0.3, // Low confidence for fallback
        hasStructuredData: false,
      },
    };
  }

  /**
   * Batch extract multiple characters
   */
  async extractBatch(
    results: SearchResult[],
    genreContext?: string
  ): Promise<ExtractedCharacter[]> {
    const extracted: ExtractedCharacter[] = [];

    for (const result of results) {
      try {
        const character = await this.extract(result, genreContext);
        extracted.push(character);
      } catch (error) {
        console.error(`[CharacterExtractor] Failed to extract ${result.name}:`, error);
        // Continue with others
      }
    }

    return extracted;
  }

  /**
   * Enhance extracted character with additional AI generation
   */
  async enhanceExtraction(character: ExtractedCharacter): Promise<ExtractedCharacter> {
    // If we already have good data, no need to enhance
    if (
      character.metadata.hasStructuredData &&
      character.personality.length >= 5 &&
      character.background.length > 100
    ) {
      return character;
    }

    try {
      // Use AI to fill in gaps
      const enhanced = await this.aiService.generateCharacter(
        character.name,
        'general',
        'balanced',
        `Existing data: ${JSON.stringify(character)}`
      );

      // Merge with existing data
      return {
        ...character,
        personality: enhanced.personality || character.personality,
        background: enhanced.background || character.background,
        appearance: enhanced.appearance || character.appearance,
        age: enhanced.age || character.age,
        occupation: enhanced.occupation || character.occupation,
        relationships: enhanced.relationships || character.relationships,
        goals: enhanced.goals || character.goals,
        quirks: enhanced.quirks || character.quirks,
        communicationStyle: enhanced.communicationStyle || character.communicationStyle,
        catchphrases: enhanced.catchphrases || character.catchphrases,
        likes: enhanced.likes || character.likes,
        dislikes: enhanced.dislikes || character.dislikes,
        skills: enhanced.skills || character.skills,
        fears: enhanced.fears || character.fears,
        metadata: {
          ...character.metadata,
          confidence: Math.min(character.metadata.confidence + 0.2, 1.0),
        },
      };
    } catch (error) {
      console.error('[CharacterExtractor] Enhancement failed:', error);
      return character;
    }
  }
}

// Singleton instance
let extractorInstance: CharacterExtractor | null = null;

export function getCharacterExtractor(): CharacterExtractor {
  if (!extractorInstance) {
    extractorInstance = new CharacterExtractor();
  }
  return extractorInstance;
}

export const characterExtractor = getCharacterExtractor();
