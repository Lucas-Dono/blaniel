/**
 * Advanced Client Fingerprinting System
 * 
 * Features:
 * - Network fingerprinting (IP, ASN, geolocation)
 * - HTTP fingerprinting (headers, user-agent)
 * - TLS/SSL fingerprinting (JA3 hash)
 * - Behavioral fingerprinting (request patterns, timing)
 * - Threat scoring and bot detection
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FingerprintData {
  // Network
  ipAddress: string;
  asn?: string;
  country?: string;
  isp?: string;

  // HTTP
  userAgent: string;
  acceptHeaders?: string;
  acceptLanguage?: string;
  acceptEncoding?: string;

  // TLS
  ja3Hash?: string;
  ja3String?: string;
  tlsVersion?: string;
  cipherSuites?: string;

  // Behavioral
  requestPattern?: RequestPattern;
  screenResolution?: string;
  timezone?: string;
  plugins?: string[];

  // Canvas/WebGL fingerprinting (si disponible del client)
  canvasFingerprint?: string;
  webglFingerprint?: string;
}

export interface RequestPattern {
  requestTimings: number[]; // Timestamps de requests
  requestPaths: string[]; // Accessed paths
  requestOrder: string[]; // Order of requested resources
  avgTimeBetweenRequests: number;
  burstiness: number; // How "bursty" requests are (bot detection)
}

export interface ThreatAnalysis {
  threatScore: number; // 0-100
  isBot: boolean;
  isSuspicious: boolean;
  indicators: string[];
  confidence: number; // 0-1
}

// ============================================================================
// JA3 FINGERPRINTING (TLS/SSL)
// ============================================================================

/**
 * Generates JA3 fingerprint from TLS handshake
 * JA3 = MD5(SSLVersion,Ciphers,Extensions,EllipticCurves,EllipticCurvePointFormats)
 * 
 * Note: In Node.js/Express we do not have direct access to the TLS handshake
 * This function is a placeholder for when integrated with reverse proxy (nginx/caddy)
 * which can pass the JA3 as a custom header
 */
export function generateJA3Hash(ja3String: string): string {
  return crypto.createHash('md5').update(ja3String).digest('hex');
}

/**
 * Extracts JA3 from headers if provided by the proxy
 * Requires configuration in nginx/caddy to pass the JA3
 */
export function extractJA3FromHeaders(request: Request): { ja3Hash?: string; ja3String?: string } {
  const ja3Hash = request.headers.get('x-ja3-hash');
  const ja3String = request.headers.get('x-ja3-string');

  return {
    ja3Hash: ja3Hash || undefined,
    ja3String: ja3String || undefined,
  };
}

// ============================================================================
// HTTP FINGERPRINTING
// ============================================================================

/**
 * Extrae fingerprint HTTP completo del request
 */
export function extractHTTPFingerprint(request: Request): Partial<FingerprintData> {
  return {
    userAgent: request.headers.get('user-agent') || 'unknown',
    acceptHeaders: request.headers.get('accept') || undefined,
    acceptLanguage: request.headers.get('accept-language') || undefined,
    acceptEncoding: request.headers.get('accept-encoding') || undefined,
  };
}

/**
 * Analiza User-Agent para detectar bots y herramientas de ataque
 */
