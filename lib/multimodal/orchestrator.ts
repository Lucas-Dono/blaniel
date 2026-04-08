/**
 * MULTIMODAL ORCHESTRATOR SERVICE
 * 
 * Orchestrates the generation of multimodal responses
 * (text + audio + image) with emotional system
 */

import { hybridEmotionalOrchestrator } from "@/lib/emotional-system/hybrid-orchestrator";
import type { UserEmotionAnalysis } from "./emotional-analyzer";

export interface MultimodalResponseParams {
  agentId: string;
  userMessage: string;
  userEmotion?: UserEmotionAnalysis;
  includeMetadata?: boolean;
}

export interface MultimodalResponse {
  text: string;
  emotion: {
    dominantEmotion: string;
    intensity: "low" | "medium" | "high";
  };
  metadata?: {
    emotionsTriggered: string[];
    internalReasoning?: {
      situation: string;
      primaryEmotion: string;
    };
  };
}

export class EmotionalOrchestrator {
  /** Generates an agent response considering the user's emotional context */
  async generateResponse(
    params: MultimodalResponseParams
  ): Promise<MultimodalResponse> {
    const { agentId, userMessage, userEmotion, includeMetadata } = params;

    console.log("[EmotionalOrchestrator] Generating response for agent:", agentId);

    // Use the hybrid orchestrator to generate the response
    // (automatically decides between Fast Path and Deep Path)
    const hybridResult = await hybridEmotionalOrchestrator.processMessage({
      agentId,
      userMessage,
      userId: "system", // Se puede obtener del contexto si es necesario
      generateResponse: true,
    });

    // Extract the agent's dominant emotion
    const emotionsTriggered = hybridResult.metadata.emotionsTriggered || [];
    const dominantEmotion = emotionsTriggered[0] || "neutral";

    // Calcular intensidad basada en el sistema emocional
    const intensity = this.calculateIntensity(hybridResult);

    // Get el texto de respuesta
    const responseText = hybridResult.response?.responseText || "Lo siento, no pude procesar tu mensaje.";

    const result: MultimodalResponse = {
      text: responseText,
      emotion: {
        dominantEmotion,
        intensity,
      },
    };

    if (includeMetadata) {
      result.metadata = {
        emotionsTriggered,
        internalReasoning: (hybridResult.response?.metadata as any)?.internalReasoning
          ? {
              situation: (hybridResult.response?.metadata as any).internalReasoning.situation,
              primaryEmotion: (hybridResult.response?.metadata as any).internalReasoning.primaryEmotion,
            }
          : undefined,
      };
    }

    return result;
  }

  /**
   * Calcula la intensidad emocional de la respuesta
   */
  private calculateIntensity(response: any): "low" | "medium" | "high" {
    // If there is metadata with explicit intensity
    if (response.metadata?.emotionalIntensity) {
      const intensity = response.metadata.emotionalIntensity;
      if (intensity < 0.3) return "low";
      if (intensity < 0.7) return "medium";
      return "high";
    }

    // Calculate from number of triggered emotions
    const emotionCount = response.metadata.emotionsTriggered?.length || 0;
    if (emotionCount === 0) return "low";
    if (emotionCount <= 2) return "medium";
    return "high";
  }
}

// Singleton instance
let emotionalOrchestrator: EmotionalOrchestrator | null = null;

export function getEmotionalOrchestrator(): EmotionalOrchestrator {
  if (!emotionalOrchestrator) {
    emotionalOrchestrator = new EmotionalOrchestrator();
    console.log("[EmotionalOrchestrator] Service initialized");
  }
  return emotionalOrchestrator;
}
