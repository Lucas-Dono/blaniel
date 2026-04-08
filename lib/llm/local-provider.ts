/**
 * Local LLM Provider
 *
 * Support for local models:
 * - Ollama (llama3, mistral, etc.)
 * - LM Studio
 * - LocalAI
 * - Text Generation WebUI (oobabooga)
 */

import type {
  LLMProvider,
  LLMMessage,
  LLMResponse,
  GenerateOptions,
  ProfileGenerationInput,
  ProfileGenerationResult,
} from './types';

export interface LocalProviderConfig {
  type: 'ollama' | 'lmstudio' | 'localai' | 'textgen';
  url: string;
  model: string;
}

export class LocalLLMProvider implements LLMProvider {
  private config: LocalProviderConfig;

  constructor(config: LocalProviderConfig) {
    this.config = config;
  }

  async generate(options: GenerateOptions & { useFullModel?: boolean }): Promise<string> {
    const messages: LLMMessage[] = [
      { role: 'system', content: options.systemPrompt },
      ...options.messages,
    ];
    const response = await this.chat(messages);
    return response.content;
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const endpoint = this.getEndpoint();
    const requestBody = this.formatRequest(messages);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Local LLM error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('Error with local LLM:', error);
      throw error;
    }
  }

  private getEndpoint(): string {
    switch (this.config.type) {
      case 'ollama':
        return `${this.config.url}/api/chat`;
      case 'lmstudio':
        return `${this.config.url}/v1/chat/completions`;
      case 'localai':
        return `${this.config.url}/v1/chat/completions`;
      case 'textgen':
        return `${this.config.url}/v1/chat/completions`;
      default:
        throw new Error(`Unknown local LLM type: ${this.config.type}`);
    }
  }

  private formatRequest(messages: LLMMessage[]): any {
    switch (this.config.type) {
      case 'ollama':
        return {
          model: this.config.model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          stream: false,
        };

      case 'lmstudio':
      case 'localai':
      case 'textgen':
        return {
          model: this.config.model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          temperature: 0.7,
          max_tokens: 2000,
        };

      default:
        throw new Error(`Unknown local LLM type: ${this.config.type}`);
    }
  }

  private parseResponse(data: any): LLMResponse {
    let content: string;

    switch (this.config.type) {
      case 'ollama':
        content = data.message?.content || '';
        break;

      case 'lmstudio':
      case 'localai':
      case 'textgen':
        content = data.choices?.[0]?.message?.content || '';
        break;

      default:
        throw new Error(`Unknown local LLM type: ${this.config.type}`);
    }

    return {
      content,
      model: this.config.model,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }

  async generateProfile(input: ProfileGenerationInput): Promise<ProfileGenerationResult> {
    // Provide defaults for optional fields
    const personality = input.personality || 'friendly and helpful';
    const purpose = input.purpose || 'help users';
    const tone = input.tone || 'casual and friendly';

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'You are an expert at creating character profiles for video game NPCs.',
      },
      {
        role: 'user',
        content: `Create a complete profile for this NPC:
Name: ${input.name}
Type: ${input.kind}
Personality: ${personality}
Purpose: ${purpose}
Tone: ${tone}

Return a JSON with:
- occupation (job/role)
- traits (array of 3-5 personality traits)
- hobbies (array of 2-4 hobbies)
- backstory (brief background story, 2-3 lines)

Also generate a systemPrompt (personality instructions for the NPC).`,
      },
    ];

    const response = await this.chat(messages);

    // Parse JSON from response
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          profile: {
            occupation: { title: parsed.occupation || purpose },
            interests: {
              traits: parsed.traits || [],
              hobbies: parsed.hobbies || [],
            },
            background: {
              backstory: parsed.backstory || '',
            },
          },
          systemPrompt: parsed.systemPrompt || `You are ${input.name}. ${personality}. ${purpose}.`,
        };
      }
    } catch (error) {
      console.error('Error parsing profile from local LLM:', error);
    }

    // Fallback - return minimal valid profile
    return {
      profile: {
        occupation: { title: purpose },
        interests: {
          traits: [],
          hobbies: [],
        },
      },
      systemPrompt: `You are ${input.name}. ${personality}. ${purpose}.`,
    };
  }
}

/**
 * Detect if a local LLM is available
 */
export async function detectLocalLLM(): Promise<LocalProviderConfig | null> {
  const providers = [
    { type: 'ollama' as const, url: 'http://localhost:11434', model: 'llama3' },
    { type: 'lmstudio' as const, url: 'http://localhost:1234', model: 'local-model' },
    { type: 'localai' as const, url: 'http://localhost:8080', model: 'gpt-3.5-turbo' },
    { type: 'textgen' as const, url: 'http://localhost:5000', model: 'default' },
  ];

  for (const provider of providers) {
    try {
      const testUrl = provider.type === 'ollama'
        ? `${provider.url}/api/tags`
        : `${provider.url}/v1/models`;

      const response = await fetch(testUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });

      if (response.ok) {
        console.log(`✅ Detected local ${provider.type} at ${provider.url}`);

        // If Ollama, get the first available model
        if (provider.type === 'ollama') {
          const data = await response.json();
          if (data.models && data.models.length > 0) {
            provider.model = data.models[0].name;
          }
        }

        return provider;
      }
    } catch (error) {
      // Provider not available
    }
  }

  return null;
}

/**
 * Create local provider if configured
 */
export function createLocalProvider(): LocalLLMProvider | null {
  const type = process.env.LOCAL_LLM_TYPE as LocalProviderConfig['type'] | undefined;
  const url = process.env.LOCAL_LLM_URL;
  const model = process.env.LOCAL_LLM_MODEL;

  if (!type || !url || !model) {
    return null;
  }

  return new LocalLLMProvider({ type, url, model });
}
