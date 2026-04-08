/**
 * Canary Tokens System
 *
 * Trap tokens placed strategically in sensitive data to detect:
 * - Data exfiltration
 * - Unauthorized database access
 * - Data scraping
 * - Data leaks
 *
 * Types of canary tokens:
 * - Fake API keys
 * - Trap emails
 * - Trap URLs
 * - Fake authentication tokens
 * - Trap database queries
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { sendAlert } from './alerting';

const prisma = new PrismaClient();

// ============================================================================
// TYPES
// ============================================================================

export type CanaryTokenType =
  | 'api_key'
  | 'email'
  | 'phone'
  | 'url'
  | 'auth_token'
  | 'database_query'
  | 'file_path'
  | 'credit_card'
  | 'ssh_key';

export interface CanaryTokenConfig {
  type: CanaryTokenType;
  description: string;
  placedIn: string;
  dataContext: any;
  alertEmails: string[];
  alertWebhook?: string;
}

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generates a convincing canary token according to type
 */
export function generateCanaryToken(type: CanaryTokenType): string {
  switch (type) {
    case 'api_key':
      // Format similar to real keys: sk_live_...
      return `sk_live_${generateRandomString(32)}`;

    case 'email':
      // Email that looks legitimate
      return `admin.${generateRandomString(8)}@example.com`;

    case 'phone':
      // Fake but valid phone number
      return `+1-555-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;

    case 'url':
      // Trap URL
      const token = generateRandomString(16);
      return `https://canary.example.com/t/${token}`;

    case 'auth_token':
      // JWT-like token
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(JSON.stringify({ sub: 'canary', exp: 9999999999 })).toString('base64');
      const signature = generateRandomString(43);
      return `${header}.${payload}.${signature}`;

    case 'database_query':
      // SQL query that looks sensitive
      return `SELECT * FROM users WHERE role='admin' AND password='${generateRandomString(12)}'`;

    case 'file_path':
      // Path that looks sensitive
      return `/var/backups/database_backup_${generateRandomString(8)}.sql`;

    case 'credit_card':
      // Credit card number that passes Luhn validation but is fake
      return generateFakeCreditCard();

    case 'ssh_key':
      // Fake SSH key
      return `ssh-rsa ${generateRandomString(64)} canary@trap`;

    default:
      return generateRandomString(32);
  }
}

