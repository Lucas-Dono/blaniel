/**
 * Report Service - Report and moderation system
 */

import { nanoid } from "nanoid";
import { prisma } from '@/lib/prisma';

/**
 * Sanitize input text to prevent XSS
 */
function sanitizeText(text: string | undefined): string | undefined {
  if (!text) return text;

  // Remove dangerous characters but keep content readable
  return text
    .replace(/[<>]/g, '') // Remove < and >
    .substring(0, 1000) // Limit length
    .trim();
}

export const ReportService = {
  /**
   * Create post report
   */
  async reportPost(data: {
    postId: string;
    reporterId: string;
    reason: string;
    description?: string;
  }) {
    // Check that post exists
    const post = await prisma.communityPost.findUnique({
      where: { id: data.postId },
      select: { id: true, authorId: true, communityId: true },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    // Check that hasn't reported before
    const existingReport = await prisma.postReport.findFirst({
      where: {
        postId: data.postId,
        reporterId: data.reporterId,
      },
    });

    if (existingReport) {
      throw new Error('You have already reported this post');
    }

    // Cannot report your own content
    if (post.authorId === data.reporterId) {
      throw new Error('Cannot report your own content');
    }

    // Create report with sanitized description
    const report = await prisma.postReport.create({
      data: {
        id: nanoid(),
        postId: data.postId,
        reporterId: data.reporterId,
        reason: data.reason,
        description: sanitizeText(data.description),
        status: 'pending',
      },
      include: {
        CommunityPost: {
          select: {
            id: true,
            title: true,
            content: true,
            authorId: true,
            communityId: true,
            createdAt: true,
            User: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            Community: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return report;
  },

  /**
   * Crear reporte de comentario
   */
  async reportComment(data: {
    commentId: string;
    reporterId: string;
    reason: string;
    description?: string;
  }) {
    // Verificar que el comentario existe
    const comment = await prisma.communityComment.findUnique({
      where: { id: data.commentId },
      select: { id: true, authorId: true, postId: true },
    });

    if (!comment) {
      throw new Error('Comentario no encontrado');
    }

    // Verificar que no haya reportado antes
    const existingReport = await prisma.commentReport.findFirst({
      where: {
        commentId: data.commentId,
        reporterId: data.reporterId,
      },
    });

    if (existingReport) {
      throw new Error('Ya has reportado este comentario');
    }

    // No puedes reportar tu propio contenido
    if (comment.authorId === data.reporterId) {
      throw new Error('No puedes reportar tu propio contenido');
    }

    // Create report with sanitized description
    const report = await prisma.commentReport.create({
      data: {
        id: nanoid(),
        commentId: data.commentId,
        reporterId: data.reporterId,
        reason: data.reason,
        description: sanitizeText(data.description),
        status: 'pending',
      },
      include: {
        CommunityComment: {
          select: {
            id: true,
            content: true,
            authorId: true,
            postId: true,
            createdAt: true,
            User: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            CommunityPost: {
              select: {
                id: true,
                title: true,
                communityId: true,
              },
            },
          },
        },
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return report;
  },

  /**
   * Obtener queue de reportes pendientes para una comunidad
   * Solo para moderadores y owners
   */
  async getReportQueue(communityId: string, filters?: {
    status?: string;
    type?: 'post' | 'comment' | 'all';
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 25;
    const skip = (page - 1) * limit;
    const status = filters?.status || 'pending';
    const type = filters?.type || 'all';

    const reports: any[] = [];

    // Get reportes de posts
    if (type === 'post' || type === 'all') {
      const postReports = await prisma.postReport.findMany({
        where: {
          status,
          CommunityPost: {
            communityId,
          },
        },
        include: {
          CommunityPost: {
            select: {
              id: true,
              title: true,
              content: true,
              authorId: true,
              communityId: true,
              createdAt: true,
              User: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
              Community: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          User: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      reports.push(...postReports.map(r => ({ ...r, type: 'post' })));
    }

    // Get reportes de comentarios
    if (type === 'comment' || type === 'all') {
      const commentReports = await prisma.commentReport.findMany({
        where: {
          status,
          CommunityComment: {
            CommunityPost: {
              communityId,
            },
          },
        },
        include: {
          CommunityComment: {
            select: {
              id: true,
              content: true,
              authorId: true,
              postId: true,
              createdAt: true,
              User: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
              CommunityPost: {
                select: {
                  id: true,
                  title: true,
                  communityId: true,
                  Community: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
          User: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      reports.push(...commentReports.map(r => ({ ...r, type: 'comment' })));
    }

    // Sort by date (most recent first)
    reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return reports;
  },

  /**
   * Resolver reporte de post
   */
  async resolvePostReport(data: {
    reportId: string;
    reviewerId: string;
    action: 'dismiss' | 'remove' | 'warn' | 'ban';
    resolution?: string;
  }) {
    const report = await prisma.postReport.findUnique({
      where: { id: data.reportId },
      include: {
        CommunityPost: {
          select: {
            id: true,
            authorId: true,
            communityId: true,
          },
        },
      },
    });

    if (!report) {
      throw new Error('Reporte no encontrado');
    }

    if (report.status !== 'pending') {
      throw new Error('Este reporte ya fue revisado');
    }

    // Update reporte
    await prisma.postReport.update({
      where: { id: data.reportId },
      data: {
        status: data.action === 'dismiss' ? 'dismissed' : 'action_taken',
        reviewedBy: data.reviewerId,
        reviewedAt: new Date(),
        action: data.action,
      },
    });

    // Apply action
    switch (data.action) {
      case 'remove':
        // Remover post
        await prisma.communityPost.update({
          where: { id: report.postId },
          data: { status: 'removed' },
        });
        break;

      case 'warn':
        // TODO: Implementar sistema de advertencias
        // Por ahora solo registramos la acción
        break;

      case 'ban':
        // Banear usuario de la comunidad
        if (report.CommunityPost.communityId) {
          await prisma.communityMember.updateMany({
            where: {
              communityId: report.CommunityPost.communityId,
              userId: report.CommunityPost.authorId,
            },
            data: {
              isBanned: true,
            },
          });

          // Remover el post también
          await prisma.communityPost.update({
            where: { id: report.postId },
            data: { status: 'removed' },
          });
        }
        break;

      case 'dismiss':
        // No hacer nada, solo marcar como revisado
        break;
    }

    return { success: true, action: data.action };
  },

  /**
   * Resolver reporte de comentario
   */
  async resolveCommentReport(data: {
    reportId: string;
    reviewerId: string;
    action: 'dismiss' | 'remove' | 'warn' | 'ban';
    resolution?: string;
  }) {
    const report = await prisma.commentReport.findUnique({
      where: { id: data.reportId },
      include: {
        CommunityComment: {
          select: {
            id: true,
            authorId: true,
            CommunityPost: {
              select: {
                communityId: true,
              },
            },
          },
        },
      },
    });

    if (!report) {
      throw new Error('Reporte no encontrado');
    }

    if (report.status !== 'pending') {
      throw new Error('Este reporte ya fue revisado');
    }

    // Update reporte
    await prisma.commentReport.update({
      where: { id: data.reportId },
      data: {
        status: data.action === 'dismiss' ? 'dismissed' : 'action_taken',
        reviewedBy: data.reviewerId,
        reviewedAt: new Date(),
        action: data.action,
      },
    });

    // Apply action
    switch (data.action) {
      case 'remove':
        // Remover comentario
        await prisma.communityComment.delete({
          where: { id: report.commentId },
        });
        break;

      case 'warn':
        // TODO: Implementar sistema de advertencias
        break;

      case 'ban':
        // Banear usuario de la comunidad
        const communityId = report.CommunityComment.CommunityPost.communityId;
        if (communityId) {
          await prisma.communityMember.updateMany({
            where: {
              communityId,
              userId: report.CommunityComment.authorId,
            },
            data: {
              isBanned: true,
            },
          });

          // Remover el comentario también
          await prisma.communityComment.delete({
            where: { id: report.commentId },
          });
        }
        break;

      case 'dismiss':
        // No hacer nada
        break;
    }

    return { success: true, action: data.action };
  },

  /**
   * Obtener estadísticas de reportes para una comunidad
   */
  async getReportStats(communityId: string) {
    const [pendingPosts, pendingComments, resolvedToday] = await Promise.all([
      // Posts pendientes
      prisma.postReport.count({
        where: {
          status: 'pending',
          CommunityPost: {
            communityId,
          },
        },
      }),
      // Comentarios pendientes
      prisma.commentReport.count({
        where: {
          status: 'pending',
          CommunityComment: {
            CommunityPost: {
              communityId,
            },
          },
        },
      }),
      // Resueltos hoy
      prisma.postReport.count({
        where: {
          status: { in: ['dismissed', 'action_taken'] },
          reviewedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
          CommunityPost: {
            communityId,
          },
        },
      }),
    ]);

    return {
      pending: pendingPosts + pendingComments,
      pendingPosts,
      pendingComments,
      resolvedToday,
    };
  },

  /**
   * Verificar si usuario puede moderar en una comunidad
   */
  async canModerate(userId: string, communityId: string): Promise<boolean> {
    const community = await prisma.community.findUnique({
      where: { id: communityId },
      select: {
        ownerId: true,
        // coOwnerIds: true, // Field removed from schema
      },
    });

    if (!community) {
      return false;
    }

    // Owner o co-owner
    // const coOwnerIds = Array.isArray(community.coOwnerIds)
    //   ? community.coOwnerIds
    //   : [];

    if (community.ownerId === userId) { // || coOwnerIds.includes(userId)
      return true;
    }

    // Moderador
    const member = await prisma.communityMember.findFirst({
      where: {
        communityId,
        userId,
        role: { in: ['owner', 'moderator'] },
        canModerate: true,
      },
    });

    return !!member;
  },
};
