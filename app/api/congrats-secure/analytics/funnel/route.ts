/**
 * API Admin - Analytics Funnel
 * Complete conversion funnel: Landing → Demo → Signup → Paid
 */

import {NextResponse} from 'next/server';
import { withAdminAuth } from '@/lib/admin/middleware';
import { calculateFunnelKPIs, getTimeRange } from '@/lib/analytics/kpi-calculator';
import { logAuditAction, AuditAction, AuditTargetType } from '@/lib/admin/audit-logger';

/**
 * GET /api/congrats-secure/analytics/funnel
 * Retrieves complete conversion funnel KPIs
 */
export const GET = withAdminAuth(async (request, { admin }) => {
  try {
    // Get time parameters (default 30 days)
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);

    // Validate days (max 90)
    if (days < 1 || days > 90) {
      return NextResponse.json(
        { error: 'Parámetro days debe estar entre 1 y 90' },
        { status: 400 }
      );
    }

    // Calcular time range
    const timeRange = getTimeRange(days);

    // Calcular KPIs del funnel
    const funnelData = await calculateFunnelKPIs(timeRange);

    // Log audit
    await logAuditAction(admin, {
      action: AuditAction.ANALYTICS_VIEW,
      targetType: AuditTargetType.SYSTEM,
      details: { endpoint: 'analytics/funnel', days }
    });

    return NextResponse.json({
      timeRange: {
        start: timeRange.start,
        end: timeRange.end,
        days: timeRange.days
      },
      data: funnelData
    });

  } catch (error) {
    console.error('Error fetching funnel analytics:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas del funnel' },
      { status: 500 }
    );
  }
});
