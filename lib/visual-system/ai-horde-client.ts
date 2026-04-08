/**
 * AI Horde Client for Stable Diffusion
 *
 * Client for generating images using AI Horde (Stable Horde)
 * - Crowdsourced distributed cluster
 * - Free with kudos system
 * - High quality images
 * - No local hardware limits
 *
 * API Documentation: https://stablehorde.net/api/
 */

const AI_HORDE_API_BASE = "https://stablehorde.net/api/v2";

export interface AIHordeGenerationParams {
  prompt: string;
  negativePrompt?: string;
  width?: number; // Default: 512
  height?: number; // Default: 512
  steps?: number; // Default: 30
  cfgScale?: number; // Guidance scale, Default: 7.5
  seed?: number; // -1 for random
  sampler?: string; // k_euler, k_euler_a, k_lms, etc.
  model?: string; // Specific model, default: best available
  nsfw?: boolean; // Allow NSFW content
  karras?: boolean; // Use Karras sigmas (better quality)
  clipSkip?: number; // CLIP skip (1-12)

  // IMG2IMG Parameters
  sourceImage?: string; // Base64 image string (without data:image/... prefix)
  denoisingStrength?: number; // 0.0-1.0, how much to transform the image (default: 0.75)
}

export interface AIHordeGenerationResult {
  id: string; // Generation request ID
  imageUrl: string; // URL of generated image (base64 or URL)
  seed: number;
  model: string;
  workerName: string;
  kudosCost: number;
  generationTime: number; // Seconds
}

export interface AIHordeRequestStatus {
  finished: number; // Images completed
  processing: number; // Images in progress
  waiting: number; // Images in queue
  done: boolean; // Request complete
  waitTime: number; // Estimated wait time (seconds)
  queuePosition: number; // Position in queue
}

/**
 * Client for AI Horde (Stable Horde)
 *
 * Usage flow:
 * 1. generateImage() - Send request and get ID
 * 2. Automatic status polling
 * 3. When ready, return image
 */
export class AIHordeClient {
  private apiKey: string;
  private clientAgent: string;

  constructor(config?: { apiKey?: string; clientAgent?: string }) {
    // API Key: "0000000000" for anonymous (low priority)
    this.apiKey = config?.apiKey || "0000000000";
    this.clientAgent =
      config?.clientAgent || "CreadorInteligencias:1.0:contact@example.com";
  }

  /**
   * Genera una imagen usando AI Horde
   *
   * Este método es asíncrono y espera a que la generación se complete.
   * Hace polling automático del estado cada 3 segundos.
   */
  async generateImage(
    params: AIHordeGenerationParams
  ): Promise<AIHordeGenerationResult> {
    try {
      console.log("[AI Horde] Starting image generation...");
      const startTime = Date.now();

      // 1. Start asynchronous generation
      const requestId = await this.submitGenerationRequest(params);
      console.log(`[AI Horde] Request ID: ${requestId}`);

      // 2. Polling hasta que se complete
      const result = await this.waitForCompletion(requestId);

      const generationTime = (Date.now() - startTime) / 1000;
      console.log(`[AI Horde] ✅ Image generated in ${generationTime}s`);

      return {
        ...result,
        generationTime,
      };
    } catch (error) {
      console.error("[AI Horde] Generation failed:", error);
      throw error;
    }
  }

