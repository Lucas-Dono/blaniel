import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helper";

/**
 * GET /api/auth/session
 * Returns the current user session
 * Supports both web (cookies) and mobile (JWT Bearer token)
 */
export async function GET(req: NextRequest) {
  try {
    console.log('[Auth Session] Getting session...');

    // Use getAuthenticatedUser which supports both JWT and better-auth
    const user = await getAuthenticatedUser(req);

    if (!user) {
      console.log('[Auth Session] No authenticated user found');
      return NextResponse.json({ user: null }, { status: 200 });
    }

    console.log('[Auth Session] ✅ User authenticated:', user.email, 'Plan:', user.plan);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image || null,
        plan: user.plan,
        createdAt: user.createdAt || null,
      },
    });
  } catch (error) {
    console.error("[Auth Session] Error getting session:", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

// Force Node.js runtime
export const runtime = 'nodejs';
