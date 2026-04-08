/**
 * Security Alerts API
 *
 * Gestión de alertas de seguridad
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecentAlerts, acknowledgeAlert, resolveAlert } from '@/lib/security/alerting';

// GET - Obtener alertas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const severity = searchParams.get('severity')?.split(',') as any;
    const type = searchParams.get('type')?.split(',') as any;
    const acknowledged = searchParams.get('acknowledged');

    const alerts = await getRecentAlerts(limit, {
      severity,
      type,
      acknowledged: acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('[ALERTS_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

// POST - Acknowledge o resolve alert
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId, action, acknowledgedBy, resolution } = body;

    if (!alertId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (action === 'acknowledge') {
      if (!acknowledgedBy) {
        return NextResponse.json(
          { error: 'acknowledgedBy is required' },
          { status: 400 }
        );
      }

      await acknowledgeAlert(alertId, acknowledgedBy);

      return NextResponse.json({
        success: true,
        message: 'Alert acknowledged',
      });
    } else if (action === 'resolve') {
      if (!resolution) {
        return NextResponse.json(
          { error: 'resolution is required' },
          { status: 400 }
        );
      }

      await resolveAlert(alertId, resolution);

      return NextResponse.json({
        success: true,
        message: 'Alert resolved',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[ALERTS_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process alert' },
      { status: 500 }
    );
  }
}
