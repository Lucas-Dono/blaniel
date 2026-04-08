/**
 * AI Service - Intelligent routing between Gemini (public data) and Venice (private/NSFW)
 * Handles all AI generation tasks for Smart Start
 *
 * Fallback system: If Gemini fails after retries, automatically fallback to Venice
 */

import { executeWithRetry } from '@/lib/ai/gemini-client';
import { getVeniceClient, VENICE_MODELS } from '@/lib/emotional-system/llm/venice';

// Types for AI generation
export interface GenerationTask {
  type:
    | 'extract-character'
    | 'generate-character'
    | 'generate-personality'
    | 'generate-description'
    | 'enhance-field';
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  source?: 'public-api' | 'user-input' | 'mixed';
  userContext?: boolean;
  nsfwMode?: boolean;
  allowAdultContent?: boolean;
}

export interface GenerationResult {
  text: string;
  model: 'gemini' | 'mistral' | 'claude';
  tokensUsed: {
    input: number;
    output: number;
  };
  finishReason?: string;
}

// Venice API client interface (SDK would be ideal, but we'll use fetch)
interface VeniceMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface VeniceResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class AIService {
  private veniceApiKey: string | null = null;
  private veniceBaseUrl = 'https://api.venice.ai/api/v1';
  private router: AIModelRouter;

  constructor() {
    // Initialize Venice
    this.veniceApiKey = process.env.VENICE_API_KEY || null;

    this.router = new AIModelRouter();
  }

  /**
   * Generate content using the appropriate model
   * With automatic fallback to Venice if Gemini fails
   */
  async generate(task: GenerationTask): Promise<GenerationResult> {
    const model = this.router.selectModel(task);

    console.log(`[AIService] Using ${model} for task: ${task.type}`);

    try {
      if (model === 'gemini') {
        return await this.generateWithGemini(task);
      } else {
        return await this.generateWithVenice(task);
      }
    } catch (primaryError: any) {
      // If primary model fails, fallback to Venice (if not already using it)
      // model can be 'gemini' or 'mistral', mistral means we're already using Venice
      if (model === 'gemini') {
        console.warn(`[AIService] ⚠️ Gemini failed, falling back to Venice...`);
        console.warn(`[AIService] Error:`, primaryError.message);

        try {
          const veniceClient = getVeniceClient();

          // Select appropriate model based on task type
          // venice-uncensored: Private/user-generated content that may need uncensored model
          // qwen3: Administrative tasks where censorship doesn't affect
          const isPrivateContent = task.type === 'generate-character' ||
                                   task.userContext ||
                                   task.nsfwMode ||
                                   task.allowAdultContent;

          const fallbackModel = isPrivateContent
            ? VENICE_MODELS.UNCENSORED  // For private/user content
            : VENICE_MODELS.QWEN_3_235B; // For admin tasks (cheaper, 10x larger)

          console.log(`[AIService] Fallback model: ${fallbackModel} (private: ${isPrivateContent})`);

          const systemPrompt = task.systemPrompt || 'You are a helpful AI assistant.';
          const veniceResponse = await veniceClient.generateWithMessages({
            systemPrompt,
            messages: [{ role: 'user', content: task.prompt }],
            temperature: task.temperature ?? 0.85,
            maxTokens: task.maxTokens ?? 2000,
            model: fallbackModel,
          });

          console.log('[AIService] ✅ Fallback to Venice successful');

          return {
            text: veniceResponse,
            model: 'mistral', // Maintain interface compatibility
            tokensUsed: {
              input: 0,
              output: 0,
            },
            finishReason: 'stop',
          };
        } catch (fallbackError: any) {
          console.error('[AIService] ❌ Venice fallback also failed:', fallbackError.message);
          throw new Error(`Both Gemini and Venice failed. Gemini: ${primaryError.message}. Venice: ${fallbackError.message}`);
        }
      } else {
        // Already using mistral/Venice, no fallback available
        throw primaryError;
      }
    }
  }

