/**
 * Analytics Tracking System - Main Export
 *
 * Exportaciones centralizadas para fácil importación.
 */

// Types and Enums
export type {
  EventType,
  EventMetadata,
  BaseEventMetadata,
  LandingEventMetadata,
  AppEventMetadata,
  ConversionEventMetadata,
  TrackEventParams,
  TrackServerEventParams,
  UTMParams,
  DeviceInfo,
  SessionInfo,
} from "./types";

export {
  LandingEventType,
  AppEventType,
  ConversionEventType,
} from "./types";

// Client-side tracking
export {
  trackEvent,
  trackEventsBatch,
  trackPageView,
  getOrCreateSessionId,
  getCurrentSession,
  getUTMParams,
  clearUTMParams,
  detectDeviceType,
  detectBrowser,
  detectOS,
  getDeviceInfo,
  createScrollDepthTracker,
  clearAnalyticsData,
  getAnalyticsDebugInfo,
} from "./track-client";

// Server-side tracking
export {
  trackServerEvent,
  trackServerEventsBatch,
  trackSignup,
  trackFirstAgent,
  trackFirstMessage,
  trackPlanUpgrade,
  trackLimitReached,
  getUserEvents,
  countEventsByType,
  getUserConversionMetrics,
} from "./track-server";

// Re-export legacy KPI tracker for backwards compatibility
export { trackEvent as trackKPIEvent, EventType as LegacyEventType } from "./kpi-tracker";
