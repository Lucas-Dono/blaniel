/**
 * VOICE INITIALIZATION UTILITIES
 *
 * Functions to automatically initialize voice configuration
 * when an emotional agent is created
 */

import { PrismaClient } from "@prisma/client";
import { getElevenLabsClient, type VoiceCharacteristics } from "./elevenlabs-client";
import type { BigFiveTraits } from "../emotional-system/types";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

export interface VoiceInitializationParams {
  agentId: string;
  name: string;
  gender?: "male" | "female" | "neutral";
  description?: string;
  personality?: BigFiveTraits;
  accent?: string;
  backstory?: string;

  // Configuration options
  manualVoiceId?: string; // If provided, use this specific voice
  enableVoiceInput?: boolean;
  enableVoiceOutput?: boolean;
  autoPlayVoice?: boolean;
}

/**
 * Automatically initialize voice configuration for an agent
 */
export async function initializeVoiceConfig(
  params: VoiceInitializationParams
): Promise<void> {
  try {
    console.log(`[VoiceInit] Initializing voice for agent: ${params.name}`);

    const elevenlabs = getElevenLabsClient();

    let voiceId: string;
    let voiceName: string;
    let selectionConfidence: number;
    let manualSelection: boolean;

    // If manual voice is provided, use it
    if (params.manualVoiceId) {
      voiceId = params.manualVoiceId;
      voiceName = await elevenlabs["getVoiceName"](voiceId);
      selectionConfidence = 1.0;
      manualSelection = true;

      console.log(`[VoiceInit] Using manual voice: ${voiceName}`);
    } else {
      // Automatic selection based on character characteristics
      const characteristics = buildVoiceCharacteristics(params);

      const selection = await elevenlabs.selectVoiceForCharacter(
        characteristics
      );

      voiceId = selection.voiceId;
      voiceName = selection.voiceName;
      selectionConfidence = selection.confidence;
      manualSelection = false;

      console.log(
        `[VoiceInit] Auto-selected voice: ${voiceName} (ID: ${voiceId}, confidence: ${selectionConfidence.toFixed(2)})`
      );
    }

    // Debug: Verify that voiceId is not undefined
    if (!voiceId) {
      throw new Error(`Voice selection failed: voiceId is ${voiceId}`);
    }

    // Determine gender if not provided
    const gender = params.gender || inferGenderFromPersonality(params.personality);

    // Create voice configuration in database
    await prisma.voiceConfig.create({
      data: {
        id: nanoid(),
        agentId: params.agentId,
        voiceId,
        voiceName,
        gender,
        age: "middle_aged", // Default, can be improved
        accent: params.accent,
        characterDescription: buildCharacterDescription(params),
        selectionConfidence,
        manualSelection,

        // Default configuration
        defaultStability: 0.5,
        defaultSimilarityBoost: 0.75,
        defaultStyle: 0.0,

        // Input/Output configuration
        enableVoiceInput: params.enableVoiceInput ?? true,
        whisperModel: "standard",
        detectEmotionalTone: true,

        enableVoiceOutput: params.enableVoiceOutput ?? true,
        autoPlayVoice: params.autoPlayVoice ?? false,
        voiceSpeed: 1.0,

        totalVoiceGenerations: 0,
        totalTranscriptions: 0,
        updatedAt: new Date(),
      },
    });

    console.log(`[VoiceInit] ✅ Voice config created for agent ${params.agentId}`);
  } catch (error) {
    console.error("[VoiceInit] Error initializing voice:", error);
    throw error;
  }
}

/**
 * Build voice characteristics from agent parameters
 */
function buildVoiceCharacteristics(
  params: VoiceInitializationParams
): VoiceCharacteristics {
  // Infer gender if not provided
  const gender = params.gender || inferGenderFromPersonality(params.personality);

  // Build enriched character description
  const descriptionParts: string[] = [];

  if (params.description) {
    descriptionParts.push(params.description);
  }

  if (params.backstory) {
    descriptionParts.push(params.backstory.substring(0, 200)); // First 200 chars
  }

  // Add personality characteristics to description
  if (params.personality) {
    const traits = [];

    if (params.personality.extraversion > 70) {
      traits.push("extroverted", "energetic", "sociable");
    } else if (params.personality.extraversion < 30) {
      traits.push("introverted", "reflective", "calm");
    }

    if (params.personality.agreeableness > 70) {
      traits.push("amable", "empática", "cálida");
    }

    if (params.personality.openness > 70) {
      traits.push("creativa", "curiosa", "imaginativa");
    }

    if (params.personality.conscientiousness > 70) {
      traits.push("organizada", "responsable", "meticulosa");
    }

    if (params.personality.neuroticism > 70) {
      traits.push("sensible", "emotiva", "expresiva");
    }

    if (traits.length > 0) {
      descriptionParts.push(`Personalidad: ${traits.join(", ")}`);
    }
  }

  const description = descriptionParts.join(". ");

  // Determinar edad aproximada desde personalidad o defaults
  const age: "young" | "middle_aged" | "old" = "middle_aged";

  // Simplemente usar middle_aged por ahora
  // TODO: Podría inferirse de la descripción/backstory

  return {
    gender,
    age,
    accent: params.accent,
    description,
    personality: params.personality,
  };
}

