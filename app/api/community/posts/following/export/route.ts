import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { UserPreferenceService } from '@/lib/services/user-preference.service';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/community/posts/following/export - Exportar preferencias y datos
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json';

    // Get todos los datos del usuario
    const [contentPreferences, emailConfig, followedPosts, actionHistory] = await Promise.all([
      UserPreferenceService.getUserPreferences(userId),
      prisma.emailNotificationConfig.findUnique({ where: { userId } }),
      prisma.postFollower.findMany({
        where: { userId },
        include: {
          CommunityPost: {
            select: {
              id: true,
              title: true,
              type: true,
              tags: true,
              createdAt: true,
              Community: {
                select: { name: true, slug: true }
              }
            }
          }
        }
      }),
      prisma.userActionHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: userId,
        email: session.user.email
      },
      preferences: {
        content: contentPreferences,
        email: emailConfig
      },
      followedPosts: followedPosts.map(f => ({
        postId: f.postId,
        postTitle: f.CommunityPost.title,
        postType: f.CommunityPost.type,
        community: f.CommunityPost.Community?.name,
        followedAt: f.createdAt,
        notificationsEnabled: f.notificationsEnabled,
        emailNotifications: f.emailNotifications
      })),
      actionHistory: actionHistory.map(a => ({
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        metadata: a.metadata,
        timestamp: a.createdAt
      }))
    };

    if (format === 'csv') {
      // Generate CSV
      const csv = generateCSV(exportData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="blaniel-preferences-${new Date().toISOString()}.csv"`
        }
      });
    }

    // Por defecto, retornar JSON
    return NextResponse.json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="blaniel-preferences-${new Date().toISOString()}.json"`
      }
    });

  } catch (error: any) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { error: error.message || 'Error al exportar datos' },
      { status: 400 }
    );
  }
}

function generateCSV(data: any): string {
  const lines: string[] = [];

  // Header
  lines.push('# Blaniel - Exportación de Preferencias');
  lines.push(`# Fecha: ${data.exportedAt}`);
  lines.push('');

  // Posts Seguidos
  lines.push('## Posts Seguidos');
  lines.push('Post ID,Título,Tipo,Comunidad,Fecha Follow,Notificaciones,Email');
  data.followedPosts.forEach((post: any) => {
    lines.push([
      post.postId,
      `"${post.postTitle}"`,
      post.postType,
      post.community || 'N/A',
      new Date(post.followedAt).toLocaleDateString(),
      post.notificationsEnabled ? 'Sí' : 'No',
      post.emailNotifications ? 'Sí' : 'No'
    ].join(','));
  });

  lines.push('');

  // Historial de Acciones
  lines.push('## Historial de Acciones');
  lines.push('Acción,Tipo,ID,Timestamp');
  data.actionHistory.slice(0, 100).forEach((action: any) => {
    lines.push([
      action.action,
      action.targetType || 'N/A',
      action.targetId || 'N/A',
      new Date(action.timestamp).toLocaleString()
    ].join(','));
  });

  return lines.join('\n');
}
