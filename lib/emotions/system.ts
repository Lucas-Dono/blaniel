/**
 * ⚠️ NOTE: This system is now a component of HybridEmotionalOrchestrator
 * 
 * DO NOT USE DIRECTLY IN ROUTES - Use instead:
 * import { hybridEmotionalOrchestrator } from "@/lib/emotional-system/hybrid-orchestrator";
 * 
 * This system (Plutchik rule-based) is now used only for the FAST PATH
 * when the message is simple. The hybrid system decides automatically.
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Complete Emotional System (Plutchik-based)
 * 
 * Analyzes messages and updates the agent's emotional state
 * based on Plutchik's Wheel of Emotions + PAD Model.
 * 
 * USED BY: HybridEmotionalOrchestrator (Fast Path)
 */

import {
  type PlutchikEmotionState,
  type PrimaryEmotion,
  createNeutralState,
  getDominantEmotions,
  calculateSecondaryEmotion,
  getOppositeEmotion,
  EMOTION_LABELS,
} from "./plutchik";

// ============================================
// "ANÁLISIS DE SENTIMIENTO" -> "SENTIMENT ANALYSIS"
// ============================================

interface EmotionTrigger {
  keywords: string[];
  emotion: PrimaryEmotion;
  intensity: number;
}

/** "Palabras clave que activan emociones específicas." -> "Keywords that trigger specific emotions." */
const EMOTION_TRIGGERS: EmotionTrigger[] = [
  // "JOY (Joy)" -> "JOY (Joy)"
  {
    keywords: [
      "feliz", "alegre", "genial", "increíble", "excelente", "perfecto",
      "amor", "maravilloso", "fantástico", "jaja", "jeje", "😊", "😄",
      "😁", "❤️", "🎉", "celebrar", "victoria", "logré", "conseguí"
    ],
    emotion: "joy",
    intensity: 0.15
  },

  // TRUST (Confianza)
  {
    keywords: [
      "confío", "confiable", "seguro", "honesto", "sincero", "gracias",
      "aprecio", "agradezco", "valoro", "respeto", "admiro"
    ],
    emotion: "trust",
    intensity: 0.12
  },

  // FEAR (Miedo)
  {
    keywords: [
      "miedo", "asustado", "nervioso", "preocupado", "ansioso", "pánico",
      "terror", "temor", "inseguro", "vulnerable", "peligro"
    ],
    emotion: "fear",
    intensity: 0.18
  },

  // SURPRISE (Sorpresa)
  {
    keywords: [
      "wow", "sorpresa", "increíble", "no esperaba", "inesperado",
      "asombrado", "shocked", "wtf", "qué", "😮", "😲", "impactante"
    ],
    emotion: "surprise",
    intensity: 0.20
  },

  // SADNESS (Tristeza)
  {
    keywords: [
      "triste", "deprimido", "melancólico", "solo", "vacío", "perdido",
      "llorar", "lágrimas", "dolor", "sufrir", "pena", "😢", "😭", "💔"
    ],
    emotion: "sadness",
    intensity: 0.15
  },

  // DISGUST (Disgusto)
  {
    keywords: [
      "asco", "desagradable", "repugnante", "horrible", "asqueroso",
      "odio", "detesto", "repulsivo", "🤮", "nauseabundo"
    ],
    emotion: "disgust",
    intensity: 0.14
  },

  // ANGER (Enojo)
  {
    keywords: [
      "enojado", "furioso", "molesto", "irritado", "frustrado", "enojo",
      "rabia", "ira", "cabrear", "hartó", "😡", "😤", "maldito", "carajo"
    ],
    emotion: "anger",
    intensity: 0.16
  },

  // "ANTICIPATION (Anticipation)" -> "ANTICIPATION (Anticipation)"
  {
    keywords: [
      "espero", "esperando", "ansioso", "emocionado", "pronto", "próximo",
      "planear", "futuro", "va a", "voy a", "deseo", "quiero", "ojalá"
    ],
    emotion: "anticipation",
    intensity: 0.13
  },
];

