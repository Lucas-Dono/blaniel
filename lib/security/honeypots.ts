/**
 * Honeypot System
 *
 * Trap endpoints that look real but are designed to detect attackers
 *
 * Types of honeypots:
 * - Fake admin panels (/admin, /wp-admin, /phpmyadmin)
 * - Fake APIs (/api/internal, /api/debug, /api/users/all)
 * - Configuration files (/config.php, /.env, /database.yml)
 * - Fake upload endpoints
 * - Weak authentication endpoints
 */

import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import { fingerprintRequest } from './fingerprinting';
import { detectScanningTools } from './threat-detection';

const prisma = new PrismaClient();

// ============================================================================
// HONEYPOT CONFIGURATION
// ============================================================================

export interface HoneypotConfig {
  path: string;
  name: string;
  type: string;
  description: string;
  fakeResponse: any;
  shouldTarpit: boolean;
  tarpitDelay: number; // ms
  autoBlock: boolean;
}

/**
 * Predefined honeypot configurations
 */
export const HONEYPOT_CONFIGS: HoneypotConfig[] = [
  // Admin panels
  {
    path: '/admin',
    name: 'Fake Admin Panel',
    type: 'fake_admin',
    description: 'Fake admin panel to detect directory scans',
    fakeResponse: {
      title: 'Admin Login',
      message: 'Please enter your credentials',
      version: '1.0.0',
    },
    shouldTarpit: true,
    tarpitDelay: 5000,
    autoBlock: false,
  },
  {
    path: '/wp-admin',
    name: 'Fake WordPress Admin',
    type: 'fake_admin',
    description: 'Fake WordPress admin (app does not use WordPress)',
    fakeResponse: {
      message: 'WordPress Login',
      redirect_to: '/wp-admin/admin.php',
    },
    shouldTarpit: true,
    tarpitDelay: 8000,
    autoBlock: true, // High confidence attack
  },
  {
    path: '/phpmyadmin',
    name: 'Fake PHPMyAdmin',
    type: 'fake_database',
    description: 'Fake PHPMyAdmin',
    fakeResponse: {
      phpMyAdmin: '4.9.0.1',
      serverVersion: '5.7.28',
    },
    shouldTarpit: true,
    tarpitDelay: 10000,
    autoBlock: true,
  },

  // Fake internal APIs
  {
    path: '/api/internal/users',
    name: 'Fake Internal API',
    type: 'fake_api',
    description: 'Fake internal API with user data',
    fakeResponse: {
      users: [
        {
          id: 'fake-user-1',
          email: 'admin@example.com',
          apiKey: 'fake-key-12345',
          role: 'admin',
        },
        {
          id: 'fake-user-2',
          email: 'developer@example.com',
          apiKey: 'fake-key-67890',
          role: 'developer',
        },
      ],
      total: 2,
    },
    shouldTarpit: true,
    tarpitDelay: 3000,
    autoBlock: true,
  },
  {
    path: '/api/debug',
    name: 'Fake Debug Endpoint',
    type: 'fake_api',
    description: 'Fake debug endpoint with sensitive information',
    fakeResponse: {
      environment: 'production',
      database: {
        host: 'fake-db.example.com',
        username: 'root',
        password: 'fake-password-123',
      },
      secrets: {
        jwtSecret: 'fake-secret-key',
        apiKey: 'fake-api-key',
      },
    },
    shouldTarpit: true,
    tarpitDelay: 2000,
    autoBlock: true,
  },
  {
    path: '/api/v1/admin/export',
    name: 'Fake Data Export',
    type: 'fake_api',
    description: 'Fake export endpoint',
    fakeResponse: {
      status: 'processing',
      exportId: 'fake-export-123',
      downloadUrl: '/downloads/export-fake-123.zip',
    },
    shouldTarpit: true,
    tarpitDelay: 5000,
    autoBlock: false,
  },

  // Configuration files
  {
    path: '/.env',
    name: 'Fake Environment File',
    type: 'fake_config',
    description: 'Fake .env file',
    fakeResponse: `DATABASE_URL=postgresql://admin:fake-password@db.example.com:5432/mydb
NEXTAUTH_SECRET=fake-secret-key-12345
API_KEY=fake-api-key-67890
STRIPE_SECRET_KEY=sk_test_fake123456789`,
    shouldTarpit: true,
    tarpitDelay: 1000,
    autoBlock: true,
  },
  {
    path: '/config.json',
    name: 'Fake Config JSON',
    type: 'fake_config',
    description: 'Fake JSON configuration file',
    fakeResponse: {
      database: {
        host: 'localhost',
        user: 'admin',
        password: 'fake-db-password',
      },
      api: {
        key: 'fake-api-key',
        secret: 'fake-api-secret',
      },
    },
    shouldTarpit: true,
    tarpitDelay: 2000,
    autoBlock: true,
  },
  {
    path: '/.git/config',
    name: 'Fake Git Config',
    type: 'fake_config',
    description: 'Fake Git config',
    fakeResponse: `[core]
  repositoryformatversion = 0
  filemode = true
[remote "origin"]
  url = https://github.com/fake/repo.git
  fetch = +refs/heads/*:refs/remotes/origin/*
[user]
  email = admin@example.com`,
    shouldTarpit: true,
    tarpitDelay: 1000,
    autoBlock: true,
  },

  // Upload endpoints
  {
    path: '/api/upload/unrestricted',
    name: 'Fake Unrestricted Upload',
    type: 'fake_upload',
    description: 'Fake unrestricted upload endpoint',
    fakeResponse: {
      success: true,
      fileUrl: 'https://cdn.example.com/uploads/fake-file.php',
      message: 'File uploaded successfully',
    },
    shouldTarpit: true,
    tarpitDelay: 4000,
    autoBlock: true,
  },

  // Weak authentication endpoints
  {
    path: '/api/auth/test',
    name: 'Fake Test Auth',
    type: 'fake_auth',
    description: 'Fake test authentication endpoint',
    fakeResponse: {
      token: 'fake-jwt-token-12345',
      user: {
        id: 'test-user',
        email: 'test@example.com',
        role: 'admin',
      },
    },
    shouldTarpit: true,
    tarpitDelay: 3000,
    autoBlock: false,
  },
];

