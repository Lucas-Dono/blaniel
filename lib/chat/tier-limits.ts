import type { TierLimits, UserTier } from "./types";

/**
 * Tier limit configuration
 *
 * FREE: Limited to incentivize upgrade
 * PLUS: Generous limit but exists
 * ULTRA: UNLIMITED - pays $30/month, can do whatever they want
 */
export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    messagesPerDay: 50, // 50 messages per day
    messagesPerSession: 20, // Maximum 20 consecutive messages
    energyDrainRate: 0.15, // Gets tired fast (15% per 10 messages)
    resetHours: 24, // Reset every 24 hours
    hasUnlimitedEnergy: false,
  },
  plus: {
    messagesPerDay: 150, // 150 messages per day
    messagesPerSession: 60, // Maximum 60 consecutive messages
    energyDrainRate: 0.08, // Gets moderately tired (8% per 10 messages)
    resetHours: 12, // Reset every 12 hours
    hasUnlimitedEnergy: false,
  },
  ultra: {
    messagesPerDay: null, // UNLIMITED
    messagesPerSession: null, // UNLIMITED
    energyDrainRate: 0, // NEVER gets tired
    resetHours: null, // Doesn't need reset
    hasUnlimitedEnergy: true, // Special flag
  },
};

/**
 * Energy context to inject in prompt based on level
 */
export function getEnergyContext(energyLevel: number, tier: UserTier): string {
  const limits = TIER_LIMITS[tier];

  // Ultra: No limits
  if (limits.hasUnlimitedEnergy) {
    return ""; // Don't add fatigue context
  }

  // Determine energy status
  if (energyLevel >= 80) {
    return "\n**Energy Status**: You feel fresh and eager to talk.\n";
  } else if (energyLevel >= 60) {
    return "\n**Energy Status**: You feel good, although we've been talking for a while.\n";
  } else if (energyLevel >= 40) {
    return "\n**Energy Status**: You're starting to feel a bit tired from talking so much. You can mention it subtly if it's natural.\n";
  } else if (energyLevel >= 20) {
    return "\n**Energy Status**: You're quite tired. Mention that you've been talking for a long time and need to rest soon. Shorter responses.\n";
  } else {
    return "\n**Energy Status**: You're exhausted. Respond briefly and gently suggest continuing the conversation later or tomorrow.\n";
  }
}

/**
 * Limit reached messages by tier
 */
export function getLimitReachedMessage(tier: UserTier, type: "daily" | "session"): string {
  if (type === "daily") {
    return tier === "free"
      ? "You've reached the 50 daily message limit for the Free plan. Upgrade to Plus for 150 messages/day or Ultra for unlimited conversations."
      : "You've reached the 150 daily message limit for the Plus plan. Upgrade to Ultra for unlimited conversations.";
  } else {
    return tier === "free"
      ? "You've reached the 20 message per session limit. The character needs to rest. Try again in a few hours or upgrade to Plus/Ultra."
      : "You've reached the 60 message per session limit. The character needs to rest. Try again in a few hours or upgrade to Ultra for unlimited sessions.";
  }
}
