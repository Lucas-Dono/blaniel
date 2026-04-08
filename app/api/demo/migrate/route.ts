/**
 * Demo Migration API Endpoint
 *
 * POST /api/demo/migrate
 * - Migra mensajes de sesión demo a base de datos
 * - Solo usuarios autenticados
 * - Crea relación user-agent si no existe
 * - Retorna ID del agente para redirección
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { demoSessionService } from '@/lib/services/demo-session.service';
import { prisma } from '@/lib/prisma';
import { apiLogger as log } from '@/lib/logging';
import { z } from 'zod';
import { encryptMessage } from '@/lib/encryption/message-encryption';
import { nanoid } from 'nanoid';

const migrationSchema = z.object({
  demoSessionId: z.string().uuid(),
});

/**
 * POST /api/demo/migrate
 * Migrar mensajes demo a cuenta real
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verificar autenticación
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in first' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. Validar input
    const body = await req.json();
    const validation = migrationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { demoSessionId } = validation.data;

    log.info({ userId, demoSessionId }, 'Starting demo migration');

    // 3. Recuperar sesión demo
    const demoSession = await demoSessionService.getSession(demoSessionId);

    if (!demoSession) {
      log.warn({ demoSessionId }, 'Demo session not found or expired');
      return NextResponse.json(
        { error: 'Demo session not found or expired' },
        { status: 404 }
      );
    }

    // 4. Obtener agente Luna
    const DEMO_LUNA_ID = process.env.DEMO_LUNA_ID || 'demo_luna';
    const lunaAgent = await prisma.agent.findFirst({
      where: {
        OR: [
          { id: DEMO_LUNA_ID },
          { name: 'Luna', visibility: 'public' },
          { name: 'Luna' },
        ],
      },
    });

    if (!lunaAgent) {
      log.error('Luna agent not found for migration');
      return NextResponse.json(
        { error: 'Agent not available' },
        { status: 500 }
      );
    }

    const agentId = lunaAgent.id;

    // 5. Verificar si ya se migraron estos mensajes (evitar duplicados)
    const existingRelation = await prisma.relation.findUnique({
      where: {
        subjectId_targetId: {
          subjectId: agentId,
          targetId: userId,
        },
      },
    });

    // Si ya hay una relación reciente, no migrar de nuevo
    if (existingRelation && existingRelation.lastInteractionAt) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      if (existingRelation.lastInteractionAt > fiveMinutesAgo) {
        log.info({ userId, agentId }, 'Recent interaction found, skipping migration');
        return NextResponse.json({
          success: true,
          agentId,
          alreadyMigrated: true,
        });
      }
    }

    // 6. Crear o actualizar relación
    const relation = await prisma.relation.upsert({
      where: {
        subjectId_targetId: {
          subjectId: agentId,
          targetId: userId,
        },
      },
      update: {
        lastInteractionAt: new Date(),
      },
      create: {
        id: nanoid(),
        subjectId: agentId,
        targetId: userId,
        targetType: 'user',
        stage: 'stranger',
        totalInteractions: 0,
        trust: 0.5,
        affinity: 0.5,
        respect: 0.5,
        privateState: {},
        visibleState: {},
        updatedAt: new Date(),
      },
    });

    // 7. Migrar mensajes del historial (solo mensajes user/assistant, no el inicial)
    const messagesToMigrate = demoSession.history.filter(
      (msg) => msg.role === 'user' || (msg.role === 'assistant' && msg.timestamp !== demoSession.createdAt)
    );

    log.debug({ count: messagesToMigrate.length }, 'Messages to migrate');

    // Create mensajes en orden
    for (const msg of messagesToMigrate) {
      const encrypted = encryptMessage(msg.content);

      await prisma.message.create({
        data: {
          id: nanoid(),
          agentId,
          userId,
          role: msg.role,
          content: encrypted.encrypted,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          createdAt: new Date(msg.timestamp),
          metadata: {
            migratedFromDemo: true,
            demoSessionId,
          } as any,
        },
      });
    }

    // 8. Actualizar contador de interacciones
    const userMessageCount = messagesToMigrate.filter((m) => m.role === 'user').length;

    await prisma.relation.update({
      where: { id: relation.id },
      data: {
        totalInteractions: {
          increment: userMessageCount,
        },
      },
    });

    // 9. Limpiar sesión demo (ya migrada)
    await demoSessionService.deleteSession(demoSessionId);

    log.info(
      { userId, agentId, messagesCount: messagesToMigrate.length },
      'Demo migration completed successfully'
    );

    return NextResponse.json({
      success: true,
      agentId,
      messagesMigrated: messagesToMigrate.length,
    });
  } catch (error: any) {
    log.error({ error: error.message, stack: error.stack }, 'Error migrating demo');

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to migrate demo session',
      },
      { status: 500 }
    );
  }
}
