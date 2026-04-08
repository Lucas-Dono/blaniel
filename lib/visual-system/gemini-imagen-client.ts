/**
 * GEMINI IMAGEN CLIENT
 * 
 * Client for image generation using Gemini Imagen API
 * - Cost: $0.06 per image (Fast mode)
 * - Support for reference images (facial consistency)
 * - Generation of specific facial expressions
 */



export interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  referenceImage?: string; // URL o base64
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  numberOfImages?: number; // 1-4
  seed?: number;
}

export interface ImageGenerationResult {
  imageBase64: string;
  seed: number;
  prompt: string;
}

export class GeminiImagenClient {
  constructor() {
    console.log("[GeminiImagen] Client initialized with centralized Gemini client");
  }

  /**
   * Generates image from prompt
   * NOTE: Gemini Imagen is not publicly available yet
   * For now, this is a preparatory implementation
   */
  async generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
    try {
      console.log(`[GeminiImagen] Generating image...`);
      console.log(`[GeminiImagen] Prompt: ${params.prompt.substring(0, 100)}...`);

      // TODO: When Gemini Imagen is available, use the real API
      // For now, return placeholder for testing

      throw new Error(
        "Gemini Imagen API not yet publicly available. Use fallback provider (Hugging Face) or wait for public release."
      );

      // Future implementation when API is available:
      /*
      const result = await executeWithRetry(async (client) => {
        const model = client.getGenerativeModel({
          model: "imagen-3.0-generate-001", // Fast mode
        });

        return await model.generateContent({
          contents: [{
            role: "user",
            parts: [{ text: params.prompt }],
          }],
          generationConfig: {
            prompt: params.prompt,
            number_of_images: params.numberOfImages || 1,
            aspect_ratio: params.aspectRatio || "1:1",
            negative_prompt: params.negativePrompt,
            seed: params.seed,
          },
        });
      });

      const imageData = result.response.candidates?.[0]?.content?.parts?.[0];
      if (!imageData || !imageData.inlineData) {
        throw new Error("No image generated");
      }

      return {
        imageBase64: imageData.inlineData.data,
        seed: params.seed || Math.floor(Math.random() * 1000000),
        prompt: params.prompt,
      };
      */
    } catch (error) {
      console.error("[GeminiImagen] Error:", error);
      throw error;
    }
  }

  /** Genera expresión facial específica para un personaje */
  async generateCharacterExpression(params: {
    characterDescription: string;
    emotionType: string;
    intensity: "low" | "medium" | "high";
    referenceImage?: string;
    seed?: number;
  }): Promise<{ imageBase64: string; seed: number }> {
    const { characterDescription, emotionType, intensity, referenceImage, seed } = params;

    const prompt = this.buildExpressionPrompt(
      characterDescription,
      emotionType,
      intensity
    );

    const negativePrompt =
      "deformed, distorted, disfigured, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated hands, mutated fingers, bad hands, bad fingers, long neck, long body, mutation, mutated, ugly, disgusting, blurry, low quality, watermark, text, signature, multiple people, crowd";

    const result = await this.generateImage({
      prompt,
      negativePrompt,
      referenceImage,
      seed,
      aspectRatio: "1:1",
      numberOfImages: 1,
    });

    return {
      imageBase64: result.imageBase64,
      seed: result.seed,
    };
  }

  /** Construye prompt optimizado para expresión facial */
  private buildExpressionPrompt(
    characterDescription: string,
    emotionType: string,
    intensity: "low" | "medium" | "high"
  ): string {
    const emotionDescriptors: Record<string, Record<string, string>> = {
      joy: {
        low: "subtle smile, gentle happiness, soft expression",
        medium: "bright smile, joyful expression, happy eyes",
        high: "wide smile, laughing, very happy, radiant expression",
      },
      distress: {
        low: "slight frown, concerned look, worried expression",
        medium: "sad expression, teary eyes, distressed look",
        high: "crying, very sad, tears streaming, heartbroken expression",
      },
      anger: {
        low: "slight annoyance, furrowed brow, mild frustration",
        medium: "angry expression, intense gaze, frowning",
        high: "very angry, furious expression, intense rage",
      },
      fear: {
        low: "nervous look, slight anxiety, worried",
        medium: "scared expression, fearful eyes, anxious",
        high: "terrified, very scared, panicked expression",
      },
      affection: {
        low: "warm smile, gentle gaze, soft expression",
        medium: "loving expression, warm eyes, caring look",
        high: "deeply affectionate, loving gaze, tender expression",
      },
      concern: {
        low: "thoughtful look, slightly worried",
        medium: "concerned expression, empathetic gaze",
        high: "deeply concerned, worried face",
      },
      neutral: {
        low: "calm expression, neutral face, relaxed",
        medium: "neutral expression, peaceful look",
        high: "serene, very calm, composed expression",
      },
      curiosity: {
        low: "interested look, slight curiosity",
        medium: "curious expression, inquisitive gaze",
        high: "very curious, fascinated expression",
      },
      excitement: {
        low: "slightly excited, anticipation",
        medium: "excited expression, energetic look",
        high: "very excited, thrilled, enthusiastic",
      },
    };

    const emotionDesc =
      emotionDescriptors[emotionType]?.[intensity] ||
      emotionDescriptors.neutral.medium;

    return `High quality portrait photo, ${characterDescription}, ${emotionDesc}, professional photography, natural lighting, detailed face, clear features, looking at camera, upper body shot, 8k uhd, soft focus background, photorealistic`;
  }
}

// Singleton
let geminiImagenClient: GeminiImagenClient | null = null;

export function getGeminiImagenClient(): GeminiImagenClient {
  if (!geminiImagenClient) {
    geminiImagenClient = new GeminiImagenClient();
  }
  return geminiImagenClient;
}
