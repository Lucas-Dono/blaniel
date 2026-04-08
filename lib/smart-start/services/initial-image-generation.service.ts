/**
 * Initial Image Generation Service
 *
 * Generates initial character images for Smart Start:
 * - Avatar (profile photo - portrait/close-up)
 * - Reference Image (full-body photo)
 *
 * Uses Venice AI with tier-based MODELS (no diferencia en resolución):
 * - FREE: z-image-turbo ($0.01/imagen) - Buena calidad
 * - PLUS/ULTRA: imagineart-1.5-pro ($0.05/imagen) - Realismo superior, mejor manejo de luces
 *
 * La diferencia está en el modelo, no en parámetros técnicos.
 */

import { getVeniceClient } from '@/lib/emotional-system/llm/venice';
import type { GenderType } from '@/types/character-creation';

export interface GenerateInitialImagesParams {
  /** Character name */
  name: string;

  /** Character gender */
  gender: GenderType;

  /** Physical appearance description */
  physicalAppearance?: string;

  /** Character age */
  age?: number;

  /** Personality description (for facial expression) */
  personality?: string;

  /** Style preference */
  style?: 'realistic' | 'anime' | 'semi-realistic';

  /** Whether to allow NSFW content */
  nsfw?: boolean;

  /** User tier (affects quality) */
  userTier?: 'FREE' | 'PLUS' | 'ULTRA';
}

export interface InitialImagesResult {
  /** Avatar URL (portrait) */
  avatarUrl: string;

  /** Full-body reference image URL */
  referenceImageUrl: string;

  /** Generation metadata */
  metadata: {
    generationTime: number;
    cost: number;
    model: string;
  };
}

export class InitialImageGenerationService {
  private veniceClient = getVeniceClient();

  /**
   * Generate both avatar and reference image for a character
   */
  async generateBothImages(params: GenerateInitialImagesParams): Promise<InitialImagesResult> {
    console.log('[InitialImageGen] Starting generation for:', params.name);
    const startTime = Date.now();

    // Generate both images in parallel for speed
    const [avatarResult, referenceResult] = await Promise.all([
      this.generateAvatar(params),
      this.generateFullBody(params),
    ]);

    const generationTime = (Date.now() - startTime) / 1000;

    // Calculate cost based on tier
    const costPerImage = params.userTier === 'FREE' ? 0.01 : 0.05;
    const totalCost = costPerImage * 2; // 2 imágenes

    const model = params.userTier === 'FREE' ? 'z-image-turbo' : 'imagineart-1.5-pro';

    console.log(`[InitialImageGen] ✅ Both images generated in ${generationTime}s (${model}, $${totalCost})`);

    return {
      avatarUrl: avatarResult.imageUrl,
      referenceImageUrl: referenceResult.imageUrl,
      metadata: {
        generationTime,
        cost: totalCost,
        model,
      },
    };
  }

  /**
   * Generate only avatar (portrait)
   */
  async generateAvatarOnly(params: GenerateInitialImagesParams): Promise<string> {
    console.log('[InitialImageGen] Generating avatar only for:', params.name);

    const result = await this.generateAvatar(params);
    return result.imageUrl;
  }

  /**
   * Generate only full-body reference image
   */
  async generateFullBodyOnly(params: GenerateInitialImagesParams): Promise<string> {
    console.log('[InitialImageGen] Generating full-body only for:', params.name);

    const result = await this.generateFullBody(params);
    return result.imageUrl;
  }

  /**
   * Generate avatar (close-up portrait)
   *
   * La diferencia de calidad viene del MODELO (z-image-turbo vs imagineart-1.5-pro),
   * no de parámetros artificiales como resolución o quality flag.
   */
  private async generateAvatar(params: GenerateInitialImagesParams) {
    const prompt = this.buildAvatarPrompt(params);
    const negativePrompt = this.buildNegativePrompt(params.style || 'realistic');

    console.log('[InitialImageGen] Avatar prompt:', prompt);

    // Mapear tier a formato de Venice
    const userTier = (params.userTier || 'FREE').toLowerCase() as 'free' | 'plus' | 'ultra';

    const result = await this.veniceClient.generateImage({
      prompt,
      negativePrompt,
      width: 1024,
      height: 1024,
      style: 'natural',
      userTier,
    });

    return result;
  }

  /**
   * Generate full-body reference image
   *
   * Usa aspect ratio más alto (768x1024) para capturar cuerpo completo.
   * La diferencia de calidad viene del modelo, no de parámetros técnicos.
   */
  private async generateFullBody(params: GenerateInitialImagesParams) {
    const prompt = this.buildFullBodyPrompt(params);
    const negativePrompt = this.buildNegativePrompt(params.style || 'realistic');

    console.log('[InitialImageGen] Full-body prompt:', prompt);

    // Mapear tier a formato de Venice
    const userTier = (params.userTier || 'FREE').toLowerCase() as 'free' | 'plus' | 'ultra';

    const result = await this.veniceClient.generateImage({
      prompt,
      negativePrompt,
      width: 768,
      height: 1024, // Taller aspect ratio for full-body
      style: 'natural',
      userTier,
    });

    return result;
  }

