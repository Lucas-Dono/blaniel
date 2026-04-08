/**
 * API Admin - User Analytics
 * Analytics for a specific user
 */

import {NextResponse} from 'next/server';
import { withAdminAuth } from '@/lib/admin/middleware';
import { calculateUserKPIs } from '@/lib/analytics/kpi-calculator';
import { logAuditAction, AuditAction, AuditTargetType } from '@/lib/admin/audit-logger';

/**
 * GET /api/congrats-secure/analytics/users/:userId
 * Gets KPIs for a specific user
 */
export const GET = withAdminAuth(async (request, { admin, params }) => {
  try {
    const userId = params?.userId;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId requerido' },
        { status: 400 }
      );
    }

    // Calculate user KPIs
    const userData = await calculateUserKPIs(userId);

    // Log audit
    await logAuditAction(admin, {
      action: AuditAction.USER_VIEW,
      targetType: AuditTargetType.USER,
      targetId: userId,
      details: { endpoint: 'analytics/users/:userId' }
    });

    return NextResponse.json({
      userId,
      data: userData
    });

  } catch (error) {
    console.error('Error fetching user analytics:', error);

    if (error instanceof Error && error.message === 'User not found') {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Error al obtener estadísticas del usuario' },
      { status: 500 }
    );
  }
});