/**
 * Patrones adicionales para detectar emociones.
 */
interface EmotionPattern {
  test: (message: string) => boolean;
  emotion: PrimaryEmotion;
  intensity: number;
}

const EMOTION_PATTERNS: EmotionPattern[] = [
  // Preguntas (curiosidad = trust + surprise)
  {
    test: (msg) => msg.includes("?") || msg.includes("¿"),
    emotion: "surprise",
    intensity: 0.08
  },
  {
    test: (msg) => msg.includes("?") || msg.includes("¿"),
    emotion: "trust",
    intensity: 0.05
  },

  // Exclamaciones (joy o surprise)
  {
    test: (msg) => (msg.match(/!/g) || []).length >= 2,
    emotion: "joy",
    intensity: 0.10
  },

  // Mensajes largos (anticipation, engagement)
  {
    test: (msg) => msg.length > 200,
    emotion: "anticipation",
    intensity: 0.08
  },
  {
    test: (msg) => msg.length > 200,
    emotion: "trust",
    intensity: 0.06
  },

  // ALL CAPS (anger o excitement)
  {
    test: (msg) => {
      const words = msg.split(" ");
      const capsWords = words.filter(w => w === w.toUpperCase() && w.length > 3);
      return capsWords.length >= 2;
    },
    emotion: "anger",
    intensity: 0.12
  },
];

// ============================================
// EMOTION ANALYSIS
// ============================================

/** Analyzes a message and returns the emotional deltas. */
export function analyzeMessageEmotions(message: string): Partial<PlutchikEmotionState> {
  const lower = message.toLowerCase();
  const deltas: Partial<PlutchikEmotionState> = {};

  // BASELINE: Every interaction slightly increases joy and trust
  deltas.joy = 0.02;
  deltas.trust = 0.02;
  deltas.anticipation = 0.01;

  // Detectar keywords
  for (const trigger of EMOTION_TRIGGERS) {
    for (const keyword of trigger.keywords) {
      if (lower.includes(keyword)) {
        deltas[trigger.emotion] = (deltas[trigger.emotion] || 0) + trigger.intensity;

        // Reduce opposite emotion
        const opposite = getOppositeEmotion(trigger.emotion);
        deltas[opposite] = (deltas[opposite] || 0) - trigger.intensity * 0.5;
      }
    }
  }

  // Detectar patrones
  for (const pattern of EMOTION_PATTERNS) {
    if (pattern.test(message)) {
      deltas[pattern.emotion] = (deltas[pattern.emotion] || 0) + pattern.intensity;
    }
  }

  return deltas;
}

// ============================================
// EMOTION STATE MANAGEMENT
// ============================================

/** Applies emotional deltas to the current state with decay. */
export function applyEmotionDeltas(
  currentState: PlutchikEmotionState,
  deltas: Partial<PlutchikEmotionState>,
  decayRate: number = 0.05,
  inertia: number = 0.3
): PlutchikEmotionState {
  const emotions: PrimaryEmotion[] = [
    "joy", "trust", "fear", "surprise",
    "sadness", "disgust", "anger", "anticipation"
  ];

  const newState = { ...currentState };

  for (const emotion of emotions) {
    let value = currentState[emotion];

    // Aplicar decay hacia 0.5 (neutral)
    const decayDirection = value > 0.5 ? -1 : 1;
    const decayAmount = Math.abs(value - 0.5) * decayRate;
    value += decayDirection * decayAmount;

    // Aplicar delta si existe
    if (deltas[emotion] !== undefined) {
      const delta = deltas[emotion]!;
      // Aplicar inercia (resistencia al cambio)
      const adjustedDelta = delta * (1 - inertia);
      value += adjustedDelta;
    }

    // Clamp entre 0 y 1
    newState[emotion] = Math.max(0, Math.min(1, value));
  }

  newState.lastUpdated = new Date();

  return newState;
}

/**
 * Convierte PlutchikEmotionState a PAD Model.
 */
