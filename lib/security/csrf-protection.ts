/**
 * CSRF Protection (Cross-Site Request Forgery)
 *
 * Validates that requests modifying data come from the correct origin.
 * OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */

import { NextRequest } from 'next/server';

/**
 * Get allowed origins from environment variables
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  // Production URL
  if (process.env.NEXTAUTH_URL) {
    origins.push(process.env.NEXTAUTH_URL);
  }

  // Public app URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }

  // Local development
  origins.push('http://localhost:3000');
  origins.push('http://127.0.0.1:3000');

  // Remove duplicates and normalize (without trailing slash)
  return Array.from(new Set(origins.map(origin => origin.replace(/\/$/, ''))));
}

/**
 * Validate that the Origin header is valid to prevent CSRF
 *
 * For requests that modify state (POST, PUT, PATCH, DELETE),
 * we must verify that the Origin header matches one of our domains.
 *
 * @param req - NextRequest
 * @returns true if origin is valid, false if invalid or suspicious
 *
 * @example
 * // In an API endpoint:
 * export async function PATCH(req: NextRequest) {
 *   if (!validateCSRFOrigin(req)) {
 *     return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
 *   }
 *   // ... rest of code
 * }
 */
export function validateCSRFOrigin(req: NextRequest): boolean {
  const method = req.method?.toUpperCase();

  // Only validate methods that modify state
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return true;
  }

  // Get Origin header
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  // The Origin header should be present in modern requests
  // If not, we try to use Referer as fallback
  const requestOrigin = origin || (referer ? extractOriginFromReferer(referer) : null);

  if (!requestOrigin) {
    console.warn('[CSRF] Request without Origin or Referer header', {
      method,
      url: req.url,
      userAgent: req.headers.get('user-agent')?.substring(0, 50),
    });
    return false;
  }

  // Validate against allowed origins
  const allowedOrigins = getAllowedOrigins();
  const normalizedRequestOrigin = requestOrigin.replace(/\/$/, '');

  const isValid = allowedOrigins.includes(normalizedRequestOrigin);

  if (!isValid) {
    console.warn('[CSRF] Invalid origin detected', {
      method,
      requestOrigin: normalizedRequestOrigin,
      allowedOrigins,
      url: req.url,
    });
  }

  return isValid;
}

/**
 * Extract origin from Referer URL
 *
 * @param referer - Complete Referer header
 * @returns Extracted origin or null if invalid
 */
function extractOriginFromReferer(referer: string): string | null {
  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Middleware helper to validate CSRF and return error response if fails
 *
 * @param req - NextRequest
 * @returns Error response if validation fails, null if valid
 *
 * @example
 * export async function PATCH(req: NextRequest) {
 *   const csrfError = checkCSRF(req);
 *   if (csrfError) return csrfError;
 *   // ... rest of code
 * }
 */
export function checkCSRF(req: NextRequest) {
  if (!validateCSRFOrigin(req)) {
    return new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Invalid origin - CSRF protection',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  return null;
}
