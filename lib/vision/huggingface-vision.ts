/**
 * HUGGINGFACE VISION CLIENT
 *
 * Cliente para image captioning usando HuggingFace Inference API
 * - Soporta rotación de múltiples API keys
 * - Tier gratuito: 30,000 requests/mes por key
 * - Modelos: BLIP-2, Florence-2, Moondream
 * - Sin censura (modelos open source)
 */

export interface VisionRequest {
  imageUrl?: string;
  imageBase64?: string;
  model?: string;
}

export interface VisionResponse {
  caption: string;
  model: string;
  confidence?: number;
}

export interface HuggingFaceVisionConfig {
  apiKey?: string; // Single key (deprecated, use apiKeys)
  apiKeys?: string[]; // Multiple keys for rotation
  defaultModel?: string;
}

export class HuggingFaceVisionClient {
  private apiKeys: string[];
  private currentKeyIndex: number = 0;
  private baseURL: string = "https://api-inference.huggingface.co/models";
  private defaultModel: string;

  // Modelos disponibles (ordenados por calidad - 2025)
  private static readonly MODELS = {
    BLIP2: "Salesforce/blip2-opt-2.7b", // ⭐ RECOMENDADO - Estado del arte, rápido y preciso
    BLIP_LARGE: "Salesforce/blip-image-captioning-large", // BLIP v1 (legacy)
    FLORENCE2: "microsoft/Florence-2-large", // Excelente para detalles pero más lento
    MOONDREAM: "vikhyatk/moondream2", // Muy rápido, ligero, bueno para edge cases
  };

  constructor(config: HuggingFaceVisionConfig) {
    // Support both single key (deprecated) and multiple keys
    if (config.apiKeys && config.apiKeys.length > 0) {
      this.apiKeys = config.apiKeys;
    } else if (config.apiKey) {
      this.apiKeys = [config.apiKey];
    } else {
      // Si no hay keys, intentar obtener del environment
      const envKeys = this.getKeysFromEnvironment();
      if (envKeys.length === 0) {
        throw new Error("HuggingFaceVisionClient requires apiKey or apiKeys");
      }
      this.apiKeys = envKeys;
    }

    // BLIP-2 es el modelo recomendado por defecto (estado del arte 2025)
    this.defaultModel = config.defaultModel || HuggingFaceVisionClient.MODELS.BLIP2;

    console.log('[HuggingFace Vision] Inicializando cliente...');
    console.log('[HuggingFace Vision] API Keys disponibles:', this.apiKeys.length);
    console.log('[HuggingFace Vision] Modelo por defecto:', this.defaultModel);
  }

  /**
   * Obtiene las API keys desde variables de entorno
   * Soporta formato: HUGGINGFACE_API_KEY_1, HUGGINGFACE_API_KEY_2, etc.
   */
  private getKeysFromEnvironment(): string[] {
    const keys: string[] = [];

    // Try with single key first
    const singleKey = process.env.HUGGINGFACE_API_KEY;
    if (singleKey) {
      keys.push(singleKey);
    }

    // Buscar keys numeradas
    for (let i = 1; i <= 20; i++) {
      const key = process.env[`HUGGINGFACE_API_KEY_${i}`];
      if (key) {
        keys.push(key);
      }
    }

    return keys;
  }

  /**
   * Obtiene la API key activa actual
   */
  private getCurrentApiKey(): string {
    return this.apiKeys[this.currentKeyIndex];
  }

  /**
   * Rota a la siguiente API key disponible
   * Retorna true si hay más keys, false si ya se probaron todas
   */
  private rotateApiKey(): boolean {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;

    // Si volvimos al inicio, significa que probamos todas las keys
    if (this.currentKeyIndex === 0) {
      console.error('[HuggingFace Vision] ⚠️  Todas las API keys han sido intentadas');
      return false;
    }

    console.log(`[HuggingFace Vision] 🔄 Rotando a API key #${this.currentKeyIndex + 1}`);
    return true;
  }

