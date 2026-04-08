/**
 * Helper for authentication that supports both NextAuth (web) and JWT (mobile)
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  image?: string | null;
  createdAt?: Date;
}

/**
 * Gets the authenticated user from:
 * 1. API Key (for external integrations like Minecraft)
 * 2. JWT (mobile)
 * 3. NextAuth/better-auth (web)
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  console.log('[AuthHelper] Attempting authentication...');

  const authHeader = req.headers.get('Authorization');
  console.log('[AuthHelper] Authorization header:', authHeader ? `${authHeader.substring(0, 30)}...` : 'MISSING');

  if (authHeader) {
    const token = extractTokenFromHeader(authHeader);
    console.log('[AuthHelper] Extracted token:', token ? `${token.substring(0, 30)}...` : 'NONE');

    if (token) {
      // FIRST: Try with API Key (if it starts with "blnl_")
      if (token.startsWith('blnl_')) {
        console.log('[AuthHelper] Detected API Key format');

        const user = await prisma.user.findUnique({
          where: { apiKey: token },
          select: {
            id: true,
            email: true,
            name: true,
            plan: true,
            image: true,
            createdAt: true,
          },
        });

        if (user) {
          console.log('[AuthHelper] ✅ Authenticated via API Key:', user.email);
          return user;
        } else {
          console.log('[AuthHelper] ❌ API Key not found or invalid');
        }
      }
      // SECOND: Try with JWT (mobile)
      else {
        const payload = await verifyToken(token);
        console.log('[AuthHelper] Token payload:', payload ? `userId: ${payload.userId}` : 'INVALID');

        if (payload) {
          // Verify that the user exists in the database
          const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
              id: true,
              email: true,
              name: true,
              plan: true,
              image: true,
              createdAt: true,
            },
          });

          if (user) {
            console.log('[AuthHelper] ✅ Authenticated via JWT:', user.email);
            return user;
          } else {
            console.log('[AuthHelper] ❌ JWT valid but user not found in database');
          }
        } else {
          console.log('[AuthHelper] ❌ Token verification failed');
        }
      }
    }
  }

  // THIRD: Try authentication with better-auth (web) - only if no API Key/JWT
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) {
      console.log('[AuthHelper] ✅ Authenticated via better-auth:', session.user.email);

      // Get plan and other fields from Prisma (better-auth doesn't have custom fields)
      const userWithPlan = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true }
      });

      return {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.name || null,
        plan: userWithPlan?.plan || 'free',
        image: session.user.image || null,
        createdAt: session.user.createdAt,
      };
    }
    console.log('[AuthHelper] better-auth session not found');
  } catch (error) {
    console.log('[AuthHelper] better-auth failed:', error);
  }

  console.log('[AuthHelper] ❌ Authentication failed - no valid API Key, JWT, or NextAuth session');
  return null;
}
