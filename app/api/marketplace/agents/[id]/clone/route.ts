import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { atomicCheckAgentLimit } from "@/lib/usage/atomic-resource-check";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  const { id: originalId } = await params;
  const original = await prisma.agent.findFirst({
    where: { id: originalId, visibility: "public" },
  });

  if (!original) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Get user plan
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true },
  });
  const userPlan = userData?.plan || "free";

  // CRITICAL: Clone con verificación atómica para prevenir race condition
  const cloned = await prisma.$transaction(
    async (tx) => {
      // Check rate limit WITHIN the transaction
      await atomicCheckAgentLimit(tx, user.id, userPlan);

      // Create agente clonado
      const newClone = await tx.agent.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          userId: user.id,
          name: `${original.name} (Clone)`,
          kind: original.kind,
          description: original.description,
          gender: original.gender,
          personality: original.personality,
          tone: original.tone,
          purpose: original.purpose,
          profile: original.profile as Prisma.InputJsonValue,
          systemPrompt: original.systemPrompt,
          visibility: "private",
          avatar: original.avatar,
          tags: original.tags as Prisma.InputJsonValue,
          originalId: original.id,
        },
      });

      // Update contador e historial dentro de la transacción
      await Promise.all([
        tx.agent.update({
          where: { id: originalId },
          data: { cloneCount: { increment: 1 } },
        }),
        tx.agentClone.create({
          data: {
            id: nanoid(),
            originalAgentId: originalId,
            clonedByUserId: user.id,
            clonedAgentId: newClone.id,
          },
        }),
      ]);

      return newClone;
    },
    {
      isolationLevel: "Serializable",
      maxWait: 5000,
      timeout: 10000,
    }
  ).catch((error) => {
    if (error.message.startsWith("{")) {
      const errorData = JSON.parse(error.message);
      throw errorData;
    }
    throw error;
  });

    return NextResponse.json({ agent: cloned, success: true });
  } catch (error: any) {
    console.error("Error cloning agent:", error);

    // If it's a rate limit error (thrown from the transaction)
    if (error.error && error.limit) {
      return NextResponse.json(error, { status: 403 });
    }

    // Prisma transaction errors
    if (error.code === "P2034") {
      // Serialization failure - race condition detectada
      return NextResponse.json(
        {
          error: "El límite de agentes fue alcanzado. Por favor intenta de nuevo.",
          hint: "Múltiples requests detectados"
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
