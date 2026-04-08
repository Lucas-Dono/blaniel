/**
 * Analytics Export API
 * Export analytics data as CSV
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { exportAnalyticsCSV, type TimeRange } from "@/lib/analytics/service";

/**
 * @swagger
 * /api/analytics/export:
 *   get:
 *     summary: Export analytics as CSV
 *     description: Export analytics data in CSV format for external analysis
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
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
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

    const csv = await exportAnalyticsCSV(user.id, range);

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `analytics-${range}-${timestamp}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting analytics:", error);
    return NextResponse.json(
      { error: "Failed to export analytics" },
      { status: 500 }
    );
  }
}
