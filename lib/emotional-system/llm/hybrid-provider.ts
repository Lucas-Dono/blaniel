/**
 * HYBRID LLM PROVIDER
 *
 * Intelligent LLM provider selection system by phase.
 *
 * Strategy:
 * - Gemini (free): Technical phases that DON'T require uncensored content
 * - Venice (paid): Phases that generate visible text or require total authenticity
 *
 * Estimated savings: 60-70% in total costs
 */

import { getVeniceClient, VENICE_MODELS } from './venice';
import { LLMRequest, LLMResponse } from '../types';
import { getLLMProvider } from '@/lib/llm/provider';

export type LLMPhase =
  | 'appraisal'      // ✅ Gemini - Technical JSON evaluation
  | 'emotion'        // ✅ Gemini - Emotion generation JSON
  | 'reasoning'      // ❌ Venice - Authentic internal thinking
  | 'action'         // ✅ Gemini - Action decision JSON
  | 'response'       // ❌ Venice - Visible response (CRITICAL)
  | 'proactive';     // ❌ Venice - Visible proactive message (CRITICAL)

/**
 * Provider configuration by phase
 */
const PHASE_CONFIG: Record<LLMPhase, {
  provider: 'gemini' | 'venice';
  reason: string;
  model?: string;
}> = {
  appraisal: {
    provider: 'gemini',
    reason: 'Numeric technical evaluation - Does not require uncensored content',
  },
  emotion: {
    provider: 'gemini',
    reason: 'Emotion generation JSON - Does not require uncensored content',
  },
  reasoning: {
    provider: 'venice',
    reason: 'Authentic internal thinking - Requires total honesty',
    model: VENICE_MODELS.DEFAULT,
  },
  action: {
    provider: 'gemini',
    reason: 'Action decision JSON - Does not require uncensored content',
  },
  response: {
    provider: 'venice',
    reason: 'CRITICAL: User-visible text - Requires total uncensored content',
    model: VENICE_MODELS.DEFAULT,
  },
  proactive: {
    provider: 'venice',
    reason: 'CRITICAL: User-visible message - Requires total uncensored content',
    model: VENICE_MODELS.DEFAULT,
  },
};

/**
 * Hybrid client that automatically selects the best provider
 */
export class HybridLLMProvider {
  private veniceClient = getVeniceClient();
  private geminiClient = getLLMProvider();

  /**
   * Generate response using the optimal provider for the phase
   */
  async generate(
    phase: LLMPhase,
    request: LLMRequest
  ): Promise<LLMResponse> {
    const config = PHASE_CONFIG[phase];

    if (config.provider === 'venice') {
      // Use Venice for critical phases
      return this.veniceClient.generate({
        ...request,
        model: config.model || request.model,
      });
    } else {
      // Use Gemini for technical phases
      // Gemini returns string directly, not { text } object
      const responseText = await this.geminiClient.generate({
        systemPrompt: '',
        messages: [
          { role: 'user', content: request.prompt }
        ],
      });

      // Convert to LLMResponse format
      return {
        text: responseText,
        model: process.env.GEMINI_MODEL_LITE || 'gemini-2.5-flash-lite',
        usage: {
          promptTokens: 0,  // Gemini doesn't return usage
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    }
  }

  /**
   * Generate with system prompt
   */
  async generateWithSystemPrompt(
    phase: LLMPhase,
    systemPrompt: string,
    userMessage: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<LLMResponse> {
    const config = PHASE_CONFIG[phase];

    if (config.provider === 'venice') {
      return this.veniceClient.generateWithSystemPrompt(
        systemPrompt,
        userMessage,
        {
          model: config.model,
          ...options,
        }
      );
    } else {
      const combinedPrompt = `${systemPrompt}\n\n${userMessage}`;
      const responseText = await this.geminiClient.generate({
        systemPrompt: '',
        messages: [
          { role: 'user', content: combinedPrompt }
        ],
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });

      return {
        text: responseText,
        model: process.env.GEMINI_MODEL_LITE || 'gemini-2.5-flash-lite',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    }
  }

  /**
   * Generate structured JSON
   */
  async generateJSON<T = any>(
    phase: LLMPhase,
    systemPrompt: string,
    userMessage: string,
    options?: {
      temperature?: number;
    }
  ): Promise<T> {
    const config = PHASE_CONFIG[phase];

    if (config.provider === 'venice') {
      return this.veniceClient.generateJSON<T>(
        systemPrompt,
        userMessage,
        {
          model: config.model,
          ...options,
        }
      );
    } else {
      const combinedPrompt = `${systemPrompt}\n\nRespond ONLY with valid JSON, no additional text.\n\n${userMessage}`;

      const responseText = await this.geminiClient.generate({
        systemPrompt: '',
        messages: [
          { role: 'user', content: combinedPrompt }
        ],
        temperature: options?.temperature,
      });

      let jsonText = responseText.trim();

      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      }

      try {
        return JSON.parse(jsonText) as T;
      } catch (error) {
        console.error('[HybridLLM] JSON parsing error:', error);
        console.error('[HybridLLM] Raw response:', responseText);
        throw new Error(`Failed to parse JSON response: ${error}`);
      }
    }
  }

  /**
   * Get configuration for a phase
   */
  getPhaseConfig(phase: LLMPhase) {
    return PHASE_CONFIG[phase];
  }

  /**
   * Calculate estimated savings vs using only Venice
   */
  async estimateSavings(messagesPerDay: number): Promise<{
    veniceOnlyCost: number;
    hybridCost: number;
    savings: number;
    savingsPercent: number;
  }> {
    // Estimated costs per phase (in USD)
    const VENICE_COST_PER_PHASE = {
      appraisal: 0.0001,
      emotion: 0.00012,
      reasoning: 0.0004,
      action: 0.00008,
      response: 0.0015,
    };

    const GEMINI_COST_PER_PHASE = {
      appraisal: 0, // Free within quota
      emotion: 0,
      reasoning: 0,
      action: 0,
      response: 0,
    };

    // Cost with all Venice
    const veniceOnlyPerMessage =
      VENICE_COST_PER_PHASE.appraisal +
      VENICE_COST_PER_PHASE.emotion +
      VENICE_COST_PER_PHASE.reasoning +
      VENICE_COST_PER_PHASE.action +
      VENICE_COST_PER_PHASE.response;

    // Hybrid cost
    const hybridPerMessage =
      GEMINI_COST_PER_PHASE.appraisal +        // Gemini
      GEMINI_COST_PER_PHASE.emotion +          // Gemini
      VENICE_COST_PER_PHASE.reasoning +        // Venice
      GEMINI_COST_PER_PHASE.action +           // Gemini
      VENICE_COST_PER_PHASE.response;          // Venice

    const veniceOnlyCost = veniceOnlyPerMessage * messagesPerDay * 30; // Mes
    const hybridCost = hybridPerMessage * messagesPerDay * 30;
    const savings = veniceOnlyCost - hybridCost;
    const savingsPercent = (savings / veniceOnlyCost) * 100;

    return {
      veniceOnlyCost,
      hybridCost,
      savings,
      savingsPercent,
    };
  }
}

/**
 * Hybrid singleton client
 */
let hybridClient: HybridLLMProvider | null = null;

export function getHybridLLMProvider(): HybridLLMProvider {
  if (!hybridClient) {
    hybridClient = new HybridLLMProvider();
  }

  return hybridClient;
}
