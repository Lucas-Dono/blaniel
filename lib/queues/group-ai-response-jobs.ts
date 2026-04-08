/**
 * BullMQ Jobs for Group AI Responses
 * 
 * Processes AI responses in groups asynchronously:
 * - FLUSH_BUFFER: Process message buffer and decide which AIs will respond
 * - GENERATE_RESPONSE: Generate response from a specific AI
 */

import { Queue, QueueEvents } from "bullmq";
import type { BufferedMessage } from "@/lib/groups/group-message-buffer.service";

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
// QUEUE DEFINITIONS
// ============================================================================

export const groupAIResponseQueue = isRedisConfigured
  ? new Queue("group-ai-responses", { connection })
  : null;

export const GroupAIJobTypes = {
  FLUSH_BUFFER: "flush-buffer",
  GENERATE_RESPONSE: "generate-response",
} as const;

// ============================================================================
// JOB DATA INTERFACES
// ============================================================================

export interface FlushBufferJobData {
  groupId: string;
}

export interface GenerateResponseJobData {
  groupId: string;
  agentId: string;
  agentName: string;
  triggeredByUserId: string;
  triggeredByUserName: string;
  bufferedMessages: BufferedMessage[];
  dispositionScore: number;
  responseIndex: number; // 0 = first AI, 1 = second, etc.

  // Conversational Director
  sceneDirective?: {
    sceneCode: string;
    role: string; // "PROTAGONIST", "ANTAGONIST", etc.
    directive: string; // Specific instruction
    targetAgents?: string[]; // IDs of agents to address
    emotionalTone?: string; // Expected emotional tone
    maxLength?: number; // Suggested length
  };
}

// ============================================================================
// JOB SCHEDULERS
// ============================================================================

/**
 * Enqueue message buffer flush
 * 
 * @param groupId - Group ID
 * @param delayMs - Delay before execution (to accumulate messages)
 */
export async function enqueueBufferFlush(
  groupId: string,
  delayMs: number
): Promise<void> {
  if (!groupAIResponseQueue) {
    console.warn("[GroupAIJobs] Redis not configured, skipping buffer flush job");
    // Fallback: ejecutar directamente
    const { handleBufferFlush } = await import("./group-ai-response-worker");
    setTimeout(() => handleBufferFlush({ groupId }), delayMs);
    return;
  }

  // Use unique jobId to avoid duplicates
  const jobId = `flush:${groupId}`;

  // Verificar si ya existe un job pendiente para este grupo
  const existingJob = await groupAIResponseQueue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === "waiting" || state === "delayed") {
      // Ya hay un flush pendiente, no crear otro
      console.log(`[GroupAIJobs] Flush already pending for group ${groupId}`);
      return;
    }
  }

  await groupAIResponseQueue.add(
    GroupAIJobTypes.FLUSH_BUFFER,
    { groupId } as FlushBufferJobData,
    {
      jobId,
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: 5, // Mantener últimos 5 jobs fallidos
    }
  );

  console.log(`[GroupAIJobs] Buffer flush scheduled for group ${groupId} in ${delayMs}ms`);
}

/** Enqueue AI response generation */
export async function enqueueAIResponse(
  data: GenerateResponseJobData
): Promise<void> {
  if (!groupAIResponseQueue) {
    console.warn("[GroupAIJobs] Redis not configured, skipping AI response job");
    // Fallback: ejecutar directamente con delay
    const { handleGenerateResponse } = await import("./group-ai-response-worker");
    setTimeout(() => handleGenerateResponse(data), data.responseIndex * 2500);
    return;
  }

  // Calculate delay based on response index
  // Primera IA responde inmediatamente, siguientes con delay
  const baseDelay = data.responseIndex * 2000;
  const jitter = Math.random() * 1500;
  const delay = baseDelay + jitter;

  await groupAIResponseQueue.add(
    GroupAIJobTypes.GENERATE_RESPONSE,
    data,
    {
      delay: Math.round(delay),
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: 10,
    }
  );

  console.log(
    `[GroupAIJobs] AI response scheduled for ${data.agentName} (${data.agentId}) in group ${data.groupId}, delay: ${Math.round(delay)}ms`
  );
}

/**
 * Cancel pending jobs for a group
 * Useful when the group is deactivated or there is an error
 */
export async function cancelGroupJobs(groupId: string): Promise<void> {
  if (!groupAIResponseQueue) return;

  // Cancelar flush pendiente
  const flushJob = await groupAIResponseQueue.getJob(`flush:${groupId}`);
  if (flushJob) {
    await flushJob.remove();
  }

  // Nota: Los jobs de respuesta individual no tienen jobId predecible,
  // so we cannot cancel them easily.
  // In production, we could use a pattern with prefixes and SCAN.
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

const queueEvents = isRedisConfigured
  ? new QueueEvents("group-ai-responses", { connection })
  : null;

if (queueEvents) {
  queueEvents.on("completed", ({ jobId, returnvalue }) => {
    console.log(`[GroupAIQueue] Job ${jobId} completed`);
  });

  queueEvents.on("failed", ({ jobId, failedReason }) => {
    console.error(`[GroupAIQueue] Job ${jobId} failed:`, failedReason);
  });

  queueEvents.on("stalled", ({ jobId }) => {
    console.warn(`[GroupAIQueue] Job ${jobId} stalled`);
  });
}

// ============================================================================
// CLEANUP
// ============================================================================

export async function closeGroupAIJobs(): Promise<void> {
  if (queueEvents) {
    await queueEvents.close();
  }
  if (groupAIResponseQueue) {
    await groupAIResponseQueue.close();
  }
  console.log("[GroupAIJobs] Queue closed");
}

// Log warning if Redis is not configured
if (!isRedisConfigured) {
  console.warn("[GroupAIJobs] ⚠️  Redis not configured - using in-memory fallback");
}