export function emotionStateToPAD(state: PlutchikEmotionState): {
  valence: number;   // Pleasure: -1 (negativo) a +1 (positivo)
  arousal: number;   // Arousal: 0 (calmado) a 1 (activado)
  dominance: number; // Dominance: 0 (sumiso) a 1 (dominante)
} {
  // VALENCE: Emociones positivas vs negativas
  const positiveEmotions = state.joy + state.trust + state.anticipation;
  const negativeEmotions = state.sadness + state.disgust + state.fear + state.anger;
  const valence = (positiveEmotions - negativeEmotions) / 4; // -1 a +1

  // AROUSAL: Emociones activadoras vs calmantes
  const highArousal = state.anger + state.fear + state.surprise + state.anticipation;
  const lowArousal = state.sadness + state.trust;
  const arousal = (highArousal - lowArousal + 2) / 4; // 0 a 1

  // DOMINANCE: Control vs submission emotions
  const dominant = state.anger + state.disgust + state.anticipation;
  const submissive = state.fear + state.sadness + state.surprise;
  const dominance = (dominant - submissive + 2) / 4; // 0 a 1

  return {
    valence: Math.max(-1, Math.min(1, valence)),
    arousal: Math.max(0, Math.min(1, arousal)),
    dominance: Math.max(0, Math.min(1, dominance)),
  };
}

/** Generates a textual summary of the emotional state. */
export function getEmotionalSummary(state: PlutchikEmotionState): {
  dominant: string[];
  secondary: string[];
  mood: string;
  pad: { valence: number; arousal: number; dominance: number };
} {
  const dominant = getDominantEmotions(state);
  const pad = emotionStateToPAD(state);

  // Detectar emociones secundarias
  const secondary: string[] = [];
  const emotions = dominant.map(e => e.emotion);

  if (emotions.length >= 2) {
    for (let i = 0; i < emotions.length; i++) {
      for (let j = i + 1; j < emotions.length; j++) {
        const sec = calculateSecondaryEmotion(
          emotions[i],
          dominant[i].intensity,
          emotions[j],
          dominant[j].intensity
        );
        if (sec) {
          secondary.push(sec.label);
        }
      }
    }
  }

  // Determinar mood general
  let mood = "Neutral";
  if (pad.valence > 0.6 && pad.arousal > 0.6) mood = "Eufórico";
  else if (pad.valence > 0.4 && pad.arousal < 0.4) mood = "Sereno";
  else if (pad.valence < -0.4 && pad.arousal > 0.6) mood = "Agitado";
  else if (pad.valence < -0.4 && pad.arousal < 0.4) mood = "Melancólico";
  else if (pad.valence > 0.3) mood = "Positivo";
  else if (pad.valence < -0.3) mood = "Negativo";

  return {
    dominant: dominant.map(e => e.label),
    secondary,
    mood,
    pad,
  };
}

/**
 * Inicializa InternalState para un agente si no existe.
 */
export async function initializeInternalState(
  agentId: string,
  prisma: any
): Promise<PlutchikEmotionState> {
  const neutralState = createNeutralState();

  await prisma.internalState.upsert({
    where: { agentId },
    create: {
      agent: {
        connect: { id: agentId }
      },
      currentEmotions: neutralState,
      moodValence: 0.0,
      moodArousal: 0.5,
      moodDominance: 0.5,
      activeGoals: [],
      conversationBuffer: [],
    },
    update: {},
  });

  return neutralState;
}

/** Updates InternalState in the database. */
export async function updateInternalState(
  agentId: string,
  newState: PlutchikEmotionState,
  prisma: any
): Promise<void> {
  const pad = emotionStateToPAD(newState);

  await prisma.internalState.upsert({
    where: { agentId },
    create: {
      agent: {
        connect: { id: agentId }
      },
      currentEmotions: newState,
      moodValence: pad.valence,
      moodArousal: pad.arousal,
      moodDominance: pad.dominance,
      activeGoals: [],
      conversationBuffer: [],
    },
    update: {
      currentEmotions: newState,
      moodValence: pad.valence,
      moodArousal: pad.arousal,
      moodDominance: pad.dominance,
      lastUpdated: new Date(),
    },
  });
}
