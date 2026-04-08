/**
 * OPENAI WHISPER CLIENT
 *
 * Audio to text transcription using OpenAI Whisper API
 * - Support for gpt-4o-transcribe and gpt-4o-mini-tts
 * - Basic emotional tone analysis from audio
 */

import OpenAI from "openai";
import fs from "fs";

export interface WhisperTranscriptionResult {
  text: string;
  language?: string;
  duration?: number;

  // Basic audio characteristics analysis
  audioAnalysis?: {
    speakingRate: number; // Estimated: words per minute
    pauseCount: number; // Number of detected pauses
    confidence: number; // Transcription confidence
  };
}

export interface EmotionalToneAnalysis {
  // Inferred from TEXT + audio characteristics
  detectedEmotions: string[];
  valence: number; // -1 (negative) to 1 (positive)
  arousal: number; // 0 (calm) to 1 (excited)
  confidence: number;
}

export class WhisperClient {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey?: string, model: "standard" | "mini" = "standard") {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });

    // Use environment variable for model
    this.model =
      model === "mini"
        ? process.env.openai_whisper_mini || "whisper-1"
        : process.env.openai_whisper || "whisper-1";

    console.log(`[WhisperClient] Initialized with model: ${this.model}`);
  }

  /**
   * Transcribe audio file to text
   */
  async transcribe(
    audioFilePath: string,
    options?: {
      language?: string;
      prompt?: string; // Previous context to improve accuracy
      temperature?: number; // 0-1, lower = more conservative
    }
  ): Promise<WhisperTranscriptionResult> {
    try {
      console.log(`[Whisper] Transcribing audio: ${audioFilePath}`);

      const audioFile = fs.createReadStream(audioFilePath);

      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: this.model,
        language: options?.language,
        prompt: options?.prompt,
        temperature: options?.temperature ?? 0.2,
        response_format: "verbose_json", // Includes timestamps and metadata
      });

      // Analyze basic audio characteristics
      const audioAnalysis = this.analyzeAudioCharacteristics(
        transcription.text,
        (transcription as any).duration
      );

      const result: WhisperTranscriptionResult = {
        text: transcription.text,
        language: transcription.language,
        duration: (transcription as any).duration,
        audioAnalysis,
      };

      console.log(`[Whisper] ✅ Transcription complete: "${result.text.substring(0, 50)}..."`);

      return result;
    } catch (error) {
      console.error("[Whisper] Error transcribing:", error);
      throw error;
    }
  }

  /**
   * Transcribe from Buffer (useful for uploads)
   */
  async transcribeFromBuffer(
    audioBuffer: Buffer,
    filename: string,
    options?: {
      language?: string;
      prompt?: string;
      temperature?: number;
    }
  ): Promise<WhisperTranscriptionResult> {
    try {
      console.log(`[Whisper] Transcribing from buffer: ${filename}`);

      // Create File from Buffer (convert to Uint8Array to ensure proper type)
      const audioFile = new File([new Uint8Array(audioBuffer)], filename);

      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: this.model,
        language: options?.language,
        prompt: options?.prompt,
        temperature: options?.temperature ?? 0.2,
        response_format: "verbose_json",
      });

      const audioAnalysis = this.analyzeAudioCharacteristics(
        transcription.text,
        (transcription as any).duration
      );

      return {
        text: transcription.text,
        language: transcription.language,
        duration: (transcription as any).duration,
        audioAnalysis,
      };
    } catch (error) {
      console.error("[Whisper] Error transcribing from buffer:", error);
      throw error;
    }
  }

  /**
   * Analyze basic audio characteristics to infer emotional tone
   */
  private analyzeAudioCharacteristics(
    text: string,
    duration?: number
  ): WhisperTranscriptionResult["audioAnalysis"] {
    if (!duration) {
      return undefined;
    }

    const wordCount = text.split(/\s+/).length;
    const speakingRate = (wordCount / duration) * 60; // words per minute

    // Detect pauses (estimated by punctuation)
    const pauseCount = (text.match(/[.!?;,]/g) || []).length;

    // Basic confidence (placeholder - Whisper doesn't return confidence score directly)
    const confidence = 0.85;

    return {
      speakingRate,
      pauseCount,
      confidence,
    };
  }

  /**
   * Emotional tone analysis based on text + audio characteristics
   */
  async analyzeEmotionalTone(
    transcription: WhisperTranscriptionResult
  ): Promise<EmotionalToneAnalysis> {
    const text = transcription.text.toLowerCase();
    const audioAnalysis = transcription.audioAnalysis;

    // Basic rule-based analysis
    // TODO: Improve with specialized model (Hume AI, etc.)

    const detectedEmotions: string[] = [];
    let valence = 0; // neutral
    let arousal = 0.5; // medium

    // 1. Emotional keyword analysis
    const positiveKeywords = [
      "feliz",
      "alegre",
      "genial",
      "excelente",
      "increíble",
      "amor",
      "gracias",
      "maravilloso",
    ];
    const negativeKeywords = [
      "triste",
      "enojado",
      "frustrado",
      "terrible",
      "horrible",
      "odio",
      "mal",
      "difícil",
    ];
    const anxietyKeywords = [
      "preocupado",
      "nervioso",
      "ansioso",
      "miedo",
      "estresado",
    ];
    const excitementKeywords = [
      "emocionado",
      "wow",
      "increíble",
      "asombroso",
      "genial",
    ];

    // Contar keywords
    const positiveCount = positiveKeywords.filter((kw) =>
      text.includes(kw)
    ).length;
    const negativeCount = negativeKeywords.filter((kw) =>
      text.includes(kw)
    ).length;
    const anxietyCount = anxietyKeywords.filter((kw) =>
      text.includes(kw)
    ).length;
    const excitementCount = excitementKeywords.filter((kw) =>
      text.includes(kw)
    ).length;

    // 2. Calcular valence
    valence = Math.max(
      -1,
      Math.min(1, (positiveCount - negativeCount) * 0.3)
    );

    // 3. Calculate arousal from audio features
    if (audioAnalysis) {
      // Speaking rate rápido → arousal alto
      if (audioAnalysis.speakingRate > 150) {
        arousal += 0.2;
      } else if (audioAnalysis.speakingRate < 100) {
        arousal -= 0.2;
      }

      // Pocas pausas → arousal alto (hablando rápido sin parar)
      if (audioAnalysis.pauseCount < 2) {
        arousal += 0.1;
      }
    }

    // 4. Detectar emociones específicas
    if (positiveCount > 0) {
      detectedEmotions.push("joy");
    }
    if (negativeCount > 0) {
      detectedEmotions.push("distress");
    }
    if (anxietyCount > 0) {
      detectedEmotions.push("anxiety");
    }
    if (excitementCount > 0) {
      detectedEmotions.push("excitement");
    }

    // 5. Análisis de signos de exclamación/interrogación
    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;

    if (exclamationCount > 0) {
      arousal += 0.1;
      if (!detectedEmotions.includes("excitement")) {
        detectedEmotions.push("excitement");
      }
    }

    if (questionCount > 1) {
      if (!detectedEmotions.includes("curiosity")) {
        detectedEmotions.push("curiosity");
      }
    }

    // Normalizar arousal
    arousal = Math.max(0, Math.min(1, arousal));

    // Si no se detectó nada, asumir neutral
    if (detectedEmotions.length === 0) {
      detectedEmotions.push("neutral");
    }

    const confidence = audioAnalysis?.confidence || 0.7;

    console.log(`[Whisper] Emotional tone analysis:`, {
      detectedEmotions,
      valence: valence.toFixed(2),
      arousal: arousal.toFixed(2),
      confidence: confidence.toFixed(2),
    });

    return {
      detectedEmotions,
      valence,
      arousal,
      confidence,
    };
  }
}

// Singleton instance
let whisperClient: WhisperClient | null = null;

export function getWhisperClient(model: "standard" | "mini" = "standard"): WhisperClient {
  if (!whisperClient) {
    whisperClient = new WhisperClient(undefined, model);
  }
  return whisperClient;
}
