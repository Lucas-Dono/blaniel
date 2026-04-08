/** API Admin - User Details and Update */

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/middleware';
import { logAuditAction, AuditAction, AuditTargetType, trackChanges } from '@/lib/admin/audit-logger';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin-secure/users/[userId]
 * Obtiene detalles completos de un usuario
 */
export const GET = withAdminAuth(async (request, { admin, params }) => {
  try {
    const userId = params?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId requerido' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        UserModerationLog: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        Agent: {
          select: {
            id: true,
            name: true,
            description: true,
            visibility: true,
            nsfwMode: true,
            createdAt: true,
            _count: {
              select: {
                Message: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        Subscription: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        Payment: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        CommunityPost: {
          select: {
            id: true,
            title: true,
            type: true,
            createdAt: true,
            _count: {
              select: {
                CommunityComment: true,
                PostAward: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: {
            Agent: true,
            CommunityPost: true,
            CommunityComment: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Log audit
    await logAuditAction(admin, {
      action: AuditAction.USER_VIEW,
      targetType: AuditTargetType.USER,
      targetId: userId,
      details: { email: user.email }
    });

    return NextResponse.json({ user });

  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Error al obtener usuario' },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/admin-secure/users/[userId]
 * Updates user data
 */
export const PATCH = withAdminAuth(async (request, { admin, params }) => {
  try {
    const userId = params?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId requerido' },
        { status: 400 }
      );
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Parsear body
    const body = await request.json();

    // Campos permitidos para actualizar
    const allowedFields = [
      'name',
      'email',
      'plan',
      'emailVerified',
      'isAdult',
      'ageVerified',
      'nsfwConsent',
      'sfwProtection',
      'imageUploadLimit'
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Update usuario
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    // Track changes para audit log
    const changes = trackChanges(currentUser, updateData, allowedFields as any);

    // Log audit
    await logAuditAction(admin, {
      action: AuditAction.USER_UPDATE,
      targetType: AuditTargetType.USER,
      targetId: userId,
      details: {
        email: updatedUser.email,
        changes
      }
    });

    return NextResponse.json({
      user: updatedUser,
      message: 'Usuario actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Error al actualizar usuario' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin-secure/users/[userId]
 * Deletes a user (soft delete or hard delete)
 */
export const DELETE = withAdminAuth(async (request, { admin, params }) => {
  try {
    const userId = params?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId requerido' },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const hardDelete = url.searchParams.get('hard') === 'true';

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    if (hardDelete) {
      // Hard delete - elimina todo
      await prisma.user.delete({
        where: { id: userId }
      });

      // Log audit
      await logAuditAction(admin, {
        action: AuditAction.USER_DELETE,
        targetType: AuditTargetType.USER,
        targetId: userId,
        details: {
          email: user.email,
          deleteType: 'hard'
        }
      });

      return NextResponse.json({
        message: 'Usuario eliminado permanentemente'
      });
    } else {
      // Soft delete - desactivar cuenta
      // (En tu schema actual no hay campo "deleted" o "active",
      // so you could add one or use another approach)

      // Por ahora, cambiar email y desactivar
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${Date.now()}_${user.email}`,
          emailVerified: false
        }
      });

      // Log audit
      await logAuditAction(admin, {
        action: AuditAction.USER_DELETE,
        targetType: AuditTargetType.USER,
        targetId: userId,
        details: {
          email: user.email,
          deleteType: 'soft'
        }
      });

      return NextResponse.json({
        message: 'Usuario desactivado'
      });
    }

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Error al eliminar usuario' },
      { status: 500 }
    );
  }
});
