import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';
import { AutoModService } from '@/lib/services/automod.service';
/**
 * PATCH /api/community/automod/[ruleId] - Actualizar regla
 * Solo para owners y co-owners
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { ruleId } = await params;

    // TODO: Implement AutoModRule model in Prisma schema
    // Get regla y verificar permisos
    // const rule = await prisma.autoModRule.findUnique({
    //   where: { id: ruleId },
    //   include: {
    //     community: {
    //       select: {
    //         ownerId: true,
    //         coOwnerIds: true,
    //       },
    //     },
    //   },
    // });

    // if (!rule) {
    //   return NextResponse.json(
    //     { error: 'Regla no encontrada' },
    //     { status: 404 }
    //   );
    // }

    // const coOwnerIds = Array.isArray(rule.community.coOwnerIds)
    //   ? rule.community.coOwnerIds
    //   : [];

    // const isOwnerOrCoOwner =
    //   rule.community.ownerId === session.user.id ||
    //   coOwnerIds.includes(session.user.id);

    // if (!isOwnerOrCoOwner) {
    //   return NextResponse.json(
    //     { error: 'Solo owners y co-owners pueden editar reglas' },
    //     { status: 403 }
    //   );
    // }

    const body = await request.json();
    const updatedRule = await AutoModService.updateRule(ruleId, body);

    return NextResponse.json({ rule: updatedRule });
  } catch (error: any) {
    console.error('Error updating automod rule:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar regla' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/community/automod/[ruleId] - Eliminar regla
 * Solo para owners y co-owners
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { ruleId } = await params;

    // TODO: Implement AutoModRule model in Prisma schema
    // Get regla y verificar permisos
    // const rule = await prisma.autoModRule.findUnique({
    //   where: { id: ruleId },
    //   include: {
    //     community: {
    //       select: {
    //         ownerId: true,
    //         coOwnerIds: true,
    //       },
    //     },
    //   },
    // });

    // if (!rule) {
    //   return NextResponse.json(
    //     { error: 'Regla no encontrada' },
    //     { status: 404 }
    //   );
    // }

    // const coOwnerIds = Array.isArray(rule.community.coOwnerIds)
    //   ? rule.community.coOwnerIds
    //   : [];

    // const isOwnerOrCoOwner =
    //   rule.community.ownerId === session.user.id ||
    //   coOwnerIds.includes(session.user.id);

    // if (!isOwnerOrCoOwner) {
    //   return NextResponse.json(
    //     { error: 'Solo owners y co-owners pueden eliminar reglas' },
    //     { status: 403 }
    //   );
    // }

    await AutoModService.deleteRule(ruleId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting automod rule:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar regla' },
      { status: 400 }
    );
  }
}
