/**
 * Reference Image and Voice Generator for New Agents
 *
 * Generates character reference image and assigns voice
 * when creating new agent, maintaining visual and vocal consistency.
 */

import { getAIHordeClient } from "@/lib/visual-system/ai-horde-client";
import { getElevenLabsClient, type VoiceCharacteristics } from "@/lib/voice-system/elevenlabs-client";
import { getLLMProvider } from "@/lib/llm/provider";

export interface ReferenceGenerationResult {
  referenceImageUrl?: string;
  voiceId?: string;
  errors: string[];
}

/**
 * Generate reference image and assign voice for new agent
 *
 * @param skipImageGeneration - If true, don't generate image (user already provided one)
 */
export async function generateAgentReferences(
  agentName: string,
  personality: string,
  gender?: string,
  userId?: string,
  agentId?: string,
  skipImageGeneration?: boolean
): Promise<ReferenceGenerationResult> {
  const result: ReferenceGenerationResult = {
    errors: [],
  };

  // 1. Generate reference image (only if user did NOT provide one)
  if (!skipImageGeneration) {
    try {
      console.log('[ReferenceGenerator] Generating image with AI Horde...');
      const prompt = buildReferenceImagePrompt(agentName, personality, gender);

      const aiHordeClient = getAIHordeClient();
      const imageResult = await aiHordeClient.generateImage({
        prompt,
        negativePrompt:
          "low quality, blurry, distorted, deformed, anime, cartoon, multiple people, text, watermark, signature, low resolution, bad anatomy",
        width: 512,
        height: 768, // Vertical to capture full body
        steps: 40, // More steps for better reference quality
        cfgScale: 7.5,
        sampler: "k_euler_a",
        seed: -1,
        nsfw: false,
      });

      if (imageResult && imageResult.imageUrl) {
        result.referenceImageUrl = imageResult.imageUrl;
        console.log(`[ReferenceGenerator] Reference image generated for ${agentName}`);
      } else {
        result.errors.push("Failed to generate reference image");
        console.error(`[ReferenceGenerator] Image generation failed`);
      }
    } catch (error) {
      result.errors.push(`Image generation error: ${error}`);
      console.error("[ReferenceGenerator] Error generating reference image:", error);
    }
  } else {
    console.log('[ReferenceGenerator] Saltando generación de imagen (usuario proporcionó una)');
  }

  // 2. Asignar voz de ElevenLabs usando IA para buscar la mejor match
  try {
    console.log('[ReferenceGenerator] Seleccionando voz automáticamente con IA...');

    const voiceResult = await selectVoiceForAgentWithAI(agentName, personality, gender);
    result.voiceId = voiceResult.voiceId;

    console.log(`[ReferenceGenerator] Voice "${voiceResult.voiceName}" (${voiceResult.voiceId}) assigned to ${agentName} with confidence ${(voiceResult.confidence * 100).toFixed(0)}%`);
  } catch (error) {
    result.errors.push(`Voice assignment error: ${error}`);
    console.error("[ReferenceGenerator] Error assigning voice:", error);
  }

  return result;
}

/**
 * Construye un prompt detallado para la imagen de referencia
 */
function buildReferenceImagePrompt(
  name: string,
  personality: string,
  gender?: string
): string {
  // Extract personality physical traits if they exist
  const personalityLower = personality.toLowerCase();

  // Determine gender if not specified
  let genderPrompt = "";
  if (gender) {
    genderPrompt = gender.toLowerCase().includes("fem") || gender.toLowerCase().includes("mujer")
      ? "female"
      : "male";
  } else {
    // Inferir de la personalidad
    if (personalityLower.includes("mujer") || personalityLower.includes("femenin") || personalityLower.includes("chica")) {
      genderPrompt = "female";
    } else if (personalityLower.includes("hombre") || personalityLower.includes("masculin") || personalityLower.includes("chico")) {
      genderPrompt = "male";
    } else {
      genderPrompt = "androgynous"; // Neutro por defecto
    }
  }

  // Extraer keywords de apariencia
  const appearanceKeywords: string[] = [];

  if (personalityLower.includes("atlético") || personalityLower.includes("deportista")) {
    appearanceKeywords.push("athletic build, fit");
  }
  if (personalityLower.includes("elegante")) {
    appearanceKeywords.push("elegant, sophisticated");
  }
  if (personalityLower.includes("casual") || personalityLower.includes("relajad")) {
    appearanceKeywords.push("casual clothing, relaxed style");
  }
  if (personalityLower.includes("tímid") || personalityLower.includes("reservad")) {
    appearanceKeywords.push("shy expression, soft features");
  }
  if (personalityLower.includes("segur") || personalityLower.includes("confiad")) {
    appearanceKeywords.push("confident posture, strong presence");
  }

  // Si no hay keywords específicas, agregar defaults
  if (appearanceKeywords.length === 0) {
    appearanceKeywords.push("natural appearance, friendly expression");
  }

  const prompt = `Professional reference portrait photograph of ${name}, ${genderPrompt} character.
${appearanceKeywords.join(", ")}.
Full body portrait, standing position, neutral white background.
Natural lighting, high quality, photorealistic, detailed facial features,
consistent appearance for character reference, professional photography.
Clear, sharp focus, 4K quality.
Character personality traits: ${personality.substring(0, 100)}.`;

  return prompt;
}

