/**
 * Marketplace Character Service - Marketplace de personajes
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from "nanoid";

export interface CreateCharacterData {
  name: string;
  description: string;
  category: string;
  tags: string[];
  personality: string;
  backstory: string;
  avatarUrl?: string;
  voiceSettings?: any;
  systemPrompt: string;
  exampleDialogues?: any;
  price?: number;
}

export interface UpdateCharacterData {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  personality?: string;
  backstory?: string;
  avatarUrl?: string;
  voiceSettings?: any;
  systemPrompt?: string;
  exampleDialogues?: any;
  price?: number;
}

export const MarketplaceCharacterService = {
  /**
   * Crear personaje
   */
  async createCharacter(authorId: string, data: CreateCharacterData) {
    const character = await prisma.marketplaceCharacter.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        authorId,
        name: data.name,
        description: data.description,
        category: data.category,
        tags: data.tags,
        personality: data.personality,
        avatar: data.avatarUrl,
        systemPrompt: data.systemPrompt,
        useCase: 'General conversation and roleplay',
        status: 'pending',
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

    return character;
  },

  /**
   * Actualizar personaje
   */
  async updateCharacter(characterId: string, userId: string, data: UpdateCharacterData) {
    const character = await prisma.marketplaceCharacter.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('Personaje no encontrado');
    }

    if (character.authorId !== userId) {
      throw new Error('No tienes permisos para editar este personaje');
    }

    const updated = await prisma.marketplaceCharacter.update({
      where: { id: characterId },
      data,
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

    return updated;
  },

  /**
   * Obtener personaje
   */
  async getCharacter(characterId: string, userId?: string) {
    const character = await prisma.marketplaceCharacter.findUnique({
      where: { id: characterId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        CharacterRating: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!character) {
      throw new Error('Personaje no encontrado');
    }

    // Solo mostrar detalles completos si es aprobado o es el autor
    if (character.status !== 'approved' && character.authorId !== userId) {
      return {
        ...character,
        systemPrompt: '[Preview unavailable - Character under review]',
        personality: character.personality.substring(0, 100) + '...',
      };
    }

    return character;
  },

  /**
   * Listar personajes
   */
  async listCharacters(filters: {
    category?: string;
    tags?: string[];
    authorId?: string;
    status?: string;
    search?: string;
    minRating?: number;
  } = {}, page = 1, limit = 25, sort: 'popular' | 'recent' | 'top_rated' | 'most_downloaded' = 'popular') {
    const where: any = {
      status: 'approved',
    };

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags,
      };
    }

    if (filters.authorId) {
      where.authorId = filters.authorId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { personality: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.minRating) {
      where.averageRating = { gte: filters.minRating };
    }

    let orderBy: any = { createdAt: 'desc' };

    if (sort === 'popular') {
      orderBy = [
        { downloadCount: 'desc' },
        { averageRating: 'desc' },
      ];
    } else if (sort === 'top_rated') {
      orderBy = [
        { averageRating: 'desc' },
        { ratingCount: 'desc' },
      ];
    } else if (sort === 'most_downloaded') {
      orderBy = { downloadCount: 'desc' };
    }

    const [characters, total] = await Promise.all([
      prisma.marketplaceCharacter.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      }),
      prisma.marketplaceCharacter.count({ where }),
    ]);

    return {
      characters,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Descargar/Importar personaje
   */
  async downloadCharacter(characterId: string, userId: string) {
    const character = await prisma.marketplaceCharacter.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('Personaje no encontrado');
    }

    if (character.status !== 'approved') {
      throw new Error('This character is not available for download');
    }

    // Check if already downloaded
    const existing = await prisma.characterDownload.findFirst({
      where: {
        characterId,
        userId,
      },
    });

    if (!existing) {
      // Registrar descarga
      await prisma.characterDownload.create({
        data: {
          id: nanoid(),
          characterId,
          userId,
        },
      });

      // Incrementar contador
      await prisma.marketplaceCharacter.update({
        where: { id: characterId },
        data: {
          downloadCount: { increment: 1 },
        },
      });
    }

    // Return the complete character for import
    return prisma.marketplaceCharacter.findUnique({
      where: { id: characterId },
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
  },

  /**
   * Calificar personaje
   */
  async rateCharacter(characterId: string, userId: string, rating: number, review?: string) {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Verificar que haya descargado el personaje
    const download = await prisma.characterDownload.findFirst({
      where: {
        characterId,
        userId,
      },
    });

    if (!download) {
      throw new Error('Debes descargar el personaje antes de calificarlo');
    }

    // Create or update rating
    const characterRating = await prisma.characterRating.upsert({
      where: {
        characterId_userId: {
          characterId,
          userId,
        },
      },
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        characterId,
        userId,
        rating,
        review,
      },
      update: {
        rating,
        review,
      },
    });

    // Recalcular promedio
    const ratings = await prisma.characterRating.aggregate({
      where: { characterId },
      _avg: { rating: true },
      _count: true,
    });

    await prisma.marketplaceCharacter.update({
      where: { id: characterId },
      data: {
        rating: ratings._avg.rating || 0,
        ratingCount: ratings._count,
      },
    });

    return characterRating;
  },

  /**
   * Eliminar personaje
   */
  async deleteCharacter(characterId: string, userId: string) {
    const character = await prisma.marketplaceCharacter.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('Personaje no encontrado');
    }

    if (character.authorId !== userId) {
      throw new Error('No tienes permisos para eliminar este personaje');
    }

    await prisma.marketplaceCharacter.delete({
      where: { id: characterId },
    });

    return { success: true };
  },

  /**
   * Aprobar personaje (admin)
   */
  async approveCharacter(characterId: string, adminId: string) {
    // Verificar que adminId es admin
    // NOTE: Currently using metadata field to check for admin privileges
    // Future: Add dedicated 'role' field to User schema for better type safety
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { metadata: true },
    });

    const metadata = admin?.metadata as { isAdmin?: boolean } | null;
    if (!admin || !metadata?.isAdmin) {
      throw new Error('No tienes permisos de administrador para aprobar personajes');
    }

    const character = await prisma.marketplaceCharacter.update({
      where: { id: characterId },
      data: {
        status: 'approved',
      },
    });

    return character;
  },

  /**
   * Rechazar personaje (admin)
   */
  async rejectCharacter(characterId: string, adminId: string, _reason: string) {
    // Verificar que adminId es admin
    // NOTE: Currently using metadata field to check for admin privileges
    // Future: Add dedicated 'role' field to User schema for better type safety
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { metadata: true },
    });

    const metadata = admin?.metadata as { isAdmin?: boolean } | null;
    if (!admin || !metadata?.isAdmin) {
      throw new Error('No tienes permisos de administrador para rechazar personajes');
    }

    const character = await prisma.marketplaceCharacter.update({
      where: { id: characterId },
      data: {
        status: 'rejected',
      },
    });

    return character;
  },

  /** Get popular categories */
  async getPopularCategories(limit = 10) {
    const categories = await prisma.marketplaceCharacter.groupBy({
      by: ['category'],
      where: { status: 'approved' },
      _count: true,
      orderBy: {
        _count: {
          category: 'desc',
        },
      },
      take: limit,
    });

    return categories;
  },

  /**
   * Obtener tags populares
   */
  async getPopularTags(limit = 20) {
    const characters = await prisma.marketplaceCharacter.findMany({
      where: { status: 'approved' },
      select: { tags: true },
    });

    const tagCounts: Record<string, number> = {};

    characters.forEach(character => {
      (character.tags as string[]).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const sortedTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));

    return sortedTags;
  },

  /**
   * Importar personaje a agente personal
   */
  async importToAgent(characterId: string, userId: string, agentName?: string) {
    const character = await this.downloadCharacter(characterId, userId);

    if (!character) {
      throw new Error('No se pudo descargar el personaje');
    }

    // Create agente basado en el personaje
    const agent = await prisma.agent.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        userId,
        name: agentName || character.name,
        description: character.description || '',
        personality: character.personality,
        systemPrompt: character.systemPrompt,
        kind: 'companion',
        profile: {}, // Empty profile by default
        avatar: character.avatar,
        // Copiar configuraciones relevantes
      },
    });

    return agent;
  },
};
