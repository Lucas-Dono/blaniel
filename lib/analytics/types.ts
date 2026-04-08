/**
 * Analytics Types
 *
 * Types and enums for the analytics tracking system.
 * Based on ANALYTICS-IMPLEMENTATION-SUMMARY.md
 */

// ============================================================================
// EVENT TYPE ENUMS
// ============================================================================

/**
 * Landing Page Events (pre-signup)
 */
export enum LandingEventType {
  // Page & Navigation
  PAGE_VIEW = "landing.page_view",
  SCROLL_DEPTH = "landing.scroll_depth",

  // Hero Section
  CTA_PRIMARY = "landing.cta_primary",
  CTA_SECONDARY = "landing.cta_secondary",

  // Demo Chat
  DEMO_START = "landing.demo_start",
  DEMO_MESSAGE = "landing.demo_message",
  DEMO_LIMIT_REACHED = "landing.demo_limit_reached",
  DEMO_SIGNUP = "landing.demo_signup",

  // Features Section
  FEATURE_CLICK = "landing.feature_click",

  // Pricing & Plans
  PLAN_VIEW = "landing.plan_view",
  PLAN_SELECT = "landing.plan_select",

  // Downloads Section
  DOWNLOADS_SECTION_VIEWED = "landing.downloads_section_viewed",
  DOWNLOAD_CLICKED = "landing.download_clicked",
}

/**
 * App Events (post-signup, UI interactions)
 */
export enum AppEventType {
  // Agent Selection
  AGENT_SELECT = "app.agent_select",
  AGENT_CREATE = "app.agent_create",

  // Messaging
  MESSAGE_SEND = "app.message_send",
  MESSAGE_RECEIVE = "app.message_receive",

  // Bonds
  BOND_PROGRESS = "app.bond_progress",
  BOND_TIER_UNLOCK = "app.bond_tier_unlock",

  // Navigation
  PAGE_VIEW = "app.page_view",
  FEATURE_DISCOVERED = "app.feature_discovered",

  // Engagement
  SESSION_START = "app.session_start",
  SESSION_END = "app.session_end",
}

/**
 * Conversion Events (critical funnel)
 */
export enum ConversionEventType {
  // Signup Funnel
  SIGNUP = "conversion.signup",
  FIRST_AGENT = "conversion.first_agent",
  FIRST_MESSAGE = "conversion.first_message",

  // Monetization
  FREE_TO_PLUS = "conversion.free_to_plus",
  FREE_TO_ULTRA = "conversion.free_to_ultra",
  PLUS_TO_ULTRA = "conversion.plus_to_ultra",

  // Upgrade Triggers
  UPGRADE_MODAL_VIEW = "conversion.upgrade_modal_view",
  UPGRADE_MODAL_CLICK = "conversion.upgrade_modal_click",

  // Limits
  LIMIT_REACHED = "conversion.limit_reached",
}

/**
 * Tipo unificado de todos los eventos
 */
export type EventType = LandingEventType | AppEventType | ConversionEventType;

// ============================================================================
// METADATA TYPES
// ============================================================================

/**
 * Metadata común a todos los eventos
 */
export interface BaseEventMetadata {
  // Session tracking
  sessionId?: string;
  userId?: string;

  // UTM Parameters (marketing attribution)
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;

  // Browser context
  url?: string;
  referrer?: string;
  userAgent?: string;

  // Device info
  deviceType?: "mobile" | "desktop" | "tablet";
  browser?: string;
  os?: string;

  // Timestamp
  timestamp?: string;

  // Allow additional properties
  [key: string]: any;
}

/**
 * Metadata para eventos de Landing Page
 */
export interface LandingEventMetadata extends BaseEventMetadata {
  // Scroll depth
  scrollDepth?: 25 | 50 | 75 | 100;

  // CTA context
  ctaLocation?: string;
  ctaText?: string;

  // Demo chat
  messageCount?: number;
  messageLength?: number;
  demoCompleted?: boolean;

  // Feature interaction
  featureName?: string;
  featureCategory?: string;

  // Plan selection
  planName?: "free" | "plus" | "ultra";
  planPrice?: number;
}

/**
 * Metadata para eventos de App
 */
export interface AppEventMetadata extends BaseEventMetadata {
  // Agent context
  agentId?: string;
  agentTier?: string;
  agentName?: string;

  // Message context
  messageLength?: number;
  conversationLength?: number;
  responseTime?: number;

  // Bond context
  bondId?: string;
  oldAffinity?: number;
  newAffinity?: number;
  bondTier?: string;

  // Session
  sessionDuration?: number;
}

/**
 * Metadata para eventos de Conversión
 */
export interface ConversionEventMetadata extends BaseEventMetadata {
  // Signup
  signupMethod?: "email" | "google" | "github";
  referralSource?: string;
  fromDemo?: boolean;

  // First actions
  timeSinceSignup?: number; // seconds
  timeToFirstMessage?: number; // seconds

  // Upgrade context
  oldPlan?: "free" | "plus" | "ultra";
  newPlan?: "free" | "plus" | "ultra";
  amount?: number;
  daysSinceSignup?: number;

  // Trigger context
  triggerType?: "bond_limit" | "generation_tier" | "feature_discovery" | "manual";
  limitReached?: string;
}

/**
 * Metadata flexible (union type)
 */
export type EventMetadata =
  | LandingEventMetadata
  | AppEventMetadata
  | ConversionEventMetadata
  | BaseEventMetadata;

// ============================================================================
// FUNCTION PARAMETER TYPES
// ============================================================================

/**
 * Parámetros para trackEvent (client-side)
 */
export interface TrackEventParams {
  eventType: EventType;
  metadata?: Partial<EventMetadata>;
  sessionId?: string; // Override automático
}

/**
 * Parámetros para trackServerEvent (server-side)
 */
export interface TrackServerEventParams {
  userId?: string;
  eventType: EventType;
  metadata?: Partial<EventMetadata>;
}

// ============================================================================
// UTM PARAMETERS
// ============================================================================

/**
 * Parámetros UTM de marketing
 */
export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

// ============================================================================
// DEVICE DETECTION
// ============================================================================

/**
 * Información del dispositivo detectada
 */
export interface DeviceInfo {
  deviceType: "mobile" | "desktop" | "tablet";
  browser: string;
  os: string;
  userAgent: string;
}

// ============================================================================
// SESSION TRACKING
// ============================================================================

/**
 * Información de sesión persistente
 */
export interface SessionInfo {
  sessionId: string;
  startedAt: string;
  lastActivityAt: string;
  utm?: UTMParams;
}
