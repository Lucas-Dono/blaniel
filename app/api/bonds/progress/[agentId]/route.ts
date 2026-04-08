import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/middleware/auth-helper";
import { prisma } from "@/lib/prisma";
import { BondTier } from "@prisma/client";

// Tier progression order
const TIER_PROGRESSION: BondTier[] = [
  "ACQUAINTANCE",
  "ADVENTURE_COMPANION",
  "CREATIVE_PARTNER",
  "CONFIDANT",
  "MENTOR",
  "BEST_FRIEND",
  "ROMANTIC",
];

// Default requirements (should match symbolic-bonds.service.ts)
const DEFAULT_TIER_REQUIREMENTS: Record<
  BondTier,
  { minAffinity: number; minDays: number; minInteractions: number }
> = {
  ROMANTIC: { minAffinity: 80, minDays: 30, minInteractions: 100 },
  BEST_FRIEND: { minAffinity: 70, minDays: 20, minInteractions: 60 },
  MENTOR: { minAffinity: 60, minDays: 15, minInteractions: 40 },
  CONFIDANT: { minAffinity: 50, minDays: 10, minInteractions: 30 },
  CREATIVE_PARTNER: { minAffinity: 55, minDays: 12, minInteractions: 35 },
  ADVENTURE_COMPANION: { minAffinity: 50, minDays: 10, minInteractions: 25 },
  ACQUAINTANCE: { minAffinity: 20, minDays: 3, minInteractions: 10 },
};

/**
 * GET /api/bonds/progress/[agentId]
 * Get bond progress for current user with specific agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { agentId } = await params;

    // Check if bond exists
    const bond = await prisma.symbolicBond.findFirst({
      where: {
        userId: session.user.id,
        agentId,
      },
      include: {
        Agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        affinityLevel: 'desc', // Get the highest affinity bond if multiple exist
      },
    });

    if (!bond) {
      // No bond exists yet - return initial state
      return NextResponse.json({
        hasBond: false,
        currentTier: null,
        currentAffinityLevel: 0,
        durationDays: 0,
        totalInteractions: 0,
        nextTier: {
          tier: "ACQUAINTANCE",
          requiredAffinity: DEFAULT_TIER_REQUIREMENTS.ACQUAINTANCE.minAffinity,
          requiredDays: DEFAULT_TIER_REQUIREMENTS.ACQUAINTANCE.minDays,
          requiredInteractions: DEFAULT_TIER_REQUIREMENTS.ACQUAINTANCE.minInteractions,
          progress: {
            affinity: 0,
            days: 0,
            interactions: 0,
            overall: 0,
          },
        },
        status: null,
        rarityTier: null,
      });
    }

    // Calculate duration
    const durationMs = Date.now() - bond.createdAt.getTime();
    const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

    // Get bond config for this agent
    const config = await prisma.agentBondConfig.findUnique({
      where: { agentId },
    });

    const tierRequirements = (config?.tierRequirements as Record<BondTier, any>) || DEFAULT_TIER_REQUIREMENTS;

    // Determine next tier
    const currentTierIndex = TIER_PROGRESSION.indexOf(bond.tier);
    const nextTier =
      currentTierIndex < TIER_PROGRESSION.length - 1
        ? TIER_PROGRESSION[currentTierIndex + 1]
        : null;

    let nextTierData = null;
    if (nextTier) {
      const requirements = tierRequirements[nextTier] || DEFAULT_TIER_REQUIREMENTS[nextTier];

      // Calculate progress percentages
      const affinityProgress = Math.min(
        (bond.affinityLevel / requirements.minAffinity) * 100,
        100
      );
      const daysProgress = Math.min(
        (durationDays / requirements.minDays) * 100,
        100
      );
      const interactionsProgress = Math.min(
        (bond.totalInteractions / requirements.minInteractions) * 100,
        100
      );

      // Overall progress (average of all three)
      const overallProgress =
        (affinityProgress + daysProgress + interactionsProgress) / 3;

      nextTierData = {
        tier: nextTier,
        requiredAffinity: requirements.minAffinity,
        requiredDays: requirements.minDays,
        requiredInteractions: requirements.minInteractions,
        progress: {
          affinity: Math.round(affinityProgress),
          days: Math.round(daysProgress),
          interactions: Math.round(interactionsProgress),
          overall: Math.round(overallProgress),
        },
      };
    }

    return NextResponse.json({
      hasBond: true,
      currentTier: bond.tier,
      currentAffinityLevel: bond.affinityLevel,
      durationDays,
      totalInteractions: bond.totalInteractions,
      nextTier: nextTierData,
      status: bond.status,
      rarityTier: bond.rarityTier,
    });
  } catch (error) {
    console.error("Error fetching bond progress:", error);
    return NextResponse.json(
      { error: "Error al obtener progreso del vínculo" },
      { status: 500 }
    );
  }
}
