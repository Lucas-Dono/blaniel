import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAndSaveComponentConfig } from '@/lib/minecraft/component-config-generator';
import { getAuthenticatedUser } from '@/lib/auth-server';

/**
 * POST /api/v1/minecraft/agents/:id/generate-config
 *
 * Genera automáticamente la configuración de componentes modulares
 * para un agente basándose en su referenceImageUrl.
 *
 * Requiere autenticación y que el usuario sea dueño del agente.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // 1. Authentication
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Verificar que el agente existe y pertenece al usuario
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        userId: true,
        referenceImageUrl: true,
        name: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this agent' },
        { status: 403 }
      );
    }

    if (!agent.referenceImageUrl) {
      return NextResponse.json(
        {
          error: 'No reference image',
          message: 'Agent does not have a referenceImageUrl to analyze',
        },
        { status: 400 }
      );
    }

    console.log('[Generate Config API] Generando config para:', agent.name);

    // 3. Generar y guardar configuración
    await generateAndSaveComponentConfig(agentId, agent.referenceImageUrl);

    return NextResponse.json({
      success: true,
      message: 'Component configuration generated successfully',
      agentId: agentId,
      agentName: agent.name,
    });

  } catch (error) {
    console.error('[Generate Config API] Error:', error);
    return NextResponse.json(
      {
        error: 'Error generating configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
