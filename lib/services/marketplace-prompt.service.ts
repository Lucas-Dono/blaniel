/**
 * Marketplace Prompt Service - Marketplace de prompts
 */

import { nanoid } from "nanoid";
import { prisma } from '@/lib/prisma';

export interface CreatePromptData {
  title: string;
  description: string;
  category: string;
  tags: string[];
  promptText: string;
  variables?: any;
  examples?: any;
  price?: number;
}

export interface UpdatePromptData {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  promptText?: string;
  variables?: any;
  examples?: any;
  price?: number;
}

export const MarketplacePromptService = {
  /**
   * Crear prompt
   */
  async createPrompt(authorId: string, data: CreatePromptData) {
    const prompt = await prisma.marketplacePrompt.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        authorId,
        name: data.title,
        description: data.description,
        category: data.category,
        tags: data.tags,
        systemPrompt: data.promptText,
        useCase: 'General purpose prompt',
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

    return prompt;
  },

  /**
   * Actualizar prompt
   */
  async updatePrompt(promptId: string, userId: string, data: UpdatePromptData) {
    const prompt = await prisma.marketplacePrompt.findUnique({
      where: { id: promptId },
    });

    if (!prompt) {
      throw new Error('Prompt no encontrado');
    }

    if (prompt.authorId !== userId) {
      throw new Error('No tienes permisos para editar este prompt');
    }

    const updated = await prisma.marketplacePrompt.update({
      where: { id: promptId },
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
   * Obtener prompt
   */
  async getPrompt(promptId: string, userId?: string) {
    const prompt = await prisma.marketplacePrompt.findUnique({
      where: { id: promptId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        PromptRating: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!prompt) {
      throw new Error('Prompt no encontrado');
    }

    // Solo mostrar el texto completo si es aprobado o es el autor
    if (prompt.status !== 'approved' && prompt.authorId !== userId) {
      return {
        ...prompt,
        promptText: '[Preview unavailable - Prompt under review]',
      };
    }

    return prompt;
  },

  /**
   * Listar prompts
   */
  async listPrompts(filters: {
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
      ];
    }

    if (filters.minRating) {
      where.rating = { gte: filters.minRating };
    }

    let orderBy: any = { createdAt: 'desc' };

    if (sort === 'popular') {
      orderBy = [
        { downloadCount: 'desc' },
        { rating: 'desc' },
      ];
    } else if (sort === 'top_rated') {
      orderBy = [
        { rating: 'desc' },
        { ratingCount: 'desc' },
      ];
    } else if (sort === 'most_downloaded') {
      orderBy = { downloadCount: 'desc' };
    }

    const [prompts, total] = await Promise.all([
      prisma.marketplacePrompt.findMany({
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
      prisma.marketplacePrompt.count({ where }),
    ]);

    return {
      prompts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Descargar prompt
   */
  async downloadPrompt(promptId: string, userId: string) {
    const prompt = await prisma.marketplacePrompt.findUnique({
      where: { id: promptId },
    });

    if (!prompt) {
      throw new Error('Prompt no encontrado');
    }

    if (prompt.status !== 'approved') {
      throw new Error('This prompt is not available for download');
    }

    // Check if already downloaded
    const existing = await prisma.promptDownload.findFirst({
      where: {
        promptId,
        userId,
      },
    });

    if (!existing) {
      // Registrar descarga
      await prisma.promptDownload.create({
        data: {
          id: nanoid(),
          promptId,
          userId,
        },
      });

      // Incrementar contador
      await prisma.marketplacePrompt.update({
        where: { id: promptId },
        data: {
          downloadCount: { increment: 1 },
        },
      });
    }

    // Retornar el prompt completo
    return prisma.marketplacePrompt.findUnique({
      where: { id: promptId },
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
   * Calificar prompt
   */
  async ratePrompt(promptId: string, userId: string, rating: number, review?: string) {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Verificar que haya descargado el prompt
    const download = await prisma.promptDownload.findFirst({
      where: {
        promptId,
        userId,
      },
    });

    if (!download) {
      throw new Error('Debes descargar el prompt antes de calificarlo');
    }

    // Create or update rating
    const promptRating = await prisma.promptRating.upsert({
      where: {
        promptId_userId: {
          promptId,
          userId,
        },
      },
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        promptId,
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
    const ratings = await prisma.promptRating.aggregate({
      where: { promptId },
      _avg: { rating: true },
      _count: true,
    });

    await prisma.marketplacePrompt.update({
      where: { id: promptId },
      data: {
        rating: ratings._avg.rating || 0,
        ratingCount: ratings._count,
      },
    });

    return promptRating;
  },

  /**
   * Eliminar prompt
   */
  async deletePrompt(promptId: string, userId: string) {
    const prompt = await prisma.marketplacePrompt.findUnique({
      where: { id: promptId },
    });

    if (!prompt) {
      throw new Error('Prompt no encontrado');
    }

    if (prompt.authorId !== userId) {
      throw new Error('No tienes permisos para eliminar este prompt');
    }

    await prisma.marketplacePrompt.delete({
      where: { id: promptId },
    });

    return { success: true };
  },

  /**
   * Aprobar prompt (admin)
   */
  async approvePrompt(promptId: string, adminId: string) {
    // Verificar que adminId es admin
    // NOTE: Currently using metadata field to check for admin privileges
    // Future: Add dedicated 'role' field to User schema for better type safety
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { metadata: true },
    });

    const metadata = admin?.metadata as { isAdmin?: boolean } | null;
    if (!admin || !metadata?.isAdmin) {
      throw new Error('No tienes permisos de administrador para aprobar prompts');
    }

    const prompt = await prisma.marketplacePrompt.update({
      where: { id: promptId },
      data: {
        status: 'approved',
      },
    });

    return prompt;
  },

  /**
   * Rechazar prompt (admin)
   */
  async rejectPrompt(promptId: string, adminId: string, _reason: string) {
    // Verificar que adminId es admin
    // NOTE: Currently using metadata field to check for admin privileges
    // Future: Add dedicated 'role' field to User schema for better type safety
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { metadata: true },
    });

    const metadata = admin?.metadata as { isAdmin?: boolean } | null;
    if (!admin || !metadata?.isAdmin) {
      throw new Error('No tienes permisos de administrador para rechazar prompts');
    }

    const prompt = await prisma.marketplacePrompt.update({
      where: { id: promptId },
      data: {
        status: 'rejected',
        // rejectionReason field doesn't exist in schema
        // Store reason in description or another text field if needed
      },
    });

    return prompt;
  },

  /** Get popular categories */
  async getPopularCategories(limit = 10) {
    const categories = await prisma.marketplacePrompt.groupBy({
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
    const prompts = await prisma.marketplacePrompt.findMany({
      where: { status: 'approved' },
      select: { tags: true },
    });

    const tagCounts: Record<string, number> = {};

    prompts.forEach(prompt => {
      (prompt.tags as string[]).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const sortedTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));

    return sortedTags;
  },
};
