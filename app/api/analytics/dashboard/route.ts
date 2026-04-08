/**
 * Analytics Dashboard API
 * Provides comprehensive analytics data for the dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getDashboardStats, type TimeRange } from "@/lib/analytics/service";

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get dashboard analytics
 *     description: Retrieve comprehensive analytics data for the dashboard
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d, 90d, 1y, all]
 *           default: 30d
 *         description: Time range for analytics
 *     responses:
 *       200:
 *         description: Dashboard analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overview:
 *                   type: object
 *                   properties:
 *                     totalMessages:
 *                       type: number
 *                     totalAgents:
 *                       type: number
 *                     totalUsers:
 *                       type: number
 *                     activeToday:
 *                       type: number
 *                 usage:
 *                   type: object
 *                 users:
 *                   type: object
 *                 revenue:
 *                   type: object
 *                 emotional:
 *                   type: object
 *                 topAgents:
 *                   type: array
 *                 timeSeries:
 *                   type: object
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") || "30d") as TimeRange;

    const stats = await getDashboardStats(user.id, range);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to get dashboard statistics" },
      { status: 500 }
    );
  }
}