function generateRandomString(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

function generateFakeCreditCard(): string {
  // Generates a number that passes Luhn algorithm but is fake
  // Prefix 4111 1111 1111 (Visa test card range)
  const base = '4111111111111';
  let sum = 0;
  let isEven = false;

  for (let i = base.length - 1; i >= 0; i--) {
    let digit = parseInt(base[i]);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return `${base}${checkDigit}`;
}

// ============================================================================
// CANARY TOKEN CREATION
// ============================================================================

/**
 * Creates a new canary token in the database
 */
export async function createCanaryToken(config: CanaryTokenConfig): Promise<{
  id: string;
  tokenValue: string;
  tokenHash: string;
}> {
  try {
    const tokenValue = generateCanaryToken(config.type);
    const tokenHash = hashToken(tokenValue);

    const canaryToken = await prisma.canaryToken.create({
      data: {
        id: nanoid(),
        tokenType: config.type,
        tokenValue,
        tokenHash,
        description: config.description,
        placedIn: config.placedIn,
        dataContext: config.dataContext,
        alertEmails: config.alertEmails,
        alertWebhook: config.alertWebhook,
        isActive: true,
        triggered: false,
        triggerCount: 0,
        updatedAt: new Date(),
      },
    });

    console.log(`[CANARY] Created ${config.type} token: ${tokenValue.substring(0, 10)}...`);

    return {
      id: canaryToken.id,
      tokenValue,
      tokenHash,
    };
  } catch (error) {
    console.error('[CANARY] Error creating token:', error);
    throw error;
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ============================================================================
// TOKEN DETECTION & TRIGGERING
// ============================================================================

/**
 * Checks if a value is a canary token and activates it if so
 */
export async function checkAndTriggerCanaryToken(
  value: string,
  context: {
    triggeredBy: string;
    ipAddress: string;
    userAgent: string;
    requestPath?: string;
    requestMethod?: string;
    headers?: Record<string, string>;
    contextData?: any;
  }
): Promise<boolean> {
  try {
    const tokenHash = hashToken(value);

    // Search for the token
    const canaryToken = await prisma.canaryToken.findUnique({
      where: { tokenHash },
    });

    if (!canaryToken) {
      return false; // Not a canary token
    }

    if (!canaryToken.isActive) {
      console.log('[CANARY] Token found but is inactive');
      return false;
    }

    console.log(`[CANARY] CANARY TOKEN TRIGGERED: ${canaryToken.tokenType} - ${canaryToken.description}`);

    // Record the trigger
    await prisma.canaryTokenTrigger.create({
      data: {
        id: nanoid(),
        canaryTokenId: canaryToken.id,
        triggeredBy: context.triggeredBy,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestPath: context.requestPath,
        requestMethod: context.requestMethod,
        headers: context.headers || {},
        contextData: context.contextData,
        fingerprint: null, // TODO: Get fingerprint if available
        alertSent: false,
      },
    });

    // Update counter
    await prisma.canaryToken.update({
      where: { id: canaryToken.id },
      data: {
        triggered: true,
        triggerCount: { increment: 1 },
        lastTriggered: new Date(),
      },
    });

    // Send alerts
    await sendCanaryAlert(canaryToken, context);

    return true;
  } catch (error) {
    console.error('[CANARY] Error checking token:', error);
    return false;
  }
}

/**
 * Middleware for checking canary tokens in requests
 */
export async function canaryTokenMiddleware(request: Request): Promise<boolean> {
  try {
    const url = new URL(request.url);
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Extract headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // 1. Check authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const triggered = await checkAndTriggerCanaryToken(token, {
        triggeredBy: 'authorization_header',
        ipAddress,
        userAgent,
        requestPath: url.pathname,
        requestMethod: request.method,
        headers,
      });

      if (triggered) return true;
    }

    // 2. Check API key in headers
    const apiKey = request.headers.get('x-api-key') || request.headers.get('api-key');
    if (apiKey) {
      const triggered = await checkAndTriggerCanaryToken(apiKey, {
        triggeredBy: 'api_key_header',
        ipAddress,
        userAgent,
        requestPath: url.pathname,
        requestMethod: request.method,
        headers,
      });

      if (triggered) return true;
    }

    // 3. Check query parameters
    for (const [key, value] of url.searchParams.entries()) {
      if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key') || key.toLowerCase().includes('api')) {
        const triggered = await checkAndTriggerCanaryToken(value, {
          triggeredBy: `query_param_${key}`,
          ipAddress,
          userAgent,
          requestPath: url.pathname,
          requestMethod: request.method,
          headers,
        });

        if (triggered) return true;
      }
    }

    // 4. Check body (only for POST/PUT/PATCH)
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        const bodyText = await request.clone().text();

        // Only check if body has reasonable size (< 1MB)
        if (bodyText.length < 1024 * 1024) {
          // Search for token patterns in body
          const tokenPatterns = [
            /sk_live_[a-zA-Z0-9]{32}/g,
            /sk_test_[a-zA-Z0-9]{32}/g,
            /Bearer\s+([a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+)/g,
          ];

          for (const pattern of tokenPatterns) {
            const matches = bodyText.match(pattern);
            if (matches) {
              for (const match of matches) {
                const token = match.replace(/^Bearer\s+/i, '');
                const triggered = await checkAndTriggerCanaryToken(token, {
                  triggeredBy: 'request_body',
                  ipAddress,
                  userAgent,
                  requestPath: url.pathname,
                  requestMethod: request.method,
                  headers,
                  contextData: { bodySnippet: bodyText.substring(0, 500) },
                });

                if (triggered) return true;
              }
            }
          }
        }
      } catch {
        // Ignore body parsing errors
      }
    }

    return false;
  } catch (error) {
    console.error('[CANARY] Error in middleware:', error);
    return false;
  }
}

// ============================================================================
// ALERTING
// ============================================================================

/**
 * Sends alerts when a canary token is triggered
 */
