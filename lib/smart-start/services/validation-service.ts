/**
 * Validation Service - Validates character drafts and ensures system compatibility
 * Checks emotional system compatibility, field requirements, and data quality
 */

import { GenreId, SubGenreId, ArchetypeId } from '../core/types';
import { CharacterDraft } from '@/types/character-creation';
import { getGenreService } from './genre-service';

export interface ValidationIssue {
  field: string;
  type: 'required' | 'min_length' | 'max_length' | 'format' | 'compatibility' | 'quality';
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  score: number; // 0-100 quality score
}

export class ValidationService {
  private genreService = getGenreService();

  /**
   * Validate complete character draft
   */
  validateCharacterDraft(draft: Partial<CharacterDraft>): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Required fields validation
    issues.push(...this.validateRequiredFields(draft));

    // Field-specific validation
    issues.push(...this.validateName(draft.name));
    issues.push(...this.validatePersonality(draft.personality));
    issues.push(...this.validateBackground(draft.backstory));
    issues.push(...this.validateSystemPrompt(draft.systemPrompt));
    issues.push(...this.validateGenreSelection(draft.genreId as GenreId | undefined, draft.subgenreId as SubGenreId | undefined, draft.archetypeId as ArchetypeId | undefined));

    // Emotional system compatibility
    issues.push(...this.validateEmotionalSystemCompatibility(draft));

