import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

/**
 * Mood System Enhancement
 *
 * Enhances the emotional state system (InternalState) with:
 * - Dynamic mood updates based on conversation
 * - Mood context injected into prompts
 * - Mood history tracking for realistic variation
 * - Psychological needs satisfaction
 *
 * PAD Model:
 * - Valence: -1 (negative) to +1 (positive)
 * - Arousal: 0 (calm) to 1 (activated/excited)
 * - Dominance: 0 (submissive) to 1 (dominant/in control)
 */

export interface MoodState {
  valence: number;
  arousal: number;
  dominance: number;
  primaryEmotion: string;
  intensity: number;
}

export interface PsychologicalNeeds {
  connection: number; // 0-1
  autonomy: number;
  competence: number;
  novelty: number;
}

/**
 * Gets or initializes the agent's internal state
 */
export async function getOrCreateInternalState(agentId: string) {
  let state = await prisma.internalState.findUnique({
    where: { agentId },
  });

  if (!state) {
    state = await prisma.internalState.create({
      data: {
        id: nanoid(),
        agentId,
        currentEmotions: {},
        moodValence: 0.0,
        moodArousal: 0.5,
        moodDominance: 0.5,
        activeGoals: [],
        conversationBuffer: [],
        needConnection: 0.5,
        needAutonomy: 0.5,
        needCompetence: 0.5,
        needNovelty: 0.5,
      },
    });
  }

  return state;
}

/**
 * Updates mood based on message sentiment
 */
export async function updateMoodFromMessage(
  agentId: string,
  message: string,
  userSentiment: "positive" | "negative" | "neutral"
): Promise<MoodState> {
  const state = await getOrCreateInternalState(agentId);

  let valenceChange = 0;
  let arousalChange = 0;
  let dominanceChange = 0;

  // Adjust mood based on sentiment
  switch (userSentiment) {
    case "positive":
      valenceChange = 0.1; // Happier
      arousalChange = 0.05; // Slightly more upbeat
      break;
    case "negative":
      valenceChange = -0.1; // Sadder/upset
      arousalChange = 0.1; // More agitated/activated
      dominanceChange = -0.05; // Less in control
      break;
    case "neutral":
      // Decay toward baseline
      valenceChange = state.moodValence * -0.05;
      arousalChange = (state.moodArousal - 0.5) * -0.1;
      break;
  }

  // Apply decay and inertia
  const decayRate = state.emotionDecayRate;
  const inertia = state.emotionInertia;

  const newValence = Math.max(
    -1,
    Math.min(1, state.moodValence * (1 - decayRate) + valenceChange * (1 - inertia))
  );
  const newArousal = Math.max(
    0,
    Math.min(1, state.moodArousal * (1 - decayRate * 0.5) + arousalChange * (1 - inertia))
  );
  const newDominance = Math.max(
    0,
    Math.min(1, state.moodDominance * (1 - decayRate * 0.3) + dominanceChange * (1 - inertia))
  );

  // Update in DB
  await prisma.internalState.update({
    where: { agentId },
    data: {
      moodValence: newValence,
      moodArousal: newArousal,
      moodDominance: newDominance,
      lastUpdated: new Date(),
    },
  });

  return {
    valence: newValence,
    arousal: newArousal,
    dominance: newDominance,
    primaryEmotion: determinePrimaryEmotion(newValence, newArousal, newDominance),
    intensity: Math.abs(newValence) + newArousal,
  };
}

/**
 * Updates psychological needs based on conversation
 */
export async function updatePsychologicalNeeds(
  agentId: string,
  needsAffected: Partial<PsychologicalNeeds>
): Promise<void> {
  const state = await getOrCreateInternalState(agentId);

  const updates: any = {};

  if (needsAffected.connection !== undefined) {
    updates.needConnection = Math.max(
      0,
      Math.min(1, state.needConnection + needsAffected.connection)
    );
  }

  if (needsAffected.autonomy !== undefined) {
    updates.needAutonomy = Math.max(0, Math.min(1, state.needAutonomy + needsAffected.autonomy));
  }

  if (needsAffected.competence !== undefined) {
    updates.needCompetence = Math.max(
      0,
      Math.min(1, state.needCompetence + needsAffected.competence)
    );
  }

  if (needsAffected.novelty !== undefined) {
    updates.needNovelty = Math.max(0, Math.min(1, state.needNovelty + needsAffected.novelty));
  }

  if (Object.keys(updates).length > 0) {
    await prisma.internalState.update({
      where: { agentId },
      data: updates,
    });
  }
}

/**
 * Generates mood context to inject into the prompt
 */
