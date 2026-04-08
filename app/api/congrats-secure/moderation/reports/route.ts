/**
 * API Admin - Report Moderation
 * Content report management (posts, comments)
 */

import {NextResponse} from 'next/server';
import { withAdminAuth } from '@/lib/admin/middleware';
import { logAuditAction, AuditAction, AuditTargetType } from '@/lib/admin/audit-logger';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin-secure/moderation/reports
 * Lista reportes pendientes y resueltos
 */
export const GET = withAdminAuth(async (request, { admin }) => {
  try {
    const url = new URL(request.url);

    // Formeters
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset = (page - 1) * limit;
    const resolved = url.searchParams.get('resolved');
    const type = url.searchParams.get('type'); // 'post' | 'comment'

    // Post Reports
    const postReportsWhere: any = {};
    if (resolved === 'true') postReportsWhere.status = { in: ['action_taken', 'dismissed'] };
    if (resolved === 'false') postReportsWhere.status = 'pending';

    // Comment Reports
    const commentReportsWhere: any = {};
    if (resolved === 'true') commentReportsWhere.status = { in: ['action_taken', 'dismissed'] };
    if (resolved === 'false') commentReportsWhere.status = 'pending';

    // Get reports by type
    let postReports: any[] = [];
    let commentReports: any[] = [];
    let totalPosts = 0;
    let totalComments = 0;

    if (!type || type === 'post') {
      [postReports, totalPosts] = await Promise.all([
        prisma.postReport.findMany({
          where: postReportsWhere,
          include: {
            CommunityPost: {
              select: {
                id: true,
                title: true,
                content: true,
                type: true,
                User: {
                  select: {
                    id: true,
                    email: true,
                    name: true
                  }
                }
              }
            },
            User: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.postReport.count({ where: postReportsWhere })
      ]);
    }

    if (!type || type === 'comment') {
      [commentReports, totalComments] = await Promise.all([
        prisma.commentReport.findMany({
          where: commentReportsWhere,
          include: {
            CommunityComment: {
              select: {
                id: true,
                content: true,
                User: {
                  select: {
                    id: true,
                    email: true,
                    name: true
                  }
                }
              }
            },
            User: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.commentReport.count({ where: commentReportsWhere })
      ]);
    }

    // Combinar y formatear
    const reports = [
      ...postReports.map((r: any) => ({
        id: r.id,
        type: 'post',
        reason: r.reason,
        description: r.description,
        status: r.status,
        reviewedAt: r.reviewedAt,
        reviewedBy: r.reviewedBy,
        action: r.action,
        createdAt: r.createdAt,
        content: r.CommunityPost,
        reporter: r.User
      })),
      ...commentReports.map((r: any) => ({
        id: r.id,
        type: 'comment',
        reason: r.reason,
        description: r.description,
        status: r.status,
        reviewedAt: r.reviewedAt,
        reviewedBy: r.reviewedBy,
        action: r.action,
        createdAt: r.createdAt,
        content: r.CommunityComment,
        reporter: r.User
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = totalPosts + totalComments;

    // Log audit
    await logAuditAction(admin, {
      action: 'moderation.view_reports',
      targetType: AuditTargetType.SYSTEM,
      details: {
        resolved,
        type,
        page,
        limit,
        resultsCount: reports.length
      }
    });

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        totalPosts,
        totalComments,
        total
      }
    });

  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Error al obtener reportes' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin-secure/moderation/reports/[reportId]/resolve
 * Resuelve un reporte (aprobar o rechazar)
 *
 * Body:
 * {
 *   "action": "approve" | "reject" | "delete_content" | "ban_user",
 *   "notes": "string"
 * }
 */
export const POST = withAdminAuth(async (request, { admin }) => {
  try {
    const body = await request.json();
    const { reportId, type, action, notes } = body;

    if (!reportId || !type || !action) {
      return NextResponse.json(
        { error: 'reportId, type y action son requeridos' },
        { status: 400 }
      );
    }

    // Update report by type
    if (type === 'post') {
      const report = await prisma.postReport.update({
        where: { id: reportId },
        data: {
          status: action === 'reject' ? 'dismissed' : 'action_taken',
          reviewedAt: new Date(),
          reviewedBy: admin.userId,
          action
        },
        include: {
          CommunityPost: {
            select: {
              id: true,
              authorId: true
            }
          }
        }
      });

      // Take action as specified
      if (action === 'delete_content') {
        await prisma.communityPost.delete({
          where: { id: report.CommunityPost.id }
        });
      } else if (action === 'ban_user') {
        // Implementar ban de usuario (agregar campo en User si no existe)
        // Por ahora, solo logging
      }

      // Log audit
      await logAuditAction(admin, {
        action: AuditAction.MODERATION_APPROVE,
        targetType: AuditTargetType.POST,
        targetId: report.CommunityPost.id,
        details: {
          reportId,
          action,
          notes
        }
      });

    } else if (type === 'comment') {
      const report = await prisma.commentReport.update({
        where: { id: reportId },
        data: {
          status: action === 'reject' ? 'dismissed' : 'action_taken',
          reviewedAt: new Date(),
          reviewedBy: admin.userId,
          action
        },
        include: {
          CommunityComment: {
            select: {
              id: true,
              authorId: true
            }
          }
        }
      });

      // Take action as specified
      if (action === 'delete_content') {
        await prisma.communityComment.delete({
          where: { id: report.CommunityComment.id }
        });
      } else if (action === 'ban_user') {
        // Implementar ban de usuario
      }

      // Log audit
      await logAuditAction(admin, {
        action: AuditAction.MODERATION_APPROVE,
        targetType: AuditTargetType.COMMENT,
        targetId: report.CommunityComment.id,
        details: {
          reportId,
          action,
          notes
        }
      });
    }

    return NextResponse.json({
      message: 'Reporte resuelto exitosamente',
      action
    });

  } catch (error) {
    console.error('Error resolving report:', error);
    return NextResponse.json(
      { error: 'Error al resolver reporte' },
      { status: 500 }
    );
  }
});
