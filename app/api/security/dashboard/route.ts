/**
 * Security Dashboard API
 *
 * Endpoints para el dashboard de seguridad
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getRecentAlerts, getAlertStats } from '@/lib/security/alerting';
import { getHoneypotStats } from '@/lib/security/honeypots';
import { getThreatStats } from '@/lib/security/threat-detection';
import { getTarpitStats } from '@/lib/security/tarpit';
import { getCanaryStats } from '@/lib/security/canary-tokens';

const prisma = new PrismaClient();

// ============================================================================
// GET - Dashboard Overview
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '24h';

    // Calcular fechas
    const to = new Date();
    const from = new Date();

    switch (timeRange) {
      case '1h':
        from.setHours(from.getHours() - 1);
        break;
      case '24h':
        from.setHours(from.getHours() - 24);
        break;
      case '7d':
        from.setDate(from.getDate() - 7);
        break;
      case '30d':
        from.setDate(from.getDate() - 30);
        break;
      default:
        from.setHours(from.getHours() - 24);
    }

    // Get estadísticas en paralelo
    const [
      alertStats,
      threatStats,
      honeypotStats,
      tarpitStats,
      canaryStats,
      recentAlerts,
      topAttackers,
      recentThreats,
    ] = await Promise.all([
      getAlertStats({ from, to }),
      getThreatStats({ from, to }),
      getHoneypotStats({ from, to }),
      getTarpitStats({ from, to }),
      getCanaryStats({ from, to }),
      getRecentAlerts(10),
      getTopAttackers({ from, to }, 10),
      getRecentThreats(10),
    ]);

    // Calcular threat score general
    const overallThreatScore = calculateOverallThreatScore({
      criticalAlerts: alertStats.bySeverity.critical || 0,
      highAlerts: alertStats.bySeverity.high || 0,
      totalThreats: threatStats.total,
      canaryTriggers: canaryStats.totalTriggers,
    });

    return NextResponse.json({
      overview: {
        threatScore: overallThreatScore,
        totalAlerts: alertStats.total,
        criticalAlerts: alertStats.bySeverity.critical || 0,
        highAlerts: alertStats.bySeverity.high || 0,
        totalThreats: threatStats.total,
        honeypotHits: honeypotStats.totalHits,
        canaryTriggers: canaryStats.totalTriggers,
        uniqueAttackers: threatStats.uniqueAttackers,
        blockedRequests: threatStats.blocked,
      },
      alerts: {
        stats: alertStats,
        recent: recentAlerts,
      },
      threats: {
        stats: threatStats,
        recent: recentThreats,
      },
      honeypots: honeypotStats,
      tarpit: tarpitStats,
      canary: canaryStats,
      attackers: {
        top: topAttackers,
      },
      timeRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });
  } catch (error) {
    console.error('[SECURITY_API] Error getting dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateOverallThreatScore(data: {
  criticalAlerts: number;
  highAlerts: number;
  totalThreats: number;
  canaryTriggers: number;
}): number {
  let score = 0;

  // Canary triggers = immediate critical threat
  if (data.canaryTriggers > 0) {
    return 100;
  }

  // Critical alerts
  score += data.criticalAlerts * 30;

  // High alerts
  score += data.highAlerts * 15;

  // Total threats (capped)
  score += Math.min(data.totalThreats * 0.5, 40);

  return Math.min(score, 100);
}

async function getTopAttackers(timeRange: { from: Date; to: Date }, limit: number) {
  try {
    // Get fingerprints con más actividad maliciosa
    const fingerprints = await prisma.clientFingerprint.findMany({
      where: {
        lastSeen: {
          gte: timeRange.from,
          lte: timeRange.to,
        },
        OR: [
          { isSuspicious: true },
          { isBlocked: true },
          { threatScore: { gt: 30 } },
        ],
      },
      include: {
        ThreatDetection: {
          where: {
            createdAt: {
              gte: timeRange.from,
              lte: timeRange.to,
            },
          },
          select: {
            severity: true,
            threatType: true,
          },
        },
        HoneypotHit: {
          where: {
            createdAt: {
              gte: timeRange.from,
              lte: timeRange.to,
            },
          },
        },
      },
      orderBy: {
        threatScore: 'desc',
      },
      take: limit,
    });

    return fingerprints.map(fp => ({
      id: fp.id,
      ipAddress: fp.ipAddress,
      country: fp.country,
      isp: fp.isp,
      threatScore: fp.threatScore,
      isBot: fp.isBot,
      isBlocked: fp.isBlocked,
      requestCount: fp.requestCount,
      threatCount: fp.ThreatDetection.length,
      honeypotHits: fp.HoneypotHit.length,
      lastSeen: fp.lastSeen,
      threats: fp.ThreatDetection.map((t: { severity: string; threatType: string }) => ({
        severity: t.severity,
        type: t.threatType,
      })),
    }));
  } catch (error) {
    console.error('[SECURITY_API] Error getting top attackers:', error);
    return [];
  }
}

async function getRecentThreats(limit: number) {
  try {
    return await prisma.threatDetection.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  } catch (error) {
    console.error('[SECURITY_API] Error getting recent threats:', error);
    return [];
  }
}
