/**
 * VENICE AI CLIENT
 *
 * Client for Venice API - Private, secure and uncensored
 * Compatible with OpenAI API spec
 *
 * Pricing:
 * - Input: $0.20 per million tokens
 * - Output: $0.90 per million tokens
 */

import { LLMRequest, LLMResponse } from "../types";

export interface VeniceConfig {
  apiKey?: string; // Single key (deprecated, use apiKeys)
  apiKeys?: string[]; // Multiple keys for rotation
  baseURL?: string;
  defaultModel?: string;
}

export interface VeniceMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface VeniceRequestBody {
  model: string;
  messages: VeniceMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
}

export interface VeniceImageParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  userTier?: 'free' | 'plus' | 'ultra'; // To select appropriate model
}

export interface VeniceImageResult {
  imageUrl: string;
  revisedPrompt?: string;
  generationTime: number;
}

/**
 * Types of errors that Venice API can return
 */
enum VeniceErrorType {
  SERVER_OVERLOAD = "SERVER_OVERLOAD",     // Server overloaded, wait and retry
  QUOTA_ERROR = "QUOTA_ERROR",             // Rate limit error, rotate key
  INSUFFICIENT_CREDITS = "INSUFFICIENT_CREDITS", // No credits, fail definitively
  SERVER_ERROR = "SERVER_ERROR",           // Error 500, retry
  UNKNOWN = "UNKNOWN"                      // Other errors, fail
}

/**
 * Classify error type based on status code and message
 */
function classifyVeniceError(statusCode: number, errorText: string): VeniceErrorType {
  const lowerError = errorText.toLowerCase();

  // Error 500 - Server problem
  if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
    return VeniceErrorType.SERVER_ERROR;
  }

  // Error 429 - Could be overload or quota
  if (statusCode === 429) {
    // Messages that indicate temporary server overload
    if (
      lowerError.includes('overload') ||
      lowerError.includes('saturado') ||
      lowerError.includes('busy') ||
      lowerError.includes('too many requests') ||
      lowerError.includes('try again later') ||
      lowerError.includes('intente más tarde') ||
      lowerError.includes('please retry')
    ) {
      return VeniceErrorType.SERVER_OVERLOAD;
    }

    // Messages that indicate insufficient credits
    if (
      lowerError.includes('insufficient credits') ||
      lowerError.includes('créditos insuficientes') ||
      lowerError.includes('no credits') ||
      lowerError.includes('balance')
    ) {
      return VeniceErrorType.INSUFFICIENT_CREDITS;
    }

    // Other quota/rate limit messages (assume API key quota)
    if (
      lowerError.includes('quota') ||
      lowerError.includes('rate limit') ||
      lowerError.includes('rate-limited')
    ) {
      return VeniceErrorType.QUOTA_ERROR;
    }

    // If 429 but we can't classify it, assume overload
    return VeniceErrorType.SERVER_OVERLOAD;
  }

  // Error 403 - Usually authentication or quota issue
  if (statusCode === 403) {
    if (lowerError.includes('insufficient credits') || lowerError.includes('créditos insuficientes')) {
      return VeniceErrorType.INSUFFICIENT_CREDITS;
    }
    return VeniceErrorType.QUOTA_ERROR;
  }

  return VeniceErrorType.UNKNOWN;
}

/**
 * Wait for a specific number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Circuit Breaker states
 */
enum CircuitState {
  CLOSED = "CLOSED",       // Working normally
  OPEN = "OPEN",           // Server overloaded, paused
  HALF_OPEN = "HALF_OPEN"  // Testing if server recovered
}

/**
 * Global Circuit Breaker to coordinate pauses across all users
 */
class VeniceCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private openedAt: number = 0;
  private failureCount: number = 0;
  private readonly cooldownMs: number = 30000; // 30 seconds
  private readonly maxFailures: number = 15;
  private lastSuccessAt: number = Date.now();
  private waitingPromises: Array<() => void> = [];

  /**
   * Check if circuit allows an attempt
   */
  async canAttempt(): Promise<boolean> {
    const now = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        // Working normally
        return true;

      case CircuitState.OPEN:
        // Check if cooldown time has passed
          if (now - this.openedAt >= this.cooldownMs) {
            this.state = CircuitState.HALF_OPEN;
            return true;
          }

          // Still in cooldown, wait
          const remainingMs = this.cooldownMs - (now - this.openedAt);

          // Wait until cooldown ends
          await sleep(remainingMs);
          return this.canAttempt();

        case CircuitState.HALF_OPEN:
          // Only allow one attempt at a time in HALF_OPEN mode
          // Other users wait to see the result
          if (this.waitingPromises.length > 0) {
            await new Promise<void>(resolve => {
              this.waitingPromises.push(resolve);
            });
            // After waiting, recursively check the new state
            return this.canAttempt();
          }
          return true;
    }
  }

  /**
   * Record a successful attempt
   */
  recordSuccess(): void {
    const wasOpen = this.state !== CircuitState.CLOSED;

    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastSuccessAt = Date.now();

    if (wasOpen) {
      // Notify all waiting users
      this.waitingPromises.forEach(resolve => resolve());
      this.waitingPromises = [];
    }
  }

  /**
   * Record a failure due to server overload
   */
  recordServerOverload(): void {
    this.failureCount++;

    if (this.failureCount >= this.maxFailures) {
      this.state = CircuitState.OPEN;
      this.openedAt = Date.now();

      // Reject all users waiting in HALF_OPEN
      this.waitingPromises.forEach(resolve => resolve());
      this.waitingPromises = [];

      throw new Error(`Venice server overloaded after ${this.maxFailures} attempts (${Math.ceil(this.failureCount * this.cooldownMs / 60000)} minutes). Please try again later.`);
    }

    // If we're in HALF_OPEN and failed, go back to OPEN
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.openedAt = Date.now();

      this.waitingPromises.forEach(resolve => resolve());
      this.waitingPromises = [];
    } else if (this.state === CircuitState.CLOSED) {
      this.state = CircuitState.OPEN;
      this.openedAt = Date.now();
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats(): { state: string; failureCount: number; maxFailures: number; cooldownSeconds: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      maxFailures: this.maxFailures,
      cooldownSeconds: this.cooldownMs / 1000
    };
  }

  /**
   * Reset the circuit (useful for testing)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.openedAt = 0;
    this.waitingPromises = [];
  }
}

/**
 * Global circuit breaker instance
 */
const globalCircuitBreaker = new VeniceCircuitBreaker();

/**
 * Image models available in Venice AI
 *
 * Pricing and features:
 * - z-image-turbo: $0.01/image (100 images = $1) - Good quality, fast
 * - imagineart-1.5-pro: $0.05/image (20 images = $1) - Superior realism, better lighting
 *
 * The difference is in the MODEL, not in technical specs.
 * imagineart-1.5-pro produces images with better inherent quality even with same parameters.
 */
export const VENICE_IMAGE_MODELS = {
  // z-image-turbo - Good quality for FREE tier
  TURBO: "z-image-turbo",

  // imagineart-1.5-pro - Superior realism for PLUS/ULTRA
  PRO: "imagineart-1.5-pro",
};

export class VeniceClient {
  private apiKeys: string[];
  private currentKeyIndex: number = 0;
  private baseURL: string;
  private defaultModel: string;

  constructor(config: VeniceConfig) {
    // Support both single key (deprecated) and multiple keys
    if (config.apiKeys && config.apiKeys.length > 0) {
      this.apiKeys = config.apiKeys;
    } else if (config.apiKey) {
      this.apiKeys = [config.apiKey];
    } else {
      throw new Error("VeniceClient requires apiKey or apiKeys");
    }

    this.baseURL = config.baseURL || "https://api.venice.ai/api/v1";
    this.defaultModel = config.defaultModel || "venice-uncensored";
  }

  /**
   * Get the current active API key
   */
  private getCurrentApiKey(): string {
    return this.apiKeys[this.currentKeyIndex];
  }

  /**
   * Rotate to the next available API key
   * Returns true if there are more keys, false if all have been tried
   */
  private rotateApiKey(): boolean {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;

    // If we're back at the beginning, it means we've tried all keys
    if (this.currentKeyIndex === 0) {
      console.error('[Venice] ⚠️  All API keys have been attempted');
      return false;
    }

    return true;
  }