  /**
   * Envía request de generación a AI Horde
   * Retorna el ID del request para hacer polling
   */
  private async submitGenerationRequest(
    params: AIHordeGenerationParams
  ): Promise<string> {
    const requestBody: any = {
      prompt: params.prompt,
      params: {
        n: 1, // Número de imágenes
        width: params.width || 512,
        height: params.height || 512,
        steps: params.steps || 30,
        cfg_scale: params.cfgScale || 7.5,
        seed:
          params.seed !== undefined && params.seed !== -1
            ? params.seed.toString()
            : undefined,
        sampler_name: params.sampler || "k_euler_a",
        karras: params.karras ?? true,
        clip_skip: params.clipSkip || 1,
      },
      nsfw: params.nsfw ?? false,
      censor_nsfw: false,
      trusted_workers: false,
      slow_workers: true,
      workers: [],
      worker_blacklist: false,
      models: params.model ? [params.model] : [],
      r2: true, // Usar R2 storage para URLs persistentes
      shared: false,
      replacement_filter: true,
    };

    // Add negative prompt if exists
    if (params.negativePrompt) {
      requestBody.params.negative_prompt = params.negativePrompt;
    }

    // IMG2IMG: Añadir source image y denoising strength
    if (params.sourceImage) {
      console.log("[AI Horde] Using img2img mode with denoising strength:", params.denoisingStrength || 0.6);

      requestBody.source_image = params.sourceImage;
      requestBody.source_processing = "img2img";

      // Denoising strength: 0.0-1.0
      // 0.0 = identical image to original
      // 1.0 = completamente nueva (ignora la referencia)
      // 0.6 = good balance (60% transformation, 40% keeps reference)
      requestBody.params.denoising_strength = params.denoisingStrength ?? 0.6;
    }

    const response = await fetch(`${AI_HORDE_API_BASE}/generate/async`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey,
        "Client-Agent": this.clientAgent,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `AI Horde API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }

    const data = await response.json();

    if (data.message) {
      console.log(`[AI Horde] ${data.message}`);
    }

    if (data.warnings && data.warnings.length > 0) {
      console.warn("[AI Horde] Warnings:", data.warnings);
    }

    return data.id;
  }

  /**
   * Verifica el estado de una generación
   */
  async checkStatus(requestId: string): Promise<AIHordeRequestStatus> {
    const response = await fetch(
      `${AI_HORDE_API_BASE}/generate/check/${requestId}`,
      {
        headers: {
          "Client-Agent": this.clientAgent,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.status}`);
    }

    const data = await response.json();

