/**
 * Plutchik's Wheel of Emotions
 *
 * Sistema de emociones basado en la investigación de Robert Plutchik.
 * 8 emociones primarias con 3 niveles de intensidad cada una.
 * Las emociones secundarias se forman combinando primarias.
 */

// ============================================
// EMOCIONES PRIMARIAS
// ============================================

export type PrimaryEmotion =
  | "joy"          // Alegría (opuesto: sadness)
  | "trust"        // Confianza (opuesto: disgust)
  | "fear"         // Miedo (opuesto: anger)
  | "surprise"     // Sorpresa (opuesto: anticipation)
  | "sadness"      // Tristeza (opuesto: joy)
  | "disgust"      // Disgusto (opuesto: trust)
  | "anger"        // Enojo (opuesto: fear)
  | "anticipation"; // Anticipation (opposite: surprise)

// ============================================
// INTENSIDADES
// ============================================

export type EmotionIntensity = "mild" | "moderate" | "intense";

export interface EmotionWithIntensity {
  emotion: PrimaryEmotion;
  intensity: number; // 0-1
  label: string; // Nombre en español con intensidad
}

/**
 * Nombres de emociones por intensidad (mild, moderate, intense)
 */
export const EMOTION_LABELS: Record<PrimaryEmotion, [string, string, string]> = {
  joy: ["Serenidad", "Alegría", "Éxtasis"],
  trust: ["Aceptación", "Confianza", "Admiración"],
  fear: ["Aprensión", "Miedo", "Terror"],
  surprise: ["Distracción", "Sorpresa", "Asombro"],
  sadness: ["Pensatividad", "Tristeza", "Aflicción"],
  disgust: ["Aburrimiento", "Disgusto", "Repulsión"],
  anger: ["Molestia", "Enojo", "Furia"],
  anticipation: ["Interés", "Anticipación", "Vigilancia"],
};

/**
 * Obtiene el label en español según la intensidad.
 */
export function getEmotionLabel(emotion: PrimaryEmotion, intensity: number): string {
  const labels = EMOTION_LABELS[emotion];

  if (intensity < 0.33) return labels[0]; // mild
  if (intensity < 0.67) return labels[1]; // moderate
  return labels[2]; // intense
}

// ============================================
// EMOCIONES SECUNDARIAS (Dyads)
// ============================================

/**
 * Las emociones secundarias se forman combinando dos primarias adyacentes.
 */
export type SecondaryEmotion =
  // Primary Dyads (adyacentes)
  | "love"        // joy + trust
  | "submission"  // trust + fear
  | "alarm"       // fear + surprise
  | "disappointment" // surprise + sadness
  | "remorse"     // sadness + disgust
  | "contempt"    // disgust + anger
  | "aggression"  // anger + anticipation
  | "optimism"    // anticipation + joy

  // Secondary Dyads (separadas por una)
  | "guilt"       // joy + fear
  | "curiosity"   // trust + surprise
  | "despair"     // fear + sadness
  | "envy"        // surprise + disgust
  | "cynicism"    // sadness + anger
  | "pride"       // disgust + anticipation
  | "hope"        // anger + joy
  | "anxiety"     // anticipation + trust

  // Tertiary Dyads (opuestas)
  | "ambivalence" // joy + sadness
  | "frozenness"  // trust + disgust
  | "outrage"     // fear + anger
  | "confusion"   // surprise + anticipation;

export interface SecondaryEmotionDef {
  name: SecondaryEmotion;
  label: string; // Nombre en español
  components: [PrimaryEmotion, PrimaryEmotion];
  description: string;
}

