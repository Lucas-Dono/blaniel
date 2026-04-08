/**
 * Group Invitation Service - Group invitations system
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from "nanoid";
import { NotificationService } from './notification.service';
import { emitGroupMemberJoined } from '@/lib/socket/server';

export const GroupInvitationService = {
  /**
   * Get invitation by code
   */
  async getInvitationByCode(inviteCode: string) {
    return prisma.groupInvitation.findUnique({
      where: { inviteCode },
      include: {
        Group: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            _count: {
              select: { GroupMember: true },
            },
          },
        },
        User_GroupInvitation_inviterIdToUser: {
          select: { id: true, name: true, image: true },
        },
        User_GroupInvitation_inviteeIdToUser: {
          select: { id: true, name: true, image: true },
        },
      },
    });
  },

  /**
   * Get invitation by ID
   */
  async getInvitationById(invitationId: string) {
    return prisma.groupInvitation.findUnique({
      where: { id: invitationId },
      include: {
        Group: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        User_GroupInvitation_inviterIdToUser: {
          select: { id: true, name: true, image: true },
        },
        User_GroupInvitation_inviteeIdToUser: {
          select: { id: true, name: true },
        },
      },
    });
  },

  /**
   * Accept group invitation
   */
  async acceptInvitation(
    invitationId: string,
    userId: string
  ): Promise<{
    success: boolean;
    error?: string;
    invitation?: any;
  }> {
    const invitation = await this.getInvitationById(invitationId);

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    // Verify that the invitation is for this user
    if (invitation.inviteeId !== userId) {
      return { success: false, error: 'This invitation is not for you' };
    }

    // Check status
    if (invitation.status !== 'pending') {
      return { success: false, error: 'This invitation has already been processed' };
    }

    // Check expiration
    if (new Date() > invitation.expiresAt) {
      await prisma.groupInvitation.update({
        where: { id: invitationId },
        data: { status: 'expired' },
      });
      return { success: false, error: 'This invitation has expired' };
    }

    // Check that user is not already a member
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId: invitation.groupId,
        userId,
        memberType: 'user',
      },
    });

    if (existingMember) {
      // Mark invitation as accepted anyway
      await prisma.groupInvitation.update({
        where: { id: invitationId },
        data: { status: 'accepted', acceptedAt: new Date() },
      });
      return { success: false, error: 'Ya eres miembro de este grupo' };
    }

    // Transaction: accept invitation and add member
    const [updatedInvitation, newMember] = await prisma.$transaction([
      prisma.groupInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
        },
        include: {
          Group: { select: { id: true, name: true } },
          User_GroupInvitation_inviterIdToUser: { select: { id: true, name: true } },
          User_GroupInvitation_inviteeIdToUser: { select: { id: true, name: true, image: true } },
        },
      }),
      prisma.groupMember.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          groupId: invitation.groupId,
          userId,
          memberType: 'user',
          role: 'member',
        },
      }),
    ]);

    // Emit real-time event for new member
    emitGroupMemberJoined(invitation.groupId, {
      groupId: invitation.groupId,
      memberId: newMember.id,
      memberType: 'user',
      role: 'member',
      user: {
        id: userId,
        name: updatedInvitation.User_GroupInvitation_inviteeIdToUser?.name || null,
        image: updatedInvitation.User_GroupInvitation_inviteeIdToUser?.image || null,
      },
    });

    // Notify the inviter
    try {
      await NotificationService.createNotification({
        userId: invitation.inviterId,
        type: 'group_invitation_accepted',
        title: 'Invitation accepted',
        message: `${updatedInvitation.User_GroupInvitation_inviteeIdToUser?.name || 'The user'} accepted your invitation to the group "${invitation.Group.name}"`,
        actionUrl: `/dashboard/grupos/${invitation.groupId}`,
        metadata: {
          actorId: userId,
          actorName: updatedInvitation.User_GroupInvitation_inviteeIdToUser?.name,
          relatedId: invitation.groupId,
          relatedType: 'group',
        },
      });
    } catch (error) {
      console.error('Error enviando notificación:', error);
    }

    return { success: true, invitation: updatedInvitation };
  },

  /**
   * Rechazar invitación a grupo
   */
  async declineInvitation(
    invitationId: string,
    userId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const invitation = await this.getInvitationById(invitationId);

    if (!invitation) {
      return { success: false, error: 'Invitación no encontrada' };
    }

    // Verify that the invitation is for this user
    if (invitation.inviteeId !== userId) {
      return { success: false, error: 'Esta invitación no es para ti' };
    }

    // Verificar estado
    if (invitation.status !== 'pending') {
      return { success: false, error: 'Esta invitación ya fue procesada' };
    }

    // Update estado
    await prisma.groupInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'declined',
      },
    });

    return { success: true };
  },

  /**
   * Obtener invitaciones pendientes de un usuario
   */
  async getPendingInvitations(
    userId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{
    invitations: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20 } = options;

    const where = {
      inviteeId: userId,
      status: 'pending',
      expiresAt: { gt: new Date() },
    };

    const [invitations, total] = await Promise.all([
      prisma.groupInvitation.findMany({
        where,
        include: {
          Group: {
            select: {
              id: true,
              name: true,
              description: true,
              _count: { select: { GroupMember: true } },
            },
          },
          User_GroupInvitation_inviterIdToUser: {
            select: { id: true, name: true, image: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.groupInvitation.count({ where }),
    ]);

    return {
      invitations,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Contar invitaciones pendientes
   */
  async getPendingInvitationsCount(userId: string): Promise<number> {
    return prisma.groupInvitation.count({
      where: {
        inviteeId: userId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    });
  },

  /**
   * Cancelar invitación (por el invitador)
   */
  async cancelInvitation(
    invitationId: string,
    userId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const invitation = await prisma.groupInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      return { success: false, error: 'Invitación no encontrada' };
    }

    // Solo el invitador puede cancelar
    if (invitation.inviterId !== userId) {
      return { success: false, error: 'No tienes permiso para cancelar esta invitación' };
    }

    if (invitation.status !== 'pending') {
      return { success: false, error: 'Esta invitación ya fue procesada' };
    }

    await prisma.groupInvitation.delete({
      where: { id: invitationId },
    });

    return { success: true };
  },
};
