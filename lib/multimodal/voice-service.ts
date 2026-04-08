/**
 * VOICE SERVICE
 *
 * Servicio de generación de voz para respuestas multimodales
 * Integra con ElevenLabs para síntesis de voz emocional
 */

import { getElevenLabsClient } from "@/lib/voice-system/elevenlabs-client";
import { prisma } from "@/lib/prisma";

export interface VoiceGenerationParams {
  text: string;
  agentId: string;
  emotion: string;
  intensity: "low" | "medium" | "high";
}

export interface VoiceGenerationResult {
  audioUrl: string;
  audioBuffer?: Buffer;
  cached: boolean;
  duration?: number;
}

export class VoiceService {
  /**
   * Genera audio desde texto con modulación emocional
   */
  async generateSpeech(
    params: VoiceGenerationParams
  ): Promise<VoiceGenerationResult> {
    const { text, agentId, emotion, intensity } = params;

    console.log("[VoiceService] Generating speech for agent:", agentId);

    // 1. Get agent voice configuration
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        VoiceConfig: true,
        InternalState: true,
      },
    });

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (!agent.VoiceConfig) {
      throw new Error(`Agent ${agentId} has no voice configuration`);
    }

    // 2. Calculate emotional modulation
    const intensityNumber = this.mapIntensityToNumber(intensity);
    const modulation = {
      currentEmotion: emotion,
      intensity: intensityNumber,
      mood: {
        valence: agent.InternalState?.moodValence || 0,
        arousal: agent.InternalState?.moodArousal || 0.5,
        dominance: agent.InternalState?.moodDominance || 0.5,
      },
      // Parámetros de ElevenLabs calculados
      stability: this.calculateStability(emotion, intensityNumber),
      similarity_boost: Math.max(0.5, 0.75 - intensityNumber * 0.25),
      style: intensityNumber > 0.7 ? 0.3 : 0,
      use_speaker_boost: true,
    };

    // 3. Generar audio con ElevenLabs
    const elevenlabs = getElevenLabsClient();
    const voiceResult = await elevenlabs.generateSpeech(
      text,
      agent.VoiceConfig.voiceId,
      modulation
    );

    // 4. Save audio in public file system or base64
    // Por ahora retornamos base64 para simplificar
    const audioBase64 = voiceResult.audioBuffer.toString("base64");
    const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

    // 5. Incrementar contador de generaciones
    await prisma.voiceConfig.update({
      where: { agentId },
      data: {
        totalVoiceGenerations: {
          increment: 1,
        },
      },
    });

    return {
      audioUrl: audioDataUrl,
      audioBuffer: voiceResult.audioBuffer,
      cached: false, // TODO: Implementar cache de audio
      duration: undefined,
    };
  }

  /**
   * Convierte intensidad de string a número
   */
  private mapIntensityToNumber(intensity: "low" | "medium" | "high"): number {
    switch (intensity) {
      case "low":
        return 0.3;
      case "medium":
        return 0.6;
      case "high":
        return 0.9;
      default:
        return 0.5;
    }
  }

  /**
   * Calcula stability basado en emoción e intensidad
   */
  private calculateStability(emotion: string, intensity: number): number {
    const unstableEmotions = ["anxiety", "fear", "excitement", "anger", "distress"];
    const isUnstable = unstableEmotions.includes(emotion.toLowerCase());

    if (isUnstable) {
      return Math.max(0, 0.5 - intensity * 0.3);
    }

    return Math.min(1, 0.5 + intensity * 0.3);
  }
}

// Singleton instance
let voiceService: VoiceService | null = null;

export function getVoiceService(): VoiceService {
  if (!voiceService) {
    voiceService = new VoiceService();
    console.log("[VoiceService] Service initialized");
  }
  return voiceService;
}
