/**
 * POST /api/bonds/establish
 *
 * Intenta establecer un nuevo bond con un agente.
 * Si no hay slots, agrega a la cola.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { attemptEstablishBond } from "@/lib/services/symbolic-bonds.service";
import { BondTier } from "@prisma/client";
import { z } from "zod";

const establishBondSchema = z.object({
  agentId: z.string(),
  tier: z.nativeEnum(BondTier),
  metrics: z.object({
    messageQuality: z.number().min(0).max(1),
    consistencyScore: z.number().min(0).max(1),
    mutualDisclosure: z.number().min(0).max(1),
    emotionalResonance: z.number().min(0).max(1),
    sharedExperiences: z.number().int().min(0),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validatedData = establishBondSchema.parse(body);

    const result = await attemptEstablishBond(
      user.id,
      validatedData.agentId,
      validatedData.tier,
      validatedData.metrics
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "¡Bond establecido exitosamente!",
        bond: result.bond,
      });
    } else {
      return NextResponse.json({
        success: false,
        inQueue: true,
        message: `No hay slots disponibles. Has sido agregado a la cola en posición #${result.queuePosition}.`,
        queueEntry: result.queueEntry,
        queuePosition: result.queuePosition,
      });
    }
  } catch (error: any) {
    console.error("Error establishing bond:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.format() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Error al establecer bond" },
      { status: 500 }
    );
  }
}