  /**
   * Private method to execute Venice API calls with smart retries and circuit breaker
   */
  private async executeWithRetry(body: VeniceRequestBody): Promise<any> {
    let lastError: Error | null = null;
    const maxKeyRetries = this.apiKeys.length;
    const maxServerErrorRetries = 3;

    let serverErrorAttempts = 0;

    // Try with each available API key
    for (let keyAttempt = 0; keyAttempt < maxKeyRetries; keyAttempt++) {
      // Reset counters when changing key
      serverErrorAttempts = 0;

      // Retry loop for temporary errors
      while (true) {
        try {
          // Check circuit breaker before attempting
          const canProceed = await globalCircuitBreaker.canAttempt();
          if (!canProceed) {
            throw new Error('Circuit breaker rejected the attempt');
          }

          const currentKey = this.getCurrentApiKey();

          const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${currentKey}`,
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorText = await response.text();
            const errorType = classifyVeniceError(response.status, errorText);

            console.error(`[Venice] ❌ Error ${response.status} (${errorType}):`, errorText);

            // Handle based on error type
            switch (errorType) {
              case VeniceErrorType.SERVER_OVERLOAD:
                // Register in circuit breaker (handles pauses globally)
                globalCircuitBreaker.recordServerOverload();
                // Continue to retry (circuit breaker will control pauses)
                continue;

              case VeniceErrorType.SERVER_ERROR:
                serverErrorAttempts++;
                if (serverErrorAttempts <= maxServerErrorRetries) {
                  const backoffMs = Math.pow(2, serverErrorAttempts - 1) * 1000;
                  await sleep(backoffMs);
                  continue;
                } else {
                  lastError = new Error(`Server error after ${maxServerErrorRetries} retries`);
                  break;
                }

              case VeniceErrorType.QUOTA_ERROR:
                if (this.rotateApiKey()) {
                  lastError = new Error(`Rate limit exceeded on key #${this.currentKeyIndex}`);
                  break;
                } else {
                  throw new Error("All API keys have reached their rate limit. Please wait a moment before retrying.");
                }

              case VeniceErrorType.INSUFFICIENT_CREDITS:
                console.error('[Venice] 💰 Insufficient credits detected.');
                throw new Error("Insufficient credits in Venice AI. Please add more credits to your account.");

              case VeniceErrorType.UNKNOWN:
              default:
                throw new Error(`Venice API error: ${response.status} - ${errorText}`);
            }
          } else {
            // Successful response - register in circuit breaker
            const data = await response.json();
            globalCircuitBreaker.recordSuccess();
            return data;
          }
        } catch (error) {
          // If it's a fetch (network) or parsing error, throw immediately
          if (error instanceof TypeError || (error as any).name === 'SyntaxError') {
            console.error("[Venice] ❌ Network or parsing error:", error);
            throw error;
          }

          // If it's an error we threw, propagate it
          if (error instanceof Error &&
              (error.message.includes('Insufficient credits') ||
               error.message.includes('Venice API error') ||
               error.message.includes('rate limit') ||
               error.message.includes('Venice server overloaded'))) {
            throw error;
          }

          lastError = error as Error;
          break; // Move to next key
        }

