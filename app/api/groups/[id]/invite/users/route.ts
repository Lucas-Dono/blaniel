/**
 * API: /api/groups/[id]/invite/users
 * GET - Buscar usuarios para invitar (prioriza amigos)
 * POST - Enviar invitación a un usuario
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/lib/services/notification.service';
import { nanoid } from "nanoid";

// GET - Buscar usuarios para invitar
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: groupId } = await params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    // Check que el usuario puede invitar a este grupo
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        GroupMember: {
          where: { memberType: 'user' },
          select: { userId: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }

    // Get IDs de usuarios ya en el grupo
    const existingUserIds = group.GroupMember
      .filter((m: any) => m.userId)
      .map((m: any) => m.userId as string);

    // Incluir al usuario actual
    existingUserIds.push(session.user.id);

    // Get amigos del usuario actual
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: session.user.id, status: 'ACCEPTED' },
          { addresseeId: session.user.id, status: 'ACCEPTED' },
        ],
      },
      include: {
        User_Friendship_requesterIdToUser: { select: { id: true, name: true, image: true, email: true } },
        User_Friendship_addresseeIdToUser: { select: { id: true, name: true, image: true, email: true } },
      },
    });

    // Mapear amigos (excluyendo los que ya están en el grupo)
    const friends = friendships
      .map((f) => (f.requesterId === session.user.id ? f.User_Friendship_addresseeIdToUser : f.User_Friendship_requesterIdToUser))
      .filter((friend) => !existingUserIds.includes(friend.id));

    // Filter por búsqueda
    let filteredFriends = friends;
    if (query) {
      const queryLower = query.toLowerCase();
      filteredFriends = friends.filter(
        (f) =>
          f.name?.toLowerCase().includes(queryLower) ||
          f.email.toLowerCase().includes(queryLower)
      );
    }

    // Search otros usuarios si hay query (no solo amigos)
    let otherUsers: any[] = [];
    if (query) {
      otherUsers = await prisma.user.findMany({
        where: {
          id: {
            notIn: [...existingUserIds, ...friends.map((f) => f.id)],
          },
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, image: true, email: true },
        take: 10,
      });
    }

    // Get invitaciones pendientes para este grupo
    const pendingInvitations = await prisma.groupInvitation.findMany({
      where: {
        groupId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        inviteeId: true,
        inviteCode: true,
        createdAt: true,
        expiresAt: true,
        User_GroupInvitation_inviteeIdToUser: {
          select: { id: true, name: true, image: true, email: true },
        },
      },
    });

    // Create mapa de usuarios invitados
    const invitedUsersMap = new Map(
      pendingInvitations.map((inv) => [inv.inviteeId, {
        invitationId: inv.id,
        inviteCode: inv.inviteCode,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
      }])
    );

    // Agregar info de invitación a amigos y otros usuarios
    const friendsWithInviteStatus = filteredFriends.map((f: any) => ({
      ...f,
      isFriend: true,
      pendingInvitation: invitedUsersMap.get(f.id) || null,
    }));

    const othersWithInviteStatus = otherUsers.map((u) => ({
      ...u,
      isFriend: false,
      pendingInvitation: invitedUsersMap.get(u.id) || null,
    }));

    return NextResponse.json({
      friends: friendsWithInviteStatus,
      others: othersWithInviteStatus,
      pendingInvitations: pendingInvitations.map((inv) => ({
        id: inv.id,
        inviteCode: inv.inviteCode,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        user: inv.User_GroupInvitation_inviteeIdToUser,
      })),
    });
  } catch (error) {
    console.error('Error buscando usuarios:', error);
    return NextResponse.json(
      { error: 'Error al buscar usuarios' },
      { status: 500 }
    );
  }
}

// POST - Enviar invitación a un usuario
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: groupId } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'Se requiere userId' },
        { status: 400 }
      );
    }

    // Check que el grupo existe
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        GroupMember: {
          where: {
            memberType: 'user',
            userId: session.user.id,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }

    // Check que el usuario actual es miembro del grupo
    if (group.GroupMember.length === 0 && group.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para invitar a este grupo' },
        { status: 403 }
      );
    }

    // Check que el usuario invitado no está ya en el grupo
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        memberType: 'user',
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'El usuario ya es miembro del grupo' },
        { status: 400 }
      );
    }

    // Check si ya hay una invitación pendiente
    const existingInvitation = await prisma.groupInvitation.findFirst({
      where: {
        groupId,
        inviteeId: userId,
        status: 'pending',
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'Ya hay una invitación pendiente para este usuario' },
        { status: 400 }
      );
    }

    // Generate código de invitación único
    const inviteCode = `${groupId.slice(-6)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    // Create la invitación
    const invitation = await prisma.groupInvitation.create({
      data: {
        id: nanoid(),
        groupId,
        inviterId: session.user.id,
        inviteeId: userId,
        inviteCode,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      },
      include: {
        User_GroupInvitation_inviteeIdToUser: { select: { id: true, name: true } },
        User_GroupInvitation_inviterIdToUser: { select: { id: true, name: true, image: true } },
        Group: { select: { id: true, name: true } },
      },
    });

    // Send notificación al usuario invitado
    try {
      await NotificationService.createNotification({
        userId,
        type: 'group_invitation',
        title: 'Invitación a grupo',
        message: `${invitation.User_GroupInvitation_inviterIdToUser?.name || 'Alguien'} te invitó al grupo "${group.name}"`,
        actionUrl: `/dashboard/grupos/invitaciones/${inviteCode}`,
        metadata: {
          actorId: session.user.id,
          actorName: invitation.User_GroupInvitation_inviterIdToUser?.name,
          actorAvatar: invitation.User_GroupInvitation_inviterIdToUser?.image,
          relatedId: invitation.id,
          relatedType: 'group_invitation',
        },
      });
    } catch (error) {
      console.error('Error enviando notificación:', error);
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        inviteCode: invitation.inviteCode,
        invitee: invitation.User_GroupInvitation_inviteeIdToUser,
      },
    });
  } catch (error) {
    console.error('Error enviando invitación:', error);
    return NextResponse.json(
      { error: 'Error al enviar invitación' },
      { status: 500 }
    );
  }
}

// DELETE - Cancelar invitación
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: groupId } = await params;
    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('invitationId');

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Se requiere invitationId' },
        { status: 400 }
      );
    }

    // Check que la invitación existe y pertenece a este grupo
    const invitation = await prisma.groupInvitation.findFirst({
      where: {
        id: invitationId,
        groupId,
        status: 'pending',
      },
      select: {
        id: true,
        inviterId: true,
        inviteCode: true,
        User_GroupInvitation_inviteeIdToUser: { select: { name: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitación no encontrada' },
        { status: 404 }
      );
    }

    // Check que el usuario tiene permiso (es el invitador o admin/owner del grupo)
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: session.user.id,
        memberType: 'user',
      },
    });

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { creatorId: true },
    });

    const isInviter = invitation.inviterId === session.user.id;
    const isAdmin = member?.role === 'admin' || member?.role === 'owner';
    const isCreator = group?.creatorId === session.user.id;

    if (!isInviter && !isAdmin && !isCreator) {
      return NextResponse.json(
        { error: 'No tienes permiso para cancelar esta invitación' },
        { status: 403 }
      );
    }

    // Delete la invitación
    await prisma.groupInvitation.delete({
      where: { id: invitationId },
    });

    // Delete la notificación asociada si existe
    try {
      await prisma.notification.deleteMany({
        where: {
          type: 'group_invitation',
          actionUrl: {
            contains: invitation.inviteCode,
          },
        },
      });
    } catch (e) {
      // No es crítico si falla
      console.error('Error eliminando notificación:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Invitación a ${invitation.User_GroupInvitation_inviteeIdToUser?.name || 'usuario'} cancelada`,
    });
  } catch (error) {
    console.error('Error cancelando invitación:', error);
    return NextResponse.json(
      { error: 'Error al cancelar invitación' },
      { status: 500 }
    );
  }
}