/**
 * Usa Gemini para analizar el personaje y ElevenLabs para seleccionar la mejor voz
 */
async function selectVoiceForAgentWithAI(
  agentName: string,
  personality: string,
  gender?: string
): Promise<{ voiceId: string; voiceName: string; confidence: number }> {
  try {
    // 1. Usar Gemini para extraer características de búsqueda
    const llm = getLLMProvider();

    const analysisPrompt = `Analiza este personaje y extrae características para buscar su voz perfecta en ElevenLabs.

PERSONAJE:
Nombre: ${agentName}
Personalidad: ${personality}
${gender ? `Género especificado: ${gender}` : ''}

TAREA:
Extrae las siguientes características en formato JSON:
- gender: "male" | "female" | "neutral"
- age: "young" | "middle_aged" | "old"
- accent: código de acento (ej: "es-AR" para argentino, "es-MX" para mexicano, "en-US", etc.)
- description: 2-3 palabras clave en inglés que describan el tono de voz ideal (ej: "cheerful energetic", "calm mature", "seductive confident")

IMPORTANTE:
- Para nombres femeninos como "Anya", "María", "Sofia" → gender: "female"
- Para nombres masculinos como "Carlos", "Josh", "Mario" → gender: "male"
- Si la personalidad menciona "alegre", "enérgico" → incluir en description
- Si menciona "tranquilo", "sereno" → incluir "calm" en description
- Si menciona nacionalidad/región, inferir el acento apropiado

Responde SOLO con el JSON, sin markdown ni explicaciones:`;

    const response = await llm.generate({
      systemPrompt: "Eres un asistente que genera JSON estructurado. Responde SOLO con JSON válido.",
      messages: [{ role: "user", content: analysisPrompt }],
      temperature: 0.3,
    });

    // Parsear respuesta
    let cleanedResponse = response.trim();
    if (cleanedResponse.startsWith("```json")) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanedResponse.startsWith("```")) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const characteristics: VoiceCharacteristics = JSON.parse(cleanedResponse);

    console.log('[ReferenceGenerator] Características extraídas por Gemini:', characteristics);

    // 2. Usar ElevenLabs para buscar la mejor voz
    const elevenlabsClient = getElevenLabsClient();
    const voiceResult = await elevenlabsClient.selectVoiceForCharacter(characteristics);

    return voiceResult;
  } catch (error) {
    console.error('[ReferenceGenerator] Error en selección inteligente de voz:', error);
    console.log('[ReferenceGenerator] Fallback a método legacy...');

    // Fallback to old method if fails
    const voiceId = selectVoiceForAgentLegacy(personality, gender);
    return {
      voiceId,
      voiceName: "Fallback Voice",
      confidence: 0.3,
    };
  }
}

/**
 * Método legacy de selección de voz (fallback)
 * @deprecated Usar selectVoiceForAgentWithAI en su lugar
 */
function selectVoiceForAgentLegacy(personality: string, gender?: string): string {
  const personalityLower = personality.toLowerCase();

  // Determine gender
  let isFemale = false;
  if (gender) {
    isFemale = gender.toLowerCase().includes("fem") || gender.toLowerCase().includes("mujer");
  } else {
    isFemale = personalityLower.includes("mujer") || personalityLower.includes("femenin") || personalityLower.includes("chica");
  }

  // Voces de ElevenLabs (IDs reales de voces pre-hechas)
  const voices = {
    female: {
      calm: "EXAVITQu4vr4xnSDxMaL", // Rachel - calm, soft
      energetic: "21m00Tcm4TlvDq8ikWAM", // Rachel - young, energetic
      mature: "AZnzlk1XvdvUeBnXmlld", // Domi - confident, mature
      friendly: "pNInz6obpgDQGcFmaJgB", // Adam - friendly (unisex)
    },
    male: {
      calm: "TxGEqnHWrfWFTfGW9XjX", // Josh - calm, deep
      energetic: "ErXwobaYiN019PkySvjV", // Antoni - young, energetic
      mature: "VR6AewLTigWG4xSOukaG", // Arnold - deep, authoritative
      friendly: "pNInz6obpgDQGcFmaJgB", // Adam - friendly (unisex)
    },
  };

  // Seleccionar basado en personalidad
  let voiceCategory: "calm" | "energetic" | "mature" | "friendly" = "friendly";

  if (personalityLower.includes("enérgic") || personalityLower.includes("activ") || personalityLower.includes("juguet")) {
    voiceCategory = "energetic";
  } else if (personalityLower.includes("calmad") || personalityLower.includes("serene") || personalityLower.includes("tranquil")) {
    voiceCategory = "calm";
  } else if (personalityLower.includes("matur") || personalityLower.includes("seri") || personalityLower.includes("profesional")) {
    voiceCategory = "mature";
  }

  return isFemale ? voices.female[voiceCategory] : voices.male[voiceCategory];
}
