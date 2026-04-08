/**
 * Gemini AI Client
 * Wrapper for Google's Generative AI with error handling and caching
 */

import { executeWithRetry } from './gemini-client';

export interface GeminiOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Generate text with Gemini
 */
export async function generateWithGemini(
  prompt: string,
  options: GeminiOptions = {}
): Promise<string | null> {
  try {
    const {
      temperature = 0.3, // Low temperature for classification tasks
      model = process.env.GEMINI_MODEL_LITE || 'gemini-2.5-flash-lite', // Use env var or fallback
    } = options;

    const result = await executeWithRetry(async (client) => {
      const geminiModel = client.getGenerativeModel({
        model,
        generationConfig: {
          temperature,
          maxOutputTokens: 100, // Short responses for classification
        },
      });

      return await geminiModel.generateContent(prompt);
    });

    const response = result.response;
    const text = response.text();

    return text.trim();
  } catch (error) {
    console.error('[Gemini] Generation error:', error);
    return null;
  }
}

/**
 * Classify text into one of the provided categories
 */
export async function classifyWithGemini(
  text: string,
  categories: string[],
  context?: string
): Promise<string | null> {
  const prompt = `${context || 'Classify the following text into one of these categories'}:

Categories: ${categories.join(', ')}

Text: "${text}"

Respond with ONLY the category name, nothing else.`;

  const result = await generateWithGemini(prompt);

  if (!result) return null;

  // Normalize response and check if it's a valid category
  const normalized = result.toLowerCase().trim();
  const match = categories.find(cat => cat.toLowerCase() === normalized);

  return match || null;
}
