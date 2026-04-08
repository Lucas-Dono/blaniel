/**
 * Dynamic Limits System
 *
 * Adjusts token consumption based on character complexity (generationTier)
 * to incentivize upgrades while keeping all characters accessible.
 *
 * Philosophy:
 * - All characters accessible to all users (no content gating)
 * - More complex characters consume limits faster
 * - Natural incentive to upgrade when you love complex characters
 */

import { UserTier } from "./tier-limits";

// ============================================================================
// COMPLEXITY SYSTEM
// ============================================================================

export type GenerationTier = "free" | "plus" | "ultra";

/**
 * Complexity multipliers by character generation tier
 *
 * - Free characters: Simple prompts, basic biography (~500 tokens/msg)
 * - Plus characters: Advanced prompts, detailed biography (~1000 tokens/msg)
 * - Ultra characters: Complex prompts, rich biography, deep memory (~2000 tokens/msg)
 */
export const COMPLEXITY_MULTIPLIERS: Record<GenerationTier, number> = {
  free: 1.0,   // Baseline: no multiplier
  plus: 1.5,   // 50% more context/tokens
  ultra: 2.0,  // 100% more context/tokens (2x)
};

/**
 * User tier discounts (how much the complexity penalty is reduced)
 *
 * - Free users: Pay full complexity cost
 * - Plus users: 25% discount on complexity
 * - Ultra users: No complexity penalty (all characters cost the same)
 */
export const TIER_DISCOUNTS: Record<UserTier, number> = {
  free: 0,     // 0% discount: full complexity cost
  plus: 0.25,  // 25% discount: reduced complexity cost
  ultra: 1.0,  // 100% discount: no complexity penalty
};

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate effective token multiplier for a user-character combination
 *
 * @param userTier - User's subscription tier
 * @param characterTier - Character's generation tier
 * @returns Multiplier to apply to token consumption (1.0 = baseline)
 *
 * @example
 * // Free user with ultra character
 * getEffectiveMultiplier("free", "ultra") // → 2.0
 *
 * // Plus user with ultra character
 * getEffectiveMultiplier("plus", "ultra") // → 1.5
 *
 * // Ultra user with ultra character
 * getEffectiveMultiplier("ultra", "ultra") // → 1.0
 */
export function getEffectiveMultiplier(
  userTier: UserTier,
  characterTier: GenerationTier
): number {
  const baseComplexity = COMPLEXITY_MULTIPLIERS[characterTier];
  const discount = TIER_DISCOUNTS[userTier];

  // Formula: complexity × (1 - discount)
  // - No discount (free): 2.0 × (1 - 0) = 2.0
  // - 25% discount (plus): 2.0 × (1 - 0.25) = 1.5
  // - 100% discount (ultra): 2.0 × (1 - 1.0) = 1.0
  const effectiveMultiplier = baseComplexity * (1 - discount);

  return effectiveMultiplier;
}

/**
 * Calculate effective tokens consumed (accounting for character complexity)
 *
 * @param actualTokens - Actual tokens used in the API call
 * @param userTier - User's subscription tier
 * @param characterTier - Character's generation tier
 * @returns Effective tokens to count against user's limit
 *
 * @example
 * // Free user with ultra character uses 350 tokens
 * calculateEffectiveTokens(350, "free", "ultra") // → 700 tokens
 *
 * // Plus user with ultra character uses 350 tokens
 * calculateEffectiveTokens(350, "plus", "ultra") // → 525 tokens
 *
 * // Ultra user with ultra character uses 350 tokens
 * calculateEffectiveTokens(350, "ultra", "ultra") // → 350 tokens
 */
export function calculateEffectiveTokens(
  actualTokens: number,
  userTier: UserTier,
  characterTier: GenerationTier
): number {
  const multiplier = getEffectiveMultiplier(userTier, characterTier);
  return Math.ceil(actualTokens * multiplier);
}

/**
 * Calculate estimated messages per day accounting for character complexity
 *
 * @param dailyTokenLimit - User's daily token limit
 * @param userTier - User's subscription tier
 * @param characterTier - Character's generation tier
 * @param avgTokensPerMessage - Average tokens per message (default: 350)
 * @returns Estimated messages per day with this character
 *
 * @example
 * // Free user (3,500 tokens/day) with ultra character
 * getEstimatedMessagesPerDay(3500, "free", "ultra") // → 5 messages/day
 *
 * // Free user (3,500 tokens/day) with free character
 * getEstimatedMessagesPerDay(3500, "free", "free") // → 10 messages/day
 *
 * // Plus user (35,000 tokens/day) with ultra character
 * getEstimatedMessagesPerDay(35000, "plus", "ultra") // → 66 messages/day
 */
