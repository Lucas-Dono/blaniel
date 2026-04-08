/**
 * Admin Costs API
 * GET /api/admin/costs - Get cost summary and analytics
 */

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/middleware';
import {
  getCostSummary,
  getDailyCosts,
  getTopUsers,
  getCostProjection,
} from '@/lib/cost-tracking/tracker';
import { prisma } from '@/lib/prisma';

export const GET = withAdminAuth(async (request, { admin: _admin }) => {
  try {

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const days = parseInt(searchParams.get('days') || '30', 10);
    const view = searchParams.get('view') || 'summary'; // summary, daily, top-users, projection

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    switch (view) {
      case 'daily':
        const dailyCosts = await getDailyCosts(userId, days);
        return NextResponse.json({
          success: true,
          data: dailyCosts,
        });

      case 'top-users':
        const topUsers = await getTopUsers(10, startDate, endDate);
        // Fetch user details
        const userIds = topUsers.map((u: any) => u.userId);
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, name: true, plan: true },
        });

        const topUsersWithDetails = topUsers.map((tu: any) => {
          const userDetail = users.find((u: any) => u.id === tu.userId);
          return {
            ...tu,
            email: userDetail?.email,
            name: userDetail?.name,
            plan: userDetail?.plan,
          };
        });

        return NextResponse.json({
          success: true,
          data: topUsersWithDetails,
        });

      case 'projection':
        const projection = await getCostProjection(userId);
        return NextResponse.json({
          success: true,
          data: projection,
        });

      case 'summary':
      default:
        const summary = await getCostSummary(userId, startDate, endDate);
        return NextResponse.json({
          success: true,
          data: summary,
        });
    }
  } catch (error) {
    console.error('[Admin Costs API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cost data',
      },
      { status: 500 }
    );
  }
});
