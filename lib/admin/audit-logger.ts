/**
 * Automatic Audit Log System
 * Records all administrative actions with full context
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import type { AdminContext } from './middleware';

/**
 * Categories of administrative actions
 */
export enum AuditAction {
  // Users
  USER_VIEW = 'user.view',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',
  USER_BAN = 'user.ban',
  USER_UNBAN = 'user.unban',
  USER_CHANGE_PLAN = 'user.change_plan',
  USER_RESET_PASSWORD = 'user.reset_password',

  // Agents
  AGENT_VIEW = 'agent.view',
  AGENT_UPDATE = 'agent.update',
  AGENT_DELETE = 'agent.delete',
  AGENT_MODERATE = 'agent.moderate',

  // Certificates
  CERTIFICATE_GENERATE = 'certificate.generate',
  CERTIFICATE_REVOKE = 'certificate.revoke',
  CERTIFICATE_DOWNLOAD = 'certificate.download',

  // Moderation
  MODERATION_APPROVE = 'moderation.approve',
  MODERATION_REJECT = 'moderation.reject',
  MODERATION_BAN_USER = 'moderation.ban_user',
  MODERATION_DELETE_CONTENT = 'moderation.delete_content',

  // Analytics
  ANALYTICS_VIEW = 'analytics.view',
  ANALYTICS_EXPORT = 'analytics.export',

  // Settings (already in English)
  SETTINGS_UPDATE = 'settings.update',
  SETTINGS_VIEW = 'settings.view',

  // System
  ADMIN_ACCESS_DENIED = 'admin.access_denied',
  ADMIN_LOGIN = 'admin.login',
  EMERGENCY_ACCESS = 'emergency.access',
  EMERGENCY_FAILED = 'emergency.failed',
}

/**
 * Types of targets for audit logs
 */
export enum AuditTargetType {
  USER = 'User',
  AGENT = 'Agent',
  CERTIFICATE = 'Certificate',
  ADMIN_ACCESS = 'AdminAccess',
  POST = 'Post',
  COMMENT = 'Comment',
  SETTINGS = 'Settings',
  SYSTEM = 'System',
}

interface AuditLogData {
  action: AuditAction | string;
  targetType: AuditTargetType | string;
  targetId?: string;
  details?: Record<string, any>;
}

/**
 * Records an action in the audit log
 */
export async function logAuditAction(
  admin: AdminContext,
  data: AuditLogData
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        id: nanoid(),
        adminAccessId: admin.adminAccessId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        ipAddress: admin.ipAddress,
        userAgent: admin.userAgent,
        details: data.details
      }
    });
  } catch (error) {
    // Don't fail if logging fails, but record the error
    console.error('Error logging audit action:', error);
  }
}

/**
 * Records a system action (without a specific admin)
 */
export async function logSystemAction(
  action: AuditAction | string,
  targetType: AuditTargetType | string,
  targetId?: string,
  details?: Record<string, any>,
  ipAddress: string = 'system',
  userAgent: string = 'system'
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        id: nanoid(),
        adminAccessId: 'system',
        action,
        targetType,
        targetId,
        ipAddress,
        userAgent,
        details
      }
    });
  } catch (error) {
    console.error('Error logging system action:', error);
  }
}

/**
 * Helper to record changes in objects
 * Compares before/after and records only modified fields
 */
export function trackChanges<T extends Record<string, any>>(
  before: T,
  after: Partial<T>,
  fieldsToTrack?: Array<keyof T>
): Record<string, { before: any; after: any }> {
  const changes: Record<string, { before: any; after: any }> = {};

  const fields = fieldsToTrack || (Object.keys(after) as Array<keyof T>);

  for (const field of fields) {
    if (after[field] !== undefined && before[field] !== after[field]) {
      changes[field as string] = {
        before: before[field],
        after: after[field]
      };
    }
  }

  return changes;
}

/**
 * Gets audit logs with filters
 */
export async function getAuditLogs(params: {
  adminAccessId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (params.adminAccessId) where.adminAccessId = params.adminAccessId;
  if (params.action) where.action = params.action;
  if (params.targetType) where.targetType = params.targetType;
  if (params.targetId) where.targetId = params.targetId;

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) where.createdAt.gte = params.startDate;
    if (params.endDate) where.createdAt.lte = params.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit || 100,
      skip: params.offset || 0,
      include: {
        AdminAccess: {
          include: {
            User: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        }
      }
    }),
    prisma.auditLog.count({ where })
  ]);

  return { logs, total };
}

/**
 * Gets audit log statistics
 */
export async function getAuditStats(params: {
  adminAccessId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const where: any = {};

  if (params.adminAccessId) where.adminAccessId = params.adminAccessId;

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) where.createdAt.gte = params.startDate;
    if (params.endDate) where.createdAt.lte = params.endDate;
  }

  // Total actions
  const totalActions = await prisma.auditLog.count({ where });

  // Actions by type
  const actionsByType = await prisma.auditLog.groupBy({
    by: ['action'],
    where,
    _count: true,
    orderBy: { _count: { action: 'desc' } }
  });

  // Actions by admin
  const actionsByAdmin = await prisma.auditLog.groupBy({
    by: ['adminAccessId'],
    where,
    _count: true,
    orderBy: { _count: { adminAccessId: 'desc' } }
  });

  // Actions by target type
  const actionsByTargetType = await prisma.auditLog.groupBy({
    by: ['targetType'],
    where,
    _count: true,
    orderBy: { _count: { targetType: 'desc' } }
  });

  return {
    totalActions,
    actionsByType: actionsByType.map(a => ({
      action: a.action,
      count: a._count
    })),
    actionsByAdmin: actionsByAdmin.map(a => ({
      adminAccessId: a.adminAccessId,
      count: a._count
    })),
    actionsByTargetType: actionsByTargetType.map(a => ({
      targetType: a.targetType,
      count: a._count
    }))
  };
}

/**
 * Wrapper for functions that automatically log their execution
 *
 * Usage:
 * ```ts
 * const updateUser = withAuditLog(
 *   async (userId, data) => {
 *     // update logic
 *     return updatedUser;
 *   },
 *   AuditAction.USER_UPDATE,
 *   AuditTargetType.USER
 * );
 *
 * await updateUser(admin, userId, data);
 * ```
 */
export function withAuditLog<TArgs extends any[], TReturn>(
  fn: (admin: AdminContext, ...args: TArgs) => Promise<TReturn>,
  action: AuditAction | string,
  targetType: AuditTargetType | string,
  getTargetId?: (...args: TArgs) => string | undefined,
  getDetails?: (...args: TArgs) => Record<string, any> | undefined
) {
  return async (admin: AdminContext, ...args: TArgs): Promise<TReturn> => {
    const targetId = getTargetId ? getTargetId(...args) : undefined;
    const details = getDetails ? getDetails(...args) : undefined;

    try {
      const result = await fn(admin, ...args);

      // Log successful execution
      await logAuditAction(admin, {
        action,
        targetType,
        targetId,
        details: {
          ...details,
          success: true
        }
      });

      return result;
    } catch (error) {
      // Log execution error
      await logAuditAction(admin, {
        action,
        targetType,
        targetId,
        details: {
          ...details,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  };
}
