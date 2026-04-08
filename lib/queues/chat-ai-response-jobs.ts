/**
 * BullMQ Jobs for Chat AI Responses
 *
 * Processes AI responses in individual chats asynchronously:
 * - The route handler saves user message and queues this job
 * - The worker processes the AI and emits result via Socket.IO
 */

import { Queue } from "bullmq";

// Check if Redis is configured for BullMQ
const isRedisConfigured = !!(
  process.env.REDIS_URL ||
  (process.env.REDIS_HOST && process.env.REDIS_PORT)
);

// Connection config for BullMQ
const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
};

// ============================================================================
// JOB DATA INTERFACE
// ============================================================================

export interface ChatAIResponseJobData {
  userMessageId: string;
  agentId: string;
  userId: string;
  content: string;
  messageType: string;
  metadata: Record<string, unknown>;
  userPlan: string;
  // For trackTokenUsage() after generation
  actualInputTokens: number;
  effectiveInputTokens: number;
  characterTier: string;
}

// ============================================================================
// QUEUE DEFINITION
// ============================================================================

export const chatAIResponseQueue = isRedisConfigured
  ? new Queue<ChatAIResponseJobData>("chat-ai-response", { connection })
  : null;

// ============================================================================
// JOB SCHEDULER
// ============================================================================

/**
 * Queue AI response generation job for individual chat
 */
export async function enqueueChatAIResponse(
  data: ChatAIResponseJobData
): Promise<void> {
  if (!chatAIResponseQueue) {
    console.warn("[ChatAIJobs] Redis not configured, cannot enqueue chat AI job");
    return;
  }

  await chatAIResponseQueue.add("generate-response", data, {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  });

  console.log(
    `[ChatAIJobs] AI response job enqueued for user ${data.userId}, message ${data.userMessageId}`
  );
}

// Log warning if Redis is not configured
if (!isRedisConfigured) {
  console.warn("[ChatAIJobs] ⚠️  Redis not configured - async chat AI responses unavailable");
}
