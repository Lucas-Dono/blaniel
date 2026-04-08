/**
 * Threat Detection System
 *
 * Threat detection system and attack pattern analysis
 */

import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

// ============================================================================
// SCANNING TOOL DETECTION
// ============================================================================

/**
 * Detecta herramientas de scanning conocidas
 */
export function detectScanningTools(userAgent: string, headers: Headers): string[] {
  const tools: string[] = [];
  const ua = userAgent.toLowerCase();

  // Herramientas de scanning web
  const scanners: Record<string, RegExp> = {
    'Nmap': /nmap/i,
    'Masscan': /masscan/i,
    'Nikto': /nikto/i,
    'SQLMap': /sqlmap/i,
    'Burp Suite': /burp/i,
    'OWASP ZAP': /zap|owasp/i,
    'Metasploit': /metasploit/i,
    'Nessus': /nessus/i,
    'Acunetix': /acunetix/i,
    'w3af': /w3af/i,
    'WPScan': /wpscan/i,
    'Gobuster': /gobuster/i,
    'Dirbuster': /dirbuster/i,
    'Dirb': /dirb/i,
    'Nuclei': /nuclei/i,
    'Ffuf': /ffuf/i,
  };

  for (const [name, pattern] of Object.entries(scanners)) {
    if (pattern.test(ua)) {
      tools.push(name);
    }
  }

  // Detect by specific headers
  const headerChecks: Array<{ header: string; value: RegExp; tool: string }> = [
    { header: 'x-scanner', value: /.*/, tool: 'Generic Scanner' },
    { header: 'x-wpscan', value: /.*/, tool: 'WPScan' },
  ];

  for (const check of headerChecks) {
    const headerValue = headers.get(check.header);
    if (headerValue && check.value.test(headerValue)) {
      tools.push(check.tool);
    }
  }

  return [...new Set(tools)]; // Remove duplicates
}

// ============================================================================
// ATTACK PATTERN DETECTION
// ============================================================================

/**
 * Detecta patrones de ataque comunes en requests
 */
