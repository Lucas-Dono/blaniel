/**
 * Onboarding Progress API
 * Handles saving and loading user onboarding progress
 */

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export interface OnboardingProgressData {
  completedTours: string[];
  currentTour: string | null;
  currentStep: number;
  badges: string[];
  totalKarma: number;
  shownTriggers?: Record<string, { count: number; lastShown: string }>;
}

/**
 * GET /api/onboarding/progress
 * Retrieve user's onboarding progress
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Get or create progress
    let progress = await prisma.onboardingProgress.findUnique({
      where: { userId },
    });

    // If no progress exists, create default
    if (!progress) {
      progress = await prisma.onboardingProgress.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          userId,
          completedTours: [],
          currentTour: null,
          currentStep: 0,
          badges: [],
          totalKarma: 0,
          shownTriggers: {},
        },
      });
    }

    const response: OnboardingProgressData = {
      completedTours: progress.completedTours,
      currentTour: progress.currentTour,
      currentStep: progress.currentStep,
      badges: progress.badges,
      totalKarma: progress.totalKarma,
      shownTriggers: progress.shownTriggers as Record<string, { count: number; lastShown: string }> || {},
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching onboarding progress:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/onboarding/progress
 * Save user's onboarding progress
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = user.id;
    const body = await req.json();

    const {
      completedTours,
      currentTour,
      currentStep,
      badges,
      totalKarma,
      shownTriggers,
    } = body as Partial<OnboardingProgressData>;

    // Validate data
    if (completedTours && !Array.isArray(completedTours)) {
      return NextResponse.json(
        { error: "completedTours must be an array" },
        { status: 400 }
      );
    }

    if (badges && !Array.isArray(badges)) {
      return NextResponse.json(
        { error: "badges must be an array" },
        { status: 400 }
      );
    }

    if (totalKarma !== undefined && typeof totalKarma !== 'number') {
      return NextResponse.json(
        { error: "totalKarma must be a number" },
        { status: 400 }
      );
    }

    // Update metadata
    const updateData: any = {};

    if (completedTours !== undefined) updateData.completedTours = completedTours;
    if (currentTour !== undefined) updateData.currentTour = currentTour;
    if (currentStep !== undefined) updateData.currentStep = currentStep;
    if (badges !== undefined) updateData.badges = badges;
    if (totalKarma !== undefined) updateData.totalKarma = totalKarma;
    if (shownTriggers !== undefined) updateData.shownTriggers = shownTriggers;

    // Update last tour timestamps
    if (currentTour !== null && currentStep === 0) {
      updateData.lastTourStarted = new Date();
    }

    if (completedTours && completedTours.length > 0) {
      updateData.lastTourCompleted = new Date();
    }

    // Upsert progress
    const progress = await prisma.onboardingProgress.upsert({
      where: { userId },
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        userId,
        completedTours: completedTours || [],
        currentTour: currentTour || null,
        currentStep: currentStep || 0,
        badges: badges || [],
        totalKarma: totalKarma || 0,
        shownTriggers: shownTriggers || {},
        lastTourStarted: currentTour ? new Date() : null,
      },
      update: updateData,
    });

    const response: OnboardingProgressData = {
      completedTours: progress.completedTours,
      currentTour: progress.currentTour,
      currentStep: progress.currentStep,
      badges: progress.badges,
      totalKarma: progress.totalKarma,
      shownTriggers: progress.shownTriggers as Record<string, { count: number; lastShown: string }> || {},
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error saving onboarding progress:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/onboarding/progress
 * Reset user's onboarding progress
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Reset progress
    const _progress = await prisma.onboardingProgress.upsert({
      where: { userId },
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        userId,
        completedTours: [],
        currentTour: null,
        currentStep: 0,
        badges: [],
        totalKarma: 0,
        shownTriggers: {},
      },
      update: {
        completedTours: [],
        currentTour: null,
        currentStep: 0,
        badges: [],
        totalKarma: 0,
        shownTriggers: {},
      },
    });

    const response: OnboardingProgressData = {
      completedTours: [],
      currentTour: null,
      currentStep: 0,
      badges: [],
      totalKarma: 0,
      shownTriggers: {},
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error resetting onboarding progress:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
