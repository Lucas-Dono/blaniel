/**
 * Multimedia Content Generator
 *
 * Generates images and audio based on tags detected in AI messages.
 * Uses existing visual system (AI Horde/FastSD) and ElevenLabs for voices.
 */

import type { MultimediaTag } from "./parser";
import { getAIHordeClient } from "@/lib/visual-system/ai-horde-client";
import { getElevenLabsClient } from "@/lib/voice-system/elevenlabs-client";

export interface GeneratedMultimedia {
  type: "image" | "audio";
  url: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface MultimediaGenerationOptions {
  agentId: string;
  agentName: string;
  agentPersonality: string;
  referenceImageUrl?: string;
  voiceId?: string;
  userId?: string;
}

/**
 * Generates multimedia content based on detected tags
 */
export class MultimediaGenerator {
  constructor() {
    // No need to initialize services, we use getters
  }

  /**
   * Generates images using AI Horde with img2img for consistency
   */
  async generateImage(
    description: string,
    options: MultimediaGenerationOptions
  ): Promise<GeneratedMultimedia | null> {
    try {
      // Build enhanced prompt with character context
      const enhancedPrompt = this.buildImagePrompt(
        description,
        options.agentName,
        options.agentPersonality
      );

      const aiHordeClient = getAIHordeClient();
      const genParams: any = {
        prompt: enhancedPrompt,
        negativePrompt:
          "low quality, blurry, distorted, different person, different face, different body, anime, cartoon, 3d render, deformed, ugly",
        width: 512,
        height: 512,
        steps: 30, // More steps for img2img
        cfgScale: 7.5,
        sampler: "k_euler_a",
        seed: -1,
        nsfw: false,
      };

      // IMG2IMG: Si hay imagen de referencia, convertirla a base64 y usar img2img
      if (options.referenceImageUrl) {
        console.log("[MultimediaGenerator] Using img2img with reference image");
        const sourceImageBase64 = await this.imageUrlToBase64(options.referenceImageUrl);

        if (sourceImageBase64) {
          genParams.sourceImage = sourceImageBase64;
          genParams.denoisingStrength = 0.6; // 60% transformación, 40% mantiene referencia
        } else {
          console.warn("[MultimediaGenerator] Failed to convert reference image to base64, using text2img");
        }
      }

      const result = await aiHordeClient.generateImage(genParams);

      if (result && result.imageUrl) {
        return {
          type: "image",
          url: result.imageUrl,
          description,
          metadata: {
            prompt: enhancedPrompt,
            model: result.model,
            usedReference: !!options.referenceImageUrl && !!genParams.sourceImage,
            denoisingStrength: genParams.denoisingStrength,
          },
        };
      }

      return null;
    } catch (error) {
      console.error("[MultimediaGenerator] Error generating image:", error);
      return null;
    }
  }

  /**
   * Genera audio usando ElevenLabs con la voz asignada al personaje
   */
  async generateAudio(
    text: string,
    options: MultimediaGenerationOptions
  ): Promise<GeneratedMultimedia | null> {
    try {
      // Si no hay voiceId asignado, usar una voz por defecto
      const voiceId = options.voiceId || this.getDefaultVoiceId(options.agentPersonality);

      const elevenlabsClient = getElevenLabsClient();
      const result = await elevenlabsClient.generateSpeech(text, voiceId);

      if (!result || !result.audioBuffer) {
        return null;
      }

      // Convertir buffer a base64 data URL
      const base64Audio = result.audioBuffer.toString("base64");
      const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

      return {
        type: "audio",
        url: audioDataUrl,
        description: text,
        metadata: {
          voiceId,
          textLength: text.length,
        },
      };
    } catch (error) {
      console.error("[MultimediaGenerator] Error generating audio:", error);
      return null;
    }
  }

  /**
   * Procesa múltiples tags multimedia y genera el contenido
   */
  async generateMultimediaContent(
    tags: MultimediaTag[],
    options: MultimediaGenerationOptions
  ): Promise<GeneratedMultimedia[]> {
    const results: GeneratedMultimedia[] = [];

    for (const tag of tags) {
      if (tag.type === "image") {
        const image = await this.generateImage(tag.description, options);
        if (image) results.push(image);
      } else if (tag.type === "audio") {
        const audio = await this.generateAudio(tag.description, options);
        if (audio) results.push(audio);
      }
    }

    return results;
  }

  /**
   * Construye un prompt mejorado para generación de imagen
   */
  private buildImagePrompt(
    description: string,
    agentName: string,
    agentPersonality: string
  ): string {
    // Extraer keywords de personalidad para mejorar el prompt
    const personalityKeywords = this.extractPersonalityKeywords(agentPersonality);

    return `${description}.
Character: ${agentName}, personality traits: ${personalityKeywords}.
High quality photograph, natural lighting, detailed features, realistic skin texture,
photorealistic, professional photography, sharp focus.
CRITICAL: Maintain exact same facial features, hair style, body type, and overall appearance
as reference image. Only pose, expression, clothing, and background may vary.`;
  }

  /**
   * Extrae keywords relevantes de la personalidad del agente
   */
  private extractPersonalityKeywords(personality: string): string {
    // Simplificar la personalidad a keywords clave
    const keywords = personality
      .toLowerCase()
      .split(/[,;.]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 3); // Solo los primeros 3 traits

    return keywords.join(", ");
  }

  /**
   * Obtiene una voz por defecto basada en la personalidad
   */
  private getDefaultVoiceId(personality: string): string {
    // Voces de ElevenLabs - mapear según personalidad
    const personalityLower = personality.toLowerCase();

    // Voces femeninas
    if (
      personalityLower.includes("femenin") ||
      personalityLower.includes("mujer") ||
      personalityLower.includes("chica")
    ) {
      return "EXAVITQu4vr4xnSDxMaL"; // Rachel (calm female)
    }

    // Voces masculinas
    if (
      personalityLower.includes("masculin") ||
      personalityLower.includes("hombre") ||
      personalityLower.includes("chico")
    ) {
      return "TxGEqnHWrfWFTfGW9XjX"; // Josh (calm male)
    }

    // Default: voz neutral
    return "pNInz6obpgDQGcFmaJgB"; // Adam (neutral)
  }

  /**
   * Convierte una URL de imagen a base64 (sin el prefijo data:image/...)
   * Soporta URLs HTTP/HTTPS y data URLs
   */
  private async imageUrlToBase64(imageUrl: string): Promise<string | null> {
    try {
      // Si ya es data URL (data:image/png;base64,...), extraer solo el base64
      if (imageUrl.startsWith("data:")) {
        const base64Match = imageUrl.match(/base64,(.+)/);
        return base64Match ? base64Match[1] : null;
      }

      // Si es URL HTTP/HTTPS, descargar y convertir a base64
      if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.error("[MultimediaGenerator] Failed to fetch image:", response.status);
          return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return buffer.toString("base64");
      }

      // URL relativa o formato no soportado
      console.error("[MultimediaGenerator] Unsupported image URL format:", imageUrl);
      return null;
    } catch (error) {
      console.error("[MultimediaGenerator] Error converting image to base64:", error);
      return null;
    }
  }
}
