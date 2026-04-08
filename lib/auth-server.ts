/**
 * Server-side authentication helpers for better-auth
 * Supports both web (better-auth cookies) and mobile (JWT tokens)
 */

import {auth} from "@/lib/auth";
import { NextRequest } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { headers as getHeaders } from 'next/headers';

/**
 * Get current session from request
 */
export async function getSession(req: Request) {
  return await auth.api.getSession({ headers: req.headers });
}

/**
 * Get current session in Server Components
 * Use this in app directory Server Components
 */
export async function getServerSession() {
  const headersList = await getHeaders();

  // Convert Next.js headers to a Headers object that better-auth can use
  const headersObj = new Headers();
  headersList.forEach((value, key) => {
    headersObj.set(key, value);
  });

  try {
    return await auth.api.getSession({
      headers: headersObj
    });
  } catch (error) {
    console.error('[Auth] Error getting server session:', error);
    return null;
  }
}

/**
 * Get authenticated user from request
 * Supports both web (better-auth) and mobile (JWT) authentication
 * Returns user if authenticated, null otherwise
 */
export async function getAuthenticatedUser(req: NextRequest) {
  // First try better-auth session (web)
  const session = await auth.api.getSession({ headers: req.headers });

  if (session?.user?.id) {
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name || undefined,
      plan: (session.user as any).plan || 'free',
    };
  }

  // If no better-auth session, try JWT token (mobile)
  const authHeader = req.headers.get('Authorization');
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    const payload = await verifyToken(token);

    if (payload) {
      return {
        id: payload.userId,
        email: payload.email,
        name: payload.name || undefined,
        plan: payload.plan || 'free',
      };
    }
  }

  return null;
}

/**
 * Get current user ID or throw error
 */
export async function requireAuth(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user?.id) {
    throw new Error('No autorizado');
  }

  return session.user;
}