async function sendCanaryAlert(
  token: any,
  context: {
    triggeredBy: string;
    ipAddress: string;
    userAgent: string;
    requestPath?: string;
  }
): Promise<void> {
  try {
    const alertMessage = {
      severity: 'critical',
      title: `Canary Token Triggered: ${token.tokenType}`,
      description: `
A canary token has been triggered, indicating potential security breach!

Token Type: ${token.tokenType}
Description: ${token.description}
Placed In: ${token.placedIn}
Triggered By: ${context.triggeredBy}

Attacker Details:
- IP Address: ${context.ipAddress}
- User Agent: ${context.userAgent}
- Request Path: ${context.requestPath || 'N/A'}

This indicates that someone has accessed and potentially exfiltrated sensitive data.
Immediate action required!
      `.trim(),
      timestamp: new Date().toISOString(),
      actionable: true,
    };

    // Send to alert system
    await sendAlert({
      type: 'canary',
      severity: 'critical',
      title: alertMessage.title,
      description: alertMessage.description,
      channels: {
        email: token.alertEmails,
        webhook: token.alertWebhook,
        dashboard: true,
      },
    });

    console.log('[CANARY] Alert sent successfully');
  } catch (error) {
    console.error('[CANARY] Error sending alert:', error);

    // Log error but don't throw to avoid interrupting flow
    await prisma.canaryTokenTrigger.updateMany({
      where: {
        canaryTokenId: token.id,
        alertSent: false,
      },
      data: {
        alertError: String(error),
      },
    });
  }
}

// ============================================================================
// PRE-CONFIGURED CANARY TOKENS
// ============================================================================

/**
 * Creates default set of canary tokens for the application
 */
export async function setupDefaultCanaryTokens(): Promise<void> {
  const defaultTokens: CanaryTokenConfig[] = [
    {
      type: 'api_key',
      description: 'Fake Stripe API key in codebase comments',
      placedIn: 'Source code comments',
      dataContext: { location: 'lib/payment.ts' },
      alertEmails: ['security@example.com'],
    },
    {
      type: 'auth_token',
      description: 'Fake JWT token in database backup file',
      placedIn: 'Database backup documentation',
      dataContext: { location: 'docs/backup.md' },
      alertEmails: ['security@example.com'],
    },
    {
      type: 'email',
      description: 'Fake admin email in user list endpoint',
      placedIn: 'API response (fake data)',
      dataContext: { endpoint: '/api/internal/users' },
      alertEmails: ['security@example.com'],
    },
    {
      type: 'database_query',
      description: 'Suspicious SQL query in logs',
      placedIn: 'Application logs',
      dataContext: { location: 'logs/app.log' },
      alertEmails: ['security@example.com'],
    },
  ];

  for (const config of defaultTokens) {
    try {
      // Check if it already exists
      const existing = await prisma.canaryToken.findFirst({
        where: {
          description: config.description,
        },
      });

      if (!existing) {
        await createCanaryToken(config);
        console.log(`[CANARY] Created default token: ${config.description}`);
      }
    } catch (error) {
      console.error(`[CANARY] Error creating default token:`, error);
    }
  }
}

// ============================================================================
// CANARY TOKEN MANAGEMENT
// ============================================================================

/**
 * Lists all canary tokens
 */
export async function listCanaryTokens(): Promise<any[]> {
  try {
    return await prisma.canaryToken.findMany({
      include: {
        CanaryTokenTrigger: {
          orderBy: { triggeredAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('[CANARY] Error listing tokens:', error);
    throw error;
  }
}

/**
 * Deactivates a canary token
 */
export async function deactivateCanaryToken(tokenId: string): Promise<void> {
  try {
    await prisma.canaryToken.update({
      where: { id: tokenId },
      data: { isActive: false },
    });

    console.log(`[CANARY] Token ${tokenId} deactivated`);
  } catch (error) {
    console.error('[CANARY] Error deactivating token:', error);
    throw error;
  }
}

/**
 * Gets canary token statistics
 */
export async function getCanaryStats(timeRange: { from: Date; to: Date }) {
  try {
    const triggers = await prisma.canaryTokenTrigger.findMany({
      where: {
        triggeredAt: {
          gte: timeRange.from,
          lte: timeRange.to,
        },
      },
      include: {
        CanaryToken: {
          select: {
            tokenType: true,
            description: true,
          },
        },
      },
    });

    const byType: Record<string, number> = {};
    const uniqueIPs = new Set<string>();

    for (const trigger of triggers) {
      const type = trigger.CanaryToken.tokenType;
      byType[type] = (byType[type] || 0) + 1;
      uniqueIPs.add(trigger.ipAddress);
    }

    return {
      totalTriggers: triggers.length,
      byType,
      uniqueAttackers: uniqueIPs.size,
    };
  } catch (error) {
    console.error('[CANARY] Error getting stats:', error);
    throw error;
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
