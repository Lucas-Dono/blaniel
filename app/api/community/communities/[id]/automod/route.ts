import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { AutoModService } from '@/lib/services/automod.service';
import { ReportService } from '@/lib/services/report.service';

/**
 * GET /api/community/communities/[id]/automod - Obtener reglas de AutoMod
 * Solo para moderadores y owners
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Check moderation permissions
    const canModerate = await ReportService.canModerate(
      session.user.id,
      id
    );

    if (!canModerate) {
      return NextResponse.json(
        { error: 'No tienes permisos de moderación en esta comunidad' },
        { status: 403 }
      );
    }

    // Get reglas y estadísticas
    const rules = await AutoModService.getRules(id);
    const stats = await AutoModService.getStats(id);

    return NextResponse.json({ rules, stats });
  } catch (error: any) {
    console.error('Error fetching automod rules:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener reglas' },
      { status: 400 }
    );
  }
}

/**
 * POST /api/community/communities/[id]/automod - Crear regla de AutoMod
 * Solo para owners y co-owners
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Check que es owner o moderador (solo ellos pueden crear reglas)
    const { prisma } = await import('@/lib/prisma');
    const community = await prisma.community.findUnique({
      where: { id },
      select: {
        ownerId: true,
      },
    });

    if (!community) {
      return NextResponse.json(
        { error: 'Comunidad no encontrada' },
        { status: 404 }
      );
    }

    // Check si es owner o tiene permisos de moderación
    const isOwner = community.ownerId === session.user.id;
    const canModerate = await ReportService.canModerate(session.user.id, id);

    if (!isOwner && !canModerate) {
      return NextResponse.json(
        { error: 'Solo owners y moderadores pueden crear reglas de AutoMod' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, type, config, action, applyTo } = body;

    if (!name || !type || !config) {
      return NextResponse.json(
        { error: 'Nombre, tipo y configuración requeridos' },
        { status: 400 }
      );
    }

    // Validate tipo de regla
    const validTypes = [
      'banned_words',
      'spam_filter',
      'karma_minimum',
      'account_age',
      'link_filter',
      'caps_filter',
    ];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de regla inválido' },
        { status: 400 }
      );
    }

    // Validate acción
    const validActions = ['remove', 'flag', 'auto_report', 'mute', 'ban'];
    if (action && !validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Acción inválida' },
        { status: 400 }
      );
    }

    const rule = await AutoModService.createRule({
      communityId: id,
      name,
      description,
      type,
      config,
      action,
      applyTo,
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating automod rule:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear regla' },
      { status: 400 }
    );
  }
}
