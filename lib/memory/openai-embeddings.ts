/**
 * OpenAI Embeddings Integration
 * text-embedding-3-small - Ultra fast and economical
 * 
 * Pricing: $0.02/M tokens ($0.01/M with batch)
 * Dimensions: 1536
 * Latency: ~200-500ms
 */

import { createLogger } from '@/lib/logger';
import { trackEmbedding } from '@/lib/cost-tracking/tracker';


const log = createLogger('OpenAIEmbeddings');

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

interface OpenAIEmbeddingResponse {
  object: 'list';
  data: Array<{
    object: 'embedding';
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generar embedding para un texto usando OpenAI text-embedding-3-small
 */
export async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurada');
  }

  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          input: text,
          model: EMBEDDING_MODEL,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }

      const data: OpenAIEmbeddingResponse = await response.json();

      if (!data.data || data.data.length === 0) {
        throw new Error('No embedding returned from OpenAI');
      }

      const embedding = data.data[0].embedding;
      const genTime = Date.now() - startTime;

      log.debug(
        {
          textLength: text.length,
          embeddingDim: embedding.length,
          timeMs: genTime,
          tokens: data.usage.prompt_tokens,
          attempt,
        },
        'Embedding generado con OpenAI'
      );

      // Track embedding cost
      const cost = (data.usage.prompt_tokens / 1_000_000) * 0.02; // $0.02 per 1M tokens
      trackEmbedding({
        provider: 'openai',
        model: EMBEDDING_MODEL,
        tokens: data.usage.prompt_tokens,
        cost,
        metadata: {
          textLength: text.length,
          embeddingDim: embedding.length,
          timeMs: genTime,
          attempt,
        },
      }).catch(err => log.warn({ error: err.message }, 'Failed to track embedding cost'));

      return embedding;
    } catch (error) {
      lastError = error as Error;
      log.warn(
        { error, attempt, maxRetries: MAX_RETRIES, text: text.substring(0, 100) },
        'Error generando embedding, reintentando...'
      );

      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
    }
  }

  // If we reach here, all retries have failed
  log.error({ error: lastError, text: text.substring(0, 100) }, 'Error generando embedding después de reintentos');
  throw lastError || new Error('Failed to generate embedding');
}

/**
 * Generate embeddings in batch (more efficient)
 * Batch pricing: $0.01/M tokens (50% discount)
 */
export async function generateOpenAIEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurada');
  }

  if (texts.length === 0) {
    return [];
  }

  const startTime = Date.now();

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: texts,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`
      );
    }

    const data: OpenAIEmbeddingResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new Error('No embeddings returned from OpenAI');
    }

    // Sort by index to ensure the correct order
    const sortedEmbeddings = data.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);

    const genTime = Date.now() - startTime;

    log.debug(
      {
        batchSize: texts.length,
        timeMs: genTime,
        tokens: data.usage.prompt_tokens,
        avgTimePerText: genTime / texts.length,
      },
      'Batch embeddings generados con OpenAI'
    );

    // Track batch embedding cost (50% discount)
    const cost = (data.usage.prompt_tokens / 1_000_000) * 0.01; // $0.01 per 1M tokens (batch)
    trackEmbedding({
      provider: 'openai',
      model: `${EMBEDDING_MODEL}-batch`,
      tokens: data.usage.prompt_tokens,
      cost,
      metadata: {
        batchSize: texts.length,
        timeMs: genTime,
        avgTimePerText: genTime / texts.length,
      },
    }).catch(err => log.warn({ error: err.message }, 'Failed to track batch embedding cost'));

    return sortedEmbeddings;
  } catch (error) {
    log.error({ error, batchSize: texts.length }, 'Error generando batch embeddings');
    throw error;
  }
}

/**
 * Calcular similitud coseno entre dos embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embeddings must have same dimensions: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/** Calculate similarity between a query and multiple embeddings */
export function batchCosineSimilarity(
  queryEmbedding: number[],
  embeddings: number[][]
): number[] {
  return embeddings.map(emb => cosineSimilarity(queryEmbedding, emb));
}

/** Check if OpenAI is configured */
export function isOpenAIConfigured(): boolean {
  return !!OPENAI_API_KEY;
}

/** Get model dimensions */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}

/**
 * Compatibility: Alias for generateOpenAIEmbedding
 * For gradual migration from Qwen
 */
export const generateEmbedding = generateOpenAIEmbedding;
export const generateEmbeddingsBatch = generateOpenAIEmbeddingsBatch;
