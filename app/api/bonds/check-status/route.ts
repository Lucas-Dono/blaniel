import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/bonds/check-status
 * Verificar el estado del bond entre un usuario y un agente
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required" },
        { status: 400 }
      );
    }

    // Check if user has an active bond with this agent
    const existingBond = await prisma.symbolicBond.findFirst({
      where: {
        userId: user.id,
        agentId,
        status: { in: ["active", "dormant", "fragile", "at_risk"] },
      },
      select: {
        id: true,
        tier: true,
        affinityLevel: true,
        rarityTier: true,
        status: true,
        daysInactive: true,
        lastInteraction: true,
      },
    });

    if (existingBond) {
      return NextResponse.json({
        hasBond: true,
        bondId: existingBond.id,
        tier: existingBond.tier,
        affinityLevel: existingBond.affinityLevel,
        rarityTier: existingBond.rarityTier,
        status: existingBond.status,
        daysInactive: existingBond.daysInactive,
      });
    }

    // Check if bond can be established
    // Get agent's symbolic bonds
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        SymbolicBond: {
          where: { status: "active" },
          select: { tier: true },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({
        hasBond: false,
        canEstablish: false,
        reason: "Agente no encontrado",
      });
    }

    // Check if there are available slots (simplified logic since bondConfig doesn't exist)
    let canEstablishAny = true; // Assume bonds can be established
    let reason = "Disponible para establecer vínculo";

    // Count current active bonds
    const currentBonds = agent.SymbolicBond.length;
    const maxBonds = 10; // Default maximum bonds per agent

    if (currentBonds >= maxBonds) {
      canEstablishAny = false;
      reason = "Todos los tipos de vínculo están llenos";
    }

    // Check if user is in queue
    const queuePosition = await prisma.bondQueue.findFirst({
      where: {
        userId: user.id,
        agentId,
      },
      select: {
        queuePosition: true,
        tier: true,
      },
    });

    return NextResponse.json({
      hasBond: false,
      canEstablish: canEstablishAny,
      reason,
      inQueue: !!queuePosition,
      queuePosition: queuePosition?.queuePosition,
      queueTier: queuePosition?.tier,
    });
  } catch (error: any) {
    console.error("[API] Error checking bond status:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