export function detectAttackPatterns(request: Request): {
  detected: boolean;
  patterns: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
} {
  const patterns: string[] = [];
  let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';

  const url = new URL(request.url);
  const fullPath = url.pathname + url.search;
  const userAgent = request.headers.get('user-agent') || '';

  // SQL Injection
  const sqlPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i,
    /(\bor\b|\band\b).*(\=|like)/i,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(fullPath)) {
      patterns.push('SQL Injection');
      maxSeverity = getSeverity(maxSeverity, 'high');
      break;
    }
  }

  // XSS
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/i,
    /javascript:/i,
    /onerror\s*=/i,
    /onload\s*=/i,
    /<iframe/i,
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(fullPath)) {
      patterns.push('XSS');
      maxSeverity = getSeverity(maxSeverity, 'high');
      break;
    }
  }

  // Path Traversal
  const pathTraversalPatterns = [
    /\.\.\//,
    /\.\.\\/,
    /%2e%2e%2f/i,
    /%2e%2e\\/i,
  ];

  for (const pattern of pathTraversalPatterns) {
    if (pattern.test(fullPath)) {
      patterns.push('Path Traversal');
      maxSeverity = getSeverity(maxSeverity, 'high');
      break;
    }
  }

  // Command Injection
  const cmdPatterns = [
    /;.*?(ls|cat|wget|curl|bash|sh|cmd|powershell)/i,
    /\|.*?(ls|cat|wget|curl|bash|sh|cmd)/i,
    /`.*?(ls|cat|wget|curl|bash|sh|cmd)/i,
  ];

  for (const pattern of cmdPatterns) {
    if (pattern.test(fullPath)) {
      patterns.push('Command Injection');
      maxSeverity = getSeverity(maxSeverity, 'critical');
      break;
    }
  }

  // LDAP Injection
  if (/(\(|\)|\*|\||\&)/.test(fullPath) && /uid|cn|mail/.test(fullPath)) {
    patterns.push('LDAP Injection');
    maxSeverity = getSeverity(maxSeverity, 'medium');
  }

  // XML Injection
  if (/<\?xml|<!DOCTYPE/i.test(fullPath)) {
    patterns.push('XML Injection');
    maxSeverity = getSeverity(maxSeverity, 'medium');
  }

  // Scanning/Fuzzing
  const scanningPatterns = [
    /\btest\b/i,
    /\badmin\b/i,
    /\bbackup\b/i,
    /\.bak$/i,
    /\.old$/i,
    /\.tmp$/i,
  ];

  let scanningScore = 0;
  for (const pattern of scanningPatterns) {
    if (pattern.test(fullPath)) {
      scanningScore++;
    }
  }

  if (scanningScore >= 2) {
    patterns.push('Directory Scanning');
    maxSeverity = getSeverity(maxSeverity, 'low');
  }

  // User-Agent anomalies
  if (!userAgent || userAgent.length < 10) {
    patterns.push('Suspicious User-Agent');
    maxSeverity = getSeverity(maxSeverity, 'low');
  }

  const confidence = patterns.length > 0 ? Math.min(patterns.length * 0.25, 1) : 0;

  return {
    detected: patterns.length > 0,
    patterns: [...new Set(patterns)],
    severity: maxSeverity,
    confidence,
  };
}

function getSeverity(
  current: 'low' | 'medium' | 'high' | 'critical',
  new_: 'low' | 'medium' | 'high' | 'critical'
): 'low' | 'medium' | 'high' | 'critical' {
  const levels = { low: 0, medium: 1, high: 2, critical: 3 };
  return levels[new_] > levels[current] ? new_ : current;
}

// ============================================================================
// BRUTE FORCE DETECTION
// ============================================================================

/**
 * Detecta ataques de fuerza bruta
 */
export async function detectBruteForce(
  ipAddress: string,
  endpoint: string,
  timeWindowMinutes: number = 5
): Promise<{
  isBruteForce: boolean;
  attempts: number;
  threshold: number;
}> {
  const threshold = 10; // 10 intentos en 5 minutos
  const since = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

  try {
    const attempts = await prisma.threatDetection.count({
      where: {
        ipAddress,
        path: endpoint,
        createdAt: {
          gte: since,
        },
      },
    });

    return {
      isBruteForce: attempts >= threshold,
      attempts,
      threshold,
    };
  } catch (error) {
    console.error('[THREAT] Error detecting brute force:', error);
    return { isBruteForce: false, attempts: 0, threshold };
  }
}

// ============================================================================
// THREAT LOGGING
// ============================================================================

/**
 * Registra una amenaza detectada
 */
export async function logThreat(
  request: Request,
  detection: {
    threatType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    attackVector: string;
    indicators: any;
    blocked?: boolean;
    response?: string;
    tarpitDelay?: number;
    honeypotUsed?: boolean;
  },
  fingerprintId?: string
): Promise<void> {
  try {
    const url = new URL(request.url);
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Extract headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Extract payload if not GET
    let payload: string | undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const body = await request.clone().text();
        payload = body.substring(0, 10000); // Limit size
      } catch {
        // Ignore
      }
    }

    await prisma.threatDetection.create({
      data: {
        id: nanoid(),
        fingerprintId: fingerprintId || null,
        threatType: detection.threatType,
        severity: detection.severity,
        confidence: detection.confidence,
        attackVector: detection.attackVector,
        method: request.method,
        path: url.pathname,
        query: url.search || null,
        payload: payload || null,
        headers,
        ipAddress,
        userAgent,
        detectorName: 'pattern_detector',
        ruleTriggered: detection.threatType,
        indicators: detection.indicators,
        blocked: detection.blocked || false,
        response: detection.response || null,
        tarpitDelay: detection.tarpitDelay || 0,
        honeypotUsed: detection.honeypotUsed || false,
      },
    });

    console.log(`[THREAT] ${detection.severity.toUpperCase()} threat detected: ${detection.threatType} from ${ipAddress}`);
  } catch (error) {
    console.error('[THREAT] Error logging threat:', error);
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function getClientIp(request: Request): string {
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'dev-ip';
}

/**
 * Get threat statistics
 */
export async function getThreatStats(timeRange: { from: Date; to: Date }) {
  try {
    const threats = await prisma.threatDetection.findMany({
      where: {
        createdAt: {
          gte: timeRange.from,
          lte: timeRange.to,
        },
      },
      select: {
        threatType: true,
        severity: true,
        ipAddress: true,
        blocked: true,
      },
    });

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const uniqueIPs = new Set<string>();
    let blockedCount = 0;

    for (const threat of threats) {
      byType[threat.threatType] = (byType[threat.threatType] || 0) + 1;
      bySeverity[threat.severity] = (bySeverity[threat.severity] || 0) + 1;
      uniqueIPs.add(threat.ipAddress);
      if (threat.blocked) blockedCount++;
    }

    return {
      total: threats.length,
      byType,
      bySeverity,
      uniqueAttackers: uniqueIPs.size,
      blocked: blockedCount,
    };
  } catch (error) {
    console.error('[THREAT] Error getting stats:', error);
    throw error;
  }
}