export const SECONDARY_EMOTIONS: SecondaryEmotionDef[] = [
  // Primary Dyads
  {
    name: "love",
    label: "Amor",
    components: ["joy", "trust"],
    description: "Combinación de alegría y confianza profunda"
  },
  {
    name: "submission",
    label: "Sumisión",
    components: ["trust", "fear"],
    description: "Confianza mezclada con temor o respeto"
  },
  {
    name: "alarm",
    label: "Alarma",
    components: ["fear", "surprise"],
    description: "Miedo intensificado por la sorpresa"
  },
  {
    name: "disappointment",
    label: "Decepción",
    components: ["surprise", "sadness"],
    description: "Sorpresa negativa que lleva a tristeza"
  },
  {
    name: "remorse",
    label: "Remordimiento",
    components: ["sadness", "disgust"],
    description: "Tristeza mezclada con autodesprecio"
  },
  {
    name: "contempt",
    label: "Desprecio",
    components: ["disgust", "anger"],
    description: "Disgusto intensificado con ira"
  },
  {
    name: "aggression",
    label: "Agresividad",
    components: ["anger", "anticipation"],
    description: "Enojo dirigido con intención"
  },
  {
    name: "optimism",
    label: "Optimismo",
    components: ["anticipation", "joy"],
    description: "Anticipación positiva del futuro"
  },

  // Secondary Dyads
  {
    name: "guilt",
    label: "Culpa",
    components: ["joy", "fear"],
    description: "Alegría contaminada por miedo o ansiedad"
  },
  {
    name: "curiosity",
    label: "Curiosidad",
    components: ["trust", "surprise"],
    description: "Sorpresa con apertura y confianza"
  },
  {
    name: "despair",
    label: "Desesperación",
    components: ["fear", "sadness"],
    description: "Miedo profundo mezclado con tristeza"
  },
  {
    name: "envy",
    label: "Envidia",
    components: ["surprise", "disgust"],
    description: "Descubrimiento desagradable sobre otros"
  },
  {
    name: "cynicism",
    label: "Cinismo",
    components: ["sadness", "anger"],
    description: "Tristeza que se convierte en resentimiento"
  },
  {
    name: "pride",
    label: "Orgullo",
    components: ["disgust", "anticipation"],
    description: "Desprecio hacia otros con autosatisfacción"
  },
  {
    name: "hope",
    label: "Esperanza",
    components: ["anger", "joy"],
    description: "Determinación enérgica hacia algo positivo"
  },
  {
    name: "anxiety",
    label: "Ansiedad",
    components: ["anticipation", "trust"],
    description: "Anticipación excesiva con incertidumbre"
  },

  // Tertiary Dyads
  {
    name: "ambivalence",
    label: "Ambivalencia",
    components: ["joy", "sadness"],
    description: "Emociones opuestas simultáneas"
  },
  {
    name: "frozenness",
    label: "Paralización",
    components: ["trust", "disgust"],
    description: "Conflicto entre confianza y rechazo"
  },
  {
    name: "outrage",
    label: "Indignación",
    components: ["fear", "anger"],
    description: "Miedo que se transforma en ira"
  },
  {
    name: "confusion",
    label: "Confusión",
    components: ["surprise", "anticipation"],
    description: "Sorpresa que interfiere con expectativas"
  },
];

/**
 * Calcula una emoción secundaria basándose en dos primarias.
 */
export function calculateSecondaryEmotion(
  emotion1: PrimaryEmotion,
  intensity1: number,
  emotion2: PrimaryEmotion,
  intensity2: number
): SecondaryEmotionDef | null {
  // Search if secondary emotion exists with these components
  const secondary = SECONDARY_EMOTIONS.find(
    (sec) =>
      (sec.components[0] === emotion1 && sec.components[1] === emotion2) ||
      (sec.components[0] === emotion2 && sec.components[1] === emotion1)
  );

  // Solo retornar si ambas intensidades son significativas (> 0.3)
  if (secondary && intensity1 > 0.3 && intensity2 > 0.3) {
    return secondary;
  }

  return null;
}

// ============================================
// EMOCIONES OPUESTAS
// ============================================

export const OPPOSITE_EMOTIONS: Record<PrimaryEmotion, PrimaryEmotion> = {
  joy: "sadness",
  sadness: "joy",
  trust: "disgust",
  disgust: "trust",
  fear: "anger",
  anger: "fear",
  surprise: "anticipation",
  anticipation: "surprise",
};

/**
 * Obtiene la emoción opuesta.
 */
export function getOppositeEmotion(emotion: PrimaryEmotion): PrimaryEmotion {
  return OPPOSITE_EMOTIONS[emotion];
}

// ============================================
// EMOTION STATE
// ============================================

/**
 * Estado emocional completo con todas las emociones primarias.
 */
export interface PlutchikEmotionState {
  // Emociones primarias (0-1)
  joy: number;
  trust: number;
  fear: number;
  surprise: number;
  sadness: number;
  disgust: number;
  anger: number;
  anticipation: number;

  // Timestamp de última actualización
  lastUpdated: Date;
}

/**
 * Crea un estado emocional neutral.
 */
export function createNeutralState(): PlutchikEmotionState {
  return {
    joy: 0.5,
    trust: 0.5,
    fear: 0.2,
    surprise: 0.1,
    sadness: 0.2,
    disgust: 0.1,
    anger: 0.1,
    anticipation: 0.4,
    lastUpdated: new Date(),
  };
}

/**
 * Obtiene las emociones dominantes (top 3).
 */
export function getDominantEmotions(
  state: PlutchikEmotionState
): EmotionWithIntensity[] {
  const emotions: EmotionWithIntensity[] = [
    { emotion: "joy", intensity: state.joy, label: getEmotionLabel("joy", state.joy) },
    { emotion: "trust", intensity: state.trust, label: getEmotionLabel("trust", state.trust) },
    { emotion: "fear", intensity: state.fear, label: getEmotionLabel("fear", state.fear) },
    { emotion: "surprise", intensity: state.surprise, label: getEmotionLabel("surprise", state.surprise) },
    { emotion: "sadness", intensity: state.sadness, label: getEmotionLabel("sadness", state.sadness) },
    { emotion: "disgust", intensity: state.disgust, label: getEmotionLabel("disgust", state.disgust) },
    { emotion: "anger", intensity: state.anger, label: getEmotionLabel("anger", state.anger) },
    { emotion: "anticipation", intensity: state.anticipation, label: getEmotionLabel("anticipation", state.anticipation) },
  ];

  return emotions
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 3);
}