// ============================================================================
// HONEYPOT HIT LOGGING
// ============================================================================

/**
 * Logs a hit to a honeypot
 */
export async function logHoneypotHit(
  request: Request,
  config: HoneypotConfig,
  fingerprintId?: string
): Promise<void> {
  try {
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const url = new URL(request.url);

    // Detect scanning tools
    const scanningTools = detectScanningTools(userAgent, request.headers);
    const isAutomated = scanningTools.length > 0 || isLikelyBot(userAgent);

    // Extract relevant headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Extract query and payload
    const query = url.search;
    let payload: string | undefined;

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const body = await request.clone().text();
        payload = body.substring(0, 10000); // Limit size
      } catch {
        // Ignore if body is already consumed
      }
    }

    await prisma.honeypotHit.create({
      data: {
        id: nanoid(),
        fingerprintId: fingerprintId || null,
        honeypotType: config.type,
        honeypotPath: config.path,
        honeypotName: config.name,
        method: request.method,
        query: query || null,
        payload: payload || null,
        headers,
        ipAddress,
        userAgent,
        isAutomated,
        scanningTools,
        fakeData: config.fakeResponse,
        tarpitDelay: config.shouldTarpit ? config.tarpitDelay : 0,
      },
    });

    // Increment honeypot hit counter in fingerprint
    if (fingerprintId) {
      await prisma.clientFingerprint.update({
        where: { id: fingerprintId },
        data: {
          honeypotHits: { increment: 1 },
        },
      });
    }

    console.log(`[HONEYPOT] Hit detected: ${config.name} from ${ipAddress}`);
  } catch (error) {
    console.error('[HONEYPOT] Error logging honeypot hit:', error);
  }
}

// ============================================================================
// HONEYPOT RESPONSE GENERATION
// ============================================================================

/**
 * Generates a honeypot response with optional tarpit
 */
export async function generateHoneypotResponse(
  request: Request,
  config: HoneypotConfig,
  options: {
    fingerprintId?: string;
    shouldBlock?: boolean;
  } = {}
): Promise<Response> {
  // Log the hit
  await logHoneypotHit(request, config, options.fingerprintId);

  // If should block, return 403
  if (options.shouldBlock || config.autoBlock) {
    return new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Access denied',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Apply tarpit if configured
  if (config.shouldTarpit) {
    await sleep(config.tarpitDelay);
  }

  // Determine content type
  const isTextResponse = typeof config.fakeResponse === 'string';
  const contentType = isTextResponse ? 'text/plain' : 'application/json';

  // Return fake response
  return new Response(
    isTextResponse
      ? config.fakeResponse
      : JSON.stringify(config.fakeResponse, null, 2),
    {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Powered-By': 'PHP/7.4.3', // Fake header to make more convincing
        'Server': 'Apache/2.4.41', // Fake server header
      },
    }
  );
}

