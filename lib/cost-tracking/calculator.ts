/**
 * Cost Calculator for AI/LLM Operations
 * Pricing tables updated for 2025
 */

// Pricing in USD per 1M tokens
export const LLM_PRICING = {
  // Claude Models
  'anthropic/claude-3.5-sonnet': {
    input: 3,
    output: 15,
  },
  'anthropic/claude-3-sonnet': {
    input: 3,
    output: 15,
  },
  'anthropic/claude-3-opus': {
    input: 15,
    output: 75,
  },
  'anthropic/claude-3-haiku': {
    input: 0.25,
    output: 1.25,
  },

  // OpenAI Models
  'openai/gpt-4-turbo': {
    input: 10,
    output: 30,
  },
  'openai/gpt-4': {
    input: 30,
    output: 60,
  },
  'openai/gpt-3.5-turbo': {
    input: 0.5,
    output: 1.5,
  },

  // Qwen Models (Cost-effective)
  'qwen/qwen-2.5-72b-instruct': {
    input: 0.18,
    output: 0.54,
  },
  'qwen/qwen-2-72b-instruct': {
    input: 0.18,
    output: 0.54,
  },
  'qwen/qwen-2.5-7b-instruct': {
    input: 0.04,
    output: 0.12,
  },

  // Google Gemini
  'google/gemini-pro-1.5': {
    input: 1.25,
    output: 5,
  },
  'google/gemini-pro': {
    input: 0.5,
    output: 1.5,
  },
  'gemini-2.5-flash-lite': {
    input: 0.2, // $0.40 per 1M tokens combined, split evenly
    output: 0.2,
  },
  'gemini-2.5-flash': {
    input: 1.25, // $2.50 per 1M tokens combined, split evenly
    output: 1.25,
  },

  // Meta Llama
  'meta-llama/llama-3.1-70b-instruct': {
    input: 0.35,
    output: 0.4,
  },
  'meta-llama/llama-3.1-8b-instruct': {
    input: 0.05,
    output: 0.08,
  },

  // Mistral
  'mistralai/mistral-large': {
    input: 2,
    output: 6,
  },
  'mistralai/mixtral-8x7b-instruct': {
    input: 0.24,
    output: 0.24,
  },

  // Venice AI
  'venice-uncensored': {
    input: 0.20,
    output: 0.90,
  },
} as const;

// Embedding pricing per 1M tokens
export const EMBEDDING_PRICING = {
  'qwen3-embedding': 0.02,
  'openai/text-embedding-3-large': 0.13,
  'openai/text-embedding-3-small': 0.02,
  'openai/text-embedding-ada-002': 0.10,
} as const;

// Image generation pricing per image
export const IMAGE_PRICING = {
  // Stable Diffusion
  'stable-diffusion-xl': {
    '512x512': 0.002,
    '768x768': 0.003,
    '1024x1024': 0.004,
  },
  'stable-diffusion-3': {
    '512x512': 0.003,
    '768x768': 0.004,
    '1024x1024': 0.006,
  },

  // DALL-E
  'dall-e-3': {
    '1024x1024': 0.04,
    '1024x1792': 0.08,
    '1792x1024': 0.08,
  },
  'dall-e-2': {
    '512x512': 0.018,
    '1024x1024': 0.02,
  },
} as const;

// Payment gateway fees (percentage)
export const PAYMENT_FEES = {
  stripe: 0.029 + 0.3, // 2.9% + $0.30
  mercadopago: 0.0399 + 0.0, // 3.99% in Argentina
} as const;

/**
 * Calculate cost for LLM API call
 */
export function calculateLLMCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = LLM_PRICING[model as keyof typeof LLM_PRICING];

  if (!pricing) {
    console.warn(`Unknown LLM model: ${model}, using default pricing`);
    // Default to GPT-3.5 pricing as fallback
    return (inputTokens / 1_000_000) * 0.5 + (outputTokens / 1_000_000) * 1.5;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Calculate cost for embeddings
 */
export function calculateEmbeddingCost(
  model: string,
  tokens: number
): number {
  const pricing = EMBEDDING_PRICING[model as keyof typeof EMBEDDING_PRICING];

  if (!pricing) {
    console.warn(`Unknown embedding model: ${model}, using default pricing`);
    // Default to qwen3 pricing as fallback
    return (tokens / 1_000_000) * 0.02;
  }

  return (tokens / 1_000_000) * pricing;
}

/**
 * Calculate cost for image generation
 */
export function calculateImageCost(
  model: string,
  resolution: string = '1024x1024'
): number {
  const modelPricing = IMAGE_PRICING[model as keyof typeof IMAGE_PRICING];

  if (!modelPricing) {
    console.warn(`Unknown image model: ${model}, using default pricing`);
    return 0.002; // Default to SD-XL 512x512 pricing
  }

  const cost = modelPricing[resolution as keyof typeof modelPricing];

  if (!cost) {
    console.warn(`Unknown resolution: ${resolution} for model ${model}`);
    // Return the cheapest option for the model
    return Math.min(...Object.values(modelPricing));
  }

  return cost;
}

/**
 * Calculate payment gateway fee
 */
export function calculatePaymentFee(
  gateway: 'stripe' | 'mercadopago',
  amount: number
): number {
  if (gateway === 'stripe') {
    return amount * 0.029 + 0.3;
  } else if (gateway === 'mercadopago') {
    return amount * 0.0399;
  }

  return 0;
}

/**
 * Estimate tokens from text (rough approximation)
 * More accurate than simple word count
 */
export function estimateTokens(text: string): number {
  // Average: 1 token ≈ 0.75 words (4 characters)
  // This is a rough estimate, actual tokenization varies by model
  const words = text.split(/\s+/).length;
  return Math.ceil(words * 1.33);
}

/**
 * Get all available models by type
 */
export function getAvailableModels() {
  return {
    llm: Object.keys(LLM_PRICING),
    embedding: Object.keys(EMBEDDING_PRICING),
    image: Object.keys(IMAGE_PRICING),
  };
}

/**
 * Get pricing info for a specific model
 */
export function getPricingInfo(model: string, type: 'llm' | 'embedding' | 'image') {
  switch (type) {
    case 'llm':
      return LLM_PRICING[model as keyof typeof LLM_PRICING];
    case 'embedding':
      return EMBEDDING_PRICING[model as keyof typeof EMBEDDING_PRICING];
    case 'image':
      return IMAGE_PRICING[model as keyof typeof IMAGE_PRICING];
    default:
      return null;
  }
}

/**
 * Format cost as USD string
 */
export function formatCost(cost: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(cost);
}

/**
 * Calculate cost per thousand tokens (for comparison)
 */
export function calculateCostPerK(
  model: string,
  type: 'input' | 'output' = 'input'
): number {
  const pricing = LLM_PRICING[model as keyof typeof LLM_PRICING];
  if (!pricing) return 0;

  return (pricing[type] / 1000);
}