export function analyzeUserAgent(userAgent: string): {
  isBot: boolean;
  isScanner: boolean;
  tool?: string;
  indicators: string[];
} {
  const indicators: string[] = [];
  let isBot = false;
  let isScanner = false;
  let tool: string | undefined;

  const ua = userAgent.toLowerCase();

  // Bots conocidos
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget',
    'python-requests', 'go-http-client', 'java/', 'okhttp'
  ];

  for (const pattern of botPatterns) {
    if (ua.includes(pattern)) {
      isBot = true;
      indicators.push(`bot_pattern_${pattern}`);
      tool = pattern;
      break;
    }
  }

  // Herramientas de scanning/pentesting
  const scannerPatterns = [
    'nmap', 'masscan', 'nikto', 'sqlmap', 'burp', 'zap',
    'metasploit', 'nessus', 'acunetix', 'w3af', 'wpscan'
  ];

  for (const pattern of scannerPatterns) {
    if (ua.includes(pattern)) {
      isScanner = true;
      indicators.push(`scanner_${pattern}`);
      tool = pattern;
      break;
    }
  }

  // User-Agent empty or very short (suspicious)
  if (!userAgent || userAgent.length < 10) {
    indicators.push('suspicious_ua_length');
  }

  // User-Agent with unusual characters
  if (/[<>{}\\|^`]/.test(userAgent)) {
    indicators.push('suspicious_ua_chars');
  }

  return { isBot, isScanner, tool, indicators };
}

// ============================================================================
// NETWORK FINGERPRINTING
// ============================================================================

/**
 * Retrieves geolocation information from the IP
 * Uses free services like ip-api.com or ipinfo.io
 */
export async function getIPGeolocation(ipAddress: string): Promise<{
  country?: string;
  isp?: string;
  asn?: string;
  reputation?: string;
}> {
  // Skip para IPs locales
  if (ipAddress === 'dev-ip' || ipAddress.startsWith('127.') || ipAddress.startsWith('192.168.')) {
    return {};
  }

  try {
    // Usar ip-api.com (gratuito, 45 req/min)
    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=country,isp,as,status`);

    if (!response.ok) {
      console.warn('[FINGERPRINT] IP geolocation API error:', response.status);
      return {};
    }

    const data = await response.json();

    if (data.status === 'fail') {
      console.warn('[FINGERPRINT] IP geolocation failed:', data.message);
      return {};
    }

    return {
      country: data.country,
      isp: data.isp,
      asn: data.as,
    };
  } catch (error) {
    console.error('[FINGERPRINT] Error fetching IP geolocation:', error);
    return {};
  }
}

/** Checks IP reputation against known blacklists */
export async function checkIPReputation(ipAddress: string): Promise<'clean' | 'suspicious' | 'malicious'> {
  // Skip para IPs locales
  if (ipAddress === 'dev-ip' || ipAddress.startsWith('127.') || ipAddress.startsWith('192.168.')) {
    return 'clean';
  }

  try {
    // Here you could integrate with services like:
    // - AbuseIPDB (requiere API key)
    // - IPVoid
    // - Spamhaus
    // Por ahora, retornamos 'clean' por defecto

    // TODO: Implement integration with AbuseIPDB or similar

    return 'clean';
  } catch (error) {
    console.error('[FINGERPRINT] Error checking IP reputation:', error);
    return 'clean';
  }
}

// ============================================================================
// BEHAVIORAL FINGERPRINTING
// ============================================================================

/**
 * Analiza patrones de requests para detectar comportamiento automatizado
 */
export function analyzeRequestPattern(pattern: RequestPattern): {
  isBot: boolean;
  confidence: number;
  indicators: string[];
} {
  const indicators: string[] = [];
  let botScore = 0;

  // 1. Timing analysis
  if (pattern.avgTimeBetweenRequests < 100) {
    // Very fast requests (< 100ms) are probably automated
    indicators.push('very_fast_requests');
    botScore += 30;
  }

  // 2. Burstiness analysis
  if (pattern.burstiness > 0.8) {
    // Very "bursty" requests (all together) are typical of bots
    indicators.push('high_burstiness');
    botScore += 25;
  }

  // 3. Request order analysis
  // Humans rarely load resources in perfect alphabetical order
  const isAlphabetical = isArrayAlphabetical(pattern.requestPaths);
  if (isAlphabetical) {
    indicators.push('alphabetical_order');
    botScore += 20;
  }

  // 4. Missing typical browser behavior
  const hasTypicalBehavior = pattern.requestPaths.some(p =>
    p.includes('favicon') || p.includes('.css') || p.includes('.js')
  );

  if (!hasTypicalBehavior && pattern.requestPaths.length > 3) {
    indicators.push('missing_browser_behavior');
    botScore += 15;
  }

  // 5. Sequential scanning pattern
  const isSequential = isSequentialPattern(pattern.requestPaths);
  if (isSequential) {
    indicators.push('sequential_scanning');
    botScore += 25;
  }

  const confidence = Math.min(botScore / 100, 1);
  const isBot = botScore > 50;

  return { isBot, confidence, indicators };
}

function isArrayAlphabetical(arr: string[]): boolean {
  if (arr.length < 3) return false;

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[i - 1]) {
      return false;
    }
  }

  return true;
}

