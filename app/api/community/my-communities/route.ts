import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

/**
 * GET /api/community/my-communities - Obtener comunidades del usuario
 * Requiere autenticación
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

    // Dynamic import para evitar problemas con edge runtime
    const { prisma } = await import('@/lib/prisma');

    // Get comunidades donde el usuario es miembro
    const memberships = await prisma.communityMember.findMany({
      where: {
        userId: session.user.id,
        isBanned: false, // Excluir comunidades donde está baneado
      },
      include: {
        Community: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            primaryColor: true,
            type: true,
            description: true,
            memberCount: true,
          },
        },
      },
      orderBy: {
        Community: {
          name: 'asc',
        },
      },
    });

    // Mapear a formato simple
    const communities = memberships.map(m => m.Community);

    return NextResponse.json({ communities });
  } catch (error: any) {
    console.error('Error fetching user communities:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener comunidades' },
      { status: 400 }
    );
  }
}