  /**
   * Build prompt for avatar (portrait)
   */
  private buildAvatarPrompt(params: GenerateInitialImagesParams): string {
    const parts: string[] = [];

    // Style prefix
    const style = params.style || 'realistic';
    if (style === 'realistic') {
      parts.push('professional portrait photo');
    } else if (style === 'anime') {
      parts.push('anime style portrait');
    } else {
      parts.push('semi-realistic portrait');
    }

    // Gender and age
    const genderDesc = this.getGenderDescription(params.gender, params.age);
    parts.push(genderDesc);

    // Physical appearance
    if (params.physicalAppearance) {
      parts.push(params.physicalAppearance);
    }

    // Personality-based expression
    if (params.personality) {
      const expression = this.getExpressionFromPersonality(params.personality);
      parts.push(expression);
    } else {
      parts.push('neutral friendly expression');
    }

    // Technical quality
    parts.push('close-up headshot');
    parts.push('looking at camera');
    parts.push('professional photography');
    parts.push('natural lighting');
    parts.push('detailed face');
    parts.push('high quality');
    parts.push('8k uhd');
    parts.push('sharp focus');

    if (style === 'realistic') {
      parts.push('realistic skin texture');
      parts.push('photorealistic');
    }

    return parts.join(', ');
  }

  /**
   * Build prompt for full-body image
   */
  private buildFullBodyPrompt(params: GenerateInitialImagesParams): string {
    const parts: string[] = [];

    // Style prefix
    const style = params.style || 'realistic';
    if (style === 'realistic') {
      parts.push('professional full-body photo');
    } else if (style === 'anime') {
      parts.push('anime style full-body illustration');
    } else {
      parts.push('semi-realistic full-body portrait');
    }

    // Gender and age
    const genderDesc = this.getGenderDescription(params.gender, params.age);
    parts.push(genderDesc);

    // Physical appearance
    if (params.physicalAppearance) {
      parts.push(params.physicalAppearance);
    }

    // Pose and framing
    parts.push('standing pose');
    parts.push('full body visible');
    parts.push('neutral background');
    parts.push('centered composition');

    // Technical quality
    parts.push('professional photography');
    parts.push('natural lighting');
    parts.push('detailed');
    parts.push('high quality');
    parts.push('8k uhd');

    if (style === 'realistic') {
      parts.push('realistic proportions');
      parts.push('photorealistic');
    }

    return parts.join(', ');
  }

  /**
   * Build negative prompt based on style
   */
  private buildNegativePrompt(style: 'realistic' | 'anime' | 'semi-realistic'): string {
    const common = [
      'deformed',
      'distorted',
      'disfigured',
      'bad anatomy',
      'wrong anatomy',
      'extra limb',
      'missing limb',
      'floating limbs',
      'mutated hands',
      'bad hands',
      'long neck',
      'mutation',
      'ugly',
      'disgusting',
      'blurry',
      'low quality',
      'watermark',
      'text',
      'signature',
      'multiple people',
      'duplicate',
    ];

    if (style === 'realistic') {
      return [...common, 'cartoon', 'anime', '3d render', 'painting', 'drawing'].join(', ');
    } else if (style === 'anime') {
      return [...common, 'realistic', '3d render', 'photograph'].join(', ');
    } else {
      return common.join(', ');
    }
  }

  /**
   * Get gender description for prompt
   */
  private getGenderDescription(gender: GenderType, age?: number): string {
    const ageStr = age ? `${age} years old` : 'young adult';

    switch (gender) {
      case 'male':
        return `handsome man, ${ageStr}`;
      case 'female':
        return `beautiful woman, ${ageStr}`;
      case 'non-binary':
        return `person, ${ageStr}, androgynous`;
      case 'other':
      default:
        return `person, ${ageStr}`;
    }
  }

  /**
   * Get facial expression from personality description
   */
  private getExpressionFromPersonality(personality: string): string {
    const p = personality.toLowerCase();

    if (p.includes('alegre') || p.includes('optimista') || p.includes('feliz')) {
      return 'warm smile, joyful expression';
    } else if (p.includes('serio') || p.includes('profesional') || p.includes('formal')) {
      return 'serious expression, professional demeanor';
    } else if (p.includes('tímid') || p.includes('introvertid') || p.includes('reservad')) {
      return 'shy smile, gentle expression';
    } else if (p.includes('confiado') || p.includes('segur') || p.includes('carismátic')) {
      return 'confident expression, charismatic smile';
    } else if (p.includes('misterios') || p.includes('enigmátic')) {
      return 'mysterious expression, slight smirk';
    } else {
      return 'neutral friendly expression';
    }
  }

}

// Singleton instance
let generatorInstance: InitialImageGenerationService | null = null;

export function getInitialImageGenerationService(): InitialImageGenerationService {
  if (!generatorInstance) {
    generatorInstance = new InitialImageGenerationService();
  }
  return generatorInstance;
}

export const initialImageGenerator = getInitialImageGenerationService();
