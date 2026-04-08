/**
 * Feature Flags Configuration
 * Define qué features están disponibles para cada tier
 */

import { Feature, UserTier, TierConfig, FeatureMetadata } from "./types";

/**
 * Tier configurations with features and limits
 */
export const TIER_CONFIGS: Record<UserTier, TierConfig> = {
  [UserTier.FREE]: {
    tier: UserTier.FREE,
    name: "Free",
    description: "Perfecto para empezar",
    features: [
      Feature.CHAT_BASIC,
      Feature.AGENT_CREATION,
      Feature.GROUPS,
      Feature.COMMUNITY_BASIC,
      Feature.ANALYTICS_BASIC,
    ],
    limits: {
      maxAgents: 3,
      maxAgentsPerWorld: 0, // Sin acceso a worlds
      maxActiveWorlds: 0,
      maxWorldAgents: 0,
      imageGenerationsPerDay: 0,
      maxMarketplaceItems: 0,
      messagesPerDay: 100,
      apiCallsPerDay: 0,
      maxStorageGB: 1,
    },
  },

  [UserTier.PLUS]: {
    tier: UserTier.PLUS,
    name: "Plus",
    description: "Para usuarios activos",
    features: [
      // Todas las de Free
      Feature.CHAT_BASIC,
      Feature.AGENT_CREATION,
      Feature.GROUPS,
      Feature.COMMUNITY_BASIC,
      Feature.ANALYTICS_BASIC,
      // Nuevas de Plus
      Feature.VOICE_MESSAGES,
      Feature.IMAGE_GENERATION,
      Feature.WORLDS,
      Feature.WORLD_CREATION,
      Feature.GROUPS_ADVANCED,
      Feature.MARKETPLACE_PUBLISHING,
      Feature.COMMUNITY_ADVANCED,
      Feature.PRIORITY_SUPPORT,
      Feature.MULTIMODAL_MESSAGES,
    ],
    limits: {
      maxAgents: 20,
      maxAgentsPerWorld: 5,
      maxActiveWorlds: 5,
      maxWorldAgents: 10,
      imageGenerationsPerDay: 10,
      maxMarketplaceItems: 5,
      messagesPerDay: 1000,
      apiCallsPerDay: 0,
      maxStorageGB: 10,
    },
    price: {
      monthly: 9.99,
      yearly: 99.99,
      currency: "USD",
    },
  },

  [UserTier.ULTRA]: {
    tier: UserTier.ULTRA,
    name: "Ultra",
    description: "Poder ilimitado",
    features: [
      // Todas las anteriores
      Feature.CHAT_BASIC,
      Feature.AGENT_CREATION,
      Feature.GROUPS,
      Feature.COMMUNITY_BASIC,
      Feature.ANALYTICS_BASIC,
      Feature.VOICE_MESSAGES,
      Feature.IMAGE_GENERATION,
      Feature.WORLDS,
      Feature.WORLD_CREATION,
      Feature.GROUPS_ADVANCED,
      Feature.MARKETPLACE_PUBLISHING,
      Feature.COMMUNITY_ADVANCED,
      Feature.PRIORITY_SUPPORT,
      Feature.MULTIMODAL_MESSAGES,
      // Exclusivas de Ultra
      Feature.AGENT_PUBLISHING,
      Feature.WORLD_ADVANCED_FEATURES,
      Feature.GROUPS_ANALYTICS,
      Feature.MARKETPLACE_UNLIMITED,
      Feature.COMMUNITY_MODERATION,
      Feature.EARLY_ACCESS,
      Feature.TEAM_FEATURES,
      Feature.CUSTOM_BRANDING,
    ],
    limits: {
      maxAgents: 100,
      maxAgentsPerWorld: 20,
      maxActiveWorlds: 20,
      maxWorldAgents: 50,
      imageGenerationsPerDay: 100,
      maxMarketplaceItems: -1, // Ilimitado
      messagesPerDay: -1, // Ilimitado
      apiCallsPerDay: 0,
      maxStorageGB: 100,
    },
    price: {
      monthly: 29.99,
      yearly: 299.99,
      currency: "USD",
    },
  },
};

/**
 * Feature metadata for UI display and messaging
 */
