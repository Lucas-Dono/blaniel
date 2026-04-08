/**
 * OPENROUTER CLIENT
 *
 * Client for OpenRouter API that supports multiple models,
 * including uncensored models for emotional companions
 */

import { LLMRequest, LLMResponse } from "../types";

export interface OpenRouterConfig {
  apiKey?: string; // Single key (deprecated, use apiKeys)
  apiKeys?: string[]; // Multiple keys for rotation
  baseURL?: string;
  defaultModel?: string;
}

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterRequestBody {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
}

export class OpenRouterClient {
  private apiKeys: string[];
  private currentKeyIndex: number = 0;
  private baseURL: string;
  private defaultModel: string;

  constructor(config: OpenRouterConfig) {
    // Support both single key (deprecated) and multiple keys
    if (config.apiKeys && config.apiKeys.length > 0) {
      this.apiKeys = config.apiKeys;
    } else if (config.apiKey) {
      this.apiKeys = [config.apiKey];
    } else {
      throw new Error("OpenRouterClient requires apiKey or apiKeys");
    }

    this.baseURL = config.baseURL || "https://openrouter.ai/api/v1";
    this.defaultModel = config.defaultModel || "cognitivecomputations/dolphin-mistral-24b-venice-edition:free";

    console.log('[OpenRouter] Initializing client...');
    console.log('[OpenRouter] Available API Keys:', this.apiKeys.length);
    console.log('[OpenRouter] Active API Key: #1');
    console.log('[OpenRouter] Default model:', this.defaultModel);
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
      console.error('[OpenRouter] ⚠️  All API keys have been attempted');
      return false;
    }

    console.log(`[OpenRouter] 🔄 Rotating to API key #${this.currentKeyIndex + 1}`);
    return true;
  }

  /**
   * Generate LLM response with automatic API key rotation
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    const maxRetries = this.apiKeys.length;

    // Try with each available API key
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const messages: OpenRouterMessage[] = [
          {
            role: "user",
            content: request.prompt,
          },
        ];

        const body: OpenRouterRequestBody = {
          model: request.model || this.defaultModel,
          messages,
          temperature: request.temperature ?? 0.8,
          max_tokens: request.maxTokens ?? 1000,
          top_p: 0.9,
          stop: request.stopSequences,
        };

        const currentKey = this.getCurrentApiKey();
        console.log(`[OpenRouter] Sending request to ${body.model} with API key #${this.currentKeyIndex + 1}...`);

        const response = await fetch(`${this.baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentKey}`,
            "HTTP-Referer": "http://localhost:3000", // For analytics
            "X-Title": "Blaniel", // For analytics
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[OpenRouter] Error ${response.status}:`, errorText);

          // Detect quota errors (429, 403, or quota/rate limit messages)
          const isQuotaError = response.status === 429 ||
                               response.status === 403 ||
                               errorText.toLowerCase().includes('quota') ||
                               errorText.toLowerCase().includes('rate limit') ||
                               errorText.toLowerCase().includes('rate-limited');

          if (isQuotaError && this.rotateApiKey()) {
            console.log('[OpenRouter] Quota error detected, trying next API key...');
            lastError = new Error(`Quota exceeded on key #${this.currentKeyIndex}`);
            continue; // Retry with next key
          }

          throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        const elapsedMs = Date.now() - startTime;
        console.log(`[OpenRouter] Response received in ${elapsedMs}ms`);

        return {
          text: data.choices[0]?.message?.content || "",
          model: data.model,
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          },
        };
      } catch (error) {
        lastError = error as Error;

        // If it's not a quota error, throw immediately
        if (!lastError.message.includes('Quota') && !lastError.message.includes('429')) {
          console.error("[OpenRouter] Generation error:", error);
          throw error;
        }
      }
    }

    // If we got here, all keys failed
    console.error('[OpenRouter] ❌ All API keys exhausted their quota');
    throw new Error("All OpenRouter API keys have exhausted their quota. Please add more keys or wait for them to renew.");
  }

  /**
   * Generate response with system prompt + user message with automatic API key rotation
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
    let lastError: Error | null = null;
    const maxRetries = this.apiKeys.length;

    // Try with each available API key
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const messages: OpenRouterMessage[] = [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userMessage,
          },
        ];

        const body: OpenRouterRequestBody = {
          model: options?.model || this.defaultModel,
          messages,
          temperature: options?.temperature ?? 0.8,
          max_tokens: options?.maxTokens ?? 1000,
          top_p: 0.9,
        };

        const currentKey = this.getCurrentApiKey();
        console.log(`[OpenRouter] Generating with system prompt using API key #${this.currentKeyIndex + 1}...`);

        const response = await fetch(`${this.baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentKey}`,
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Blaniel",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[OpenRouter] Error ${response.status}:`, errorText);

          // Detect quota errors
          const isQuotaError = response.status === 429 ||
                               response.status === 403 ||
                               errorText.toLowerCase().includes('quota') ||
                               errorText.toLowerCase().includes('rate limit') ||
                               errorText.toLowerCase().includes('rate-limited');

          if (isQuotaError && this.rotateApiKey()) {
            console.log('[OpenRouter] Quota error detected in generateWithSystemPrompt, trying next API key...');
            lastError = new Error(`Quota exceeded on key #${this.currentKeyIndex}`);
            continue; // Retry with next key
          }

          throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        return {
          text: data.choices[0]?.message?.content || "",
          model: data.model,
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          },
        };
      } catch (error) {
        lastError = error as Error;

        // If it's not a quota error, throw immediately
        if (!lastError.message.includes('Quota') && !lastError.message.includes('429')) {
          console.error("[OpenRouter] Generation error:", error);
          throw error;
        }
      }
    }

    // If we got here, all keys failed
    console.error('[OpenRouter] ❌ All API keys exhausted their quota in generateWithSystemPrompt');
    throw new Error("All OpenRouter API keys have exhausted their quota. Please add more keys or wait for them to renew.");
  }

  /**
   * Generate structured JSON (better with Claude or GPT-4)
   */
  async generateJSON<T = any>(
    systemPrompt: string,
    userMessage: string,
    options?: {
      model?: string;
      temperature?: number;
    }
  ): Promise<T> {
    const response = await this.generateWithSystemPrompt(
      systemPrompt + "\n\nRespond ONLY with valid JSON, no additional text.",
      userMessage,
      {
        ...options,
        temperature: options?.temperature ?? 0.3, // Lower for JSON
      }
    );

    try {
      // Extract JSON from text (sometimes comes with ```json or extra text)
      let jsonText = response.text.trim();

      // Remove markdown code blocks if they exist
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      }

      // Parse JSON
      const parsed = JSON.parse(jsonText);
      return parsed as T;
    } catch (error) {
      console.error("[OpenRouter] JSON parsing error:", error);
      console.error("[OpenRouter] Raw response:", response.text);
      throw new Error(`Failed to parse JSON response: ${error}`);
    }
  }
}

