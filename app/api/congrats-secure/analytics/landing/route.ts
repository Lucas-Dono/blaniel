/**
 * API Admin - Analytics Landing Page
 * Landing page specific KPIs: traffic, demo, conversion
 */

import {NextResponse} from 'next/server';
import { withAdminAuth } from '@/lib/admin/middleware';
import { calculateLandingKPIs, getTimeRange } from '@/lib/analytics/kpi-calculator';
import { logAuditAction, AuditAction, AuditTargetType } from '@/lib/admin/audit-logger';

/**
 * GET /api/congrats-secure/analytics/landing
 * Gets landing page KPIs (traffic, demo, sources, devices)
 */
export const GET = withAdminAuth(async (request, { admin }) => {
  try {
    // Get time parameters (default 7 days for landing)
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '7', 10);

    // Validate days (max 90)
    if (days < 1 || days > 90) {
      return NextResponse.json(
        { error: 'Parámetro days debe estar entre 1 y 90' },
        { status: 400 }
      );
    }

    // Calcular time range
    const timeRange = getTimeRange(days);

    // Calcular KPIs de landing
    const landingData = await calculateLandingKPIs(timeRange);

    // Log audit
    await logAuditAction(admin, {
      action: AuditAction.ANALYTICS_VIEW,
      targetType: AuditTargetType.SYSTEM,
      details: { endpoint: 'analytics/landing', days }
    });

    return NextResponse.json({
      timeRange: {
        start: timeRange.start,
        end: timeRange.end,
        days: timeRange.days
      },
      data: landingData
    });

  } catch (error) {
    console.error('Error fetching landing analytics:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas de landing page' },
      { status: 500 }
    );
  }
});
