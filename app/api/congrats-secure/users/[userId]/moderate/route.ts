/**
 * API Admin - Moderación de Usuarios
 * Endpoint unificado para todas las acciones de moderación
 */

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/middleware';
import { logAuditAction, AuditAction, AuditTargetType } from '@/lib/admin/audit-logger';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

/**
 * POST /api/congrats-secure/users/[userId]/moderate
 * Ejecuta acciones de moderación sobre un usuario
 *
 * Body:
 * {
 *   action: 'ban' | 'unban' | 'suspend' | 'unsuspend' | 'warn' | 'update_role',
 *   reason?: string,
 *   duration?: number,  // En días (para ban/suspend temporal)
 *   role?: string      // Solo para update_role
 * }
 */
export const POST = withAdminAuth(async (request, { admin, params }) => {
  try {
    const userId = params?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId requerido' },
        { status: 400 }
      );
    }

    // Get usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isBanned: true,
        isSuspended: true,
        warningCount: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Parsear body
    const body = await request.json();
    const { action, reason, duration, role } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'action requerida' },
        { status: 400 }
      );
    }

    let updateData: any = {};
    let logMessage = '';
    let metadata: any = {};

    switch (action) {
      case 'ban': {
        if (user.isBanned) {
          return NextResponse.json(
            { error: 'Usuario ya está baneado' },
            { status: 400 }
          );
        }

        const bannedUntil = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;

        updateData = {
          isBanned: true,
          bannedAt: new Date(),
          bannedReason: reason || 'No especificado',
          bannedBy: admin.email,
          bannedUntil
        };

        logMessage = duration
          ? `Usuario baneado por ${duration} días`
          : 'Usuario baneado permanentemente';

        metadata = { duration, reason, bannedUntil };
        break;
      }

      case 'unban': {
        if (!user.isBanned) {
          return NextResponse.json(
            { error: 'Usuario no está baneado' },
            { status: 400 }
          );
        }

        updateData = {
          isBanned: false,
          bannedAt: null,
          bannedReason: null,
          bannedBy: null,
          bannedUntil: null
        };

        logMessage = 'Usuario desbaneado';
        metadata = { reason };
        break;
      }

      case 'suspend': {
        if (user.isSuspended) {
          return NextResponse.json(
            { error: 'Usuario ya está suspendido' },
            { status: 400 }
          );
        }

        if (!duration) {
          return NextResponse.json(
            { error: 'duration requerida para suspensión' },
            { status: 400 }
          );
        }

        const suspendedUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

        updateData = {
          isSuspended: true,
          suspendedAt: new Date(),
          suspendedReason: reason || 'No especificado',
          suspendedBy: admin.email,
          suspendedUntil
        };

        logMessage = `Usuario suspendido por ${duration} días`;
        metadata = { duration, reason, suspendedUntil };
        break;
      }

      case 'unsuspend': {
        if (!user.isSuspended) {
          return NextResponse.json(
            { error: 'Usuario no está suspendido' },
            { status: 400 }
          );
        }

        updateData = {
          isSuspended: false,
          suspendedAt: null,
          suspendedReason: null,
          suspendedBy: null,
          suspendedUntil: null
        };

        logMessage = 'Suspensión removida';
        metadata = { reason };
        break;
      }

      case 'warn': {
        if (!reason) {
          return NextResponse.json(
            { error: 'reason requerida para advertencia' },
            { status: 400 }
          );
        }

        updateData = {
          warningCount: user.warningCount + 1,
          lastWarningAt: new Date(),
          lastWarningReason: reason
        };

        logMessage = `Advertencia #${user.warningCount + 1} agregada`;
        metadata = { reason, newWarningCount: user.warningCount + 1 };
        break;
      }

      case 'update_role': {
        if (!role) {
          return NextResponse.json(
            { error: 'role requerido' },
            { status: 400 }
          );
        }

        const allowedRoles = ['user', 'moderator', 'admin', 'vip'];
        if (!allowedRoles.includes(role)) {
          return NextResponse.json(
            { error: `Rol inválido. Roles permitidos: ${allowedRoles.join(', ')}` },
            { status: 400 }
          );
        }

        updateData = { role };
        logMessage = `Rol cambiado de ${user.role} a ${role}`;
        metadata = { previousRole: user.role, newRole: role, reason };
        break;
      }

      default:
        return NextResponse.json(
          { error: `Acción inválida: ${action}` },
          { status: 400 }
        );
    }

    // Update usuario
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    // Create log de moderación
    await prisma.userModerationLog.create({
      data: {
        id: nanoid(),
        userId,
        action,
        reason,
        performedBy: admin.adminAccessId,
        performedByName: admin.email,
        metadata
      }
    });

    // Log de auditoría
    await logAuditAction(admin, {
      action: AuditAction.USER_UPDATE,
      targetType: AuditTargetType.USER,
      targetId: userId,
      details: {
        moderationAction: action,
        message: logMessage,
        userEmail: user.email,
        metadata
      }
    });

    return NextResponse.json({
      success: true,
      message: logMessage,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        isBanned: updatedUser.isBanned,
        isSuspended: updatedUser.isSuspended,
        warningCount: updatedUser.warningCount,
        role: updatedUser.role
      }
    });

  } catch (error) {
    console.error('Error in moderation action:', error);
    return NextResponse.json(
      { error: 'Error al ejecutar acción de moderación' },
      { status: 500 }
    );
  }
});
