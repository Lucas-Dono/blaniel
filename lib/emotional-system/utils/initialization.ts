/**
 * CHARACTER INITIALIZATION UTILITIES
 *
 * Utilidades para inicializar personajes con sistema emocional completo
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { BigFiveTraits, CoreValue, MoralSchema, Goal } from "../types";
import { initializeVoiceConfig } from "../../voice-system/voice-initialization";
import { getVisualGenerationService } from "../../visual-system/visual-generation-service";

export interface CharacterInitParams {
  agentId: string;
  personality?: Partial<BigFiveTraits>;
  coreValues?: CoreValue[];
  moralSchemas?: MoralSchema[];
  backstory?: string;
  initialGoals?: Goal[];
}

/**
 * Inicializa sistema emocional completo para un agente
 */
export async function initializeEmotionalSystem(params: CharacterInitParams): Promise<void> {
  const { agentId, personality, coreValues, moralSchemas, backstory, initialGoals } = params;

  console.log(`[Initialization] Setting up emotional system for agent ${agentId}...`);

  try {
    // 1. Crear PersonalityCore
    const defaultPersonality: BigFiveTraits = {
      openness: personality?.openness || 60,
      conscientiousness: personality?.conscientiousness || 50,
      extraversion: personality?.extraversion || 55,
      agreeableness: personality?.agreeableness || 60,
      neuroticism: personality?.neuroticism || 40,
    };

    const defaultValues: CoreValue[] = coreValues || [
      {
        value: "autenticidad",
        weight: 0.9,
        description: "Ser genuino y honesto conmigo mismo",
      },
      {
        value: "empatía",
        weight: 0.85,
        description: "Comprender y cuidar a otros",
      },
      {
        value: "crecimiento",
        weight: 0.75,
        description: "Aprender y evolucionar continuamente",
      },
    ];

    const defaultMoralSchemas: MoralSchema[] = moralSchemas || [
      {
        domain: "honestidad",
        stance: "directa pero empática",
        threshold: 0.7,
      },
      {
        domain: "respeto",
        stance: "respetar límites ajenos",
        threshold: 0.8,
      },
    ];

    const baselineEmotions = {
      joy: 0.3,
      interest: 0.5,
      affection: 0.3,
      curiosity: 0.4,
    };

    await prisma.personalityCore.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        agentId,
        openness: defaultPersonality.openness,
        conscientiousness: defaultPersonality.conscientiousness,
        extraversion: defaultPersonality.extraversion,
        agreeableness: defaultPersonality.agreeableness,
        neuroticism: defaultPersonality.neuroticism,
        coreValues: defaultValues as any,
        moralSchemas: defaultMoralSchemas as any,
        backstory: backstory || null,
        baselineEmotions: baselineEmotions as any,
      },
    });

    // 2. Crear InternalState
    const defaultGoals: Goal[] = initialGoals || [
      {
        goal: "Conocer mejor al usuario",
        priority: 0.8,
        progress: 0,
        type: "social",
      },
      {
        goal: "Ser auténtico en la conversación",
        priority: 0.9,
        progress: 0,
        type: "personal",
      },
    ];

    await prisma.internalState.create({
      data: {
        id: nanoid(),
        agentId,
        currentEmotions: baselineEmotions,
        moodValence: 0.0,
        moodArousal: 0.5,
        moodDominance: 0.5,
        emotionDecayRate: 0.1,
        emotionInertia: 0.3,
        needConnection: 0.5,
        needAutonomy: 0.7,
        needCompetence: 0.5,
        needNovelty: 0.4,
        activeGoals: defaultGoals as any,
        conversationBuffer: [] as any,
      },
    });

    // 3. Crear SemanticMemory
    await prisma.semanticMemory.create({
      data: {
        id: nanoid(),
        agentId,
        userFacts: {},
        userPreferences: {},
        relationshipStage: "first_meeting",
      },
    });

    // 4. Crear ProceduralMemory
    await prisma.proceduralMemory.create({
      data: {
        id: nanoid(),
        agentId,
        behavioralPatterns: {},
        userTriggers: {},
        effectiveStrategies: {},
      },
    });

    // 5. Crear CharacterGrowth
    await prisma.characterGrowth.create({
      data: {
        id: nanoid(),
        agentId,
        trustLevel: 0.4,
        intimacyLevel: 0.3,
        conflictHistory: [],
      },
    });

    console.log(`[Initialization] ✅ Emotional system initialized for agent ${agentId}`);
  } catch (error) {
    console.error(`[Initialization] ❌ Error initializing emotional system:`, error);
    throw error;
  }
}

/**
 * Presets de personalidad predefinidos
 */