    // Quality checks
    issues.push(...this.validateQuality(draft));

    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    return {
      valid: errors.length === 0,
      issues,
      warnings,
      errors,
      score: this.calculateQualityScore(draft, issues),
    };
  }

  /**
   * Validate required fields
   */
  private validateRequiredFields(draft: Partial<CharacterDraft>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!draft.name || draft.name.trim().length === 0) {
      issues.push({
        field: 'name',
        type: 'required',
        message: 'Character name is required',
        severity: 'error',
        suggestion: 'Provide a unique name for your character',
      });
    }

    if (!draft.systemPrompt || draft.systemPrompt.trim().length === 0) {
      issues.push({
        field: 'systemPrompt',
        type: 'required',
        message: 'System prompt is required',
        severity: 'error',
        suggestion: 'Use Smart Start to generate a system prompt',
      });
    }

    return issues;
  }

  /**
   * Validate name
   */
  private validateName(name?: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!name) return issues;

    const trimmed = name.trim();

    if (trimmed.length < 2) {
      issues.push({
        field: 'name',
        type: 'min_length',
        message: 'Name must be at least 2 characters',
        severity: 'error',
      });
    }

    if (trimmed.length > 100) {
      issues.push({
        field: 'name',
        type: 'max_length',
        message: 'Name must be less than 100 characters',
        severity: 'error',
      });
    }

    // Check for suspicious patterns
    if (/[<>{}[\]\\]/.test(trimmed)) {
      issues.push({
        field: 'name',
        type: 'format',
        message: 'Name contains invalid characters',
        severity: 'error',
      });
    }

    return issues;
  }

  /**
   * Validate personality (accepts both string and string[])
   */
  private validatePersonality(personality?: string | string[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!personality) {
      issues.push({
        field: 'personality',
        type: 'required',
        message: 'At least 3 personality traits are recommended',
        severity: 'warning',
        suggestion: 'Add personality traits to make the character more interesting',
      });
      return issues;
    }

    // Convert string to array for validation
    const personalityArray = Array.isArray(personality)
      ? personality
      : personality.split(',').map(t => t.trim()).filter(t => t.length > 0);

    if (personalityArray.length < 3) {
      issues.push({
        field: 'personality',
        type: 'min_length',
        message: 'At least 3 personality traits are recommended',
        severity: 'warning',
        suggestion: 'Add more traits for a well-rounded character',
      });
    }

    if (personalityArray.length > 15) {
      issues.push({
        field: 'personality',
        type: 'max_length',
        message: 'Too many personality traits (max 15)',
        severity: 'warning',
        suggestion: 'Focus on the most important traits',
      });
    }

    // Check for duplicate traits
    const unique = new Set(personalityArray.map(t => t.toLowerCase().trim()));
    if (unique.size < personalityArray.length) {
      issues.push({
        field: 'personality',
        type: 'quality',
        message: 'Duplicate personality traits detected',
        severity: 'info',
        suggestion: 'Remove duplicate traits',
      });
    }

    return issues;
  }

  /**
   * Validate backstory
   */
  private validateBackground(backstory?: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!backstory || backstory.trim().length === 0) {
      issues.push({
        field: 'backstory',
        type: 'required',
        message: 'Background story is recommended',
        severity: 'warning',
        suggestion: 'Add a brief backstory to give the character depth',
      });
      return issues;
    }

    const trimmed = backstory.trim();

    if (trimmed.length < 50) {
      issues.push({
        field: 'backstory',
        type: 'min_length',
        message: 'Background is too short (min 50 characters)',
        severity: 'warning',
        suggestion: 'Expand the backstory with more details',
      });
    }

    if (trimmed.length > 2000) {
      issues.push({
        field: 'backstory',
        type: 'max_length',
        message: 'Background is too long (max 2000 characters)',
        severity: 'warning',
        suggestion: 'Keep the background concise',
      });
    }

    return issues;
  }

  /**
   * Validate system prompt
   */
  private validateSystemPrompt(systemPrompt?: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!systemPrompt) return issues;

    const trimmed = systemPrompt.trim();

    if (trimmed.length < 100) {
      issues.push({
        field: 'systemPrompt',
        type: 'min_length',
        message: 'System prompt seems too short',
        severity: 'warning',
        suggestion: 'Use Smart Start templates for better prompts',
      });
    }

    if (trimmed.length > 10000) {
      issues.push({
        field: 'systemPrompt',
        type: 'max_length',
        message: 'System prompt is too long (max 10000 characters)',
        severity: 'error',
        suggestion: 'Reduce prompt length',
      });
    }

    // Check for common prompt issues
    if (!trimmed.includes('You are') && !trimmed.includes('Your name is')) {
      issues.push({
        field: 'systemPrompt',
        type: 'quality',
        message: 'Prompt should clearly define character identity',
        severity: 'info',
        suggestion: 'Start with "You are [character name]..."',
      });
    }

    return issues;
  }

  /**
   * Validate genre selection
   */
  private validateGenreSelection(
    genreId?: GenreId,
    subgenreId?: SubGenreId,
    archetypeId?: ArchetypeId
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!genreId) {
      issues.push({
        field: 'genreId',
        type: 'required',
        message: 'Genre selection is recommended',
        severity: 'warning',
        suggestion: 'Select a genre to get better suggestions',
      });
      return issues;
    }

    // Validate that the combination exists
    const isValid = this.genreService.validateCombination(genreId, subgenreId, archetypeId);

    if (!isValid) {
      issues.push({
        field: 'genre',
        type: 'compatibility',
        message: 'Invalid genre/subgenre/archetype combination',
        severity: 'error',
        suggestion: 'Select a valid combination from Smart Start',
      });
    }

    return issues;
  }

  /**
   * Validate emotional system compatibility
   */
  private validateEmotionalSystemCompatibility(draft: Partial<CharacterDraft>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!draft.genreId) return issues;

    const genre = this.genreService.getGenre(draft.genreId as GenreId);
    if (!genre) return issues;

    const emotionalProfile = genre.metadata?.emotionalProfile;
    if (!emotionalProfile) return issues;

    // Check if personality traits align with emotional profile
    if (draft.personality) {
      const personalityArray: string[] = Array.isArray(draft.personality)
        ? draft.personality
        : draft.personality.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);

      if (personalityArray.length > 0) {
        const hasCompatibleTraits = this.checkPersonalityCompatibility(
          personalityArray,
          emotionalProfile
        );

        if (!hasCompatibleTraits) {
          issues.push({
            field: 'personality',
            type: 'compatibility',
            message: `Personality traits may not align well with ${genre.name} genre`,
            severity: 'info',
            suggestion: `Consider traits that match ${genre.name} characteristics`,
          });
        }
      }
    }

    // Check response patterns
    if (draft.systemPrompt) {
      const hasEmotionalDepth = this.checkEmotionalDepth(draft.systemPrompt);

      if (!hasEmotionalDepth && genre.id === 'romance') {
        issues.push({
          field: 'systemPrompt',
          type: 'compatibility',
          message: 'System prompt lacks emotional depth for this genre',
          severity: 'info',
          suggestion: 'Add more emotional context to the prompt',
        });
      }
    }

    return issues;
  }

  /**
   * Check personality compatibility with emotional profile
   */
  private checkPersonalityCompatibility(
    personality: string[],
    emotionalProfile: any
  ): boolean {
    // This is a simplified check - could be more sophisticated
    const lowerTraits = personality.map(t => t.toLowerCase());

    // Romance should have emotional traits
    if (emotionalProfile.type === 'romance') {
      const emotionalTraits = [
        'caring',
        'affectionate',
        'passionate',
        'empathetic',
        'romantic',
        'loving',
      ];
      return lowerTraits.some(trait => emotionalTraits.some(et => trait.includes(et)));
    }

    // Gaming should have competitive/playful traits
    if (emotionalProfile.type === 'gaming') {
      const gamingTraits = [
        'competitive',
        'strategic',
        'determined',
        'playful',
        'skilled',
        'focused',
      ];
      return lowerTraits.some(trait => gamingTraits.some(gt => trait.includes(gt)));
    }

    // Professional should have competent traits
    if (emotionalProfile.type === 'professional') {
      const professionalTraits = [
        'professional',
        'knowledgeable',
        'expert',
        'reliable',
        'experienced',
      ];
      return lowerTraits.some(trait => professionalTraits.some(pt => trait.includes(pt)));
    }

    return true; // Default to compatible
  }

  /**
   * Check emotional depth in system prompt
   */
  private checkEmotionalDepth(systemPrompt: string): boolean {
    const emotionalKeywords = [
      'feel',
      'emotion',
      'heart',
      'care',
      'love',
      'passion',
      'express',
      'respond emotionally',
    ];

    const lower = systemPrompt.toLowerCase();
    return emotionalKeywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Validate overall quality
   */
  private validateQuality(draft: Partial<CharacterDraft>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for completeness
    const completeness = this.calculateCompleteness(draft);

    if (completeness < 0.5) {
      issues.push({
        field: 'overall',
        type: 'quality',
        message: 'Character profile is incomplete',
        severity: 'warning',
        suggestion: 'Fill in more fields for a better character',
      });
    }

    // Check for AI-generated content quality
    if (draft.aiGeneratedFields && draft.aiGeneratedFields.length > 0) {
      const aiQuality = this.checkAIGeneratedQuality(draft);

      if (!aiQuality.good) {
        issues.push({
          field: 'aiGenerated',
          type: 'quality',
          message: aiQuality.message,
          severity: 'info',
          suggestion: 'Review and edit AI-generated content',
        });
      }
    }

    return issues;
  }

  /**
   * Calculate completeness score (0-1)
   */
  private calculateCompleteness(draft: Partial<CharacterDraft>): number {
    let filled = 0;
    const total = 10;

    if (draft.name) filled++;
    if (draft.systemPrompt && draft.systemPrompt.length > 100) filled++;

    // Handle both string and array personality
    if (draft.personality) {
      const personalityArray: string[] = Array.isArray(draft.personality)
        ? draft.personality
        : draft.personality.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
      if (personalityArray.length >= 3) filled++;
    }

    if (draft.backstory && draft.backstory.length >= 50) filled++;
    if (draft.physicalAppearance) filled++;
    if (draft.age) filled++;
    if (draft.occupation) filled++;
    if (draft.genreId) filled++;
    if (draft.imageUrl) filled++;
    if (draft.communicationStyle) filled++;

    return filled / total;
  }

  /**
   * Check AI-generated content quality
   */
  private checkAIGeneratedQuality(draft: Partial<CharacterDraft>): {
    good: boolean;
    message: string;
  } {
    // Check for generic/placeholder content
    const genericPhrases = [
      'lorem ipsum',
      'placeholder',
      'example',
      'insert here',
      'to be determined',
    ];

    // Handle both string and array personality
    const personalityText = draft.personality
      ? Array.isArray(draft.personality)
        ? draft.personality.join(' ')
        : draft.personality
      : '';

    const allText = [
      draft.name,
      draft.backstory,
      draft.systemPrompt,
      personalityText,
    ].join(' ').toLowerCase();

    for (const phrase of genericPhrases) {
      if (allText.includes(phrase)) {
        return {
          good: false,
          message: 'AI-generated content contains placeholder text',
        };
      }
    }

    return { good: true, message: 'Quality OK' };
  }

  /**
   * Calculate overall quality score (0-100)
   */
  private calculateQualityScore(
    draft: Partial<CharacterDraft>,
    issues: ValidationIssue[]
  ): number {
    let score = 100;

    // Deduct for errors
    score -= issues.filter(i => i.severity === 'error').length * 20;

    // Deduct for warnings
    score -= issues.filter(i => i.severity === 'warning').length * 10;

    // Deduct for info issues
    score -= issues.filter(i => i.severity === 'info').length * 5;

    // Bonus for completeness
    const completeness = this.calculateCompleteness(draft);
    score += completeness * 20;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Validate single field
   */
  validateField(field: string, value: any): ValidationIssue[] {
    switch (field) {
      case 'name':
        return this.validateName(value);
      case 'personality':
        return this.validatePersonality(value);
      case 'backstory':
      case 'background': // Support legacy field name
        return this.validateBackground(value);
      case 'systemPrompt':
        return this.validateSystemPrompt(value);
      default:
        return [];
    }
  }
}

// Singleton instance
let validationServiceInstance: ValidationService | null = null;

export function getValidationService(): ValidationService {
  if (!validationServiceInstance) {
    validationServiceInstance = new ValidationService();
  }
  return validationServiceInstance;
}

export const validationService = getValidationService();