// ============================================================================
// HONEYPOT ROUTE HANDLER
// ============================================================================

/**
 * Main handler for honeypot routes
 */
export async function handleHoneypotRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Search for matching honeypot configuration
  const config = HONEYPOT_CONFIGS.find(h => h.path === pathname);

  if (!config) {
    return null; // Not a honeypot
  }

  console.log(`[HONEYPOT] Request to honeypot: ${pathname}`);

  // Client fingerprint
  let fingerprintId: string | undefined;
  try {
    const { dbRecord } = await fingerprintRequest(request, {
      includeGeolocation: false, // Skip for honeypots (performance)
      includeReputation: false,
    });
    fingerprintId = dbRecord.id;
  } catch (error) {
    console.error('[HONEYPOT] Error fingerprinting request:', error);
  }

  // Generate response
  return generateHoneypotResponse(request, config, {
    fingerprintId,
    shouldBlock: false, // Let config.autoBlock decide
  });
}

// ============================================================================
// DYNAMIC HONEYPOTS
// ============================================================================

/**
 * Creates a custom dynamic honeypot
 */
export function createDynamicHoneypot(config: HoneypotConfig): void {
  HONEYPOT_CONFIGS.push(config);
  console.log(`[HONEYPOT] Dynamic honeypot created: ${config.path}`);
}

/**
 * Generates honeypots based on commonly scanned paths
 */
export function generateCommonHoneypots(): HoneypotConfig[] {
  const commonPaths = [
    '/api/v1/users',
    '/api/admin',
    '/backup',
    '/backup.sql',
    '/db.sql',
    '/dump.sql',
    '/database.sql',
    '/config.php',
    '/settings.php',
    '/admin.php',
    '/test.php',
    '/shell.php',
    '/upload.php',
    '/login.php',
    '/administrator',
    '/manager',
    '/webdav',
    '/.svn',
    '/.hg',
    '/api/keys',
    '/api/secrets',
  ];

  return commonPaths.map(path => ({
    path,
    name: `Dynamic Honeypot: ${path}`,
    type: 'fake_api',
    description: `Auto-generated honeypot for ${path}`,
    fakeResponse: {
      error: 'Not found',
      path,
    },
    shouldTarpit: true,
    tarpitDelay: 3000,
    autoBlock: true,
  }));
}

// ============================================================================
// HONEYPOT STATISTICS
// ============================================================================

/**
 * Gets honeypot statistics
 */
export async function getHoneypotStats(timeRange: {
  from: Date;
  to: Date;
}): Promise<{
  totalHits: number;
  hitsByType: Record<string, number>;
  hitsByHoneypot: Record<string, number>;
  uniqueIPs: number;
  automatedHits: number;
  topAttackers: Array<{ ipAddress: string; hits: number }>;
}> {
  try {
    const hits = await prisma.honeypotHit.findMany({
      where: {
        createdAt: {
          gte: timeRange.from,
          lte: timeRange.to,
        },
      },
      select: {
        honeypotType: true,
        honeypotName: true,
        ipAddress: true,
        isAutomated: true,
      },
    });

    const hitsByType: Record<string, number> = {};
    const hitsByHoneypot: Record<string, number> = {};
    const ips = new Set<string>();
    let automatedHits = 0;
    const attackerCounts: Record<string, number> = {};

    for (const hit of hits) {
      // By type
      hitsByType[hit.honeypotType] = (hitsByType[hit.honeypotType] || 0) + 1;

      // By honeypot
      hitsByHoneypot[hit.honeypotName] = (hitsByHoneypot[hit.honeypotName] || 0) + 1;

      // Unique IPs
      ips.add(hit.ipAddress);

      // Automated hits
      if (hit.isAutomated) {
        automatedHits++;
      }

      // Attacker counts
      attackerCounts[hit.ipAddress] = (attackerCounts[hit.ipAddress] || 0) + 1;
    }

    const topAttackers = Object.entries(attackerCounts)
      .map(([ipAddress, hits]) => ({ ipAddress, hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    return {
      totalHits: hits.length,
      hitsByType,
      hitsByHoneypot,
      uniqueIPs: ips.size,
      automatedHits,
      topAttackers,
    };
  } catch (error) {
    console.error('[HONEYPOT] Error getting stats:', error);
    throw error;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

function isLikelyBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget',
    'python', 'go-http', 'java/', 'okhttp'
  ];

  return botPatterns.some(pattern => ua.includes(pattern));
}