        // Exit while loop
        break;
      }

      // If we got here and no lastError, something went wrong
      if (!lastError) {
        lastError = new Error('Unknown error occurred');
      }
    }

    // If we got here, all keys failed
    console.error('[Venice] ❌ All API keys failed after multiple retries');
    throw new Error("All Venice API keys have failed. Please verify your account or try again later.");
  }

  /**
   * Generate LLM response with smart error handling and retries
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    const messages: VeniceMessage[] = [
      {
        role: "user",
        content: request.prompt,
      },
    ];

    const body: VeniceRequestBody = {
      model: request.model || this.defaultModel,
      messages,
      temperature: request.temperature ?? 0.8,
      max_tokens: request.maxTokens ?? 1000,
      top_p: 0.9,
      stop: request.stopSequences,
    };

    const data = await this.executeWithRetry(body);

    return {
      text: data.choices[0]?.message?.content || "",
      model: data.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Generate response with system prompt + multiple messages (compatible with worlds format)
   */
  async generateWithMessages(options: {
    systemPrompt: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }): Promise<string> {
    const { systemPrompt, messages, temperature, maxTokens, model } = options;

    const veniceMessages: VeniceMessage[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const body: VeniceRequestBody = {
      model: model || this.defaultModel,
      messages: veniceMessages,
      temperature: temperature ?? 0.9,
      max_tokens: maxTokens ?? 1000,
      top_p: 0.9,
    };

    const data = await this.executeWithRetry(body);

    return data.choices[0]?.message?.content || "";
  }

  /**
   * Generate response with system prompt + user message with smart retry handling
   */
  async generateWithSystemPrompt(
    systemPrompt: string,
    userMessage: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<LLMResponse> {
    const messages: VeniceMessage[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userMessage,
      },
    ];

    const body: VeniceRequestBody = {
      model: options?.model || this.defaultModel,
      messages,
      temperature: options?.temperature ?? 0.8,
      max_tokens: options?.maxTokens ?? 1000,
      top_p: 0.9,
    };

    const data = await this.executeWithRetry(body);

    return {
      text: data.choices[0]?.message?.content || "",
      model: data.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Generate structured JSON
   */
  async generateJSON<T = any>(
    systemPrompt: string,
    userMessage: string,
    options?: {
      model?: string;
      temperature?: number;
    }
  ): Promise<T> {
    // Add /no_think for Qwen 3 models if model specified is qwen3-4b
    const isQwen3 = options?.model?.includes('qwen3') || options?.model?.includes('qwen-3');
    const finalUserMessage = isQwen3 ? `/no_think\n\n${userMessage}` : userMessage;

    const response = await this.generateWithSystemPrompt(
      systemPrompt + "\n\nRespond ONLY with valid JSON, no additional text.",
      finalUserMessage,
      {
        ...options,
        temperature: options?.temperature ?? 0.3, // Lower for JSON
      }
    );

    try {
      // Extract JSON from text (sometimes comes with ```json or extra text)
      let jsonText = response.text.trim();

      // Clean <think> tags that may appear with Qwen 3
      jsonText = jsonText.replace(/<think>[\s\S]*?<\/think>/gi, '');

      // Remove markdown code blocks if they exist
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      }

      // Normalize spaces and line breaks before parsing
      jsonText = jsonText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

      // Parse JSON
      const parsed = JSON.parse(jsonText);
      return parsed as T;
    } catch (error) {
      console.error("[Venice] ❌ JSON parsing error:", error);
      console.error("[Venice] Raw response:", response.text);
      throw new Error(`Failed to parse JSON response: ${error}`);
    }
  }

  /**
   * Select the appropriate image model based on user tier
   *
   * - FREE: z-image-turbo ($0.01/image) - 100 images = $1 USD
   * - PLUS: imagineart-1.5-pro ($0.05/image) - 20 images = $1 USD
   * - ULTRA: imagineart-1.5-pro ($0.05/image) - 20 images = $1 USD
   *
   * imagineart-1.5-pro has better realism and lighting handling inherently,
   * even with the same technical parameters (resolution, quality, etc).
   *
   * With a PLUS/ULTRA user paying $10, we get budget for 200 images.
   */
  private selectImageModel(userTier: 'free' | 'plus' | 'ultra'): string {
    switch (userTier) {
      case 'free':
        return VENICE_IMAGE_MODELS.TURBO; // $0.01 per image - Good quality
      case 'plus':
      case 'ultra':
        return VENICE_IMAGE_MODELS.PRO; // $0.05 per image - Superior realism
      default:
        return VENICE_IMAGE_MODELS.TURBO;
    }
  }

  /**
   * Generate an image using Venice AI with tier-based models
   *
   * Models and costs:
   * - FREE: z-image-turbo ($0.01/image) - Good quality, fast
   * - PLUS/ULTRA: imagineart-1.5-pro ($0.05/image) - Superior realism, better lighting
   *
   * The difference is in the MODEL, not in the resolution.
   * imagineart-1.5-pro has better inherent quality with the same parameters.
   */
  async generateImage(params: VeniceImageParams): Promise<VeniceImageResult> {
    try {
      // Select model based on tier
      const model = this.selectImageModel(params.userTier || 'free');

      const startTime = Date.now();

      // Build full prompt (combining prompt + negative prompt)
      let fullPrompt = params.prompt;

      if (params.negativePrompt) {
        fullPrompt += `\n\nNegative: ${params.negativePrompt}`;
      }

      const requestBody = {
        model,
        prompt: fullPrompt,
        n: 1,
        size: `${params.width || 1024}x${params.height || 1024}`,
        quality: 'standard', // Same for all, difference is in the model
        style: params.style || 'natural',
      };

      const currentKey = this.getCurrentApiKey();
      const response = await fetch(`${this.baseURL}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Venice Image] ❌ Error:', response.status, errorText);
        throw new Error(`Venice Image API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Venice API returns OpenAI-like format: { created, data: [{ b64_json: "..." }] }
      if (!data.data || !data.data[0] || !data.data[0].b64_json) {
        console.error('[Venice Image] Invalid response format:', JSON.stringify(data).substring(0, 500));
        throw new Error('Invalid response from Venice Image API - no b64_json in data array');
      }

      const generationTime = (Date.now() - startTime) / 1000;

      // Convert base64 to data URL
      const base64Image = data.data[0].b64_json;
      const imageUrl = `data:image/png;base64,${base64Image}`;

      return {
        imageUrl,
        revisedPrompt: fullPrompt, // Venice doesn't return revised prompt
        generationTime,
      };
    } catch (error) {
      console.error('[Venice Image] ❌ Error generating image:', error);
      throw error;
    }
  }


  /**
   * Enhance user prompt to optimized format for image models
   *
   * Transform narrative descriptions in any language to
   * optimized keywords in English with appropriate emphasis.
   *
   * Uses Qwen 3 4B (very economical: $0.15/M output, $0.05/M input)
   *
   * Limits by tier:
   * - FREE: 2 enhancements/day
   * - PLUS: 10 enhancements/day
   * - ULTRA: 30 enhancements/day
   *
   * Example:
   * Input: "mujer joven con moño, remera beige, ojos verdes"
   * Output: "professional portrait, young woman, (elegant bun:1.4), (beige top:1.5), (green eyes:1.3), photorealistic, 8k"
   */
  async enhanceImagePrompt(userPrompt: string): Promise<string> {
    const systemPrompt = `Eres un experto en optimización de prompts para modelos de generación de imágenes (Stable Diffusion, DALL-E, Midjourney).

Tu tarea: Transformar descripciones narrativas en keywords optimizadas separadas por comas.

REGLAS OBLIGATORIAS:
1. Convertir TODO a inglés (incluso si input está en español, francés, chino, etc)
2. Separar keywords con comas (NO frases completas)
3. Agregar énfasis con () en características importantes:
   - Características únicas/críticas: (keyword:1.4) o (keyword:1.5)
   - Características importantes: (keyword:1.2) o (keyword:1.3)
   - Características normales: sin paréntesis
4. Mantener estructura: [tipo imagen], [sujeto], [características con énfasis], [calidad]
5. Máximo 75-100 palabras
6. NO usar negative prompts (modelos modernos no los necesitan)
7. Si el usuario especifica estilo (anime, cartoon, realistic), respetarlo

EJEMPLOS:

Input: "mujer joven de cabello castaño ondulado con moño elegante, viste remera beige y vestido marrón, tiene ojos verdes brillantes y maquillaje natural"
Output: professional portrait photo, young woman, (elegant bun hairstyle:1.4), brown wavy hair, (beige top:1.5), brown dress, (bright green eyes:1.3), natural makeup, soft lighting, photorealistic, 8k

Input: "homme avec cheveux courts noirs, lunettes rondes, chemise blanche"
Output: professional portrait photo, man, (short black hair:1.2), (round glasses:1.3), white shirt, natural lighting, photorealistic, 8k

Input: "chica anime de pelo rosa largo, ojos azules grandes, uniforme escolar"
Output: anime style portrait, teenage girl, (long pink hair:1.3), (large blue eyes:1.3), school uniform, detailed anime art, vibrant colors

Input: "elderly woman, gray hair in braid, warm smile, knitted sweater"
Output: professional portrait photo, elderly woman, (gray hair in braid:1.2), (warm gentle smile:1.2), knitted sweater, soft natural lighting, photorealistic, 8k

IMPORTANTE: Solo retorna el prompt optimizado, nada más.`;

    const response = await this.generateWithMessages({
      systemPrompt,
      messages: [
        {
          role: 'user',
          content: `/no_think\n\n${userPrompt}`, // Qwen 3 command to disable internal reasoning
        },
      ],
      model: VENICE_MODELS.QWEN_3_4B, // Economical model
      temperature: 0.3, // Low temperature for consistency
      maxTokens: 300, // Increased to give margin without internal reasoning
    });

    // Post-processing: Clean <think> tags and line breaks
    let enhancedPrompt = response.trim();

    // Remove <think>...</think> blocks (empty or with content)
    enhancedPrompt = enhancedPrompt.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // Remove multiple line breaks and replace with space
    enhancedPrompt = enhancedPrompt.replace(/\n+/g, ' ');

    // Remove multiple spaces
    enhancedPrompt = enhancedPrompt.replace(/\s+/g, ' ');

    // Final trim
    enhancedPrompt = enhancedPrompt.trim();

    return enhancedPrompt;
  }

  /**
   * Generate optimized avatar image for characters
   *
   * The difference between tiers is in the MODEL used:
   * - FREE: z-image-turbo ($0.01/image) - Good quality
   * - PLUS/ULTRA: imagineart-1.5-pro ($0.05/image) - Superior realism, better lighting
   *
   * Same size (1024x1024) for all - difference in model quality.
   *
   * Does NOT use negative prompt by default (2025-2026 models are good without it).
   * Users can specify it only if they need specific cases.
   */
  async generateAvatar(params: {
    description: string;
    age?: number;
    gender?: 'male' | 'female' | 'non-binary';
    userTier?: 'free' | 'plus' | 'ultra';
    negativePrompt?: string; // Optional - only for specific cases where the user needs it
  }): Promise<VeniceImageResult> {
    let prompt = `professional portrait photo, ${params.description}`;

    if (params.age) {
      prompt += `, ${params.age} years old`;
    }

    if (params.gender) {
      const genderMap = {
        'male': 'male',
        'female': 'female',
        'non-binary': 'androgynous person'
      };
      prompt += `, ${genderMap[params.gender]}`;
    }

    prompt += ', high quality, realistic, detailed face, professional headshot, studio lighting, 8k';

    return this.generateImage({
      prompt,
      negativePrompt: params.negativePrompt, // undefined if not provided (modern models don't need it)
      width: 1024,
      height: 1024,
      style: 'natural',
      userTier: params.userTier || 'free',
    });
  }
}

/**
 * Load multiple API keys from environment variables
 * Supports VENICE_API_KEY or VENICE_API_KEY_1, VENICE_API_KEY_2, etc.
 */
function loadVeniceApiKeys(): string[] {
  const keys: string[] = [];

  // Try to load VENICE_API_KEY (single key)
  const singleKey = process.env.VENICE_API_KEY;
  if (singleKey) {
    keys.push(singleKey);
  }

  // Try to load VENICE_API_KEY_1, VENICE_API_KEY_2, etc.
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`VENICE_API_KEY_${i}`];
    if (key) {
      keys.push(key);
    }
  }

  return keys;
}