export const FEATURE_METADATA: Record<Feature, FeatureMetadata> = {
  // Chat & Messaging
  [Feature.CHAT_BASIC]: {
    feature: Feature.CHAT_BASIC,
    name: "Chat Básico",
    description: "Conversaciones 1-1 con tus agentes",
    minTier: UserTier.FREE,
    upgradeMessage: "Disponible en todos los planes",
    category: "chat",
  },
  [Feature.VOICE_MESSAGES]: {
    feature: Feature.VOICE_MESSAGES,
    name: "Mensajes de Voz",
    description: "Envía y recibe mensajes de voz",
    minTier: UserTier.PLUS,
    upgradeMessage: "Actualiza a Plus para habilitar mensajes de voz",
    category: "chat",
  },
  [Feature.IMAGE_GENERATION]: {
    feature: Feature.IMAGE_GENERATION,
    name: "Generación de Imágenes",
    description: "Genera imágenes con IA",
    minTier: UserTier.PLUS,
    upgradeMessage: "Plus: 10 imágenes/día, Ultra: 100 imágenes/día",
    category: "chat",
  },
  [Feature.MULTIMODAL_MESSAGES]: {
    feature: Feature.MULTIMODAL_MESSAGES,
    name: "Mensajes Multimodales",
    description: "Envía imágenes, videos y archivos",
    minTier: UserTier.PLUS,
    upgradeMessage: "Actualiza a Plus para mensajes multimedia",
    category: "chat",
  },

  // Agents
  [Feature.AGENT_CREATION]: {
    feature: Feature.AGENT_CREATION,
    name: "Creación de Agentes",
    description: "Crea tus propios agentes IA",
    minTier: UserTier.FREE,
    upgradeMessage: "Free: 3 agentes, Plus: 20 agentes, Ultra: 100 agentes",
    category: "agents",
  },
  [Feature.AGENT_PUBLISHING]: {
    feature: Feature.AGENT_PUBLISHING,
    name: "Publicación de Agentes",
    description: "Publica tus agentes en el marketplace",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Actualiza a Ultra para publicar agentes",
    category: "agents",
  },
  [Feature.AGENT_API_ACCESS]: {
    feature: Feature.AGENT_API_ACCESS,
    name: "API de Agentes",
    description: "Accede a tus agentes vía API",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Actualiza a Ultra para acceso API",
    category: "agents",
  },

  // Worlds
  [Feature.WORLDS]: {
    feature: Feature.WORLDS,
    name: "Mundos Virtuales",
    description: "Accede a mundos multi-agente",
    minTier: UserTier.PLUS,
    upgradeMessage: "Actualiza a Plus para acceso a Mundos (5 activos) o Ultra (20 activos)",
    category: "worlds",
  },
  [Feature.WORLD_CREATION]: {
    feature: Feature.WORLD_CREATION,
    name: "Creación de Mundos",
    description: "Crea tus propios mundos",
    minTier: UserTier.PLUS,
    upgradeMessage: "Plus: 5 mundos, Ultra: 20 mundos",
    category: "worlds",
  },
  [Feature.WORLD_ADVANCED_FEATURES]: {
    feature: Feature.WORLD_ADVANCED_FEATURES,
    name: "Features Avanzadas de Mundos",
    description: "Eventos emergentes, directores IA, etc.",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Actualiza a Ultra para features avanzadas",
    category: "worlds",
  },

  // Groups
  [Feature.GROUPS]: {
    feature: Feature.GROUPS,
    name: "Grupos",
    description: "Crea grupos con usuarios e IAs",
    minTier: UserTier.FREE,
    upgradeMessage: "Free: 2 grupos, Plus: 10 grupos, Ultra: 50 grupos",
    category: "groups",
  },
  [Feature.GROUPS_ADVANCED]: {
    feature: Feature.GROUPS_ADVANCED,
    name: "Features Avanzadas de Grupos",
    description: "Story Mode, AI Director, eventos emergentes",
    minTier: UserTier.PLUS,
    upgradeMessage: "Actualiza a Plus para Story Mode y AI Director",
    category: "groups",
  },
  [Feature.GROUPS_ANALYTICS]: {
    feature: Feature.GROUPS_ANALYTICS,
    name: "Analytics de Grupos",
    description: "Visualiza relaciones y dinámicas del grupo",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Actualiza a Ultra para analytics avanzadas",
    category: "groups",
  },

  // Marketplace
  [Feature.MARKETPLACE_PUBLISHING]: {
    feature: Feature.MARKETPLACE_PUBLISHING,
    name: "Publicar en Marketplace",
    description: "Publica characters, prompts, themes",
    minTier: UserTier.PLUS,
    upgradeMessage: "Plus: 5 items, Ultra: Ilimitado",
    category: "marketplace",
  },
  [Feature.MARKETPLACE_UNLIMITED]: {
    feature: Feature.MARKETPLACE_UNLIMITED,
    name: "Marketplace Ilimitado",
    description: "Publica items sin límite",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Actualiza a Ultra para publicaciones ilimitadas",
    category: "marketplace",
  },

  // Community
  [Feature.COMMUNITY_BASIC]: {
    feature: Feature.COMMUNITY_BASIC,
    name: "Comunidad Básica",
    description: "Únete a comunidades y participa",
    minTier: UserTier.FREE,
    upgradeMessage: "Disponible en todos los planes",
    category: "community",
  },
  [Feature.COMMUNITY_ADVANCED]: {
    feature: Feature.COMMUNITY_ADVANCED,
    name: "Comunidad Avanzada",
    description: "Crea comunidades y eventos",
    minTier: UserTier.PLUS,
    upgradeMessage: "Actualiza a Plus para crear comunidades",
    category: "community",
  },
  [Feature.COMMUNITY_MODERATION]: {
    feature: Feature.COMMUNITY_MODERATION,
    name: "Herramientas de Moderación",
    description: "Tools avanzadas de moderación",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Actualiza a Ultra para herramientas de moderación",
    category: "community",
  },

  // Analytics
  [Feature.ANALYTICS_BASIC]: {
    feature: Feature.ANALYTICS_BASIC,
    name: "Analytics Básicas",
    description: "Ve tus estadísticas básicas",
    minTier: UserTier.FREE,
    upgradeMessage: "Disponible en todos los planes",
    category: "analytics",
  },
  [Feature.ANALYTICS_ADVANCED]: {
    feature: Feature.ANALYTICS_ADVANCED,
    name: "Analytics Avanzadas",
    description: "Insights profundos y métricas",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Actualiza a Ultra para analytics avanzadas",
    category: "analytics",
  },
  [Feature.ANALYTICS_EXPORT]: {
    feature: Feature.ANALYTICS_EXPORT,
    name: "Exportar Datos",
    description: "Exporta tus datos en CSV/JSON",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Actualiza a Ultra para exportar datos",
    category: "analytics",
  },

  // Support & Priority
  [Feature.PRIORITY_SUPPORT]: {
    feature: Feature.PRIORITY_SUPPORT,
    name: "Soporte Prioritario",
    description: "Respuestas en < 24h",
    minTier: UserTier.PLUS,
    upgradeMessage: "Actualiza a Plus para soporte prioritario",
    category: "business",
  },
  [Feature.EARLY_ACCESS]: {
    feature: Feature.EARLY_ACCESS,
    name: "Early Access",
    description: "Acceso anticipado a features",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Actualiza a Ultra para early access",
    category: "business",
  },

  // API
  [Feature.API_ACCESS]: {
    feature: Feature.API_ACCESS,
    name: "Acceso API",
    description: "API REST para integraciones",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Actualiza a Ultra para acceso API",
    category: "api",
  },
  [Feature.API_WEBHOOKS]: {
    feature: Feature.API_WEBHOOKS,
    name: "Webhooks",
    description: "Recibe eventos en tiempo real",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Actualiza a Ultra para webhooks",
    category: "api",
  },

  // Business
  [Feature.TEAM_FEATURES]: {
    feature: Feature.TEAM_FEATURES,
    name: "Equipos",
    description: "Colabora con tu equipo",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Actualiza a Ultra para features de equipo",
    category: "business",
  },
  [Feature.CUSTOM_BRANDING]: {
    feature: Feature.CUSTOM_BRANDING,
    name: "Branding Personalizado",
    description: "White-label para empresas",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Contacta ventas para branding personalizado",
    category: "business",
  },
  [Feature.SSO]: {
    feature: Feature.SSO,
    name: "Single Sign-On",
    description: "SSO empresarial (SAML, OAuth)",
    minTier: UserTier.ULTRA,
    upgradeMessage: "Contacta ventas para SSO empresarial",
    category: "business",
  },
};

/**
 * Get tier hierarchy (for checking >= tier)
 */
export const TIER_HIERARCHY: UserTier[] = [
  UserTier.FREE,
  UserTier.PLUS,
  UserTier.ULTRA,
];

/**
 * Helper: Check if tierA >= tierB
 */
export function isTierSufficient(
  userTier: UserTier,
  requiredTier: UserTier
): boolean {
  const userIndex = TIER_HIERARCHY.indexOf(userTier);
  const requiredIndex = TIER_HIERARCHY.indexOf(requiredTier);
  return userIndex >= requiredIndex;
}

/**
 * Get next tier for upgrade suggestions
 */
export function getNextTier(currentTier: UserTier): UserTier | null {
  const currentIndex = TIER_HIERARCHY.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex >= TIER_HIERARCHY.length - 1) {
    return null;
  }
  return TIER_HIERARCHY[currentIndex + 1];
}

/**
 * Get upgrade URL for tier
 */
export function getUpgradeUrl(targetTier: UserTier): string {
  return `/pricing?upgrade=${targetTier}`;
}
