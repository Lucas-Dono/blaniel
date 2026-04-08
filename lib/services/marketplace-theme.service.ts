/**
 * Servicio para el Marketplace de Temas
 */

import { nanoid } from "nanoid";
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export interface PublishThemeData {
  name: string;
  description?: string;
  userBubbleColor: string;
  agentBubbleColor: string;
  backgroundColor: string;
  backgroundGradient?: string[];
  accentColor: string;
  textColor?: string;
  backgroundImage?: string;
  category: string;
  tags: string[];
  previewImages?: string[];
}

export interface SearchFilters {
  category?: string;
  tags?: string[];
  minRating?: number;
  sortBy?: 'downloads' | 'rating' | 'recent' | 'featured';
  isFeatured?: boolean;
  isPremium?: boolean;
}

export const MarketplaceThemeService = {
  /**
   * Publicar un tema en el marketplace
   */
  async publishTheme(authorId: string, themeData: PublishThemeData) {
    // Create el exportData para que pueda ser importado
    const exportData = {
      version: '1.0',
      theme: {
        name: themeData.name,
        userBubbleColor: themeData.userBubbleColor,
        agentBubbleColor: themeData.agentBubbleColor,
        backgroundColor: themeData.backgroundColor,
        backgroundGradient: themeData.backgroundGradient,
        accentColor: themeData.accentColor,
        textColor: themeData.textColor,
        backgroundImage: themeData.backgroundImage,
        isCustom: true,
        tags: themeData.tags,
      },
      exportedAt: new Date().toISOString(),
    };

    const theme = await prisma.marketplaceTheme.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        authorId,
        name: themeData.name,
        description: themeData.description,
        userBubbleColor: themeData.userBubbleColor,
        agentBubbleColor: themeData.agentBubbleColor,
        backgroundColor: themeData.backgroundColor,
        backgroundGradient: themeData.backgroundGradient || undefined,
        accentColor: themeData.accentColor,
        textColor: themeData.textColor,
        backgroundImage: themeData.backgroundImage,
        category: themeData.category,
        tags: themeData.tags || [],
        previewImages: themeData.previewImages || [],
        exportData: exportData,
        status: 'approved', // Auto-aprobar por ahora, podemos agregar moderación después
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

    return theme;
  },

  /**
   * Obtener temas del marketplace con filtros
   */
  async searchThemes(filters: SearchFilters, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: Prisma.MarketplaceThemeWhereInput = {
      status: 'approved',
      isPublic: true,
    };

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.isFeatured !== undefined) {
      where.isFeatured = filters.isFeatured;
    }

    if (filters.isPremium !== undefined) {
      where.isPremium = filters.isPremium;
    }

    if (filters.minRating) {
      where.rating = {
        gte: filters.minRating,
      };
    }

    if (filters.tags && filters.tags.length > 0) {
      // Buscar temas que contengan al menos un tag
      where.tags = {
        path: [],
        array_contains: filters.tags,
      };
    }

    // Ordenamiento
    let orderBy: Prisma.MarketplaceThemeOrderByWithRelationInput = {};
    switch (filters.sortBy) {
      case 'downloads':
        orderBy = { downloadCount: 'desc' };
        break;
      case 'rating':
        orderBy = { rating: 'desc' };
        break;
      case 'recent':
        orderBy = { publishedAt: 'desc' };
        break;
      case 'featured':
        orderBy = { isFeatured: 'desc' };
        break;
      default:
        orderBy = { downloadCount: 'desc' };
    }

    const [themes, total] = await Promise.all([
      prisma.marketplaceTheme.findMany({
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
              MarketplaceThemeRating: true,
              MarketplaceThemeDownload: true,
            },
          },
        },
      }),
      prisma.marketplaceTheme.count({ where }),
    ]);

    return {
      themes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Obtener un tema por ID
   */
  async getThemeById(themeId: string) {
    const theme = await prisma.marketplaceTheme.findUnique({
      where: { id: themeId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        MarketplaceThemeRating: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            MarketplaceThemeRating: true,
            MarketplaceThemeDownload: true,
          },
        },
      },
    });

    if (theme) {
      // Incrementar view count
      await prisma.marketplaceTheme.update({
        where: { id: themeId },
        data: { viewCount: { increment: 1 } },
      });
    }

    return theme;
  },

  /**
   * Descargar un tema
   */
  async downloadTheme(themeId: string, userId: string, platform?: string) {
    // Registrar la descarga
    await prisma.marketplaceThemeDownload.create({
      data: {
        id: nanoid(),
        themeId,
        userId,
        platform,
        version: '1.0',
      },
    });

    // Incrementar contador de descargas
    await prisma.marketplaceTheme.update({
      where: { id: themeId },
      data: { downloadCount: { increment: 1 } },
    });

    // Get el tema con exportData
    const theme = await prisma.marketplaceTheme.findUnique({
      where: { id: themeId },
      select: {
        exportData: true,
        name: true,
      },
    });

    return theme;
  },

  /**
   * Dejar rating y review
   */
  async rateTheme(themeId: string, userId: string, rating: number, review?: string) {
    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new Error('Rating debe estar entre 1 y 5');
    }

    // Create o actualizar rating
    const themeRating = await prisma.marketplaceThemeRating.upsert({
      where: {
        themeId_userId: {
          themeId,
          userId,
        },
      },
      create: {
        id: nanoid(),
        updatedAt: new Date(),
        themeId,
        userId,
        rating,
        review,
      },
      update: {
        rating,
        review,
      },
    });

    // Recalcular rating promedio del tema
    const ratings = await prisma.marketplaceThemeRating.findMany({
      where: { themeId },
      select: { rating: true },
    });

    const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

    await prisma.marketplaceTheme.update({
      where: { id: themeId },
      data: {
        rating: avgRating,
        ratingCount: ratings.length,
      },
    });

    return themeRating;
  },

  /**
   * Reportar un tema
   */
  async reportTheme(
    themeId: string,
    userId: string,
    reason: string,
    description?: string
  ) {
    const report = await prisma.marketplaceThemeReport.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        themeId,
        userId,
        reason,
        description,
      },
    });

    return report;
  },

  /**
   * Obtener temas del usuario
   */
  async getUserThemes(userId: string) {
    const themes = await prisma.marketplaceTheme.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            MarketplaceThemeRating: true,
            MarketplaceThemeDownload: true,
          },
        },
      },
    });

    return themes;
  },

  /**
   * Obtener temas destacados
   */
  async getFeaturedThemes(limit = 10) {
    const themes = await prisma.marketplaceTheme.findMany({
      where: {
        status: 'approved',
        isPublic: true,
        isFeatured: true,
      },
      orderBy: { downloadCount: 'desc' },
      take: limit,
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

    return themes;
  },

  /**
   * Obtener temas más descargados
   */
  async getTrendingThemes(limit = 10) {
    const themes = await prisma.marketplaceTheme.findMany({
      where: {
        status: 'approved',
        isPublic: true,
      },
      orderBy: { downloadCount: 'desc' },
      take: limit,
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

    return themes;
  },

  /**
   * Obtener categorías disponibles
   */
  async getCategories() {
    const themes = await prisma.marketplaceTheme.findMany({
      where: {
        status: 'approved',
        isPublic: true,
      },
      select: { category: true },
      distinct: ['category'],
    });

    return themes.map(t => t.category);
  },

  /**
   * Obtener tags populares
   */
  async getPopularTags(limit = 20) {
    const themes = await prisma.marketplaceTheme.findMany({
      where: {
        status: 'approved',
        isPublic: true,
      },
      select: { tags: true },
    });

    // Contar frecuencia de tags
    const tagCount = new Map<string, number>();
    themes.forEach(theme => {
      const tags = theme.tags as string[];
      tags.forEach(tag => {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      });
    });

    // Ordenar por frecuencia
    return Array.from(tagCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  },

  /**
   * Eliminar tema (soft delete)
   */
  async deleteTheme(themeId: string, userId: string) {
    const theme = await prisma.marketplaceTheme.findUnique({
      where: { id: themeId },
      select: { authorId: true },
    });

    if (!theme) {
      throw new Error('Tema no encontrado');
    }

    if (theme.authorId !== userId) {
      throw new Error('No tienes permiso para eliminar este tema');
    }

    await prisma.marketplaceTheme.update({
      where: { id: themeId },
      data: {
        status: 'removed',
        isPublic: false,
      },
    });

    return { success: true };
  },

  /**
   * Actualizar tema
   */
  async updateTheme(themeId: string, userId: string, updates: Partial<PublishThemeData>) {
    const theme = await prisma.marketplaceTheme.findUnique({
      where: { id: themeId },
      select: { authorId: true },
    });

    if (!theme) {
      throw new Error('Tema no encontrado');
    }

    if (theme.authorId !== userId) {
      throw new Error('No tienes permiso para editar este tema');
    }

    const updated = await prisma.marketplaceTheme.update({
      where: { id: themeId },
      data: updates,
    });

    return updated;
  },
};