  /**
   * Genera caption de una imagen con rotación automática de API keys
   */
  async generateCaption(request: VisionRequest): Promise<VisionResponse> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    const maxRetries = this.apiKeys.length;

    // Validate que tengamos imagen
    if (!request.imageUrl && !request.imageBase64) {
      throw new Error("Either imageUrl or imageBase64 is required");
    }

    // Intentar con cada API key disponible
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const model = request.model || this.defaultModel;
        const currentKey = this.getCurrentApiKey();

        console.log(`[HuggingFace Vision] Generating caption with key #${this.currentKeyIndex + 1}...`);

        // Preparar la imagen
        let imageData: ArrayBuffer;

        if (request.imageBase64) {
          // Convertir base64 a ArrayBuffer
          const base64Data = request.imageBase64.replace(/^data:image\/\w+;base64,/, '');
          const binaryString = Buffer.from(base64Data, 'base64');
          imageData = binaryString.buffer;
        } else if (request.imageUrl) {
          // Descargar la imagen
          const imageResponse = await fetch(request.imageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.status}`);
          }
          imageData = await imageResponse.arrayBuffer();
        } else {
          throw new Error("No image data provided");
        }

        // Llamar a HuggingFace Inference API
        const response = await fetch(`${this.baseURL}/${model}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${currentKey}`,
            "Content-Type": "application/json",
          },
          body: imageData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[HuggingFace Vision] Error ${response.status}:`, errorText);

          // Detectar errores de cuota (429, 503, o mensajes de quota/rate limit)
          const isQuotaError = response.status === 429 ||
                               response.status === 503 ||
                               errorText.toLowerCase().includes('quota') ||
                               errorText.toLowerCase().includes('rate limit') ||
                               errorText.toLowerCase().includes('rate-limited') ||
                               errorText.toLowerCase().includes('model is currently loading');

          if (isQuotaError && this.rotateApiKey()) {
            console.log('[HuggingFace Vision] Error de cuota detectado, intentando con siguiente API key...');
            lastError = new Error(`Quota exceeded on key #${this.currentKeyIndex}`);
            continue; // Reintentar con siguiente key
          }

          throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Response format varies by model
        let caption = "";

        if (Array.isArray(data) && data.length > 0) {
          // Formato BLIP: [{ generated_text: "..." }]
          caption = data[0].generated_text || data[0].caption || "";
        } else if (data.generated_text) {
          caption = data.generated_text;
        } else if (data.caption) {
          caption = data.caption;
        } else {
          console.warn('[HuggingFace Vision] Formato de respuesta inesperado:', data);
          caption = JSON.stringify(data);
        }

        const elapsedMs = Date.now() - startTime;
        console.log(`[HuggingFace Vision] Caption generated in ${elapsedMs}ms: "${caption.substring(0, 100)}..."`);

        return {
          caption: caption.trim(),
          model,
          confidence: data.score || data.confidence,
        };

      } catch (error) {
        console.error(`[HuggingFace Vision] Attempt ${attempt + 1} failed:`, error);
        lastError = error as Error;

        // Si no quedan más keys, lanzar el error
        if (attempt === maxRetries - 1) {
          throw lastError;
        }
      }
    }

    // Si llegamos aquí, todas las keys fallaron
    throw lastError || new Error("All API keys exhausted");
  }

  /**
   * Helper para generar caption desde URL directamente
   */
  async captionFromUrl(imageUrl: string, model?: string): Promise<string> {
    const response = await this.generateCaption({ imageUrl, model });
    return response.caption;
  }

  /**
   * Helper para generar caption desde base64 directamente
   */
  async captionFromBase64(imageBase64: string, model?: string): Promise<string> {
    const response = await this.generateCaption({ imageBase64, model });
    return response.caption;
  }

  /**
   * Obtiene estadísticas de uso de las keys
   */
  getKeyStats(): { total: number; current: number } {
    return {
      total: this.apiKeys.length,
      current: this.currentKeyIndex + 1,
    };
  }
}
