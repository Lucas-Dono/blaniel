import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { MessageService } from '@/lib/services/message.service';
import { formatZodError } from '@/lib/validation/schemas';
import { canSendMessage } from '@/lib/usage/token-limits';
import { trackUsage } from '@/lib/usage/tracker';
import { decryptMessageIfNeeded } from '@/lib/encryption/message-encryption';

/**
 * Endpoint especializado para Minecraft
 *
 * Diferencias con /message regular:
 * - Respuestas más cortas (< 200 caracteres para chat de MC)
 * - Sin multimodal (Minecraft no renderiza imágenes inline)
 * - Rate limiting ajustado (1 msg/5s para evitar spam)
 * - Metadata específica de contexto 3D (posición, actividad)
 */

const minecraftChatSchema = z.object({
  message: z.string().min(1).max(500),
  context: z.object({
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
      world: z.string(), // "overworld", "nether", "end"
    }).optional(),
    activity: z.enum([
      'idle',
      'following_player',
      'working',
      'sleeping',
      'walking',
      'running',
      'trading',
      'talking',
    ]).optional(),
    nearbyPlayers: z.array(z.string()).optional(), // Lista de usernames
    timeOfDay: z.number().min(0).optional(), // Minecraft world time (total ticks)
    weather: z.enum(['clear', 'rain', 'thunder']).optional(),
  }).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 16 requirement)
    const { id: agentId } = await params;

    // Extraer y verificar JWT token
    const authHeader = req.headers.get('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const tokenData = await verifyToken(token);
    if (!tokenData) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Get usuario de la BD
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: { id: true, plan: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    const body = await req.json();
    console.log('[Minecraft Chat] Body recibido:', JSON.stringify(body, null, 2));

    const validation = minecraftChatSchema.safeParse(body);

    if (!validation.success) {
      console.log('[Minecraft Chat] Validation failed:', JSON.stringify(validation.error, null, 2));
      const error = formatZodError(validation.error);
      return NextResponse.json(error, { status: 400 });
    }

    console.log('[Minecraft Chat] Validation passed, processing message...');

    const { message, context } = validation.data;

    // Normalizar timeOfDay a 0-24000 (hora del día)
    const normalizedTimeOfDay = context?.timeOfDay ? context.timeOfDay % 24000 : undefined;

    // Rate limiting específico para Minecraft (más restrictivo)
    const canUse = await canSendMessage(user.id, user.plan);
    if (!canUse) {
      return NextResponse.json(
        {
          error: 'Rate limit excedido. Espera 5 segundos entre mensajes.',
          shouldWait: true,
          cooldownSeconds: 5,
        },
        { status: 429 }
      );
    }

    // Construir metadata específica de Minecraft
    const minecraftMetadata = {
      source: 'minecraft',
      position: context?.position,
      activity: context?.activity || 'idle',
      nearbyPlayers: context?.nearbyPlayers || [],
      timeOfDay: normalizedTimeOfDay,
      weather: context?.weather,
      timestamp: Date.now(),
    };

    // Process mensaje con servicio existente
    const messageService = new MessageService();
    const result = await messageService.processMessage({
      userId: user.id,
      agentId,
      content: message,
      metadata: minecraftMetadata,
      userPlan: user.plan,
    });

    // Track usage (tokens usados en el procesamiento)
    if (result.usage?.tokensUsed) {
      await trackUsage(user.id, 'message', result.usage.tokensUsed);
    }

    // Get el mensaje completo de la BD para desencriptar
    const dbMessage = await prisma.message.findUnique({
      where: { id: result.assistantMessage.id },
      select: {
        content: true,
        iv: true,
        authTag: true,
      },
    });

    if (!dbMessage) {
      throw new Error('Message not found in database');
    }

    // Desencriptar el contenido del mensaje
    const decryptedContent = decryptMessageIfNeeded(
      dbMessage.content,
      dbMessage.iv,
      dbMessage.authTag
    );

    console.log('[Minecraft Chat] Decrypted content:', decryptedContent);

    // Formato de respuesta optimizado para Minecraft
    const primaryEmotion = result.emotions?.dominant?.[0] || 'neutral';
    const responsePayload = {
      response: decryptedContent,
      emotions: {
        primary: primaryEmotion,
        intensity: result.emotions?.pad?.arousal || 0.5,
        // Emociones mapeadas a animaciones de Minecraft
        animation: mapEmotionToAnimation(primaryEmotion),
      },
      action: determineAction(result, { ...context, timeOfDay: normalizedTimeOfDay }),
      relationship: {
        stage: result.relationship?.stage,
        trust: result.state?.trust,
        affinity: result.state?.affinity,
      },
      metadata: {
        tokensUsed: result.usage?.tokensUsed,
      },
    };

    console.log('[Minecraft Chat] Sending response:', JSON.stringify(responsePayload, null, 2));
    return NextResponse.json(responsePayload);

  } catch (error: any) {
    console.error('[Minecraft Chat API Error]', error);
    return NextResponse.json(
      {
        error: 'Error al procesar mensaje',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Mapea emociones a animaciones de Minecraft/MCA
 */
function mapEmotionToAnimation(emotion?: string): string {
  const animationMap: Record<string, string> = {
    joy: 'wave',
    sadness: 'cry',
    anger: 'shake_fist',
    fear: 'cower',
    surprise: 'shocked',
    disgust: 'turn_away',
    anticipation: 'look_around',
    trust: 'nod',
    love: 'heart_eyes',
    neutral: 'idle',
  };

  return animationMap[emotion || 'neutral'] || 'idle';
}

/**
 * Determina acción sugerida para el aldeano basado en contexto
 */
function determineAction(result: any, context?: any) {
  // Si el agente sugiere seguir al jugador
  if (result.assistantMessage.content.toLowerCase().includes('seguir')) {
    return { type: 'follow_player', duration: 60 }; // 60 segundos
  }

  // Si es de noche y está afuera, sugerir ir a casa
  if (context?.timeOfDay && context.timeOfDay > 13000 && context.timeOfDay < 23000) {
    return { type: 'go_home' };
  }

  // Si hay tormenta, buscar refugio
  if (context?.weather === 'thunder') {
    return { type: 'seek_shelter' };
  }

  // Acción por defecto basada en actividad actual
  return { type: 'continue', activity: context?.activity || 'idle' };
}
