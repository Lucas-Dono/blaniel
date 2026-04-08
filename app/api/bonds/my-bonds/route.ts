/**
 * GET /api/bonds/my-bonds
 *
 * Obtiene todos los bonds activos y el legado del usuario autenticado
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getUserBonds, getUserBondLegacy } from "@/lib/services/symbolic-bonds.service";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const [activeBonds, legacy] = await Promise.all([
      getUserBonds(user.id),
      getUserBondLegacy(user.id),
    ]);

    return NextResponse.json({
      activeBonds,
      legacy,
      stats: {
        totalActive: activeBonds.length,
        totalLegacy: legacy.length,
        highestRarity: activeBonds.reduce((max, bond) => {
          const rarityValues: Record<string, number> = {
            Common: 1,
            Uncommon: 2,
            Rare: 3,
            Epic: 4,
            Legendary: 5,
            Mythic: 6,
          };
          const current = rarityValues[bond.rarityTier] || 0;
          return current > max ? current : max;
        }, 0),
      },
    });
  } catch (error: any) {
    console.error("Error fetching bonds:", error);
    return NextResponse.json(
      { error: error.message || "Error al obtener bonds" },
      { status: 500 }
    );
  }
}