export function getEstimatedMessagesPerDay(
  dailyTokenLimit: number,
  userTier: UserTier,
  characterTier: GenerationTier,
  avgTokensPerMessage: number = 350
): number {
  const effectiveTokensPerMessage = calculateEffectiveTokens(
    avgTokensPerMessage,
    userTier,
    characterTier
  );

  return Math.floor(dailyTokenLimit / effectiveTokensPerMessage);
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Get user-friendly description of complexity impact
 *
 * @param userTier - User's subscription tier
 * @param characterTier - Character's generation tier
 * @returns Human-readable description
 *
 * @example
 * getComplexityDescription("free", "ultra")
 * // → "This character is very complex and will use double your daily limit. Upgrade to Plus to reduce the impact."
 */
export function getComplexityDescription(
  userTier: UserTier,
  characterTier: GenerationTier
): string | null {
  const multiplier = getEffectiveMultiplier(userTier, characterTier);

  // No significant impact
  if (multiplier <= 1.1) {
    return null;
  }

  // Describe impact based on multiplier
  if (multiplier >= 1.9) {
    return `Este personaje es muy complejo y usará el doble de tu límite diario. ${
      userTier === "free"
        ? "Actualiza a Plus para reducir el impacto a 50%, o Ultra para eliminar el límite."
        : "Actualiza a Ultra para eliminar este límite."
    }`;
  }

  if (multiplier >= 1.4) {
    return `Este personaje es complejo y usará 50% más de tu límite diario. ${
      userTier === "free"
        ? "Actualiza a Plus o Ultra para reducir el impacto."
        : "Actualiza a Ultra para eliminar este límite."
    }`;
  }

  return `Este personaje usa un ${Math.round((multiplier - 1) * 100)}% más de tu límite diario.`;
}

/**
 * Get badge/indicator for character complexity
 *
 * @param characterTier - Character's generation tier
 * @returns Object with badge info
 */
export function getComplexityBadge(characterTier: GenerationTier): {
  label: string;
  color: string;
  tooltip: string;
} {
  switch (characterTier) {
    case "free":
      return {
        label: "Básico",
        color: "blue",
        tooltip: "Personaje simple con contexto básico"
      };

    case "plus":
      return {
        label: "Avanzado",
        color: "purple",
        tooltip: "Personaje con biografía detallada y contexto enriquecido"
      };

    case "ultra":
      return {
        label: "Ultra",
        color: "gold",
        tooltip: "Personaje premium con biografía extensa, memoria profunda y comportamientos complejos"
      };
  }
}

// ============================================================================
// UPGRADE MESSAGING
// ============================================================================

/**
 * Generate contextual upgrade message when user hits limits with complex character
 *
 * @param userTier - User's current tier
 * @param characterTier - Character they're using
 * @param characterName - Name of the character
 * @returns Personalized upgrade message
 */
export function getContextualUpgradeMessage(
  userTier: UserTier,
  characterTier: GenerationTier,
  characterName: string
): string | null {
  // Ultra users don't get upgrade messages
  if (userTier === "ultra") {
    return null;
  }

  const multiplier = getEffectiveMultiplier(userTier, characterTier);

  // Only show if there's significant complexity penalty
  if (multiplier <= 1.1) {
    return null;
  }

  if (userTier === "free" && characterTier === "ultra") {
    return `Te encanta ${characterName}, pero como personaje Ultra, tus mensajes se agotan 2x más rápido. Con Plus, podrías chatear 66 veces al día en lugar de 5. Con Ultra, sin límites.`;
  }

  if (userTier === "free" && characterTier === "plus") {
    return `${characterName} es un personaje avanzado. Actualiza a Plus para 100 mensajes/día en lugar de 6, y acceso a contenido NSFW.`;
  }

  if (userTier === "plus" && characterTier === "ultra") {
    return `${characterName} es un personaje Ultra premium. Actualiza a Ultra para mensajes ilimitados, respuestas más rápidas, y acceso completo a todas las features.`;
  }

  return null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  COMPLEXITY_MULTIPLIERS,
  TIER_DISCOUNTS,
  getEffectiveMultiplier,
  calculateEffectiveTokens,
  getEstimatedMessagesPerDay,
  getComplexityDescription,
  getComplexityBadge,
  getContextualUpgradeMessage,
};