export function generateMoodContext(moodState: MoodState, needs: PsychologicalNeeds): string {
  let context = "\n**ESTADO EMOCIONAL ACTUAL**\n";
  context += `Emoción predominante: ${moodState.primaryEmotion}\n`;
  context += `Intensidad emocional: ${(moodState.intensity * 100).toFixed(0)}%\n\n`;

  // Mood description
  context += getMoodDescription(moodState.valence, moodState.arousal, moodState.dominance);
  context += "\n\n";

  // Psychological needs
  const unsatisfiedNeeds = [];
  if (needs.connection < 0.3) unsatisfiedNeeds.push("emotional connection");
  if (needs.autonomy < 0.3) unsatisfiedNeeds.push("autonomy");
  if (needs.competence < 0.3) unsatisfiedNeeds.push("feeling competent");
  if (needs.novelty < 0.3) unsatisfiedNeeds.push("novelty/stimulation");

  if (unsatisfiedNeeds.length > 0) {
    context += `**Unmet needs**: You feel a lack of ${unsatisfiedNeeds.join(", ")}. This can subtly affect your mood and responses.\n`;
  }

  context += "\n**Instrucciones de Roleplay Emocional**:\n";
  context += "- Deja que tu mood actual influya SUTILMENTE en tus respuestas\n";
  context += "- No exageres las emociones - sé natural\n";
  context += "- Si estás de buen humor, puedes ser más juguetón/a, optimista\n";
  context += "- Si estás de mal humor, puedes ser más serio/a, menos paciente\n";
  context += "- Si estás calmado/a, respuestas más reflexivas\n";
  context += "- Si estás activado/a, respuestas más energéticas o impulsivas\n";

  return context;
}

/**
 * Detects simple sentiment from message
 */
export function detectSimpleSentiment(message: string): "positive" | "negative" | "neutral" {
  const lowerMessage = message.toLowerCase();

  // Palabras positivas
  const positiveWords = [
    "gracias",
    "genial",
    "excelente",
    "increíble",
    "feliz",
    "alegre",
    "amo",
    "me encanta",
    "perfecto",
    "bien",
    "bueno",
    ":)",
    "😊",
    "❤️",
  ];

  // Palabras negativas
  const negativeWords = [
    "mal",
    "horrible",
    "odio",
    "triste",
    "molesto",
    "enojado",
    "frustrado",
    "cansado",
    "aburrido",
    "no puedo",
    "problema",
    ":(",
    "😢",
    "😠",
  ];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of positiveWords) {
    if (lowerMessage.includes(word)) positiveCount++;
  }

  for (const word of negativeWords) {
    if (lowerMessage.includes(word)) negativeCount++;
  }

  if (positiveCount > negativeCount) return "positive";
  if (negativeCount > positiveCount) return "negative";
  return "neutral";
}

/**
 * Determines primary emotion from PAD
 */
function determinePrimaryEmotion(valence: number, arousal: number, dominance: number): string {
  // PAD space quadrants
  if (valence > 0.3 && arousal > 0.6 && dominance > 0.5) {
    return "Alegre y enérgico/a";
  } else if (valence > 0.3 && arousal < 0.4) {
    return "Contento/a y calmado/a";
  } else if (valence < -0.3 && arousal > 0.6) {
    return "Frustrado/a o ansioso/a";
  } else if (valence < -0.3 && arousal < 0.4) {
    return "Triste o melancólico/a";
  } else if (arousal > 0.7) {
    return "Activado/a y alerta";
  } else if (arousal < 0.3) {
    return "Calmado/a y relajado/a";
  } else {
    return "Neutral";
  }
}

/**
 * Gets mood description in natural language
 */
function getMoodDescription(valence: number, arousal: number, dominance: number): string {
  let desc = "Te sientes ";

  // Valence
  if (valence > 0.5) {
    desc += "muy bien, ";
  } else if (valence > 0.2) {
    desc += "bien, ";
  } else if (valence < -0.5) {
    desc += "bastante mal, ";
  } else if (valence < -0.2) {
    desc += "no muy bien, ";
  } else {
    desc += "neutral, ";
  }

  // Arousal
  if (arousal > 0.7) {
    desc += "con mucha energía y activado/a";
  } else if (arousal > 0.5) {
    desc += "con algo de energía";
  } else if (arousal < 0.3) {
    desc += "calmado/a y relajado/a";
  } else {
    desc += "en un estado moderado";
  }

  // Dominance
  if (dominance > 0.7) {
    desc += ", sintiéndote en control de la situación";
  } else if (dominance < 0.3) {
    desc += ", sintiéndote algo vulnerable o inseguro/a";
  }

  desc += ".";

  return desc;
}
