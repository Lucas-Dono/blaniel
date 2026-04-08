/**
 * EMOTIONAL ANALYZER SERVICE
 *
 * Analiza el tono emocional de mensajes del usuario
 * usando el sistema emocional existente
 */

import { getLLMProvider } from "@/lib/llm/provider";

export interface UserEmotionAnalysis {
  dominantEmotion: string;
  intensity: "low" | "medium" | "high";
  valence: number; // -1 (negativo) a +1 (positivo)
  arousal: number; // 0 (calmado) a 1 (activado)
  confidence: number; // 0-1
}

export class EmotionalAnalyzer {
  /**
   * Analiza el mensaje del usuario para detectar emociones
   */
  async analyzeMessage(message: string): Promise<UserEmotionAnalysis> {
    try {
      const llm = getLLMProvider();

      const prompt = `Analiza la emoción predominante en este mensaje del usuario.

Mensaje: "${message}"

Responde SOLO con un JSON válido en este formato exacto:
{
  "dominantEmotion": "joy|sadness|anger|fear|surprise|disgust|neutral",
  "intensity": "low|medium|high",
  "valence": (número entre -1 y 1),
  "arousal": (número entre 0 y 1),
  "confidence": (número entre 0 y 1)
}`;

      const response = await llm.generate({
        systemPrompt: "You are an expert at analyzing human emotions from voice patterns.",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        maxTokens: 100,
      });

      // Parse JSON response
      const cleaned = response.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
      const analysis = JSON.parse(cleaned);

      return {
        dominantEmotion: analysis.dominantEmotion || "neutral",
        intensity: analysis.intensity || "medium",
        valence: analysis.valence || 0,
        arousal: analysis.arousal || 0.5,
        confidence: analysis.confidence || 0.7,
      };
    } catch (error) {
      console.error("[EmotionalAnalyzer] Error analyzing message:", error);

      // Fallback to neutral analysis
      return {
        dominantEmotion: "neutral",
        intensity: "medium",
        valence: 0,
        arousal: 0.5,
        confidence: 0.3,
      };
    }
  }
}

// Singleton instance
let emotionalAnalyzer: EmotionalAnalyzer | null = null;

export function getEmotionalAnalyzer(): EmotionalAnalyzer {
  if (!emotionalAnalyzer) {
    emotionalAnalyzer = new EmotionalAnalyzer();
    console.log("[EmotionalAnalyzer] Service initialized");
  }
  return emotionalAnalyzer;
}
