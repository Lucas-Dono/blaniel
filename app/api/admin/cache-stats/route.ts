/**
 * Cache Statistics API
 *
 * GET /api/admin/cache-stats
 * - Obtiene estadísticas del semantic cache
 * - Solo accesible para admins
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { semanticCache } from '@/lib/cache/semantic-cache';
import { prisma } from '@/lib/prisma';
import { apiLogger as log } from '@/lib/logging';

export async function GET(req: NextRequest) {
  try {
    // Authentication
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization - solo admins
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    if (!adminEmails.includes(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');

    if (agentId) {
      // Stats para un agente específico
      const stats = await semanticCache.getStats(agentId);

      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { name: true },
      });

      return NextResponse.json({
        agentId,
        agentName: agent?.name || 'Unknown',
        stats,
      });
    } else {
      // Stats globales
      const agents = await prisma.agent.findMany({
        select: { id: true, name: true },
        take: 100, // Limitar a 100 agentes
      });

      const statsPromises = agents.map(async (agent) => ({
        agentId: agent.id,
        agentName: agent.name,
        stats: await semanticCache.getStats(agent.id),
      }));

      const allStats = await Promise.all(statsPromises);

      // Calcular métricas globales
      const totalEntries = allStats.reduce((sum, s) => sum + s.stats.totalEntries, 0);
      const totalHits = allStats.reduce((sum, s) => sum + s.stats.totalHits, 0);
      const avgHitCount = totalEntries > 0 ? totalHits / totalEntries : 0;

      // Estimación de ahorros (asumiendo $0.01 por llamada de API)
      const costPerRequest = 0.01;
      const estimatedSavings = totalHits * costPerRequest;

      // Hit rate estimado (hits / (hits + entries))
      const hitRate = totalEntries > 0 ? totalHits / (totalHits + totalEntries) : 0;

      return NextResponse.json({
        global: {
          totalEntries,
          totalHits,
          avgHitCount: parseFloat(avgHitCount.toFixed(2)),
          hitRate: parseFloat((hitRate * 100).toFixed(2)) + '%',
          estimatedSavings: `$${estimatedSavings.toFixed(2)}`,
          agentsWithCache: allStats.filter((s) => s.stats.totalEntries > 0).length,
        },
        topAgents: allStats
          .filter((s) => s.stats.totalEntries > 0)
          .sort((a, b) => b.stats.totalHits - a.stats.totalHits)
          .slice(0, 10)
          .map((s) => ({
            agentId: s.agentId,
            agentName: s.agentName,
            entries: s.stats.totalEntries,
            hits: s.stats.totalHits,
            avgHitCount: parseFloat(s.stats.avgHitCount.toFixed(2)),
          })),
        agents: allStats,
      });
    }
  } catch (error) {
    log.error({ error }, 'Error getting cache stats');
    return NextResponse.json(
      {
        error: 'Failed to get cache stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/cache-stats
 * Invalida el cache de un agente específico o limpia el cache global
 */
export async function DELETE(req: NextRequest) {
  try {
    // Authentication
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization - solo admins
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    if (!adminEmails.includes(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');

    if (agentId) {
      // Invalidar cache de un agente específico
      await semanticCache.invalidate(agentId);

      log.info({ agentId, adminId: user.id }, 'Cache invalidated for agent');

      return NextResponse.json({
        success: true,
        message: `Cache invalidated for agent ${agentId}`,
      });
    } else {
      // Cleanup global
      await semanticCache.cleanup();

      log.info({ adminId: user.id }, 'Global cache cleanup performed');

      return NextResponse.json({
        success: true,
        message: 'Global cache cleanup completed',
      });
    }
  } catch (error) {
    log.error({ error }, 'Error invalidating cache');
    return NextResponse.json(
      {
        error: 'Failed to invalidate cache',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