    return {
      finished: data.finished || 0,
      processing: data.processing || 0,
      waiting: data.waiting || 0,
      done: data.done || false,
      waitTime: data.wait_time || 0,
      queuePosition: data.queue_position || 0,
    };
  }

  /**
   * Obtiene el resultado completo de una generación
   */
  private async getGenerationResult(
    requestId: string
  ): Promise<AIHordeGenerationResult> {
    const response = await fetch(
      `${AI_HORDE_API_BASE}/generate/status/${requestId}`,
      {
        headers: {
          "Client-Agent": this.clientAgent,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get result: ${response.status}`);
    }

    const data = await response.json();

    if (!data.generations || data.generations.length === 0) {
      throw new Error("No generations found in response");
    }

    const generation = data.generations[0];

    return {
      id: requestId,
      imageUrl: generation.img || "", // URL de la imagen (R2 storage)
      seed: parseInt(generation.seed) || 0,
      model: generation.model || "unknown",
      workerName: generation.worker_name || "unknown",
      kudosCost: data.kudos || 0,
      generationTime: 0, // Se calcula en generateImage()
    };
  }

  /**
   * Espera a que la generación se complete haciendo polling
   */
  private async waitForCompletion(
    requestId: string,
    maxWaitTime = 600 // 10 minutos máximo
  ): Promise<AIHordeGenerationResult> {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 segundos

    while (true) {
      // Verificar timeout
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > maxWaitTime) {
        throw new Error(
          `Generation timeout after ${maxWaitTime} seconds. Request ID: ${requestId}`
        );
      }

      // Verificar estado
      const status = await this.checkStatus(requestId);

      console.log(
        `[AI Horde] Status: ${status.finished}/${status.finished + status.processing + status.waiting} ` +
          `(Queue: ${status.queuePosition}, Wait: ${status.waitTime}s)`
      );

      // Si está completo, obtener resultado
      if (status.done) {
        return await this.getGenerationResult(requestId);
      }

      // Esperar antes de siguiente poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Genera expresión de personaje
   */
  async generateCharacterExpression(params: {
    characterDescription: string;
    emotionType: string;
    intensity: "low" | "medium" | "high";
    seed?: number;
  }): Promise<{ imageUrl: string; seed: number; kudosCost: number }> {
    const prompt = this.buildExpressionPrompt(
      params.characterDescription,
      params.emotionType,
      params.intensity
    );

    const negativePrompt =
      "deformed, bad anatomy, ugly, blurry, low quality, extra limbs, " +
      "bad hands, multiple people, watermark, text, signature, " +
      "cartoon, anime, 3d render, painting, drawing";

    const result = await this.generateImage({
      prompt,
      negativePrompt,
      width: 512,
      height: 512,
      steps: 30, // AI Horde funciona bien con 25-30 pasos
      cfgScale: 7.5,
      seed: params.seed || -1,
      sampler: "k_euler_a",
      karras: true,
      nsfw: false,
    });

    return {
      imageUrl: result.imageUrl,
      seed: result.seed,
      kudosCost: result.kudosCost,
    };
  }

  /**
   * Construye prompt para expresión emocional
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
        low: "slight frown, concerned look",
        medium: "sad expression, worried look",
        high: "crying, very sad, tears",
      },
      anger: {
        low: "slight annoyance, furrowed brow",
        medium: "angry expression, frowning",
        high: "very angry, furious, intense",
      },
      fear: {
        low: "nervous look, slight anxiety",
        medium: "scared expression, fearful",
        high: "terrified, very scared, panicked",
      },
      affection: {
        low: "warm smile, gentle gaze",
        medium: "loving expression, warm eyes",
        high: "deeply affectionate, loving",
      },
      neutral: {
        low: "calm expression, neutral",
        medium: "neutral expression, peaceful",
        high: "serene, very calm, composed",
      },
    };

    const emotionDesc =
      emotionDescriptors[emotionType]?.[intensity] ||
      emotionDescriptors.neutral.medium;

    return (
      `professional portrait photo, ${characterDescription}, ${emotionDesc}, ` +
      `photorealistic, detailed face, natural lighting, high quality, ` +
      `8k uhd, sharp focus, upper body shot, realistic skin texture`
    );
  }

  /**
   * Obtiene información del usuario (kudos, estadísticas)
   */
  async getUserInfo(): Promise<{
    username: string;
    kudos: number;
    usage: {
      megapixelsteps: number;
      requests: number;
    };
  }> {
    const response = await fetch(`${AI_HORDE_API_BASE}/find_user`, {
      headers: {
        apikey: this.apiKey,
        "Client-Agent": this.clientAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    const data = await response.json();

    return {
      username: data.username || "Anonymous",
      kudos: data.kudos || 0,
      usage: data.usage || { megapixelsteps: 0, requests: 0 },
    };
  }

  /**
   * Lista modelos disponibles
   */
  async getAvailableModels(): Promise<
    Array<{ name: string; count: number; performance: number }>
  > {
    const response = await fetch(`${AI_HORDE_API_BASE}/status/models`, {
      headers: {
        "Client-Agent": this.clientAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get models: ${response.status}`);
    }

    const data = await response.json();

    return data.map((model: any) => ({
      name: model.name,
      count: model.count || 0, // Workers disponibles
      performance: model.performance || 0,
    }));
  }
}

/**
 * Singleton para reutilizar cliente
 */
let aiHordeClient: AIHordeClient | null = null;

export function getAIHordeClient(config?: {
  apiKey?: string;
  clientAgent?: string;
}): AIHordeClient {
  if (!aiHordeClient || config) {
    // Leer API key desde variable de entorno si no se proporciona
    const apiKey = config?.apiKey || process.env.AI_HORDE_API_KEY || "0000000000";
    const clientAgent = config?.clientAgent || "CreadorInteligencias:1.0:contact@example.com";

    console.log('[AI Horde] Inicializando cliente...');
    console.log('[AI Horde] API Key detectada:', apiKey !== "0000000000" ? 'Sí ✓' : 'No (modo anónimo)');

    aiHordeClient = new AIHordeClient({ apiKey, clientAgent });
  }
  return aiHordeClient;
}
