/**
 * API Admin - Dashboard
 * Main system statistics (KPIs)
 */

import {NextResponse} from 'next/server';
import { withAdminAuth } from '@/lib/admin/middleware';
import { logAuditAction, AuditAction, AuditTargetType } from '@/lib/admin/audit-logger';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin-secure/dashboard
 * Retrieves main system statistics
 */
export const GET = withAdminAuth(async (request, { admin }) => {
  try {
    // Get date parameters (last 30 days by default)
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Ejecutar todas las queries en paralelo
    const [
      // Usuarios
      totalUsers,
      usersToday,
      usersThisWeek,
      usersThisMonth,

      // Agentes
      totalAgents,
      agentsToday,
      agentsThisWeek,
      agentsThisMonth,

      // Messages (approximation - limit to last 30 days for performance)
      messagesStats,

      // Planes
      planDistribution,

      // Sistema
      systemStats,

      // Moderation
      pendingReports,

    ] = await Promise.all([
      // Usuarios
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      }),
      prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      }),
      prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      }),

      // Agentes
      prisma.agent.count(),
      prisma.agent.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      }),
      prisma.agent.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      }),
      prisma.agent.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      }),

      // Messages (only last 30 days for performance)
      prisma.message.aggregate({
        where: {
          createdAt: { gte: startDate }
        },
        _count: true
      }),

      // Distribution of plans
      prisma.user.groupBy({
        by: ['plan'],
        _count: true
      }),

      // Stats del sistema
      prisma.$queryRaw`
        SELECT
          pg_database_size(current_database()) as db_size,
          (SELECT count(*) FROM pg_stat_activity
           WHERE datname = current_database() AND state = 'active') as active_connections,
          (SELECT count(*) FROM pg_stat_activity
           WHERE datname = current_database() AND state = 'idle') as idle_connections
      ` as Promise<Array<{ db_size: bigint; active_connections: number; idle_connections: number }>>,

      // Reports pending moderation
      Promise.all([
        prisma.postReport.count({ where: { status: 'pending' } }),
        prisma.commentReport.count({ where: { status: 'pending' } })
      ]).then(([posts, comments]) => posts + comments),
    ]);

    // Calcular tasas de crecimiento
    const userGrowthRate = usersThisWeek > 0
      ? ((usersToday / usersThisWeek) * 100).toFixed(1)
      : '0';

    const agentGrowthRate = agentsThisWeek > 0
      ? ((agentsToday / agentsThisWeek) * 100).toFixed(1)
      : '0';

    // Formato de respuesta
    const dashboardData = {
      users: {
        total: totalUsers,
        today: usersToday,
        thisWeek: usersThisWeek,
        thisMonth: usersThisMonth,
        growthRate: parseFloat(userGrowthRate)
      },
      agents: {
        total: totalAgents,
        today: agentsToday,
        thisWeek: agentsThisWeek,
        thisMonth: agentsThisMonth,
        growthRate: parseFloat(agentGrowthRate)
      },
      messages: {
        totalLastMonth: messagesStats._count,
        averagePerDay: Math.round(messagesStats._count / days)
      },
      plans: {
        distribution: planDistribution.map(p => ({
          plan: p.plan,
          count: p._count,
          percentage: ((p._count / totalUsers) * 100).toFixed(1)
        })),
        premium: planDistribution
          .filter(p => p.plan !== 'free')
          .reduce((sum, p) => sum + p._count, 0)
      },
      system: {
        databaseSize: systemStats[0]?.db_size
          ? Number(systemStats[0].db_size) / (1024 * 1024)  // MB
          : 0,
        activeConnections: Number(systemStats[0]?.active_connections || 0),
        idleConnections: Number(systemStats[0]?.idle_connections || 0),
        totalConnections: Number(systemStats[0]?.active_connections || 0) + Number(systemStats[0]?.idle_connections || 0)
      },
      moderation: {
        pendingReports
      },
      timestamp: new Date().toISOString()
    };

    // Log audit
    await logAuditAction(admin, {
      action: AuditAction.ANALYTICS_VIEW,
      targetType: AuditTargetType.SYSTEM,
      details: { endpoint: 'dashboard', days }
    });

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas del dashboard' },
      { status: 500 }
    );
  }
});
