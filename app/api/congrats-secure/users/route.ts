/**
 * API Admin - User Management
 * User list and search
 */

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/middleware';
import { logAuditAction, AuditAction, AuditTargetType } from '@/lib/admin/audit-logger';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin-secure/users
 * Lists users with filters and search
 */
export const GET = withAdminAuth(async (request, { admin }) => {
  try {
    const url = new URL(request.url);

    // Pagination parameters
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset = (page - 1) * limit;

    // Filtering parameters
    const search = url.searchParams.get('search') || undefined;
    const plan = url.searchParams.get('plan') || undefined;
    const verified = url.searchParams.get('verified');
    const adult = url.searchParams.get('adult');

    // Construir where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { id: { contains: search } }
      ];
    }

    if (plan) where.plan = plan;
    if (verified === 'true') where.emailVerified = true;
    if (verified === 'false') where.emailVerified = false;
    if (adult === 'true') where.isAdult = true;
    if (adult === 'false') where.isAdult = false;

    // Ejecutar queries en paralelo
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          plan: true,
          emailVerified: true,
          isAdult: true,
          ageVerified: true,
          nsfwConsent: true,
          createdAt: true,
          updatedAt: true,
          // Moderation fields
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
          lastWarningReason: true,
          _count: {
            select: {
              Agent: true,
              CommunityPost: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.user.count({ where })
    ]);

    // Log audit
    await logAuditAction(admin, {
      action: AuditAction.USER_VIEW,
      targetType: AuditTargetType.SYSTEM,
      details: {
        search,
        plan,
        page,
        limit,
        resultsCount: users.length
      }
    });

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Error al obtener usuarios' },
      { status: 500 }
    );
  }
});
