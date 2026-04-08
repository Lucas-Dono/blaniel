/**
 * Tier-based Rate Limiting System
 *
 * Defines comprehensive limits for each user tier (Free, Plus, Ultra)
 * covering API requests, messages, resources, and features.
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type UserTier = "free" | "plus" | "ultra";

export interface RateLimitWindow {
  perMinute: number;
  perHour: number;
  perDay: number;
}

export interface ResourceLimits {
  // TOKEN-BASED LIMITS (justo y preciso)
  inputTokensPerDay: number;      // Input tokens (user) per day
  outputTokensPerDay: number;     // Output tokens (AI) per day
  totalTokensPerDay: number;      // Combined total per day
  inputTokensPerWeek: number;     // ANTI-ABUSE: Control semanal de entrada
  outputTokensPerWeek: number;    // ANTI-ABUSE: Control semanal de salida
  totalTokensPerWeek: number;     // ANTI-ABUSE: Control semanal total

  // OTHER RESOURCES
  contextMessages: number;         // Historical context in prompts
  activeAgents: number;
  activeWorlds: number;
  charactersInMarketplace: number;
  imageGenerationPerDay: number;
  imageAnalysisPerMonth: number;
  imageAnalysisPerDay: number;    // ANTI-ABUSE: Daily limit for image analysis
  voiceMessagesPerMonth: number;
  voiceMessagesPerDay: number;    // ANTI-ABUSE: Daily limit for voice messages
  proactiveMessagesPerDay: number; // Mensajes proactivos de la IA

  // GROUPS SYSTEM
  activeGroups: number;            // Active simultaneous groups
  maxUsersPerGroup: number;        // Usuarios por grupo
  maxAIsPerGroup: number;          // IAs por grupo
  groupMessagesPerDay: number;     // Group messages per day
  groupCooldownMs: number;         // Cooldown entre mensajes en grupos (ms)
}

export interface TierLimits {
  tier: UserTier;
  displayName: string;

  // API Rate Limiting
  apiRequests: RateLimitWindow;

  // Resource Limits
  resources: ResourceLimits;

  // Feature Flags
  features: {
    nsfwContent: boolean;
    advancedBehaviors: boolean;
    voiceMessages: boolean;
    priorityGeneration: boolean;
    apiAccess: boolean;
    exportConversations: boolean;
    customVoiceCloning: boolean;
  };

  // Cooldowns (in milliseconds)
  cooldowns: {
    messageCooldown: number;
    worldMessageCooldown: number;
    imageAnalysisCooldown: number;  // ← ANTI-BOT: Cooldown between image analysis
    voiceMessageCooldown: number;   // ← ANTI-BOT: Cooldown entre mensajes de voz
  };
}

// ============================================================================
// TIER DEFINITIONS
// ============================================================================

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    tier: "free",
    displayName: "Free (Bootstrap)",

    apiRequests: {
      perMinute: 10,
      perHour: 100,
      perDay: 300,
    },

    resources: {
      // TOKEN-BASED LIMITS: 10 messages/day (~3,500 tokens), 50 messages/week (~17,500 tokens)
      inputTokensPerDay: 1_500,      // ~10 mensajes × 150 tokens input
      outputTokensPerDay: 2_000,     // ~10 mensajes × 200 tokens output
      totalTokensPerDay: 3_500,      // ~10 mensajes × 350 tokens total
      inputTokensPerWeek: 7_500,     // ~50 mensajes × 150 tokens
      outputTokensPerWeek: 10_000,   // ~50 mensajes × 200 tokens
      totalTokensPerWeek: 17_500,    // ~50 mensajes × 350 tokens

      // OTHER RESOURCES
      contextMessages: 10,
      activeAgents: 3,
      activeWorlds: 0, // Sin worlds (muy costoso)
      charactersInMarketplace: 0,
      imageGenerationPerDay: 0,
      imageAnalysisPerMonth: 2, // REDUCIDO: 2/mes (bootstrap)
      imageAnalysisPerDay: 1, // Max 1 analysis/day
      voiceMessagesPerMonth: 0,
      voiceMessagesPerDay: 0, // Sin voz en free
      proactiveMessagesPerDay: 0, // Sin proactive en free

      // GROUPS SYSTEM
      activeGroups: 2,              // 2 grupos activos
      maxUsersPerGroup: 5,          // 5 usuarios por grupo
      maxAIsPerGroup: 1,            // 1 IA por grupo
      groupMessagesPerDay: 100,     // 100 group messages/day
      groupCooldownMs: 5000,        // 5 segundos entre mensajes
    },

    features: {
      nsfwContent: false,
      advancedBehaviors: false, // Sin yandere, BPD, etc.
      voiceMessages: false,
      priorityGeneration: false,
      apiAccess: false,
      exportConversations: false,
      customVoiceCloning: false,
    },

    cooldowns: {
      messageCooldown: 5000, // ← ANTI-SPAM: 5 segundos entre mensajes (reducir carga)
      worldMessageCooldown: 15000, // 15 seconds (disuadir uso)
      imageAnalysisCooldown: 10000, // 10 seconds between images
      voiceMessageCooldown: 0, // N/A (sin acceso)
    },
  },

  plus: {
    tier: "plus",
    displayName: "Plus ($5/mes)",

    apiRequests: {
      perMinute: 30,
      perHour: 600,
      perDay: 3000,
    },

    resources: {
      // TOKEN-BASED LIMITS: 100 messages/day (~35,000 tokens), 500 messages/week (~175,000 tokens)
      inputTokensPerDay: 15_000,     // ~100 mensajes × 150 tokens input
      outputTokensPerDay: 20_000,    // ~100 mensajes × 200 tokens output
      totalTokensPerDay: 35_000,     // ~100 mensajes × 350 tokens total
      inputTokensPerWeek: 75_000,    // ~500 mensajes × 150 tokens
      outputTokensPerWeek: 100_000,  // ~500 mensajes × 200 tokens
      totalTokensPerWeek: 175_000,   // ~500 mensajes × 350 tokens

      // OTHER RESOURCES
      contextMessages: 40, // 4x more context than free
      activeAgents: 15,
      activeWorlds: 3, // Worlds limitados (costosos)
      charactersInMarketplace: 5,
      imageGenerationPerDay: 10,
      imageAnalysisPerMonth: 30, // 1 image/day average
      imageAnalysisPerDay: 3, // ANTI-ABUSE: Max 3 analysis/day
      voiceMessagesPerMonth: 100, // Voz limitada ($0.17/msg)
      voiceMessagesPerDay: 5, // ANTI-ABUSE: Max 5 voice/day
      proactiveMessagesPerDay: 3, // 3 proactive/day

      // GROUPS SYSTEM
      activeGroups: 10,             // 10 grupos activos
      maxUsersPerGroup: 20,         // 20 usuarios por grupo
      maxAIsPerGroup: 5,            // 5 IAs por grupo
      groupMessagesPerDay: 1000,    // 1000 group messages/day
      groupCooldownMs: 2000,        // 2 segundos entre mensajes
    },

    features: {
      nsfwContent: true, // ✅ NSFW habilitado
      advancedBehaviors: true, // ✅ Yandere, BPD, etc.
      voiceMessages: true,
      priorityGeneration: false, // Solo Ultra
      apiAccess: false,
      exportConversations: true,
      customVoiceCloning: false, // Solo Ultra
    },

    cooldowns: {
      messageCooldown: 2000, // ← 2 segundos entre mensajes (evitar spam)
      worldMessageCooldown: 3000, // 3 segundos
      imageAnalysisCooldown: 3000, // ← 3 seconds between images
      voiceMessageCooldown: 3000, // ← 3 segundos entre voz
    },
  },

  ultra: {
    tier: "ultra",
    displayName: "Ultra ($15/mes)",

    apiRequests: {
      perMinute: 100,
      perHour: 6000, // 100/min × 60
      perDay: 10000, // Generoso pero no ilimitado
    },

    resources: {
      // TOKEN-BASED LIMITS: 100 messages/day (~35,000 tokens), 700 messages/week (~245,000 tokens)
      inputTokensPerDay: 15_000,     // ~100 mensajes × 150 tokens input
      outputTokensPerDay: 20_000,    // ~100 mensajes × 200 tokens output
      totalTokensPerDay: 35_000,     // ~100 mensajes × 350 tokens total
      inputTokensPerWeek: 105_000,   // ~700 mensajes × 150 tokens (USER PROPOSAL)
      outputTokensPerWeek: 140_000,  // ~700 mensajes × 200 tokens (USER PROPOSAL)
      totalTokensPerWeek: 245_000,   // ~700 mensajes × 350 tokens (USER PROPOSAL)

      // OTHER RESOURCES
      contextMessages: 100, // Maximum context (deep memory)
      activeAgents: 100, // More than enough for power users
      activeWorlds: 20,
      charactersInMarketplace: 50,
      imageGenerationPerDay: 100,
      imageAnalysisPerMonth: 600, // 20/day × 30 = 600/month
      imageAnalysisPerDay: 20, // Generoso pero no abusivo
      voiceMessagesPerMonth: 50, // Reducido de 600 a 50
      voiceMessagesPerDay: 5, // Reducido de 20 a 5
      proactiveMessagesPerDay: 10, // Suficiente para proactividad sin spam

      // GROUPS SYSTEM
      activeGroups: 50,             // 50 grupos activos
      maxUsersPerGroup: 100,        // 100 usuarios por grupo
      maxAIsPerGroup: 20,           // 20 IAs por grupo
      groupMessagesPerDay: -1,      // Mensajes ilimitados
      groupCooldownMs: 1000,        // 1 segundo entre mensajes
    },

    features: {
      nsfwContent: true,
      advancedBehaviors: true,
      voiceMessages: true,
      priorityGeneration: true, // ✅ Respuestas prioritarias
      apiAccess: false, // ❌ API access eliminado
      exportConversations: true,
      customVoiceCloning: true, // ✅ Voice cloning personalizado
    },

    cooldowns: {
      messageCooldown: 1000, // ← ANTI-BOT: 1 segundo (imperceptible para humanos)
      worldMessageCooldown: 1000, // ← ANTI-BOT: 1 segundo
      imageAnalysisCooldown: 5000, // ← ANTI-BOT: 5 segundos (user proposal)
      voiceMessageCooldown: 5000, // ← ANTI-BOT: 5 segundos (user proposal)
    },
  },
};

// ============================================================================
// TOKEN <-> MESSAGE CONVERSION (for UI)
// ============================================================================

/**
 * Average tokens per message for UI conversions
 * Based on real usage analysis:
 * - Input (user): ~150 tokens
 * - Output (AI): ~200 tokens
 * - Total: ~350 tokens per exchange
 */
