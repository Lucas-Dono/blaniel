/**
 * CRON JOB: Actualización de User Summaries
 * Schedule: Cada hora (0 * * * *)
 *
 * Actualiza los resúmenes analíticos de usuarios activos en la última hora.
 * Calcula métricas agregadas para queries rápidas en dashboards y reportes.
 *
 * Protección: Requiere header Authorization con CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { subHours } from 'date-fns';
import { nanoid } from 'nanoid';

// ============================================================================
// SECURITY: Verificación de autorización
// ============================================================================

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  // En desarrollo, permitir sin token si CRON_SECRET no está configurado
  if (process.env.NODE_ENV === 'development' && !process.env.CRON_SECRET) {
    console.warn('[CRON] Warning: CRON_SECRET not configured in development');
    return true;
  }

  return token === process.env.CRON_SECRET;
}

// ============================================================================
// HELPER: Actualizar summary de un usuario
// ============================================================================

async function updateUserAnalyticsSummary(userId: string): Promise<boolean> {
  try {
    // Get datos del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        plan: true,
        updatedAt: true
      }
    });

    if (!user) {
      console.warn(`[CRON] User ${userId} not found, skipping`);
      return false;
    }

    // ============================================================================
    // 1. ACQUISITION DATA (solo si no existe ya)
    // ============================================================================

    const existingSummary = await prisma.userAnalyticsSummary.findUnique({
      where: { userId },
      select: {
        acquisitionSource: true,
        acquisitionMedium: true,
        acquisitionCampaign: true,
        acquisitionDate: true
      }
    });

    let acquisitionData = {};

    if (!existingSummary?.acquisitionDate) {
      // Search primera sesión del usuario para attribution
      const firstSession = await prisma.userSession.findFirst({
        where: { userId },
        orderBy: { startedAt: 'asc' },
        select: {
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          startedAt: true
        }
      });

      if (firstSession) {
        acquisitionData = {
          acquisitionSource: firstSession.utmSource,
          acquisitionMedium: firstSession.utmMedium,
          acquisitionCampaign: firstSession.utmCampaign,
          acquisitionDate: firstSession.startedAt
        };
      } else {
        acquisitionData = {
          acquisitionSource: 'direct',
          acquisitionMedium: null,
          acquisitionCampaign: null,
          acquisitionDate: user.createdAt
        };
      }
    }

    // ============================================================================
    // 2. ENGAGEMENT METRICS
    // ============================================================================

    // Total mensajes del usuario
    const totalMessages = await prisma.message.count({
      where: {
        userId,
        role: 'user'
      }
    });

    // Sesiones del usuario (contar días únicos de actividad)
    const messagesGroupedByDay = await prisma.message.findMany({
      where: {
        userId,
        role: 'user'
      },
      select: {
        createdAt: true
      }
    });

    const uniqueDays = new Set(
      messagesGroupedByDay.map(m => m.createdAt.toISOString().split('T')[0])
    );
    const totalSessions = uniqueDays.size;

    // Avg session duration (placeholder - requiere tracking más sofisticado)
    const avgSessionDuration = 0;

    // Avg messages per session
    const avgMessagesPerSession = totalSessions > 0 ? totalMessages / totalSessions : 0;

    // ============================================================================
    // 3. AGENT PREFERENCES
    // ============================================================================

    // Mensajes por agente
    const messagesByAgent = await prisma.message.groupBy({
      by: ['agentId'],
      where: {
        userId,
        role: 'user'
      },
      _count: true,
      orderBy: {
        _count: {
          agentId: 'desc'
        }
      }
    });

    const favoriteAgentId = messagesByAgent[0]?.agentId || null;
    const favoriteAgentMessages = messagesByAgent[0]?._count || 0;

    // Total agentes creados
    const totalAgents = await prisma.agent.count({
      where: { userId }
    });

    // ============================================================================
    // 4. BONDS SUMMARY
    // ============================================================================

    const bonds = await prisma.symbolicBond.findMany({
      where: {
        userId,
        status: 'active'
      },
      select: {
        rarityTier: true,
        affinityLevel: true
      }
    });

    const totalBonds = bonds.length;

    // Highest bond tier (ordenado por rareza)
    const tierOrder = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
    const highestBondTier = bonds.length > 0
      ? bonds.reduce((highest, bond) => {
          const currentIndex = tierOrder.indexOf(bond.rarityTier);
          const highestIndex = tierOrder.indexOf(highest);
          return currentIndex > highestIndex ? bond.rarityTier : highest;
        }, bonds[0].rarityTier)
      : null;

    // Avg bond affinity
    const avgBondAffinity = bonds.length > 0
      ? bonds.reduce((sum, b) => sum + b.affinityLevel, 0) / bonds.length
      : 0;

    // ============================================================================
    // 5. MONETIZATION
    // ============================================================================

    // Plan actual
    const plan = user.plan;

    // Lifetime value (calcular desde subscriptions)
    const subscriptions = await prisma.subscription.findMany({
      where: { userId },
      select: {
        createdAt: true,
        status: true
      }
    });

    // Calcular LTV aproximado (placeholder - mejorar con datos de billing real)
    let lifetimeValue = 0;
    if (plan === 'plus') lifetimeValue += 10; // Asumiendo $10/mes
    if (plan === 'ultra') lifetimeValue += 30; // Asumiendo $30/mes

    // Primera conversión a plan pago (cualquier suscripción activa o pasada)
    const firstPaidSub = subscriptions
      .filter(s => s.status !== 'cancelled')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

    const firstPaidAt = firstPaidSub?.createdAt || null;

    // ============================================================================
    // 6. ACTIVITY & STREAKS
    // ============================================================================

    // Last active (último mensaje enviado)
    const lastMessage = await prisma.message.findFirst({
      where: {
        userId,
        role: 'user'
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    const lastActiveAt = lastMessage?.createdAt || user.updatedAt;

    // Current streak (días consecutivos con actividad)
    // TODO: Implementar lógica de streaks más sofisticada
    const currentStreak = 0;
    const longestStreak = 0;

    // ============================================================================
    // 7. RELATION STAGE (más común)
    // ============================================================================

    // Encontrar el stage más común en las relaciones del usuario
    const relations = await prisma.relation.groupBy({
      by: ['stage'],
      where: { subjectId: userId },
      _count: true,
      orderBy: {
        _count: {
          stage: 'desc'
        }
      }
    });

    const relationStage = relations[0]?.stage || 'stranger';

    // ============================================================================
    // 8. USER FLAGS (calculados automáticamente)
    // ============================================================================

    const isChurnRisk = lastActiveAt
      ? (Date.now() - lastActiveAt.getTime()) > (7 * 24 * 60 * 60 * 1000)
      : false;

    const isPowerUser = totalMessages > 100;
    const isHighValue = lifetimeValue > 50;

    // ============================================================================
    // 9. UPSERT EN BASE DE DATOS
    // ============================================================================

    const summaryData = {
      userId,

      // Acquisition (solo actualizar si no existe)
      ...acquisitionData,

      // Engagement
      totalMessages,
      totalSessions,
      avgSessionDuration,
      avgMessagesPerSession,

      // Agent Preferences
      favoriteAgentId,
      favoriteAgentMessages,
      totalAgents,

      // Bonds
      totalBonds,
      highestBondTier,
      avgBondAffinity,

      // Monetization
      plan,
      lifetimeValue,
      firstPaidAt,

      // Activity
      lastActiveAt,
      currentStreak,
      longestStreak,

      // Relation Stage
      relationStage,

      // User Flags
      isChurnRisk,
      isPowerUser,
      isHighValue,

      // Timestamps
      updatedAt: new Date()
    };

    await prisma.userAnalyticsSummary.upsert({
      where: { userId },
      create: {
        id: nanoid(),
        ...summaryData
      },
      update: summaryData
    });

    return true;

  } catch (error) {
    console.error(`[CRON] Error updating summary for user ${userId}:`, error);
    return false;
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check authorization
    if (!isAuthorized(request)) {
      console.error('[CRON] Unauthorized attempt to access update-user-summaries');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or missing CRON_SECRET' },
        { status: 401 }
      );
    }

    const oneHourAgo = subHours(new Date(), 1);

    console.log(`[CRON] Starting user summaries update for users active since ${oneHourAgo.toISOString()}`);

    // ============================================================================
    // FIND ACTIVE USERS (última hora)
    // ============================================================================

    // Usuarios que enviaron mensajes en la última hora
    const recentMessages = await prisma.message.findMany({
      where: {
        createdAt: { gte: oneHourAgo },
        role: 'user'
      },
      select: {
        userId: true
      },
      distinct: ['userId']
    });

    const activeUserIds = recentMessages
      .map(m => m.userId)
      .filter((id): id is string => id !== null);

    if (activeUserIds.length === 0) {
      console.log('[CRON] No active users in the last hour, skipping');
      return NextResponse.json({
        success: true,
        updated: 0,
        duration: `${Date.now() - startTime}ms`,
        message: 'No active users found'
      });
    }

    console.log(`[CRON] Found ${activeUserIds.length} active users to update`);

    // ============================================================================
    // PROCESS IN BATCHES (para evitar sobrecarga)
    // ============================================================================

    const BATCH_SIZE = 10; // Process 10 usuarios a la vez
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < activeUserIds.length; i += BATCH_SIZE) {
      const batch = activeUserIds.slice(i, i + BATCH_SIZE);

      console.log(`[CRON] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(activeUserIds.length / BATCH_SIZE)} (${batch.length} users)`);

      // Process batch en paralelo (pero con límite de BATCH_SIZE)
      const results = await Promise.all(
        batch.map(userId => updateUserAnalyticsSummary(userId))
      );

      successCount += results.filter(r => r).length;
      failureCount += results.filter(r => !r).length;

      // Pequeña pausa entre batches para no saturar la BD
      if (i + BATCH_SIZE < activeUserIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[CRON] ✓ User summaries update completed in ${duration}ms`);
    console.log(`[CRON] Success: ${successCount}, Failures: ${failureCount}`);

    return NextResponse.json({
      success: true,
      updated: successCount,
      failed: failureCount,
      total: activeUserIds.length,
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON] Error in user summaries update:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// EXPORT ROUTE METADATA
// ============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minuto máximo
