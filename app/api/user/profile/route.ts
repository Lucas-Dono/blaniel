import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { checkCSRF } from "@/lib/security/csrf-protection";
import { sanitizeAndValidateName } from "@/lib/security/unicode-sanitizer";

// GET /api/user/profile - Get user profile
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        plan: true,
        createdAt: true,
        // Include accounts to check if user has OAuth linked
        Account: {
          select: {
            providerId: true,
          },
        },
      },
    });

    // Check if user has any OAuth account linked (Google, etc.)
    // If they do, 2FA is not available (OAuth providers handle their own 2FA)
    const accounts = userProfile?.Account ?? [];
    const hasOAuthAccount = accounts.some(
      (account) => account.providerId !== "credential"
    );
    const isOAuthAccount = hasOAuthAccount;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get agents count
    const agentsCount = await prisma.agent.count({
      where: { userId: user.id },
    });

    // Get groups count
    const groupsCount = await prisma.group.count({
      where: { creatorId: user.id },
    });

    // Get messages count for this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const messagesThisMonth = await prisma.message.count({
      where: {
        userId: user.id,
        role: "user", // Only count user's messages, not AI responses
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    // Remove accounts from response (don't expose to client)
    const { Account, ...userProfileWithoutAccounts } = userProfile || { Account: [] };

    return NextResponse.json({
      user: userProfileWithoutAccounts,
      isOAuthAccount,
      stats: {
        agentsCount,
        groupsCount,
        messagesThisMonth,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/user/profile - Update user profile
export async function PATCH(req: NextRequest) {
  // Validación CSRF
  const csrfError = checkCSRF(req);
  if (csrfError) return csrfError;

  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name: rawName } = body;

    // SECURITY: Sanitize name to prevent visual confusion attacks
    let sanitizedName = rawName;
    if (rawName !== undefined) {
      const nameValidation = sanitizeAndValidateName(rawName);
      if (!nameValidation.valid || !nameValidation.sanitized) {
        console.warn('[API] Nombre de usuario rechazado:', {
          original: rawName,
          reason: nameValidation.reason,
          detections: nameValidation.detections
        });
        return NextResponse.json(
          {
            error: nameValidation.reason || 'El nombre contiene caracteres no permitidos',
            field: 'name',
            detections: nameValidation.detections
          },
          { status: 400 }
        );
      }

      sanitizedName = nameValidation.sanitized;

      // Log if anything was sanitized
      if (rawName !== sanitizedName) {
        console.info('[API] Nombre de usuario sanitizado:', {
          original: rawName,
          sanitized: sanitizedName,
          detections: nameValidation.detections
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(sanitizedName !== undefined && { name: sanitizedName }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        plan: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