/**
 * Venice singleton client
 */
let veniceClient: VeniceClient | null = null;

export function getVeniceClient(): VeniceClient {
  if (!veniceClient) {
    const apiKeys = loadVeniceApiKeys();

    if (apiKeys.length === 0) {
      throw new Error("No Venice API keys found. Configure VENICE_API_KEY or VENICE_API_KEY_1, VENICE_API_KEY_2, etc.");
    }

    veniceClient = new VeniceClient({
      apiKeys,
      defaultModel: process.env.VENICE_MODEL || "venice-uncensored",
    });
  }

  return veniceClient;
}

/**
 * Get Venice global circuit breaker
 * Useful for monitoring, statistics, or manual reset in testing
 */
export function getVeniceCircuitBreaker() {
  return {
    getState: () => globalCircuitBreaker.getState(),
    getStats: () => globalCircuitBreaker.getStats(),
    reset: () => globalCircuitBreaker.reset(),
  };
}

/**
 * Models available in Venice AI (Text)
 */
export const VENICE_MODELS = {
  DEFAULT: "venice-uncensored",
  FAST: "qwen3-4b",
  BEST: "venice-uncensored",
  UNCENSORED: "venice-uncensored",
  QWEN_3_4B: "qwen3-4b",
  QWEN_3_235B: "qwen3-235b-a22b-instruct-2507",
};

/**
 * Recommended models for different tasks
 */
export const RECOMMENDED_MODELS = {
  // For fast appraisal (cheap and fast)
  APPRAISAL: VENICE_MODELS.FAST,

  // For emotion generation (balance)
  EMOTION: VENICE_MODELS.FAST,

  // For internal reasoning (uncensored, emotional)
  REASONING: VENICE_MODELS.UNCENSORED,
  ACTION: VENICE_MODELS.FAST,
  RESPONSE: VENICE_MODELS.UNCENSORED,
  JSON: VENICE_MODELS.DEFAULT,
  AMBIENT_DIALOGUE: VENICE_MODELS.QWEN_3_4B,
};
