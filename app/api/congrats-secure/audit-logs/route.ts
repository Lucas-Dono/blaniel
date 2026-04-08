/**
 * API Admin - Audit Logs
 * Viewing and searching audit logs
 */

import {NextResponse} from 'next/server';
import { withAdminAuth } from '@/lib/admin/middleware';
import { logAuditAction, AuditTargetType, getAuditLogs } from '@/lib/admin/audit-logger';

/**
 * GET /api/admin-secure/audit-logs
 * Obtiene audit logs con filtros
 */
export const GET = withAdminAuth(async (request, { admin }) => {
  try {
    const url = new URL(request.url);

    // Formeters
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
    const offset = (page - 1) * limit;

    const action = url.searchParams.get('action') || undefined;
    const targetType = url.searchParams.get('targetType') || undefined;
    const targetId = url.searchParams.get('targetId') || undefined;
    const adminAccessId = url.searchParams.get('adminAccessId') || undefined;

    // Fechas
    const startDate = url.searchParams.get('startDate')
      ? new Date(url.searchParams.get('startDate')!)
      : undefined;
    const endDate = url.searchParams.get('endDate')
      ? new Date(url.searchParams.get('endDate')!)
      : undefined;

    // Get logs
    const { logs, total } = await getAuditLogs({
      action,
      targetType,
      targetId,
      adminAccessId,
      startDate,
      endDate,
      limit,
      offset
    });

    // Log de acceso a audit logs
    await logAuditAction(admin, {
      action: 'audit_logs.view',
      targetType: AuditTargetType.SYSTEM,
      details: {
        filters: { action, targetType, targetId, adminAccessId },
        resultsCount: logs.length
      }
    });

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Error al obtener audit logs' },
      { status: 500 }
    );
  }
});
