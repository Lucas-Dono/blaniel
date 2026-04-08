/**
 * HUGGING FACE SPACES CLIENT
 *
 * Cliente para generación de imágenes usando Hugging Face Spaces
 * - Space: Heartsync/NSFW-Uncensored-photo
 * - GRATIS (espacios públicos)
 * - Sin censura (ideal para contenido NSFW premium)
 */

import { Client } from "@gradio/client";

export interface HFImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  guidanceScale?: number;
  inferenceSteps?: number;
  seed?: number;
  randomizeSeed?: boolean;
}

export interface HFImageGenerationResult {
  imageUrl: string;
  seed: number;
}

export class HuggingFaceSpacesClient {
  private spaceUrl: string;
  private client: any;
  private connecting: Promise<void> | null = null;

  constructor(spaceUrl?: string) {
    // Use the newest Space which has better availability
    this.spaceUrl = spaceUrl || "Heartsync/NSFW-Uncensored-new";
  }

  /**
   * Conecta al Space de Hugging Face
   */
  async connect(): Promise<void> {
    if (this.client) {
      return; // Ya conectado
    }

    if (this.connecting) {
      await this.connecting; // Wait for connection in progress
      return;
    }

    this.connecting = (async () => {
      try {
        console.log(`[HFSpaces] Connecting to ${this.spaceUrl}...`);
        this.client = await Client.connect(this.spaceUrl);
        console.log(`[HFSpaces] ✅ Connected`);
      } catch (error) {
        console.error(`[HFSpaces] Connection failed:`, error);
        this.client = null;
        throw error;
      } finally {
        this.connecting = null;
      }
    })();

    await this.connecting;
  }

  /**
   * Genera imagen desde prompt
   */
  async generateImage(params: HFImageGenerationParams): Promise<HFImageGenerationResult> {
    try {
      await this.connect();

      console.log(`[HFSpaces] Generating image...`);
      console.log(`[HFSpaces] Prompt: ${params.prompt.substring(0, 100)}...`);

      const result = await this.client.predict("/infer", {
        prompt: params.prompt,
        negative_prompt:
          params.negativePrompt ||
          "text, watermark, signature, cartoon, anime, illustration, painting, drawing, low quality, blurry, deformed, distorted, disfigured, bad anatomy",
        seed: params.seed || 0,
        randomize_seed: params.randomizeSeed ?? true,
        width: params.width || 1024,
        height: params.height || 1024,
        guidance_scale: params.guidanceScale || 7,
        num_inference_steps: params.inferenceSteps || 28,
      });

      // result.data puede ser un string o un objeto con estructura compleja
      let imageUrl: string;

      if (typeof result.data === "string") {
        imageUrl = result.data;
      } else if (Array.isArray(result.data) && result.data[0]?.url) {
        // Formato: [{ path, url, size, orig_name, mime_type, ... }]
        imageUrl = result.data[0].url;
      } else if (result.data && typeof result.data === "object" && "url" in result.data) {
        // Formato: { url, path, ... }
        imageUrl = (result.data as any).url;
      } else {
        console.error("[HFSpaces] Unexpected result format:", result.data);
        throw new Error("Unexpected image result format from Hugging Face Spaces");
      }

      console.log(`[HFSpaces] ✅ Image generated: ${imageUrl}`);

      return {
        imageUrl,
        seed: params.seed || 0,
      };
    } catch (error) {
      console.error("[HFSpaces] Error generating image:", error);
      throw error;
    }
  }

  /**
   * Genera expresión facial específica
   */
  async generateCharacterExpression(params: {
    characterDescription: string;
    emotionType: string;
    intensity: "low" | "medium" | "high";
    seed?: number;
  }): Promise<{ imageUrl: string; seed: number }> {
    const { characterDescription, emotionType, intensity, seed } = params;

    const prompt = this.buildExpressionPrompt(
      characterDescription,
      emotionType,
      intensity
    );

    const result = await this.generateImage({
      prompt,
      seed,
      width: 1024,
      height: 1024,
      guidanceScale: 7,
      inferenceSteps: 28,
      randomizeSeed: !seed,
    });

    return result;
  }

  /**
   * Boost prompt usando el Space (mejora el prompt automáticamente)
   */
  async boostPrompt(keyword: string): Promise<string> {
    try {
      await this.connect();

      const result = await this.client.predict("/boost_prompt", {
        keyword,
      });

      return result.data as string;
    } catch (error) {
      console.error("[HFSpaces] Error boosting prompt:", error);
      return keyword; // Fallback al original
    }
  }

  /**
   * Obtiene un prompt aleatorio del Space
   */
  async getRandomPrompt(): Promise<string> {
    try {
      await this.connect();

      const result = await this.client.predict("/get_random_prompt", {});

      return result.data as string;
    } catch (error) {
      console.error("[HFSpaces] Error getting random prompt:", error);
      return "";
    }
  }

  /**
   * Construye prompt optimizado para expresión facial
   */
  private buildExpressionPrompt(
    characterDescription: string,
    emotionType: string,
    intensity: "low" | "medium" | "high"
  ): string {
    const emotionDescriptors: Record<string, Record<string, string>> = {
      joy: {
        low: "subtle smile, gentle happiness",
        medium: "bright smile, joyful expression",
        high: "wide smile, laughing, very happy",
      },
      distress: {
        low: "slight frown, worried look",
        medium: "sad expression, teary eyes",
        high: "crying, very sad, tears",
      },
      anger: {
        low: "annoyed, furrowed brow",
        medium: "angry expression, frowning",
        high: "very angry, furious",
      },
      fear: {
        low: "nervous, slightly worried",
        medium: "scared expression, anxious",
        high: "terrified, very scared",
      },
      affection: {
        low: "warm smile, gentle gaze",
        medium: "loving expression, warm eyes",
        high: "deeply affectionate, loving gaze",
      },
      concern: {
        low: "thoughtful, slightly worried",
        medium: "concerned expression, empathetic",
        high: "deeply concerned, worried",
      },
      neutral: {
        low: "calm, relaxed expression",
        medium: "neutral expression, peaceful",
        high: "serene, very calm",
      },
      curiosity: {
        low: "interested look",
        medium: "curious expression",
        high: "very curious, fascinated",
      },
      excitement: {
        low: "slightly excited",
        medium: "excited expression",
        high: "very excited, thrilled",
      },
    };

    const emotionDesc =
      emotionDescriptors[emotionType]?.[intensity] ||
      emotionDescriptors.neutral.medium;

    return `professional portrait photo, ${characterDescription}, ${emotionDesc}, high quality, detailed face, looking at camera, upper body, natural lighting, photorealistic, 8k`;
  }
}

// Singleton
let hfSpacesClient: HuggingFaceSpacesClient | null = null;

export function getHuggingFaceSpacesClient(): HuggingFaceSpacesClient {
  if (!hfSpacesClient) {
    hfSpacesClient = new HuggingFaceSpacesClient();
  }
  return hfSpacesClient;
}