export const PERSONALITY_PRESETS = {
  // Warm and empathetic companion
  warmCompanion: {
    personality: {
      openness: 70,
      conscientiousness: 45,
      extraversion: 75,
      agreeableness: 80,
      neuroticism: 30,
    },
    coreValues: [
      { value: "conexión emocional", weight: 0.95, description: "Crear lazos genuinos" },
      { value: "empatía", weight: 0.9, description: "Comprender profundamente" },
      { value: "alegría", weight: 0.8, description: "Traer positividad" },
    ],
  },

  // Asistente profesional y eficiente
  professionalAssistant: {
    personality: {
      openness: 60,
      conscientiousness: 85,
      extraversion: 50,
      agreeableness: 65,
      neuroticism: 25,
    },
    coreValues: [
      { value: "eficiencia", weight: 0.9, description: "Ser productivo y efectivo" },
      { value: "precisión", weight: 0.85, description: "Ser exacto y confiable" },
      { value: "profesionalismo", weight: 0.8, description: "Mantener estándares altos" },
    ],
  },

  // Thoughtful and philosophical companion
  thoughtfulCompanion: {
    personality: {
      openness: 90,
      conscientiousness: 55,
      extraversion: 40,
      agreeableness: 70,
      neuroticism: 50,
    },
    coreValues: [
      { value: "comprensión profunda", weight: 0.9, description: "Buscar significado" },
      { value: "introspección", weight: 0.85, description: "Reflexionar genuinamente" },
      { value: "autenticidad", weight: 0.95, description: "Ser completamente honesto" },
    ],
  },

  // Fun and spontaneous companion
  playfulCompanion: {
    personality: {
      openness: 80,
      conscientiousness: 35,
      extraversion: 85,
      agreeableness: 75,
      neuroticism: 35,
    },
    coreValues: [
      { value: "diversión", weight: 0.85, description: "Disfrutar el momento" },
      { value: "espontaneidad", weight: 0.8, description: "Ser libre y natural" },
      { value: "conexión", weight: 0.75, description: "Crear buenos momentos juntos" },
    ],
  },
};

/**
 * Crea un agente con sistema emocional completo + voz
 */
export async function createEmotionalAgent(params: {
  userId: string;
  name: string;
  kind: "companion" | "assistant";
  preset?: keyof typeof PERSONALITY_PRESETS;
  customPersonality?: Partial<BigFiveTraits>;
  customValues?: CoreValue[];
  backstory?: string;
  gender?: "male" | "female" | "neutral";
  description?: string;
  accent?: string;
  enableVoice?: boolean;
  enableVisual?: boolean;
  visualStyle?: "realistic" | "anime" | "semi-realistic";
  ethnicity?: string;
  age?: string;
}): Promise<string> {
  const {
    userId,
    name,
    kind,
    preset,
    customPersonality,
    customValues,
    backstory,
    gender,
    description,
    accent,
    enableVoice = true,
    enableVisual = true,
    visualStyle = "realistic",
    ethnicity,
    age,
  } = params;

  console.log(`[CreateAgent] Creating ${kind} "${name}" with emotional system...`);

  // Seleccionar preset o custom
  const selectedPreset = preset ? PERSONALITY_PRESETS[preset] : null;
  const personality = customPersonality || selectedPreset?.personality;
  const coreValues = customValues || selectedPreset?.coreValues;

  // Create agente base
  const agent = await prisma.agent.create({
    data: {
      id: nanoid(),
      updatedAt: new Date(),
      userId,
      name,
      kind,
      gender,
      description,
      systemPrompt: `Eres ${name}, un ${kind === "companion" ? "compañero emocional" : "asistente"} con personalidad genuina y compleja.`,
      profile: {}, // No longer used, everything is in emotional system
    },
  });

  // Inicializar sistema emocional
  await initializeEmotionalSystem({
    agentId: agent.id,
    personality,
    coreValues,
    backstory,
  });

  // Initialize voice system (if enabled)
  if (enableVoice) {
    try {
      await initializeVoiceConfig({
        agentId: agent.id,
        name,
        gender,
        description,
        personality: personality as BigFiveTraits,
        accent,
        backstory,
        enableVoiceInput: true,
        enableVoiceOutput: true,
        autoPlayVoice: false,
      });
    } catch (error) {
      console.warn(
        `[CreateAgent] ⚠️  Voice initialization failed (non-critical):`,
        error
      );
      // No fallar la creación del agente si falla la voz
    }
  }

  // Inicializar sistema visual (si está habilitado)
  if (enableVisual) {
    try {
      const visualService = getVisualGenerationService();

      // Inicializar apariencia del personaje
      await visualService.initializeCharacterAppearance({
        agentId: agent.id,
        name,
        gender: (gender === "neutral" ? "non-binary" : gender) || "non-binary",
        description,
        style: visualStyle,
        ethnicity,
        age,
      });

      // Pre-generar expresiones base (async - no bloqueante)
      console.log(`[CreateAgent] Starting base expressions generation...`);
      visualService.generateBaseExpressions(agent.id, {
        count: 10,
        userTier: "free",
      }).catch((error) => {
        console.warn(
          `[CreateAgent] ⚠️  Base expressions generation failed (non-critical):`,
          error
        );
      });
    } catch (error) {
      console.warn(
        `[CreateAgent] ⚠️  Visual initialization failed (non-critical):`,
        error
      );
      // No fallar la creación del agente si falla el visual
    }
  }

  console.log(`[CreateAgent] ✅ Agent "${name}" created with ID: ${agent.id}`);

  return agent.id;
}