/**
 * Construye descripción de personaje para almacenar
 */
function buildCharacterDescription(params: VoiceInitializationParams): string {
  const parts: string[] = [];

  parts.push(`Nombre: ${params.name}`);

  if (params.description) {
    parts.push(params.description);
  }

  if (params.backstory) {
    parts.push(`Backstory: ${params.backstory.substring(0, 300)}`);
  }

  return parts.join(". ");
}

/**
 * Infiere género desde personalidad (heurística simple)
 * Esto es solo un fallback - mejor proporcionar gender explícitamente
 */
function inferGenderFromPersonality(
  personality?: BigFiveTraits
): "male" | "female" | "neutral" {
  // Por ahora, usar neutral si no se especifica
  // In production, it would be better if user always specifies

  if (!personality) {
    return "neutral";
  }

  // Very simple heuristic based on psychological research
  // (NO es 100% preciso, solo un fallback razonable)

  const agreeablenessBias = personality.agreeableness;
  const neuroticismBias = personality.neuroticism;

  // Studies show women tend to score higher in agreeableness and neuroticism
  // PERO esto es solo estadística poblacional, no determina género individual

  const femininityScore =
    (agreeablenessBias / 100) * 0.5 + (neuroticismBias / 100) * 0.5;

  if (femininityScore > 0.6) {
    return "female";
  } else if (femininityScore < 0.4) {
    return "male";
  }

  return "neutral";
}

/**
 * Actualiza la configuración de voz de un agente existente
 */
export async function updateVoiceConfig(
  agentId: string,
  updates: Partial<{
    voiceId: string;
    enableVoiceInput: boolean;
    enableVoiceOutput: boolean;
    autoPlayVoice: boolean;
    whisperModel: "standard" | "mini";
    voiceSpeed: number;
  }>
): Promise<void> {
  try {
    console.log(`[VoiceInit] Updating voice config for agent: ${agentId}`);

    // Si se actualiza voiceId, obtener el nombre
    let voiceName: string | undefined;
    if (updates.voiceId) {
      const elevenlabs = getElevenLabsClient();
      voiceName = await elevenlabs["getVoiceName"](updates.voiceId);
    }

    await prisma.voiceConfig.update({
      where: { agentId },
      data: {
        ...(updates.voiceId && { voiceId: updates.voiceId, voiceName }),
        ...(updates.enableVoiceInput !== undefined && {
          enableVoiceInput: updates.enableVoiceInput,
        }),
        ...(updates.enableVoiceOutput !== undefined && {
          enableVoiceOutput: updates.enableVoiceOutput,
        }),
        ...(updates.autoPlayVoice !== undefined && {
          autoPlayVoice: updates.autoPlayVoice,
        }),
        ...(updates.whisperModel && { whisperModel: updates.whisperModel }),
        ...(updates.voiceSpeed && { voiceSpeed: updates.voiceSpeed }),

        // Si se cambió la voz manualmente, marcar como manual selection
        ...(updates.voiceId && { manualSelection: true }),
      },
    });

    console.log(`[VoiceInit] ✅ Voice config updated`);
  } catch (error) {
    console.error("[VoiceInit] Error updating voice config:", error);
    throw error;
  }
}

/**
 * Obtiene la configuración de voz de un agente
 */
export async function getVoiceConfig(agentId: string) {
  return await prisma.voiceConfig.findUnique({
    where: { agentId },
  });
}

/**
 * Incrementa contador de generaciones de voz
 */
export async function incrementVoiceGenerations(agentId: string): Promise<void> {
  await prisma.voiceConfig.update({
    where: { agentId },
    data: {
      totalVoiceGenerations: {
        increment: 1,
      },
    },
  });
}

/**
 * Incrementa contador de transcripciones
 */
export async function incrementTranscriptions(agentId: string): Promise<void> {
  await prisma.voiceConfig.update({
    where: { agentId },
    data: {
      totalTranscriptions: {
        increment: 1,
      },
    },
  });
}
