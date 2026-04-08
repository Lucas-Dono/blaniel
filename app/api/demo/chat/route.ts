/**
 * Demo Chat API Endpoint
 * 
 * POST /api/demo/chat
 * - Chat demo without authentication
 * - Ephemeral sessions in Redis
 * - Only allows chat with Luna
 * - Strict rate limiting
 * - No DB persistence
 */

import { NextRequest, NextResponse } from 'next/server';
import { demoSessionService } from '@/lib/services/demo-session.service';
import { demoRateLimiter, DEMO_LIMITS } from '@/lib/demo/rate-limiter';
import { messageService } from '@/lib/services/message.service';
import { getClientIp } from '@/lib/auth/rate-limit';
import { apiLogger as log } from '@/lib/logging';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Input validation
const demoMessageSchema = z.object({
  content: z.string().min(1).max(500), // Límite más corto para demos
  sessionId: z.string().nullable().optional(), // Acepta string, null o undefined
});

/**
 * POST /api/demo/chat
 * Enviar mensaje en demo
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Get client IP
    const ip = getClientIp(req);
    log.info({ ip: ip.substring(0, 10) }, 'Demo chat request received');

    // 2. Parsear y validar input
    let body;
    try {
      body = await req.json();
      log.debug({ body }, 'Request body parsed');
    } catch (error) {
      log.error({ error }, 'Failed to parse JSON body');
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validation = demoMessageSchema.safeParse(body);
    if (!validation.success) {
      log.error({ body, errors: validation.error.format() }, 'Validation failed');
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { content, sessionId } = validation.data;

    // 3. Get or create session
    let session;
    try {
      session = await demoSessionService.getOrCreateSession(
        sessionId || null,
        ip
      );
    } catch (error: any) {
      if (error.message === 'IP session limit exceeded') {
        return NextResponse.json(
          {
            error: 'Demo limit exceeded',
            message: `Has alcanzado el límite de ${DEMO_LIMITS.sessionsPerIpPerDay} sesiones demo por día. Por favor regístrate para acceso completo.`,
            upgradeUrl: '/registro',
          },
          { status: 429 }
        );
      }
      throw error;
    }

    log.info({ sessionId: session.id, messageCount: session.messageCount }, 'Session obtained');

    // 4. Verificar rate limits
    const rateLimitCheck = await demoRateLimiter.checkRateLimit(
      session.id,
      session.messageCount,
      ip
    );

    if (!rateLimitCheck.allowed) {
      const response: any = {
        error: 'Rate limit exceeded',
        sessionId: session.id,
        messagesRemaining: rateLimitCheck.messagesRemaining || 0,
      };

      if (rateLimitCheck.reason === 'MESSAGE_LIMIT_REACHED') {
        response.message = '¡Has alcanzado el límite de la demo! Regístrate para continuar conversando con Luna.';
        response.shouldShowSignup = true;
        response.upgradeUrl = '/registro';
      } else if (rateLimitCheck.reason === 'COOLDOWN_ACTIVE') {
        response.message = `Por favor espera ${rateLimitCheck.waitSeconds} segundos antes de enviar otro mensaje.`;
        response.waitSeconds = rateLimitCheck.waitSeconds;
      }

      return NextResponse.json(response, { status: 429 });
    }

    // 5. Obtener agente Luna
    const DEMO_LUNA_ID = process.env.DEMO_LUNA_ID || 'demo_luna';
    const lunaAgent = await prisma.agent.findFirst({
      where: {
        OR: [
          { id: DEMO_LUNA_ID },
          { name: 'Luna', visibility: 'public' },
          { name: 'Luna' },
        ],
      },
      include: {
        PersonalityCore: true,
        InternalState: true,
        SemanticMemory: true,
      },
    });

    if (!lunaAgent) {
      log.error('Luna agent not found for demo');
      return NextResponse.json(
        { error: 'Demo agent not available' },
        { status: 500 }
      );
    }

    log.info({ agentId: lunaAgent.id, agentName: lunaAgent.name }, 'Luna agent loaded for demo');

    // 6. Procesar mensaje con servicio demo
    let response;
    try {
      log.info({ agentId: lunaAgent.id, sessionId: session.id }, 'Calling processDemoMessage');
      response = await messageService.processDemoMessage({
        agentId: lunaAgent.id,
        content,
        session,
      });
      log.info({ sessionId: session.id, hasResponse: !!response }, 'processDemoMessage completed');
    } catch (error: any) {
      log.error({
        error: error.message,
        stack: error.stack,
        sessionId: session.id
      }, 'Error processing demo message');
      return NextResponse.json(
        {
          error: 'Failed to process message',
          message: error.message,
          details: error.stack
        },
        { status: 500 }
      );
    }

    // 7. Update session with new message and status
    await demoSessionService.addMessage(session.id, 'user', content);
    await demoSessionService.addMessage(session.id, 'assistant', response.content);
    await demoSessionService.incrementMessageCount(session.id);

    if (response.emotionalState) {
      await demoSessionService.updateSession(session.id, {
        emotionalState: response.emotionalState,
      });
    }

    // 8. Registrar cooldown
    await demoRateLimiter.trackMessage(session.id);

    // 9. Calcular mensajes restantes
    const messagesRemaining = DEMO_LIMITS.messagesPerSession - session.messageCount - 1;
    const shouldShowSignup = messagesRemaining === 0;

    const elapsed = Date.now() - startTime;
    log.info(
      { sessionId: session.id, messagesRemaining, elapsed },
      'Demo message processed successfully'
    );

    // 10. Retornar respuesta
    return NextResponse.json(
      {
        message: response.content,
        emotions: response.emotions,
        sessionId: session.id,
        messagesRemaining,
        shouldShowSignup,
        metadata: {
          responseTime: elapsed,
          cooldownSeconds: DEMO_LIMITS.cooldownSeconds,
        },
      },
      {
        headers: {
          'X-Demo-Session': session.id,
          'X-Messages-Remaining': messagesRemaining.toString(),
          'X-Response-Time': elapsed.toString(),
        },
      }
    );
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    log.error({ error: error.message, stack: error.stack, elapsed }, 'Unexpected error in demo chat');

    const isDev = process.env.NODE_ENV === 'development';

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Ha ocurrido un error inesperado. Por favor intenta de nuevo.',
        ...(isDev && {
          debug: {
            message: error.message,
            stack: error.stack
          }
        })
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/demo/chat
 * Get demo information
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({
      limits: DEMO_LIMITS,
      stats: demoRateLimiter.getStats(),
    });
  }

  // Get specific session information
  try {
    const session = await demoSessionService.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const messagesRemaining = await demoSessionService.getMessagesRemaining(sessionId);

    return NextResponse.json({
      sessionId: session.id,
      messageCount: session.messageCount,
      messagesRemaining,
      emotionalState: session.emotionalState,
      history: session.history,
      createdAt: new Date(session.createdAt).toISOString(),
    });
  } catch (error) {
    log.error({ error, sessionId }, 'Error getting session info');
    return NextResponse.json(
      { error: 'Failed to get session info' },
      { status: 500 }
    );
  }
}
