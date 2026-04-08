/**
 * API Endpoint: GET /api/analytics/behaviors
 *
 * Obtiene estadísticas globales de behaviors de todos los agentes del usuario.
 * Incluye:
 * - Distribución de behaviors activos
 * - Triggers más comunes
 * - Safety levels alcanzados
 * - Comparación entre agentes
 * - Tendencias temporales
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  try {
    // Get usuario autenticado
    const user = await getAuthenticatedUser(req);
    const userId = user?.id || "default-user";

    // Get todos los agentes del usuario
    const agents = await prisma.agent.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        kind: true,
        gender: true,
        nsfwMode: true,
        createdAt: true,
      },
    });

    if (agents.length === 0) {
      return NextResponse.json({
        agents: [],
        totalAgents: 0,
        behaviorDistribution: {},
        triggerStats: {},
        safetyLevelStats: {},
        agentComparison: [],
        message: "No agents found",
      });
    }

    const agentIds = agents.map((a) => a.id);

    // Get todos los BehaviorProfiles
    const behaviorProfiles = await prisma.behaviorProfile.findMany({
      where: {
        agentId: { in: agentIds },
      },
      select: {
        id: true,
        agentId: true,
        behaviorType: true,
        baseIntensity: true,
        currentPhase: true,
        createdAt: true,
      },
    });

    // Get todos los triggers
    const allTriggers = await prisma.behaviorTriggerLog.findMany({
      where: {
        Message: {
          agentId: { in: agentIds },
        },
      },
      select: {
        id: true,
        behaviorType: true,
        triggerType: true,
        weight: true,
        createdAt: true,
        Message: {
          select: {
            agentId: true,
          },
        },
      },
    });

    // Calcular distribución de behaviors
    const behaviorDistribution: Record<string, number> = {};
    behaviorProfiles.forEach((profile) => {
      behaviorDistribution[profile.behaviorType] =
        (behaviorDistribution[profile.behaviorType] || 0) + 1;
    });

    // Calcular triggers más comunes
    const triggerStats: Record<string, { count: number; avgWeight: number }> = {};
    allTriggers.forEach((trigger) => {
      if (!triggerStats[trigger.triggerType]) {
        triggerStats[trigger.triggerType] = { count: 0, avgWeight: 0 };
      }
      triggerStats[trigger.triggerType].count++;
      triggerStats[trigger.triggerType].avgWeight += trigger.weight;
    });

    // Promediar pesos
    Object.keys(triggerStats).forEach((key) => {
      triggerStats[key].avgWeight /= triggerStats[key].count;
    });

    // Sort triggers por frecuencia
    const topTriggers = Object.entries(triggerStats)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([type, stats]) => ({
        type,
        count: stats.count,
        avgWeight: stats.avgWeight,
      }));

    // Calcular safety levels (simulado basándose en intensidad y fase)
    const safetyLevelStats = {
      SAFE: 0,
      WARNING: 0,
      CRITICAL: 0,
      EXTREME_DANGER: 0,
    };

    behaviorProfiles.forEach((profile) => {
      // Determinar safety level basándose en fase
      if (profile.currentPhase <= 2) {
        safetyLevelStats.SAFE++;
      } else if (profile.currentPhase <= 4) {
        safetyLevelStats.WARNING++;
      } else if (profile.currentPhase <= 6) {
        safetyLevelStats.CRITICAL++;
      } else {
        safetyLevelStats.EXTREME_DANGER++;
      }
    });

    // Comparación entre agentes
    const agentComparison = agents.map((agent) => {
      const agentBehaviors = behaviorProfiles.filter(
        (p) => p.agentId === agent.id
      );
      const agentTriggers = allTriggers.filter(
        (t) => t.Message.agentId === agent.id
      );

      const avgIntensity =
        agentBehaviors.length > 0
          ? agentBehaviors.reduce((sum, b) => sum + b.baseIntensity, 0) /
            agentBehaviors.length
          : 0;

      const avgPhase =
        agentBehaviors.length > 0
          ? agentBehaviors.reduce((sum, b) => sum + b.currentPhase, 0) /
            agentBehaviors.length
          : 0;

      return {
        id: agent.id,
        name: agent.name,
        kind: agent.kind,
        gender: agent.gender,
        nsfwMode: agent.nsfwMode,
        behaviorCount: agentBehaviors.length,
        triggerCount: agentTriggers.length,
        avgIntensity,
        avgPhase,
        createdAt: agent.createdAt,
      };
    });

    // Tendencias temporales (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTriggers = allTriggers.filter(
      (t) => new Date(t.createdAt) >= thirtyDaysAgo
    );

    // Agrupar por día
    const dailyTriggers: Record<string, number> = {};
    recentTriggers.forEach((trigger) => {
      const date = new Date(trigger.createdAt).toISOString().split("T")[0];
      dailyTriggers[date] = (dailyTriggers[date] || 0) + 1;
    });

    const trends = Object.entries(dailyTriggers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date,
        triggerCount: count,
      }));

    return NextResponse.json({
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        nsfwMode: a.nsfwMode,
      })),
      totalAgents: agents.length,
      totalBehaviors: behaviorProfiles.length,
      totalTriggers: allTriggers.length,
      behaviorDistribution,
      topTriggers,
      safetyLevelStats,
      agentComparison: agentComparison.sort(
        (a, b) => b.triggerCount - a.triggerCount
      ),
      trends,
      metadata: {
        generatedAt: new Date().toISOString(),
        periodDays: 30,
      },
    });
  } catch (error) {
    console.error("[API] Error fetching behavior analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