  /**
   * Generate using Gemini (for public data extraction)
   */
  private async generateWithGemini(task: GenerationTask): Promise<GenerationResult> {
    try {
      const result = await executeWithRetry(async (client) => {
        const model = client.getGenerativeModel({
          model: process.env.GEMINI_MODEL_FULL || 'gemini-2.5-flash',
        });

        return await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [{ text: task.prompt }],
            },
          ],
          generationConfig: {
            temperature: task.temperature ?? 0.9,
            maxOutputTokens: task.maxTokens ?? 2000,
          },
        });
      });

      const response = result.response;
      const text = response.text();

      return {
        text,
        model: 'gemini',
        tokensUsed: {
          input: response.usageMetadata?.promptTokenCount || 0,
          output: response.usageMetadata?.candidatesTokenCount || 0,
        },
        finishReason: response.candidates?.[0]?.finishReason,
      };
    } catch (error) {
      console.error('[AIService] Gemini generation error:', error);
      throw error;
    }
  }

  /**
   * Generate using Venice (Mistral Uncensored for privacy/NSFW)
   */
  private async generateWithVenice(task: GenerationTask): Promise<GenerationResult> {
    if (!this.veniceApiKey) {
      throw new Error('Venice API key not configured');
    }

    try {
      const messages: VeniceMessage[] = [];

      if (task.systemPrompt) {
        messages.push({
          role: 'system',
          content: task.systemPrompt,
        });
      }

      messages.push({
        role: 'user',
        content: task.prompt,
      });

      const response = await fetch(`${this.veniceBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.veniceApiKey}`,
        },
        body: JSON.stringify({
          model: VENICE_MODELS.UNCENSORED,
          messages,
          temperature: task.temperature ?? 0.9,
          max_tokens: task.maxTokens ?? 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Venice API error: ${response.status} ${response.statusText}`);
      }

      const data: VeniceResponse = await response.json();

      return {
        text: data.choices[0].message.content,
        model: 'mistral',
        tokensUsed: {
          input: data.usage.prompt_tokens,
          output: data.usage.completion_tokens,
        },
        finishReason: data.choices[0].finish_reason,
      };
    } catch (error) {
      console.error('[AIService] Venice generation error:', error);
      throw error;
    }
  }

  /**
   * Extract character data from search result
   */
  async extractCharacterFromSearchResult(
    searchResult: any,
    genreContext?: string
  ): Promise<any> {
    const prompt = this.buildExtractionPrompt(searchResult, genreContext);

    const result = await this.generate({
      type: 'extract-character',
      prompt,
      source: 'public-api',
      temperature: 0.3, // More deterministic for extraction
      maxTokens: 1500,
    });

    return this.parseStructuredResponse(result.text);
  }

  /**
   * Generate character from scratch
   */
  async generateCharacter(
    name: string,
    genre: string,
    archetype: string,
    additionalContext?: string
  ): Promise<any> {
    const prompt = this.buildGenerationPrompt(name, genre, archetype, additionalContext);

    const result = await this.generate({
      type: 'generate-character',
      prompt,
      source: 'user-input',
      temperature: 0.9,
      maxTokens: 2000,
    });

    return this.parseStructuredResponse(result.text);
  }

  /**
   * Build extraction prompt
   */
  private buildExtractionPrompt(searchResult: any, genreContext?: string): string {
    return `Extract character information from this data for use in a character-based chatbot.

**Source Data:**
- Name: ${searchResult.name}
- Description: ${searchResult.description || 'N/A'}
- Source: ${searchResult.source}
- Metadata: ${JSON.stringify(searchResult.metadata || {}, null, 2)}

**Genre Context:** ${genreContext || 'General'}

**Extract and return JSON with:**
\`\`\`json
{
  "personality": ["trait1", "trait2", "trait3", "trait4", "trait5"],
  "background": "Brief backstory in 2-3 sentences",
  "appearance": "Physical description",
  "age": "Age or age range",
  "occupation": "Job or role",
  "relationships": ["key relationship 1", "key relationship 2"],
  "goals": ["main motivation 1", "main motivation 2"],
  "quirks": ["unique characteristic 1", "unique characteristic 2"],
  "communicationStyle": "How they speak and interact (1-2 sentences)",
  "catchphrases": ["phrase1", "phrase2"],
  "likes": ["thing1", "thing2", "thing3"],
  "dislikes": ["thing1", "thing2"]
}
\`\`\`

Be specific and accurate to the source material. For fictional characters, maintain canon. For real people, be respectful and factual.

Return ONLY valid JSON, no additional text.`;
  }

  /**
   * Build generation prompt
   */
  private buildGenerationPrompt(
    name: string,
    genre: string,
    archetype: string,
    additionalContext?: string
  ): string {
    return `Create a detailed character profile for a chatbot character with these specifications:

**Character Name:** ${name}
**Genre:** ${genre}
**Archetype:** ${archetype}
${additionalContext ? `**Additional Context:** ${additionalContext}` : ''}

Generate a complete character profile in JSON format:

\`\`\`json
{
  "personality": ["5-7 distinct personality traits"],
  "background": "Compelling backstory in 2-3 sentences that explains who they are and their history",
  "appearance": "Detailed physical description including notable features",
  "age": "Appropriate age or age range",
  "occupation": "Their job, role, or main activity",
  "relationships": ["Important relationships that define them"],
  "goals": ["Their main motivations and what drives them"],
  "quirks": ["Unique characteristics that make them memorable"],
  "communicationStyle": "Detailed description of how they speak, their tone, vocabulary, and interaction patterns",
  "catchphrases": ["2-3 phrases they might commonly use"],
  "likes": ["Things they enjoy or are passionate about"],
  "dislikes": ["Things they avoid or dislike"],
  "skills": ["Their competencies and abilities"],
  "fears": ["Their vulnerabilities or concerns"]
}
\`\`\`

Make the character feel authentic and well-rounded. Ensure consistency with the genre and archetype.

Return ONLY valid JSON, no additional text.`;
  }

  /**
   * Parse structured JSON response from AI
   */
  private parseStructuredResponse(text: string): any {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;

      return JSON.parse(jsonText.trim());
    } catch (error) {
      console.error('[AIService] Failed to parse JSON response:', error);
      console.error('Raw text:', text);
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  /**
   * Check if AI services are configured
   */
  isConfigured(): { gemini: boolean; venice: boolean } {
    return {
      gemini: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      venice: this.veniceApiKey !== null,
    };
  }
}

/**
 * AI Model Router - Decides which model to use based on task requirements
 */
class AIModelRouter {
  selectModel(task: GenerationTask): 'gemini' | 'mistral' {
    // Privacy-sensitive content MUST use Venice
    if (task.userContext || task.nsfwMode || task.allowAdultContent) {
      return 'mistral';
    }

    // Public data extraction and character generation can use Gemini first (faster, cheaper)
    // Falls back to Venice automatically if Gemini fails
    if (task.source === 'public-api' && (task.type === 'extract-character' || task.type === 'generate-character')) {
      return 'gemini';
    }

    // User-generated content should use Venice for privacy
    if (task.source === 'user-input') {
      return 'mistral';
    }

    // Default to Mistral for safety
    return 'mistral';
  }
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
}

export const aiService = getAIService();
