/**
 * Security Middleware Integration
 *
 * Central middleware that integrates all security systems:
 * - Fingerprinting
 * - Threat detection
 * - Honeypots
 * - Tarpit
 * - Canary tokens
 * - Alerting
 */

import { NextRequest, NextResponse } from 'next/server';
import { fingerprintRequest } from './fingerprinting';
import { handleHoneypotRequest } from './honeypots';
import { detectAttackPatterns, logThreat } from './threat-detection';
import { applyTarpit } from './tarpit';
import { canaryTokenMiddleware } from './canary-tokens';
import { sendAlert, AlertTemplates } from './alerting';
import { blockFingerprint } from './fingerprinting';

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

export interface SecurityConfig {
  enableFingerprinting?: boolean;
  enableHoneypots?: boolean;
  enableTarpit?: boolean;
  enableCanaryTokens?: boolean;
  enableThreatDetection?: boolean;
  autoBlock?: boolean; // Auto-block high threat clients
  autoBlockThreshold?: number; // Threat score threshold for auto-block
}

const DEFAULT_CONFIG: SecurityConfig = {
  enableFingerprinting: true,
  enableHoneypots: true,
  enableTarpit: true,
  enableCanaryTokens: true,
  enableThreatDetection: true,
  autoBlock: true,
  autoBlockThreshold: 80,
};

/**
 * Main security middleware
 */
