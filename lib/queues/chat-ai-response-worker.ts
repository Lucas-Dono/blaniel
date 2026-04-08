/**
 * BullMQ Worker for Chat AI Responses
 *
 * Procesa jobs de generación de respuesta AI para chats individuales:
 * 1. Genera respuesta AI llamando a messageService.generateAIResponse()
 * 2. Trackea uso de tokens
 * 3. Emite resultado al cliente mobile via Socket.IO
 */

import { Worker } from "bullmq";
import type { ChatAIResponseJobData } from "./chat-ai-response-jobs";
import { messageService } from "@/lib/services/message.service";
import { getSocketServer } from "@/lib/socket/server";
import { calculateEffectiveTokens } from "@/lib/usage/dynamic-limits";
import { trackTokenUsage, estimateTokensFromText } from "@/lib/usage/token-limits";
import { trackCooldown } from "@/lib/usage/cooldown-tracker";
import { createLogger } from "@/lib/logger";

const log = createLogger("ChatAIResponseWorker");

// Check if Redis is configured
const isRedisConfigured = !!(
  process.env.REDIS_URL ||
  (process.env.REDIS_HOST && process.env.REDIS_PORT)
);

if (!isRedisConfigured) {
  console.warn("[ChatAIWorker] ⚠️  Redis not configured - worker not started");
} else {
  const connection = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  };

  const worker = new Worker<ChatAIResponseJobData>(
    "chat-ai-response",
    async (job) => {
      const {
        userMessageId,
        agentId,
        userId,
        content,
        messageType,
        metadata,
        userPlan,
        actualInputTokens,
        effectiveInputTokens,
        characterTier,
      } = job.data;

      log.info(
        { userMessageId, agentId, userId, jobId: job.id },
        "Processing chat AI response job"
      );

      // Generate AI response
      const result = await messageService.generateAIResponse({
        userMessageId,
        agentId,
        userId,
        content,
        messageType: messageType as any,
        metadata,
        userPlan,
      });

      // Track token usage after generation
      const actualOutputTokens = estimateTokensFromText(result.assistantMessage.content);
      const effectiveOutputTokens = calculateEffectiveTokens(
        actualOutputTokens,
        userPlan as "free" | "plus" | "ultra",
        characterTier as "free" | "plus" | "ultra"
      );

      await trackTokenUsage(
        userId,
        effectiveInputTokens,
        effectiveOutputTokens,
        {
          agentId,
          messageId: result.assistantMessage.id,
          userMessageContent: content.substring(0, 100),
        }
      );

      // Track cooldown after successful processing
      await trackCooldown(userId, "message", userPlan);

      log.info(
        {
          userMessageId,
          agentId,
          userId,
          tokensUsed: result.usage.tokensUsed,
        },
        "AI response generated, emitting via Socket.IO"
      );

      // Emit result to mobile client via Socket.IO
      const io = getSocketServer();
      if (io) {
        io.to(`user:${userId}`).emit("chat:message:response" as any, {
          userMessageId,
          agentId,
          message: result.assistantMessage,
          emotions: result.emotions,
          state: result.state,
          relationship: result.relationship,
          behaviors: result.behaviors,
          usage: result.usage,
        });

        log.info(
          { userId, userMessageId, agentId },
          "chat:message:response emitted to user room"
        );
      } else {
        log.warn(
          { userId, userMessageId },
          "Socket.IO server not available - client will need to poll"
        );
      }

      return { assistantMessageId: result.assistantMessage.id };
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on("completed", (job, returnValue) => {
    log.info(
      { jobId: job.id, assistantMessageId: returnValue?.assistantMessageId },
      "Chat AI response job completed"
    );
  });

  worker.on("failed", (job, err) => {
    log.error(
      { jobId: job?.id, error: err.message, userMessageId: job?.data?.userMessageId },
      "Chat AI response job failed"
    );

    // Emit failure event so client can show error state
    if (job?.data) {
      const io = getSocketServer();
      if (io) {
        io.to(`user:${job.data.userId}`).emit("chat:message:error" as any, {
          userMessageId: job.data.userMessageId,
          agentId: job.data.agentId,
          error: "Failed to generate AI response",
        });
      }
    }
  });

  console.log("[ChatAIWorker] Worker started with concurrency 5");
}