export const TOKENS_PER_MESSAGE = {
  input: 150,
  output: 200,
  total: 350,
} as const;

/**
 * Convierte tokens a mensajes estimados (para mostrar en UI)
 */
export function tokensToMessages(tokens: number, type: 'input' | 'output' | 'total' = 'total'): number {
  if (tokens === -1) return -1; // Unlimited
  const divisor = TOKENS_PER_MESSAGE[type];
  return Math.floor(tokens / divisor);
}

/** Converts messages to estimated tokens (for calculations) */
export function messagesToTokens(messages: number, type: 'input' | 'output' | 'total' = 'total'): number {
  if (messages === -1) return -1; // Unlimited
  const multiplier = TOKENS_PER_MESSAGE[type];
  return messages * multiplier;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get tier limits for a given plan
 */
export function getTierLimits(plan: string = "free"): TierLimits {
  const tier = plan.toLowerCase() as UserTier;
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

/**
 * Check if a limit is unlimited
 */
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

/**
 * Check if a tier has a specific feature
 */
export function hasTierFeature(tier: UserTier, feature: keyof TierLimits["features"]): boolean {
  return TIER_LIMITS[tier].features[feature];
}

/**
 * Get resource limit value
 */
export function getResourceLimit(tier: UserTier, resource: keyof ResourceLimits): number {
  return TIER_LIMITS[tier].resources[resource];
}

/**
 * Check if resource usage is within limits
 */
export function isWithinLimit(currentUsage: number, limit: number): boolean {
  if (isUnlimited(limit)) return true;
  return currentUsage < limit;
}

/**
 * Calculate remaining quota
 */
export function getRemainingQuota(currentUsage: number, limit: number): number {
  if (isUnlimited(limit)) return -1; // Unlimited
  return Math.max(0, limit - currentUsage);
}

/**
 * Get upgrade message for a specific limit
 */
export function getUpgradeMessage(
  tier: UserTier,
  limitType: string,
  current: number,
  limit: number
): string {
  const _tierName = TIER_LIMITS[tier].displayName;

  switch (tier) {
    case "free":
      return `Límite ${limitType} alcanzado (${current}/${limit}). Actualiza a Plus para límites más altos o Ultra para acceso ilimitado. /pricing`;

    case "plus":
      return `Límite ${limitType} alcanzado (${current}/${limit}). Actualiza a Ultra para acceso ilimitado y características premium. /pricing`;

    case "ultra":
      return `Límite ${limitType} alcanzado (${current}/${limit}). Por favor espera o contacta soporte.`;

    default:
      return `Límite ${limitType} alcanzado. Considera actualizar tu plan.`;
  }
}

/**
 * Get rate limit upgrade message
 */
export function getRateLimitUpgradeMessage(tier: UserTier): string {
  switch (tier) {
    case "free":
      return "Límite de solicitudes por minuto alcanzado (10/min). Actualiza a Plus para 30 req/min o Ultra para 100 req/min. /pricing";

    case "plus":
      return "Límite de solicitudes por minuto alcanzado (30/min). Actualiza a Ultra para 100 req/min sin límites horarios/diarios. /pricing";

    case "ultra":
      return "Límite de solicitudes por minuto alcanzado (100/min). Por favor espera un momento.";

    default:
      return "Límite de solicitudes alcanzado. Por favor espera un momento.";
  }
}

// ============================================================================
// ERROR RESPONSE BUILDERS
// ============================================================================

export interface RateLimitError {
  error: string;
  code: "RATE_LIMIT_EXCEEDED";
  tier: UserTier;
  limit: number;
  remaining: number;
  reset?: number;
  upgradeUrl: string;
  upgradeMessage: string;
}

export interface ResourceLimitError {
  error: string;
  code: "RESOURCE_LIMIT_EXCEEDED";
  tier: UserTier;
  resource: string;
  current: number;
  limit: number;
  upgradeUrl: string;
  upgradeMessage: string;
}

/**
 * Build rate limit error response
 */
export function buildRateLimitError(
  tier: UserTier,
  limit: number,
  remaining: number,
  reset?: number
): RateLimitError {
  return {
    error: "Rate limit exceeded",
    code: "RATE_LIMIT_EXCEEDED",
    tier,
    limit,
    remaining,
    reset,
    upgradeUrl: "/pricing",
    upgradeMessage: getRateLimitUpgradeMessage(tier),
  };
}

/**
 * Build resource limit error response
 */
export function buildResourceLimitError(
  tier: UserTier,
  resource: string,
  current: number,
  limit: number
): ResourceLimitError {
  return {
    error: "Resource limit exceeded",
    code: "RESOURCE_LIMIT_EXCEEDED",
    tier,
    resource,
    current,
    limit,
    upgradeUrl: "/pricing",
    upgradeMessage: getUpgradeMessage(tier, resource, current, limit),
  };
}

// ============================================================================
// COMPARISON & ANALYTICS
// ============================================================================

/**
 * Compare two tiers
 */
export function compareTiers(tierA: UserTier, tierB: UserTier): number {
  const order: Record<UserTier, number> = { free: 0, plus: 1, ultra: 2 };
  return order[tierA] - order[tierB];
}

/**
 * Get next tier for upgrade
 */
export function getNextTier(currentTier: UserTier): UserTier | null {
  if (currentTier === "free") return "plus";
  if (currentTier === "plus") return "ultra";
  return null; // Already at top tier
}

/**
 * Get tier benefits for comparison
 */
export interface TierComparison {
  tier: UserTier;
  limits: TierLimits;
  improvements: string[];
}

export function getTierComparison(fromTier: UserTier, toTier: UserTier): TierComparison {
  const fromLimits = TIER_LIMITS[fromTier];
  const toLimits = TIER_LIMITS[toTier];

  const improvements: string[] = [];

  // API requests
  if (toLimits.apiRequests.perMinute > fromLimits.apiRequests.perMinute) {
    improvements.push(`${toLimits.apiRequests.perMinute} solicitudes/min (antes: ${fromLimits.apiRequests.perMinute})`);
  }

  // Messages (basado en tokens, ~350 tokens por mensaje)
  const toMessagesPerDay = Math.floor(toLimits.resources.totalTokensPerDay / 350);
  const fromMessagesPerDay = Math.floor(fromLimits.resources.totalTokensPerDay / 350);
  if (toMessagesPerDay !== fromMessagesPerDay) {
    const toMsg = isUnlimited(toLimits.resources.totalTokensPerDay) ? "ilimitados" : toMessagesPerDay;
    improvements.push(`${toMsg} mensajes/día`);
  }

  // Agents
  if (toLimits.resources.activeAgents > fromLimits.resources.activeAgents) {
    improvements.push(`${toLimits.resources.activeAgents} agentes activos`);
  }

  // Worlds
  if (toLimits.resources.activeWorlds > fromLimits.resources.activeWorlds) {
    improvements.push(`${toLimits.resources.activeWorlds} mundos activos`);
  }

  // Features
  Object.entries(toLimits.features).forEach(([feature, enabled]) => {
    if (enabled && !fromLimits.features[feature as keyof TierLimits["features"]]) {
      improvements.push(`✅ ${feature}`);
    }
  });

  return {
    tier: toTier,
    limits: toLimits,
    improvements,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TIER_LIMITS;