/**
 * Load multiple API keys from environment variables
 * Supports OPENROUTER_API_KEY or OPENROUTER_API_KEY_1, OPENROUTER_API_KEY_2, etc.
 */
function loadOpenRouterApiKeys(): string[] {
  const keys: string[] = [];

  // Try to load OPENROUTER_API_KEY (single key)
  const singleKey = process.env.OPENROUTER_API_KEY;
  if (singleKey) {
    keys.push(singleKey);
  }

  // Try to load OPENROUTER_API_KEY_1, OPENROUTER_API_KEY_2, etc.
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`OPENROUTER_API_KEY_${i}`];
    if (key) {
      keys.push(key);
    }
  }

  return keys;
}

/**
 * OpenRouter singleton client
 */
let openRouterClient: OpenRouterClient | null = null;

export function getOpenRouterClient(): OpenRouterClient {
  if (!openRouterClient) {
    const apiKeys = loadOpenRouterApiKeys();

    if (apiKeys.length === 0) {
      throw new Error("No OpenRouter API keys found. Configure OPENROUTER_API_KEY or OPENROUTER_API_KEY_1, OPENROUTER_API_KEY_2, etc.");
    }

    openRouterClient = new OpenRouterClient({
      apiKeys,
      defaultModel: process.env.MODEL_UNCENSORED || "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    });

    console.log("[OpenRouter] Client initialized with uncensored model");
  }

  return openRouterClient;
}

/**
 * Helper function to get OpenRouter Gemini model from environment variable
 * Converts GEMINI_MODEL_LITE to OpenRouter format (google/MODEL:free)
 */
function getOpenRouterGeminiModel(): string {
  const geminiModel = process.env.GEMINI_MODEL_LITE;
  if (geminiModel) {
    // If model already has google/ prefix, use as is
    if (geminiModel.startsWith('google/')) {
      return geminiModel.includes(':free') ? geminiModel : `${geminiModel}:free`;
    }
    // Otherwise, add google/ prefix and :free suffix
    return `google/${geminiModel}:free`;
  }
  // Fallback to default
  return "google/gemini-2.5-flash-exp:free";
}

/**
 * Recommended models for different tasks
 */
export const RECOMMENDED_MODELS = {
  // For fast appraisal (cheap and fast)
  APPRAISAL: getOpenRouterGeminiModel(),

  // For emotion generation (cheap)
  EMOTION: getOpenRouterGeminiModel(),

  // For internal reasoning (uncensored, emotional)
  REASONING: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",

  // For action decision (fast)
  ACTION: getOpenRouterGeminiModel(),

  // For final response (uncensored, expressive)
  RESPONSE: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",

  JSON: getOpenRouterGeminiModel(),
  JSON_CHEAP: getOpenRouterGeminiModel(),
};
