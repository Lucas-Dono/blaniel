/**
 * Community Service - Communities/groups management
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from "nanoid";
import type { Prisma } from '@prisma/client';

export interface CreateCommunityData {
  name: string;
  slug: string;
  description: string;
  category: string;
  type?: 'public' | 'private' | 'restricted';
  icon?: string;
  iconShape?: string;
  banner?: string;
  bannerShape?: string;
  rules?: string;
  primaryColor?: string;
}

export interface UpdateCommunityData {
  name?: string;
  description?: string;
  category?: string;
  type?: string;
  rules?: string;
  icon?: string;
  iconShape?: string;
  banner?: string;
  bannerShape?: string;
  primaryColor?: string;
}

export const CommunityService = {
  /**
   * Create new community
   */
  async createCommunity(ownerId: string, data: CreateCommunityData) {
    // Verify that the slug does not exist
    const existing = await prisma.community.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      throw new Error('A community with that slug already exists');
    }

    const community = await prisma.community.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        ownerId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        category: data.category,
        type: data.type || 'public',
        icon: data.icon,
        banner: data.banner,
        rules: data.rules,
        primaryColor: data.primaryColor || '#8B5CF6',
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Agregar al owner como miembro con rol owner
    await prisma.communityMember.create({
      data: {
        id: nanoid(),
        communityId: community.id,
        userId: ownerId,
        role: 'owner',
        canPost: true,
        canComment: true,
        canModerate: true,
      },
    });

    // Update contador de miembros
    await prisma.community.update({
      where: { id: community.id },
      data: { memberCount: 1 },
    });

    return { ...community, memberCount: 1 };
  },

  /**
   * Obtener comunidad por ID
   */
  async getCommunity(communityId: string, userId?: string) {
    const community = await prisma.community.findUnique({
      where: { id: communityId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        _count: {
          select: {
            CommunityMember: true,
            CommunityPost: true,
          },
        },
      },
    });

    if (!community) {
      return null;
    }

    // Si hay userId, verificar si es miembro
    let memberInfo = null;
    if (userId) {
      memberInfo = await prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId,
          },
        },
      });
    }

    return {
      ...community,
      isMember: !!memberInfo,
      memberRole: memberInfo?.role || null,
    };
  },

  /**
   * Obtener comunidad por slug
   */
  async getCommunityBySlug(slug: string, userId?: string) {
    const community = await prisma.community.findUnique({
      where: { slug },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        _count: {
          select: {
            CommunityMember: true,
            CommunityPost: true,
          },
        },
      },
    });

    if (!community) {
      return null;
    }

    // Si hay userId, verificar si es miembro
    let memberInfo = null;
    if (userId) {
      memberInfo = await prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId,
          },
        },
      });
    }

    return {
      ...community,
      isMember: !!memberInfo,
      memberRole: memberInfo?.role || null,
    };
  },

  /**
   * Actualizar comunidad
   */
  async updateCommunity(communityId: string, userId: string, data: UpdateCommunityData) {
    // Verificar permisos (debe ser owner o moderator)
    const member = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    if (!member || (member.role !== 'owner' && member.role !== 'moderator')) {
      throw new Error('No tienes permiso para editar esta comunidad');
    }

    const updated = await prisma.community.update({
      where: { id: communityId },
      data,
    });

    return updated;
  },

  /**
   * Unirse a una comunidad
   */
  async joinCommunity(communityId: string, userId: string) {
    const community = await prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new Error('Comunidad no encontrada');
    }

    // Verificar si ya es miembro
    const existing = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    if (existing) {
      throw new Error('Ya eres miembro de esta comunidad');
    }

    // If private, cannot join directly (requires invitation)
    if (community.type === 'private') {
      throw new Error('Esta comunidad es privada');
    }

    const member = await prisma.communityMember.create({
      data: {
        id: nanoid(),
        communityId,
        userId,
        role: 'member',
      },
    });

    // Incrementar contador de miembros
    await prisma.community.update({
      where: { id: communityId },
      data: {
        memberCount: { increment: 1 },
      },
    });

    return member;
  },

  /**
   * Salir de una comunidad
   */
  async leaveCommunity(communityId: string, userId: string) {
    const member = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    if (!member) {
      throw new Error('No eres miembro de esta comunidad');
    }

    // El owner no puede salir
    if (member.role === 'owner') {
      throw new Error('Owner cannot leave the community');
    }

    await prisma.communityMember.delete({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    // Decrementar contador de miembros
    await prisma.community.update({
      where: { id: communityId },
      data: {
        memberCount: { decrement: 1 },
      },
    });

    return { success: true };
  },

  /**
   * Eliminar comunidad (solo owner)
   */
  async deleteCommunity(communityId: string, userId: string) {
    const member = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    if (!member || member.role !== 'owner') {
      throw new Error('Only the owner can delete the community');
    }

    await prisma.community.delete({
      where: { id: communityId },
    });

    return { success: true };
  },

  /**
   * Obtener miembros de una comunidad
   */
  async getMembers(communityId: string, page = 1, limit = 50) {
    return this.getCommunityMembers(communityId, page, limit);
  },

  /**
   * Obtener miembros de una comunidad
   */
  async getCommunityMembers(communityId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [members, total] = await Promise.all([
      prisma.communityMember.findMany({
        where: { communityId },
        skip,
        take: limit,
        orderBy: [
          { role: 'asc' }, // owner, moderator, member
          { joinedAt: 'asc' },
        ],
      }),
      prisma.communityMember.count({
        where: { communityId },
      }),
    ]);

    return {
      members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Actualizar rol de miembro
   */
  async updateMemberRole(
    communityId: string,
    targetUserId: string,
    newRole: 'moderator' | 'member',
    requesterId: string
  ) {
    // Verificar que el requester es owner
    const requester = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId: requesterId,
        },
      },
    });

    if (!requester || requester.role !== 'owner') {
      throw new Error('Only the owner can change roles');
    }

    const updated = await prisma.communityMember.update({
      where: {
        communityId_userId: {
          communityId,
          userId: targetUserId,
        },
      },
      data: {
        role: newRole,
        canModerate: newRole === 'moderator',
      },
    });

    return updated;
  },

  /**
   * Banear usuario de comunidad
   */
  async banUser(communityId: string, targetUserId: string, moderatorId: string) {
    // Verificar permisos
    const moderator = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId: moderatorId,
        },
      },
    });

    if (!moderator || (moderator.role !== 'owner' && moderator.role !== 'moderator')) {
      throw new Error('No tienes permiso para banear usuarios');
    }

    await prisma.communityMember.update({
      where: {
        communityId_userId: {
          communityId,
          userId: targetUserId,
        },
      },
      data: {
        isBanned: true,
        canPost: false,
        canComment: false,
      },
    });

    return { success: true };
  },

  /**
   * Mutear usuario temporalmente
   */
  async muteUser(
    communityId: string,
    targetUserId: string,
    moderatorId: string,
    durationHours: number
  ) {
    // Verificar permisos
    const moderator = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId: moderatorId,
        },
      },
    });

    if (!moderator || (moderator.role !== 'owner' && moderator.role !== 'moderator')) {
      throw new Error('No tienes permiso para mutear usuarios');
    }

    const mutedUntil = new Date();
    mutedUntil.setHours(mutedUntil.getHours() + durationHours);

    await prisma.communityMember.update({
      where: {
        communityId_userId: {
          communityId,
          userId: targetUserId,
        },
      },
      data: {
        isMuted: true,
        mutedUntil,
        canPost: false,
        canComment: false,
      },
    });

    return { success: true, mutedUntil };
  },

  /**
   * Listar comunidades (explorar)
   */
  async listCommunities(filters: {
    category?: string;
    type?: string;
    search?: string;
    sortBy?: 'members' | 'posts' | 'recent';
    page?: number;
    limit?: number;
  }) {
    const {
      category,
      type,
      search,
      sortBy = 'members',
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.CommunityWhereInput = {};

    if (category) where.category = category;
    if (type) where.type = type as any;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy: Prisma.CommunityOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'members':
        orderBy = { memberCount: 'desc' };
        break;
      case 'posts':
        orderBy = { postCount: 'desc' };
        break;
      case 'recent':
        orderBy = { createdAt: 'desc' };
        break;
    }

    const [communities, total] = await Promise.all([
      prisma.community.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          _count: {
            select: {
              CommunityMember: true,
              CommunityPost: true,
            },
          },
        },
      }),
      prisma.community.count({ where }),
    ]);

    return {
      communities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Obtener comunidades del usuario
   */
  async getUserCommunities(userId: string) {
    const memberships = await prisma.communityMember.findMany({
      where: { userId },
      include: {
        Community: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            _count: {
              select: {
                CommunityMember: true,
                CommunityPost: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map(m => ({
      ...m.Community,
      memberRole: m.role,
      joinedAt: m.joinedAt,
    }));
  },

  /**
   * Obtener comunidades destacadas
   */
  async getFeaturedCommunities(limit = 10) {
    return await prisma.community.findMany({
      where: {
        isFeatured: true,
        type: 'public',
      },
      take: limit,
      orderBy: { memberCount: 'desc' },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        _count: {
          select: {
            CommunityMember: true,
            CommunityPost: true,
          },
        },
      },
    });
  },

  /**
   * Verificar si un usuario es owner
   */
  isOwner(community: any, userId: string): boolean {
    return community.ownerId === userId;
  },

  /**
   * Transferir ownership principal (solo owner principal)
   */
  async transferOwnership(communityId: string, currentOwnerId: string, newOwnerId: string) {
    // Verificar que el requester sea el owner actual
    const community = await prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new Error('Comunidad no encontrada');
    }

    if (community.ownerId !== currentOwnerId) {
      throw new Error('Solo el propietario actual puede transferir la propiedad');
    }

    // Verificar que el nuevo owner sea miembro
    const newOwnerMember = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId: newOwnerId,
        },
      },
    });

    if (!newOwnerMember) {
      throw new Error('El nuevo propietario debe ser miembro de la comunidad');
    }

    // Update la comunidad
    await prisma.community.update({
      where: { id: communityId },
      data: {
        ownerId: newOwnerId,
      },
    });

    // Update roles de miembros
    // Nuevo owner
    await prisma.communityMember.update({
      where: {
        communityId_userId: {
          communityId,
          userId: newOwnerId,
        },
      },
      data: {
        role: 'owner',
        canModerate: true,
      },
    });

    // Owner anterior pasa a moderator
    await prisma.communityMember.update({
      where: {
        communityId_userId: {
          communityId,
          userId: currentOwnerId,
        },
      },
      data: {
        role: 'moderator',
      },
    });

    return { success: true, newOwnerId };
  },
};