function isSequentialPattern(paths: string[]): boolean {
  // Detecta patrones como /api/1, /api/2, /api/3...
  const numbers = paths.map(p => {
    const match = p.match(/\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }).filter(n => n !== null) as number[];

  if (numbers.length < 3) return false;

  // Check if sequential
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] !== numbers[i - 1] + 1) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// THREAT SCORING
// ============================================================================

/** Calculates threat score based on multiple signals */
export function calculateThreatScore(data: {
  userAgentAnalysis: ReturnType<typeof analyzeUserAgent>;
  behaviorAnalysis: ReturnType<typeof analyzeRequestPattern>;
  ipReputation: string;
  ja3Hash?: string;
  knownBadJA3s?: string[];
}): ThreatAnalysis {
  let threatScore = 0;
  const indicators: string[] = [];

  // 1. User-Agent analysis (0-30 points)
  if (data.userAgentAnalysis.isScanner) {
    threatScore += 30;
    indicators.push('scanner_detected');
  } else if (data.userAgentAnalysis.isBot) {
    threatScore += 15;
    indicators.push('bot_detected');
  }

  indicators.push(...data.userAgentAnalysis.indicators);

  // 2. Behavioral analysis (0-40 points)
  if (data.behaviorAnalysis.isBot) {
    threatScore += 40 * data.behaviorAnalysis.confidence;
    indicators.push('automated_behavior');
  }

  indicators.push(...data.behaviorAnalysis.indicators);

  // 3. IP reputation (0-30 points)
  if (data.ipReputation === 'malicious') {
    threatScore += 30;
    indicators.push('malicious_ip');
  } else if (data.ipReputation === 'suspicious') {
    threatScore += 15;
    indicators.push('suspicious_ip');
  }

  // 4. JA3 fingerprint (0-20 points)
  if (data.ja3Hash && data.knownBadJA3s?.includes(data.ja3Hash)) {
    threatScore += 20;
    indicators.push('malicious_ja3');
  }

  // Normalize to 0-100
  threatScore = Math.min(threatScore, 100);

  const isBot = data.userAgentAnalysis.isBot || data.behaviorAnalysis.isBot;
  const isSuspicious = threatScore > 30;
  const confidence = indicators.length / 10; // More indicators = higher confidence

  return {
    threatScore,
    isBot,
    isSuspicious,
    indicators,
    confidence: Math.min(confidence, 1),
  };
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/** Creates or updates fingerprint in the database */
export async function upsertFingerprint(
  data: FingerprintData,
  threatAnalysis: ThreatAnalysis
) {
  // Generate unique ID based on multiple signals
  const _fingerprintId = generateFingerprintId(data);

  try {
    // Buscar fingerprint existente
    const existing = await prisma.clientFingerprint.findFirst({
      where: {
        OR: [
          { ipAddress: data.ipAddress },
          data.ja3Hash ? { ja3Hash: data.ja3Hash } : {},
        ].filter(obj => Object.keys(obj).length > 0),
      },
    });

    if (existing) {
      // Update existente
      return await prisma.clientFingerprint.update({
        where: { id: existing.id },
        data: {
          lastSeen: new Date(),
          requestCount: { increment: 1 },
          threatScore: threatAnalysis.threatScore,
          isBot: threatAnalysis.isBot,
          isSuspicious: threatAnalysis.isSuspicious,

          // Update datos si cambiaron
          userAgent: data.userAgent,
          acceptHeaders: data.acceptHeaders,
          acceptLanguage: data.acceptLanguage,
          acceptEncoding: data.acceptEncoding,
          ja3Hash: data.ja3Hash,
          ja3String: data.ja3String,
          tlsVersion: data.tlsVersion,
          cipherSuites: data.cipherSuites,
          requestPattern: data.requestPattern as any,
          screenResolution: data.screenResolution,
          timezone: data.timezone,
          plugins: data.plugins,
        },
      });
    } else {
      // Create nuevo
      return await prisma.clientFingerprint.create({
        data: {
          id: nanoid(),
          ipAddress: data.ipAddress,
          ipReputation: null, // Will be updated with checkIPReputation
          asn: data.asn,
          country: data.country,
          isp: data.isp,

          userAgent: data.userAgent,
          acceptHeaders: data.acceptHeaders,
          acceptLanguage: data.acceptLanguage,
          acceptEncoding: data.acceptEncoding,

          ja3Hash: data.ja3Hash,
          ja3String: data.ja3String,
          tlsVersion: data.tlsVersion,
          cipherSuites: data.cipherSuites,

          requestPattern: data.requestPattern as any,
          screenResolution: data.screenResolution,
          timezone: data.timezone,
          plugins: data.plugins,

          threatScore: threatAnalysis.threatScore,
          isBot: threatAnalysis.isBot,
          isSuspicious: threatAnalysis.isSuspicious,
          isBlocked: threatAnalysis.threatScore > 80, // Auto-block high threat
        },
      });
    }
  } catch (error) {
    console.error('[FINGERPRINT] Error upserting fingerprint:', error);
    throw error;
  }
}

function generateFingerprintId(data: FingerprintData): string {
  const components = [
    data.ipAddress,
    data.userAgent,
    data.ja3Hash || '',
    data.acceptLanguage || '',
  ].join('|');

  return crypto.createHash('sha256').update(components).digest('hex');
}

/**
 * Obtiene fingerprint existente por IP o JA3
 */
export async function getFingerprint(ipAddress: string, ja3Hash?: string) {
  try {
    return await prisma.clientFingerprint.findFirst({
      where: {
        OR: [
          { ipAddress },
          ja3Hash ? { ja3Hash } : {},
        ].filter(obj => Object.keys(obj).length > 0),
      },
      include: {
        ThreatDetection: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        HoneypotHit: {
          select: {
            id: true,
            ipAddress: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  } catch (error) {
    console.error('[FINGERPRINT] Error getting fingerprint:', error);
    return null;
  }
}

/**
 * Bloquea un fingerprint
 */
export async function blockFingerprint(fingerprintId: string, _reason: string) {
  try {
    return await prisma.clientFingerprint.update({
      where: { id: fingerprintId },
      data: {
        isBlocked: true,
        blockedCount: { increment: 1 },
      },
    });
  } catch (error) {
    console.error('[FINGERPRINT] Error blocking fingerprint:', error);
    throw error;
  }
}

// ============================================================================
// MAIN FINGERPRINTING FUNCTION
// ============================================================================

/**
 * Main fingerprinting function
 * Analyzes the request and returns complete fingerprint with threat analysis
 */
export async function fingerprintRequest(
  request: Request,
  options: {
    includeGeolocation?: boolean;
    includeReputation?: boolean;
    requestPattern?: RequestPattern;
  } = {}
): Promise<{
  fingerprint: FingerprintData;
  threatAnalysis: ThreatAnalysis;
  dbRecord: any;
}> {
  // 1. Extract basic fingerprint
  const ipAddress = getClientIp(request);
  const httpFingerprint = extractHTTPFingerprint(request);
  const ja3Data = extractJA3FromHeaders(request);

  // 2. Geolocation (opcional, puede ser lento)
  let geoData = {};
  if (options.includeGeolocation) {
    geoData = await getIPGeolocation(ipAddress);
  }

  // 3. Reputation check (opcional, puede ser lento)
  let reputation: string = 'clean';
  if (options.includeReputation) {
    reputation = await checkIPReputation(ipAddress);
  }

  // 4. Build complete fingerprint
  const fingerprint: FingerprintData = {
    ipAddress,
    userAgent: httpFingerprint.userAgent || 'unknown',
    acceptHeaders: httpFingerprint.acceptHeaders,
    acceptLanguage: httpFingerprint.acceptLanguage,
    acceptEncoding: httpFingerprint.acceptEncoding,
    ...ja3Data,
    ...geoData,
    requestPattern: options.requestPattern,
  };

  // 5. Analyze for threats
  const userAgentAnalysis = analyzeUserAgent(fingerprint.userAgent);

  let behaviorAnalysis = {
    isBot: false,
    confidence: 0,
    indicators: [] as string[],
  };

  if (options.requestPattern) {
    behaviorAnalysis = analyzeRequestPattern(options.requestPattern);
  }

  const threatAnalysis = calculateThreatScore({
    userAgentAnalysis,
    behaviorAnalysis,
    ipReputation: reputation,
    ja3Hash: fingerprint.ja3Hash,
  });

  // 6. Upsert to database
  const dbRecord = await upsertFingerprint(fingerprint, threatAnalysis);

  return {
    fingerprint,
    threatAnalysis,
    dbRecord,
  };
}

// Helper function
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
