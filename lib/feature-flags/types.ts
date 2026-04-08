/**
 * Feature Flags System - Types and Configuration
 * Sistema de feature flags basado en tier de usuario
 */

/**
 * User subscription tiers
 */
export enum UserTier {
  FREE = "free",
  PLUS = "plus",
  ULTRA = "ultra",
}

/**
 * Available feature flags
 * Cada feature está controlada por el tier del usuario
 */
export enum Feature {
  // Chat & Messaging
  CHAT_BASIC = "CHAT_BASIC",
  VOICE_MESSAGES = "VOICE_MESSAGES",
  IMAGE_GENERATION = "IMAGE_GENERATION",
  MULTIMODAL_MESSAGES = "MULTIMODAL_MESSAGES",

  // Agents
  AGENT_CREATION = "AGENT_CREATION",
  AGENT_PUBLISHING = "AGENT_PUBLISHING",
  AGENT_API_ACCESS = "AGENT_API_ACCESS",

  // Worlds
  WORLDS = "WORLDS",
  WORLD_CREATION = "WORLD_CREATION",
  WORLD_ADVANCED_FEATURES = "WORLD_ADVANCED_FEATURES",

  // Groups
  GROUPS = "GROUPS",
  GROUPS_ADVANCED = "GROUPS_ADVANCED",
  GROUPS_ANALYTICS = "GROUPS_ANALYTICS",

  // Marketplace
  MARKETPLACE_PUBLISHING = "MARKETPLACE_PUBLISHING",
  MARKETPLACE_UNLIMITED = "MARKETPLACE_UNLIMITED",

  // Community
  COMMUNITY_BASIC = "COMMUNITY_BASIC",
  COMMUNITY_ADVANCED = "COMMUNITY_ADVANCED",
  COMMUNITY_MODERATION = "COMMUNITY_MODERATION",

  // Analytics & Insights
  ANALYTICS_BASIC = "ANALYTICS_BASIC",
  ANALYTICS_ADVANCED = "ANALYTICS_ADVANCED",
  ANALYTICS_EXPORT = "ANALYTICS_EXPORT",

  // Support & Priority
  PRIORITY_SUPPORT = "PRIORITY_SUPPORT",
  EARLY_ACCESS = "EARLY_ACCESS",

  // API Access
  API_ACCESS = "API_ACCESS",
  API_WEBHOOKS = "API_WEBHOOKS",

  // Business Features
  TEAM_FEATURES = "TEAM_FEATURES",
  CUSTOM_BRANDING = "CUSTOM_BRANDING",
  SSO = "SSO",
}

/**
 * Feature limits per tier
 */
export interface FeatureLimits {
  // Agents
  maxAgents: number;
  maxAgentsPerWorld: number;

  // Worlds
  maxActiveWorlds: number;
  maxWorldAgents: number;

  // Image Generation
  imageGenerationsPerDay: number;

  // Marketplace
  maxMarketplaceItems: number;

  // Messages
  messagesPerDay: number;

  // API
  apiCallsPerDay: number;

  // Storage
  maxStorageGB: number;
}

/**
 * Tier configuration with features and limits
 */
export interface TierConfig {
  tier: UserTier;
  name: string;
  description: string;
  features: Feature[];
  limits: FeatureLimits;
  price?: {
    monthly: number;
    yearly: number;
    currency: string;
  };
}

/**
 * Feature metadata for UI display
 */
export interface FeatureMetadata {
  feature: Feature;
  name: string;
  description: string;
  icon?: string;
  minTier: UserTier;
  upgradeMessage: string;
  category: "chat" | "agents" | "worlds" | "groups" | "marketplace" | "community" | "analytics" | "api" | "business";
}

/**
 * Feature check result
 */
export interface FeatureCheckResult {
  hasAccess: boolean;
  feature: Feature;
  userTier: UserTier;
  requiredTier?: UserTier;
  reason?: string;
  upgradeUrl?: string;
}

/**
 * Feature usage tracking
 */
export interface FeatureUsage {
  userId: string;
  feature: Feature;
  count: number;
  limit: number;
  resetAt: Date;
}
