/**
 * Monetization Analytics API Endpoint
 *
 * GET /api/analytics/monetization
 * - Returns monetization metrics
 * - MRR, conversions, plan distribution
 * - Upgrade context analysis
 * - Temporal trends
 *
 * PHASE 5: Monetization Analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const _userId = user.id;

    // Get all users with their plans
    const users = await prisma.user.findMany({
      select: {
        id: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Calculate plan distribution
    const planDistribution = users.reduce((acc, user) => {
      const plan = user.plan || "free";
      acc[plan] = (acc[plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate MRR (Monthly Recurring Revenue)
    const planPrices = {
      free: 0,
      plus: 5,
      ultra: 15,
    };

    const mrr = users.reduce((total, user) => {
      const plan = (user.plan || "free") as keyof typeof planPrices;
      return total + (planPrices[plan] || 0);
    }, 0);

    // Calculate conversion rates
    const totalUsers = users.length;
    const paidUsers = users.filter((u) => u.plan && u.plan !== "free").length;
    const conversionRate = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;

    // Calculate growth trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newUsers = users.filter((u) => new Date(u.createdAt) >= thirtyDaysAgo);
    const userGrowth = newUsers.length;

    // Get paid conversions in last 30 days
    const newPaidUsers = newUsers.filter((u) => u.plan && u.plan !== "free");
    const recentConversions = newPaidUsers.length;

    // Simulate upgrade context data (in real app, this would come from tracking events)
    // For now, we'll create mock data based on plan distribution
    const upgradeContexts = {
      limit_reached: Math.floor(paidUsers * 0.6), // 60% upgraded due to limits
      feature_locked: Math.floor(paidUsers * 0.25), // 25% for locked features
      voluntary: Math.floor(paidUsers * 0.15), // 15% voluntary upgrades
    };

    // Calculate daily trends for last 30 days
    const trends = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dailyUsers = users.filter((u) => {
        const createdAt = new Date(u.createdAt);
        return createdAt >= date && createdAt < nextDate;
      });

      const dailyPaid = dailyUsers.filter((u) => u.plan && u.plan !== "free");

      trends.push({
        date: date.toISOString(),
        newUsers: dailyUsers.length,
        newPaid: dailyPaid.length,
        mrr: dailyPaid.reduce((total, user) => {
          const plan = (user.plan || "free") as keyof typeof planPrices;
          return total + (planPrices[plan] || 0);
        }, 0),
      });
    }

    // Calculate churn (users who downgraded)
    // In a real app, you'd track plan changes in a separate table
    const churnRate = 2.5; // Mock value - in production, calculate from plan change history

    // Calculate ARPU (Average Revenue Per User)
    const arpu = totalUsers > 0 ? mrr / totalUsers : 0;

    // Calculate LTV (Lifetime Value) - simplified
    const avgCustomerLifetimeMonths = 12; // Assume 12 months average
    const ltv = arpu * avgCustomerLifetimeMonths;

    return NextResponse.json({
      overview: {
        mrr,
        totalUsers,
        paidUsers,
        conversionRate: Number(conversionRate.toFixed(2)),
        arpu: Number(arpu.toFixed(2)),
        ltv: Number(ltv.toFixed(2)),
        churnRate: Number(churnRate.toFixed(2)),
      },
      planDistribution: Object.entries(planDistribution).map(([plan, count]) => ({
        plan,
        count,
        percentage: Number(((count / totalUsers) * 100).toFixed(2)),
        revenue: count * planPrices[plan as keyof typeof planPrices],
      })),
      growth: {
        userGrowth,
        recentConversions,
        conversionRate: newUsers.length > 0
          ? Number(((recentConversions / newUsers.length) * 100).toFixed(2))
          : 0,
      },
      upgradeContexts: Object.entries(upgradeContexts).map(([context, count]) => ({
        context,
        count,
        percentage: paidUsers > 0 ? Number(((count / paidUsers) * 100).toFixed(2)) : 0,
      })),
      trends,
      metadata: {
        generatedAt: new Date().toISOString(),
        periodDays: 30,
        currency: "USD",
      },
    });
  } catch (error) {
    console.error("[Monetization Analytics] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch monetization analytics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
