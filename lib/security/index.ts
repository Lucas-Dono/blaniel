/**
 * Security System - Main Export
 *
 * Punto de entrada principal para el sistema de seguridad
 */

// Fingerprinting
export {
  fingerprintRequest,
  getFingerprint,
  blockFingerprint,
  analyzeUserAgent,
  calculateThreatScore,
  generateJA3Hash,
  type FingerprintData,
  type ThreatAnalysis,
} from './fingerprinting';

// Threat Detection
export {
  detectAttackPatterns,
  detectBruteForce,
  detectScanningTools,
  logThreat,
  getThreatStats,
} from './threat-detection';

// Honeypots
export {
  handleHoneypotRequest,
  generateHoneypotResponse,
  createDynamicHoneypot,
  getHoneypotStats,
  HONEYPOT_CONFIGS,
  type HoneypotConfig,
} from './honeypots';

// Tarpit
export {
  applyTarpit,
  calculateTarpitDelay,
  withTarpit,
  getTarpitStats,
  globalTarpit,
  SmartTarpit,
  ProgressiveTarpit,
  type TarpitConfig,
} from './tarpit';

// Canary Tokens
export {
  createCanaryToken,
  checkAndTriggerCanaryToken,
  canaryTokenMiddleware,
  setupDefaultCanaryTokens,
  listCanaryTokens,
  deactivateCanaryToken,
  getCanaryStats,
  type CanaryTokenType,
  type CanaryTokenConfig,
} from './canary-tokens';

// Alerting
export {
  sendAlert,
  getRecentAlerts,
  acknowledgeAlert,
  resolveAlert,
  getAlertStats,
  sendDailySecurityDigest,
  AlertTemplates,
  type AlertSeverity,
  type AlertType,
  type AlertConfig,
} from './alerting';

// Security Middleware
export {
  securityMiddleware,
  withSecurity,
  honeypotRoute,
  SecurityPresets,
  type SecurityConfig,
} from './security-middleware';

// Presets y configuraciones
export const SecurityLevels = {
  LOW: {
    autoBlockThreshold: 90,
    enableTarpit: false,
  },
  MEDIUM: {
    autoBlockThreshold: 70,
    enableTarpit: true,
  },
  HIGH: {
    autoBlockThreshold: 50,
    enableTarpit: true,
  },
  CRITICAL: {
    autoBlockThreshold: 30,
    enableTarpit: true,
  },
} as const;

// Quick setup helpers
export const quickSetup = {
  /**
   * Protect a public API with basic security
   */
  publicAPI: (handler: any) => {
    const { withSecurity, SecurityPresets } = require('./security-middleware');
    return withSecurity(handler, SecurityPresets.publicAPI);
  },

  /**
   * Protect a private API with maximum security
   */
  privateAPI: (handler: any) => {
    const { withSecurity, SecurityPresets } = require('./security-middleware');
    return withSecurity(handler, SecurityPresets.privateAPI);
  },

  /**
   * Protect authentication endpoint (detects brute force)
   */
  auth: (handler: any) => {
    const { withSecurity, SecurityPresets } = require('./security-middleware');
    return withSecurity(handler, SecurityPresets.authentication);
  },
};

// Version
export const SECURITY_SYSTEM_VERSION = '1.0.0';