export async function securityMiddleware(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
  config: Partial<SecurityConfig> = {}
): Promise<NextResponse> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  try {
    // ========================================================================
    // 1. HONEYPOT CHECK (priority)
    // ========================================================================
    if (cfg.enableHoneypots) {
      const honeypotResponse = await handleHoneypotRequest(request);
      if (honeypotResponse) {
        console.log('[SECURITY] Honeypot triggered, returning fake response');
        return honeypotResponse as any;
      }
    }

    // ========================================================================
    // 2. FINGERPRINTING
    // ========================================================================
    let fingerprintData: any = null;

    if (cfg.enableFingerprinting) {
      try {
        fingerprintData = await fingerprintRequest(request, {
          includeGeolocation: false, // Skip for performance
          includeReputation: false,
        });

        // If blocked, return 403 immediately
        if (fingerprintData.dbRecord.isBlocked) {
          console.log('[SECURITY] Blocked fingerprint detected');

          return new NextResponse(
            JSON.stringify({
              error: 'Forbidden',
              message: 'Access denied',
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      } catch (error) {
        console.error('[SECURITY] Fingerprinting error:', error);
      }
    }

    // ========================================================================
    // 3. THREAT DETECTION
    // ========================================================================
    if (cfg.enableThreatDetection) {
      const threatAnalysis = detectAttackPatterns(request);

      if (threatAnalysis.detected) {
        console.log('[SECURITY] Threat detected:', threatAnalysis.patterns);

        // Log threat
        await logThreat(request, {
          threatType: threatAnalysis.patterns[0], // Primary threat type
          severity: threatAnalysis.severity,
          confidence: threatAnalysis.confidence,
          attackVector: threatAnalysis.patterns.join(', '),
          indicators: threatAnalysis.patterns,
          blocked: threatAnalysis.severity === 'critical',
        }, fingerprintData?.dbRecord?.id);

        // Send alert for critical threats
        if (threatAnalysis.severity === 'critical') {
          const url = new URL(request.url);
          await sendAlert(
            AlertTemplates.sqlInjectionAttempt(
              fingerprintData?.fingerprint?.ipAddress || 'unknown',
              url.pathname + url.search
            )
          );
        }

        // Block critical threats immediately
        if (threatAnalysis.severity === 'critical') {
          if (fingerprintData?.dbRecord?.id) {
            await blockFingerprint(
              fingerprintData.dbRecord.id,
              `Critical threat: ${threatAnalysis.patterns.join(', ')}`
            );
          }

          return new NextResponse(
            JSON.stringify({
              error: 'Forbidden',
              message: 'Malicious request detected',
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }
    }

    // ========================================================================
    // 4. CANARY TOKEN CHECK
    // ========================================================================
    if (cfg.enableCanaryTokens) {
      try {
        const canaryTriggered = await canaryTokenMiddleware(request);

        if (canaryTriggered) {
          console.log('[SECURITY] ⚠️ Canary token triggered!');

          // Auto-block si se detecta canary token
          if (fingerprintData?.dbRecord?.id) {
            await blockFingerprint(
              fingerprintData.dbRecord.id,
              'Canary token triggered - data exfiltration attempt'
            );
          }

          // Nota: No bloqueamos la request para no alertar al atacante
          // Simplemente registramos y monitoreamos
        }
      } catch (error) {
        console.error('[SECURITY] Canary token check error:', error);
      }
    }

    // ========================================================================
    // 5. AUTO-BLOCK CHECK
    // ========================================================================
    if (cfg.autoBlock && fingerprintData) {
      const threatScore = fingerprintData.threatAnalysis.threatScore;

      if (threatScore >= (cfg.autoBlockThreshold || 80)) {
        console.log(`[SECURITY] Auto-blocking fingerprint with threat score ${threatScore}`);

        await blockFingerprint(
          fingerprintData.dbRecord.id,
          `Auto-blocked: threat score ${threatScore}`
        );

        return new NextResponse(
          JSON.stringify({
            error: 'Forbidden',
            message: 'Access denied',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // ========================================================================
    // 6. TARPIT APPLICATION
    // ========================================================================
    if (cfg.enableTarpit && fingerprintData) {
      const threatScore = fingerprintData.threatAnalysis.threatScore;

      if (threatScore > 30) {
        console.log(`[SECURITY] Applying tarpit (threat score: ${threatScore})`);

        return await applyTarpit(
          fingerprintData.dbRecord.id,
          threatScore,
          handler
        ) as any;
      }
    }

    // ========================================================================
    // 7. EXECUTE HANDLER (request is clean)
    // ========================================================================
    return await handler();

  } catch (error) {
    console.error('[SECURITY] Security middleware error:', error);

    // In case of error, allow the request (fail-open)
    // This prevents security errors from breaking the application
    return await handler();
  }
}

/**
 * Wrapper para usar en route handlers
 */
export function withSecurity(
  handler: (request: NextRequest, ...args: any[]) => Promise<Response>,
  config?: Partial<SecurityConfig>
) {
  return async (request: NextRequest, ...args: any[]): Promise<Response> => {
    return securityMiddleware(
      request,
      () => handler(request, ...args) as Promise<NextResponse>,
      config
    );
  };
}

/**
 * Specific wrapper for honeypot routes
 */
export function honeypotRoute(config?: Partial<SecurityConfig>) {
  return (handler: (request: NextRequest) => Promise<Response>) => {
    return withSecurity(handler, {
      ...config,
      enableHoneypots: true,
      enableTarpit: true,
      autoBlock: true,
    });
  };
}

/**
 * Configuración de seguridad por tipo de endpoint
 */
export const SecurityPresets = {
  // Public API (less restrictive)
  publicAPI: {
    enableFingerprinting: true,
    enableHoneypots: false,
    enableTarpit: false,
    enableCanaryTokens: true,
    enableThreatDetection: true,
    autoBlock: false,
  } as SecurityConfig,

  // API privada/admin (muy restrictiva)
  privateAPI: {
    enableFingerprinting: true,
    enableHoneypots: true,
    enableTarpit: true,
    enableCanaryTokens: true,
    enableThreatDetection: true,
    autoBlock: true,
    autoBlockThreshold: 50,
  } as SecurityConfig,

  // Authentication (detect brute force)
  authentication: {
    enableFingerprinting: true,
    enableHoneypots: false,
    enableTarpit: true,
    enableCanaryTokens: false,
    enableThreatDetection: true,
    autoBlock: true,
    autoBlockThreshold: 70,
  } as SecurityConfig,

  // Dashboard/monitoring (permisivo)
  dashboard: {
    enableFingerprinting: true,
    enableHoneypots: false,
    enableTarpit: false,
    enableCanaryTokens: false,
    enableThreatDetection: false,
    autoBlock: false,
  } as SecurityConfig,
};
