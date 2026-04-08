/**
 * JWT utilities using jose (Edge Runtime compatible)
 * jose is the recommended library for JWT in Next.js Edge Runtime
 */

import { SignJWT, jwtVerify } from 'jose';

// SECURITY FIX #4: Forzar error si JWT_SECRET no está configurado en producción
// Previene uso de secretos por defecto inseguros
const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SECURITY ERROR: NEXTAUTH_SECRET or JWT_SECRET must be set in production');
  }
  console.warn('⚠️  WARNING: Using default JWT secret in development. Set NEXTAUTH_SECRET or JWT_SECRET in production!');
}

const DEVELOPMENT_SECRET = 'dev-secret-key-only-for-development';
const SECRET_TO_USE = JWT_SECRET || DEVELOPMENT_SECRET;

// Convert secret string to Uint8Array for jose
const getSecretKey = () => new TextEncoder().encode(SECRET_TO_USE);

export interface TokenPayload {
  userId: string;
  email: string;
  name: string | null;
  plan: string;
}

/**
 * Generate a JWT token
 * Compatible with Edge Runtime
 */
export async function generateToken(payload: TokenPayload): Promise<string> {
  const secret = getSecretKey();

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d') // Token válido por 30 días
    .sign(secret);

  return token;
}

/**
 * Verify a JWT token
 * Compatible with Edge Runtime
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    console.log('[JWT] Verifying token...');
    const secret = getSecretKey();

    const { payload } = await jwtVerify(token, secret);

    // Validate que el payload tiene los campos requeridos
    if (!payload.userId || !payload.email) {
      console.error('[JWT] ❌ Token missing required fields');
      return null;
    }

    console.log('[JWT] ✅ Token valid:', { userId: payload.userId, email: payload.email });

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string | null,
      plan: payload.plan as string,
    };
  } catch (error) {
    console.error('[JWT] ❌ Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Extract token from Authorization header
 * Format: "Bearer <token>"
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  console.log('[JWT] Extracting token from header:', authHeader ? `${authHeader.substring(0, 50)}...` : 'NULL');

  if (!authHeader) {
    console.log('[JWT] ❌ No auth header provided');
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    console.log('[JWT] ❌ Invalid header format - expected 2 parts, got:', parts.length);
    return null;
  }

  if (parts[0] !== 'Bearer') {
    console.log('[JWT] ❌ Invalid auth scheme - expected Bearer, got:', parts[0]);
    return null;
  }

  console.log('[JWT] ✅ Token extracted successfully');
  return parts[1];
}
