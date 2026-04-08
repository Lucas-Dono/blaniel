/**
 * Cost Tracking Integration Examples
 *
 * This file shows how to integrate cost tracking into existing endpoints
 */

import { trackLLMCall, trackEmbedding, trackImageGeneration, trackPaymentFee } from './tracker';
import { estimateTokens } from './calculator';

// ==========================================
// EXAMPLE 1: Track LLM Call in Message Service
// ==========================================

/**
 * After generating LLM response, track the cost
 *
 * Location: lib/services/message.service.ts
 * After line 416: let response = await llm.generate({...})
 */
export async function exampleTrackLLMInMessageService(
  agentId: string,
  userId: string,
  systemPrompt: string,
  conversationMessages: Array<{ role: string; content: string }>,
  response: string
) {
  // Estimate tokens (since Gemini doesn't return usage data)
  const inputTokens = estimateTokens(
    systemPrompt + '\n' + conversationMessages.map(m => m.content).join('\n')
  );
  const outputTokens = estimateTokens(response);

  // Track the cost (async, non-blocking)
  await trackLLMCall({
    userId,
    agentId,
    provider: 'google', // or 'openrouter' if using OpenRouter
    model: 'gemini-2.5-flash-lite', // Current model
    inputTokens,
    outputTokens,
    metadata: {
      messageCount: conversationMessages.length,
      systemPromptLength: systemPrompt.length,
    },
  });

  console.log('[CostTracking] LLM call tracked', {
    agentId,
    userId,
    inputTokens,
    outputTokens,
  });
}

// ==========================================
// EXAMPLE 2: Track in Emotional System
// ==========================================

/**
 * Track LLM calls in emotional orchestrator
 *
 * Location: lib/emotional-system/hybrid-orchestrator.ts
 * When using LLM for emotion analysis
 */
export async function exampleTrackEmotionalAnalysis(
  agentId: string,
  userId: string,
  userMessage: string,
  emotionResponse: string
) {
  const inputTokens = estimateTokens(userMessage);
  const outputTokens = estimateTokens(emotionResponse);

  await trackLLMCall({
    userId,
    agentId,
    provider: 'google',
    model: 'gemini-2.5-flash-lite',
    inputTokens,
    outputTokens,
    metadata: {
      type: 'emotion-analysis',
    },
  });
}

// ==========================================
// EXAMPLE 3: Track Embeddings
// ==========================================

/**
 * Track embedding generation
 *
 * Location: lib/memory/qwen-embeddings.ts
 * After generating embeddings
 */
export async function exampleTrackEmbedding(
  userId: string,
  agentId: string,
  text: string
) {
  const tokens = estimateTokens(text);

  await trackEmbedding({
    userId,
    agentId,
    provider: 'qwen',
    model: 'qwen3-embedding',
    tokens,
    metadata: {
      textLength: text.length,
    },
  });

  console.log('[CostTracking] Embedding tracked', { agentId, userId, tokens });
}

// ==========================================
// EXAMPLE 4: Track Image Generation
// ==========================================

/**
 * Track image generation
 *
 * Location: lib/visual-system/visual-generation-service.ts
 * After generating image
 */
export async function exampleTrackImageGeneration(
  userId: string,
  agentId: string,
  model: string,
  resolution: string
) {
  await trackImageGeneration({
    userId,
    agentId,
    provider: 'stable-diffusion',
    model,
    resolution,
    metadata: {
      generatedAt: new Date().toISOString(),
    },
  });

  console.log('[CostTracking] Image generation tracked', {
    agentId,
    userId,
    model,
    resolution,
  });
}

// ==========================================
// EXAMPLE 5: Track Payment Fee
// ==========================================

/**
 * Track payment gateway fee
 *
 * Location: app/api/webhooks/mercadopago/route.ts
 * After successful payment
 */
export async function exampleTrackPaymentFee(
  userId: string,
  gateway: 'stripe' | 'mercadopago',
  amount: number
) {
  await trackPaymentFee({
    userId,
    gateway,
    amount,
    metadata: {
      currency: 'USD',
      processedAt: new Date().toISOString(),
    },
  });

  console.log('[CostTracking] Payment fee tracked', { userId, gateway, amount });
}

// ==========================================
// EXAMPLE 6: Track in World Messages
// ==========================================

/**
 * Track LLM calls in world messages
 *
 * Location: app/api/worlds/[id]/message/route.ts
 * After generating world response
 */
export async function exampleTrackWorldMessage(
  worldId: string,
  userId: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  response: string
) {
  const inputTokens = estimateTokens(
    systemPrompt + '\n' + messages.map(m => m.content).join('\n')
  );
  const outputTokens = estimateTokens(response);

  await trackLLMCall({
    userId,
    worldId,
    provider: 'google',
    model: 'gemini-2.5-flash-lite',
    inputTokens,
    outputTokens,
    metadata: {
      type: 'world-message',
      messageCount: messages.length,
    },
  });

  console.log('[CostTracking] World message tracked', {
    worldId,
    userId,
    inputTokens,
    outputTokens,
  });
}
