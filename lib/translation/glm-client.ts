import { GLMRequest, GLMResponse, GLMMessage } from './types';

// Z.ai Coding Plan endpoint (OpenAI-compatible)
const GLM_API_ENDPOINT = 'https://api.z.ai/api/coding/paas/v4/chat/completions';
const DEFAULT_MODEL = 'GLM-4.7';
const DEFAULT_RATE_LIMIT = 1000;
const MAX_RETRIES = 3;

class GLMClientManager {
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;
  private rateLimit: number;
  private lastRequestTime = 0;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private keysLoaded = false;

  constructor() {
    this.rateLimit = DEFAULT_RATE_LIMIT;
  }

  private loadApiKeys(): void {
    if (this.keysLoaded) return;

    this.rateLimit = parseInt(process.env.GLM_RATE_LIMIT || `${DEFAULT_RATE_LIMIT}`);

    let keyIndex = 1;
    while (true) {
      const key = process.env[`GLM_API_KEY_${keyIndex}`];
      if (!key) break;
      this.apiKeys.push(key);
      keyIndex++;
    }

    if (this.apiKeys.length === 0) {
      throw new Error('No GLM API keys found. Set GLM_API_KEY_1 in environment variables.');
    }

    console.log(`Loaded ${this.apiKeys.length} GLM API key(s)`);
    this.keysLoaded = true;
  }

  private ensureKeysLoaded(): void {
    if (!this.keysLoaded) {
      this.loadApiKeys();
    }
  }

  private getCurrentKey(): string {
    return this.apiKeys[this.currentKeyIndex];
  }

  rotateKey(): boolean {
    if (this.apiKeys.length <= 1) {
      console.warn('No additional API keys available for rotation');
      return false;
    }

    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    console.log(`Rotated to API key ${this.currentKeyIndex + 1}/${this.apiKeys.length}`);
    return true;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimit) {
      const waitTime = this.rateLimit - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  private extractContent(message: any): string {
    // GLM-4.7 returns reasoning_content, other models return content
    const content = message.content || message.reasoning_content || '';
    return content.trim();
  }

  private async makeRequest(messages: GLMMessage[], temperature = 0.3, maxTokens = 2000): Promise<GLMResponse> {
    this.ensureKeysLoaded();
    await this.waitForRateLimit();

    const request: GLMRequest = {
      model: process.env.GLM_MODEL || DEFAULT_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    const response = await fetch(GLM_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getCurrentKey()}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GLM API error (${response.status}): ${errorText}`);
    }

    const data: GLMResponse = await response.json();

    if (data.usage) {
      this.totalInputTokens += data.usage.prompt_tokens;
      this.totalOutputTokens += data.usage.completion_tokens;
    }

    return data;
  }

  async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message.toLowerCase();

        if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
          console.warn(`Rate limit hit, attempt ${attempt + 1}/${MAX_RETRIES}`);

          if (this.rotateKey()) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }

        if (errorMessage.includes('403') || errorMessage.includes('unauthorized')) {
          console.warn(`Auth error, rotating key, attempt ${attempt + 1}/${MAX_RETRIES}`);

          if (this.rotateKey()) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }

        const backoffTime = Math.pow(2, attempt) * 1000;
        console.warn(`Request failed, retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  async translateBatch(texts: string[]): Promise<string[]> {
    return this.executeWithRetry(async () => {
      const batchText = texts.map((t, i) => `[${i + 1}]\n${t}`).join('\n\n---\n\n');

      const messages: GLMMessage[] = [
        {
          role: 'system',
          content: 'You are a professional translator for software documentation. Translate Spanish developer comments to English, preserving technical terms, code references, and formatting. If a comment is already in English, return it unchanged. Maintain the exact same numbering format.',
        },
        {
          role: 'user',
          content: `Translate these numbered comments from Spanish to English (if already in English, return unchanged). Keep the exact same [N] numbering:\n\n${batchText}\n\nReturn the translations with the same [N] format.`,
        },
      ];

      const response = await this.makeRequest(messages, 0.3, 3000);
      const translated = this.extractContent(response.choices[0]?.message) || '';

      const results: string[] = [];
      const sections = translated.split(/---|\n\n(?=\[\d+\])/);

      for (let i = 0; i < texts.length; i++) {
        const section = sections.find(s => s.trim().startsWith(`[${i + 1}]`));
        if (section) {
          const content = section.replace(/^\[\d+\]\s*/, '').trim();
          results.push(content);
        } else {
          results.push(texts[i]);
        }
      }

      return results;
    });
  }

  getUsageStats(): { inputTokens: number; outputTokens: number; estimatedCost: number } {
    const inputCost = (this.totalInputTokens / 1_000_000) * 0.10;
    const outputCost = (this.totalOutputTokens / 1_000_000) * 0.30;

    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      estimatedCost: inputCost + outputCost,
    };
  }
}

export const glmClient = new GLMClientManager();
