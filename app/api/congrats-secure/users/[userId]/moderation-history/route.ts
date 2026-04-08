/**
 * API Admin - Historial de Moderación de Usuario
 */

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/middleware';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/congrats-secure/users/[userId]/moderation-history
 * Obtiene el historial completo de moderación de un usuario
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

    // Get usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isBanned: true,
        bannedAt: true,
        bannedUntil: true,
        bannedReason: true,
        bannedBy: true,
        isSuspended: true,
        suspendedAt: true,
        suspendedUntil: true,
        suspendedReason: true,
        suspendedBy: true,
        warningCount: true,
        lastWarningAt: true,
        lastWarningReason: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Get historial de moderación
    const history = await prisma.userModerationLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return NextResponse.json({
      user,
      history,
      stats: {
        totalActions: history.length,
        bans: history.filter(h => h.action === 'ban').length,
        suspensions: history.filter(h => h.action === 'suspend').length,
        warnings: history.filter(h => h.action === 'warn').length,
        roleChanges: history.filter(h => h.action === 'update_role').length
      }
    });

  } catch (error) {
    console.error('Error fetching moderation history:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial de moderación' },
      { status: 500 }
    );
  }
});
