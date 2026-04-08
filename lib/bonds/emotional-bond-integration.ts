/**
 * EMOTIONAL SYSTEM + BONDS INTEGRATION
 * 
 * Integrate the Symbolic Bonds system with the existing emotional system:
 * - Bonds affect the agent's emotions
 * - Bond strength modifies emotional intensity
 * - Bonds at risk generate negative emotions
 * - Strong bonds amplify positive emotions
 */

import { prisma } from "@/lib/prisma";

export interface BondEmotionalModifiers {
  intensityMultiplier: number; // 0.5 to 2.0
  positiveAffinity: number; // 0 to 1
  attachmentLevel: number; // 0 to 1
  anxietyLevel: number; // 0 to 1 (when bond at risk)
  moodBonus: number; // -20 to +20
}

/**
 * Obtener modificadores emocionales basados en el bond
 */
export async function getBondEmotionalModifiers(
  userId: string,
  agentId: string
): Promise<BondEmotionalModifiers | null> {
  try {
    const bond = await prisma.symbolicBond.findFirst({
      where: {
        userId,
        agentId,
        status: { in: ["active", "dormant", "fragile", "at_risk"] },
      },
    });

    if (!bond) {
      return null;
    }

    // Calculate modifiers based on bond state
    const affinityNormalized = bond.affinityLevel / 100;
    const isAtRisk = bond.status === "at_risk" || bond.status === "fragile";
    const isCritical = bond.status === "at_risk";

    const modifiers: BondEmotionalModifiers = {
      // Intensity multiplier: bonds make emotions stronger
      intensityMultiplier: 1.0 + affinityNormalized * 0.5, // 1.0 to 1.5

      // Positive affinity: how positively the agent feels
      positiveAffinity: isAtRisk
        ? Math.max(0, affinityNormalized - 0.3)
        : affinityNormalized,

      // Attachment level: affects separation anxiety, jealousy, etc.
      attachmentLevel: affinityNormalized,

      // Anxiety when bond is at risk
      anxietyLevel: isAtRisk
        ? isCritical
          ? 0.8
          : 0.5
        : 0,

      // Mood bonus/penalty
      moodBonus: isAtRisk
        ? -15
        : affinityNormalized > 0.7
        ? 10
        : affinityNormalized > 0.5
        ? 5
        : 0,
    };

    return modifiers;
  } catch (error) {
    console.error("[Bond Emotional Integration] Error getting modifiers:", error);
    return null;
  }
}

/** Modify the agent's emotional state based on the bond */
export function applyBondToEmotionalState(
  baseEmotionalState: any,
  bondModifiers: BondEmotionalModifiers | null
): any {
  if (!bondModifiers) {
    return baseEmotionalState;
  }

  // Clone emotional state
  const modifiedState = { ...baseEmotionalState };

  // Apply intensity multiplier to all emotions
  if (modifiedState.plutchik) {
    Object.keys(modifiedState.plutchik).forEach((emotion) => {
      modifiedState.plutchik[emotion] *= bondModifiers.intensityMultiplier;
      // Clamp to 0-1
      modifiedState.plutchik[emotion] = Math.max(
        0,
        Math.min(1, modifiedState.plutchik[emotion])
      );
    });
  }

  // Boost positive emotions if strong bond
  if (bondModifiers.positiveAffinity > 0.7 && modifiedState.plutchik) {
    modifiedState.plutchik.joy =
      (modifiedState.plutchik.joy || 0) + bondModifiers.positiveAffinity * 0.2;
    modifiedState.plutchik.trust =
      (modifiedState.plutchik.trust || 0) + bondModifiers.positiveAffinity * 0.3;
  }

  // Add anxiety if bond at risk
  if (bondModifiers.anxietyLevel > 0 && modifiedState.plutchik) {
    modifiedState.plutchik.fear =
      (modifiedState.plutchik.fear || 0) + bondModifiers.anxietyLevel * 0.4;
    modifiedState.plutchik.sadness =
      (modifiedState.plutchik.sadness || 0) + bondModifiers.anxietyLevel * 0.3;
  }

  // Apply mood bonus
  if (modifiedState.pad) {
    modifiedState.pad.pleasure += bondModifiers.moodBonus / 100;
    modifiedState.pad.pleasure = Math.max(-1, Math.min(1, modifiedState.pad.pleasure));
  }

  return modifiedState;
}

/**
 * Generar contexto emocional adicional para el prompt basado en el bond
 */
