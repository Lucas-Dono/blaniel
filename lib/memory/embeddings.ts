/**
 * Embedding Generation Service - OpenAI Edition
 * Generates vector embeddings for text using OpenAI's text-embedding-3-small model
 * Runs in the cloud via OpenAI API
 *
 * IMPORTANT: This module should only be used in server-side contexts.
 */

import OpenAI from "openai";

// Model configuration from environment variables
const EMBEDDING_MODEL = process.env.embedding_model || "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536; // text-embedding-3-small dimensions

// Singleton OpenAI client
let openaiClient: OpenAI | null = null;

/**
 * Get or initialize the OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  openaiClient = new OpenAI({ apiKey });
  console.log("[Embeddings] OpenAI client initialized");
  return openaiClient;
}

/**
 * Generate embedding for a single text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Text cannot be empty");
  }

  try {
    const client = getOpenAIClient();

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: "float",
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("No embedding returned from OpenAI");
    }

    return response.data[0].embedding;
  } catch (error: any) {
    console.error("[Embeddings] Error generating embedding:", error?.message || error);

    // If it's an invalid API key error, log more details
    if (error?.status === 401) {
      console.error("[Embeddings] Invalid OpenAI API key - check OPENAI_API_KEY environment variable");
    }

    throw new Error(`Failed to generate embedding: ${error?.message || error}`);
  }
}

/**
 * Generate embeddings for multiple texts (batch processing)
 * OpenAI API supports batch embedding requests
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  try {
    const client = getOpenAIClient();

    // OpenAI API supports batch requests (up to 2048 inputs)
    // We'll batch in groups of 100 to be safe
    const batchSize = 100;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
        encoding_format: "float",
      });

      if (!response.data || response.data.length === 0) {
        throw new Error("No embeddings returned from OpenAI");
      }

      // Sort by index to maintain order (API may return out of order)
      const sortedEmbeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);

      results.push(...sortedEmbeddings);
    }

    return results;
  } catch (error: any) {
    console.error("[Embeddings] Error generating batch embeddings:", error?.message || error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have the same dimensions");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Find most similar embeddings from a list
 */
export function findMostSimilar(
  queryEmbedding: number[],
  embeddings: Array<{ id: string; embedding: number[]; metadata?: any }>,
  topK: number = 5
): Array<{ id: string; similarity: number; metadata?: any }> {
  const results = embeddings.map((item) => ({
    id: item.id,
    similarity: cosineSimilarity(queryEmbedding, item.embedding),
    metadata: item.metadata,
  }));

  // Sort by similarity (descending)
  results.sort((a, b) => b.similarity - a.similarity);

  // Return top K results
  return results.slice(0, topK);
}

/**
 * Prepare text for embedding (chunking for long texts)
 * OpenAI's text-embedding-3-small supports up to 8191 tokens
 */
export function prepareTextForEmbedding(
  text: string,
  maxLength: number = 8000 // Conservative limit to account for tokenization
): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  // Split by sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Get embedding dimensions for the current model
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}

/**
 * Preload the embedding model (no-op for OpenAI, kept for API compatibility)
 */
export async function preloadEmbeddingModel(): Promise<void> {
  // No need to preload with OpenAI API
  // Just verify the client can be initialized
  try {
    getOpenAIClient();
    console.log("[Embeddings] OpenAI embeddings ready");
  } catch (error) {
    console.warn("[Embeddings] Failed to initialize OpenAI client:", error);
  }
}

/**
 * Check if embeddings are currently available
 */
export function areEmbeddingsAvailable(): boolean {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    return !!apiKey;
  } catch {
    return false;
  }
}

/**
 * Get the reason why embeddings are disabled (if applicable)
 */
export function getDisableReason(): string | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "OPENAI_API_KEY not configured";
  }
  return null;
}