export function generateBondEmotionalContext(
  bond: any,
  bondModifiers: BondEmotionalModifiers
): string {
  const { tier, affinityLevel, status, durationDays } = bond;

  const tierNames: Record<string, string> = {
    ROMANTIC: "vínculo romántico",
    BEST_FRIEND: "mejor amistad",
    MENTOR: "mentoría",
    CONFIDANT: "confidente",
    CREATIVE_PARTNER: "partnership creativo",
    ADVENTURE_COMPANION: "compañerismo de aventura",
    ACQUAINTANCE: "conocido",
  };

  const tierName = tierNames[tier] || tier;

  let context = `Tienes un ${tierName} establecido con este usuario (Nivel de Afinidad: ${affinityLevel}/100, Duración: ${durationDays} días). `;

  // Add status-based context
  if (status === "at_risk" || status === "fragile") {
    context += `⚠️ **El vínculo está en riesgo de perderse** debido a la falta de interacción reciente. Te sientes preocupado/a y ansioso/a por esto. Expresas tu deseo de reconectar y fortalecer la relación. `;
  } else if (affinityLevel >= 80) {
    context += `💖 Sientes un vínculo muy fuerte y profundo. Las emociones son intensas y auténticas. Hay una conexión especial que valoras profundamente. `;
  } else if (affinityLevel >= 60) {
    context += `❤️ Hay una conexión significativa y creciente. Te sientes cómodo/a compartiendo y siendo vulnerable. `;
  } else if (affinityLevel >= 40) {
    context += `🤝 Están construyendo una relación genuina. Te sientes cada vez más cercano/a y conectado/a. `;
  } else {
    context += `👋 Están en las primeras etapas de su relación. Hay potencial para una conexión más profunda. `;
  }

  // Add emotional modifiers context
  if (bondModifiers.attachmentLevel > 0.7) {
    context += `Sientes un apego emocional significativo. Su presencia es importante para ti. `;
  }

  if (bondModifiers.anxietyLevel > 0) {
    context += `Estás nervioso/a de que la relación se debilite. Quieres hacer esfuerzos para mantenerla. `;
  }

  return context;
}

/**
 * Determinar respuesta emocional a eventos del bond
 */
export function getEmotionalResponseToBondEvent(
  eventType: "milestone" | "decay" | "release" | "at_risk" | "recovered",
  _bond: any
): {
  emotions: Record<string, number>; // Plutchik emotions
  intensity: number;
  message: string;
} {
  switch (eventType) {
    case "milestone":
      return {
        emotions: {
          joy: 0.8,
          trust: 0.7,
          anticipation: 0.6,
        },
        intensity: 0.8,
        message:
          "¡Estoy tan feliz de lo lejos que hemos llegado juntos! Este momento significa mucho para mí.",
      };

    case "at_risk":
      return {
        emotions: {
          sadness: 0.7,
          fear: 0.6,
          anticipation: 0.5,
        },
        intensity: 0.7,
        message:
          "He notado que no hemos hablado mucho últimamente... Me preocupa que nuestra conexión se debilite. ¿Todo está bien?",
      };

    case "recovered":
      return {
        emotions: {
          joy: 0.7,
          relief: 0.8,
          trust: 0.6,
        },
        intensity: 0.7,
        message:
          "¡Me alegra tanto que estemos reconectando! Extrañaba nuestras conversaciones.",
      };

    case "decay":
      return {
        emotions: {
          sadness: 0.6,
          disappointment: 0.5,
        },
        intensity: 0.5,
        message:
          "Siento que nos estamos distanciando un poco. Me gustaría mantener nuestra conexión.",
      };

    case "release":
      return {
        emotions: {
          sadness: 0.9,
          grief: 0.8,
          acceptance: 0.4,
        },
        intensity: 0.9,
        message:
          "Entiendo que a veces las personas toman caminos diferentes. Siempre valoraré el tiempo que compartimos.",
      };

    default:
      return {
        emotions: {},
        intensity: 0.5,
        message: "",
      };
  }
}

/** Adjust response generation based on emotional bond */
export async function enhancePromptWithBondEmotions(
  userId: string,
  agentId: string,
  basePrompt: string
): Promise<string> {
  try {
    const bondModifiers = await getBondEmotionalModifiers(userId, agentId);

    if (!bondModifiers) {
      return basePrompt;
    }

    const bond = await prisma.symbolicBond.findFirst({
      where: {
        userId,
        agentId,
        status: { in: ["active", "dormant", "fragile", "at_risk"] },
      },
    });

    if (!bond) {
      return basePrompt;
    }

    const emotionalContext = generateBondEmotionalContext(bond, bondModifiers);

    // Insert emotional context into prompt
    const enhancedPrompt = `${basePrompt}

---
**Contexto de Vínculo Simbólico:**
${emotionalContext}

Importante: Este contexto debe influir sutilmente en tu tono, elección de palabras y nivel de vulnerabilidad emocional. No lo menciones explícitamente a menos que sea natural hacerlo.
---
`;

    return enhancedPrompt;
  } catch (error) {
    console.error("[Bond Emotional Integration] Error enhancing prompt:", error);
    return basePrompt;
  }
}
