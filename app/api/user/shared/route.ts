/** GET /api/user/shared - Get user statistics and shared content */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const currentUser = await requireAuth(req);

    // Get filter parameters
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') as 'all' | 'characters' | 'prompts' | 'themes' | null;

    // Build user statistics
    const [charactersCount, promptsCount, themesCount] = await Promise.all([
      prisma.marketplaceCharacter.count({
        where: { authorId: currentUser.id },
      }),
      prisma.marketplacePrompt.count({
        where: { authorId: currentUser.id },
      }),
      prisma.marketplaceTheme.count({
        where: { authorId: currentUser.id },
      }),
    ]);

    // Calculate download totals from relationship tables
    const [charactersDownloads, promptsDownloads, themesDownloads] = await Promise.all([
      prisma.characterDownload.count({
        where: {
          MarketplaceCharacter: {
            authorId: currentUser.id,
          },
        },
      }),
      prisma.promptDownload.count({
        where: {
          MarketplacePrompt: {
            authorId: currentUser.id,
          },
        },
      }),
      prisma.marketplaceThemeDownload.count({
        where: {
          MarketplaceTheme: {
            authorId: currentUser.id,
          },
        },
      }),
    ]);

    // Get ratings (likes) from user content
    const [characterRatings, promptRatings, _themeRatings] = await Promise.all([
      prisma.characterRating.aggregate({
        where: {
          MarketplaceCharacter: {
            authorId: currentUser.id,
          },
          rating: { gte: 4 }, // Count solo ratings positivos como "likes"
        },
        _count: true,
      }),
      prisma.promptRating.aggregate({
        where: {
          MarketplacePrompt: {
            authorId: currentUser.id,
          },
          rating: { gte: 4 },
        },
        _count: true,
      }),
      prisma.marketplaceTheme.findMany({
        where: { authorId: currentUser.id },
        select: { rating: true },
      }),
    ]);

    // Calculate total statistics
    const stats = {
      totalShared: charactersCount + promptsCount + themesCount,
      totalLikes: (characterRatings._count ?? 0) + (promptRatings._count ?? 0),
      totalDownloads: charactersDownloads + promptsDownloads + themesDownloads,
      totalComments: 0, // TODO: Implementar cuando haya sistema de comentarios
      reputation: 0, // TODO: Implementar sistema de reputación
      badges: [], // TODO: Implementar sistema de badges
    };

    // Get shared items based on the filter
    const items: any[] = [];

    if (!type || type === 'all' || type === 'characters') {
      const characters = await prisma.marketplaceCharacter.findMany({
        where: { authorId: currentUser.id },
        select: {
          id: true,
          name: true,
          category: true,
          createdAt: true,
          CharacterRating: {
            where: { rating: { gte: 4 } },
            select: { id: true },
          },
          CharacterDownload: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: type === 'characters' ? 50 : 10,
      });

      items.push(
        ...characters.map((c) => ({
          id: c.id,
          type: 'character' as const,
          name: c.name,
          category: c.category,
          likes: c.CharacterRating.length,
          downloads: c.CharacterDownload.length,
          views: 0, // TODO: Implementar tracking de vistas
          comments: 0, // TODO: Implementar comentarios
          createdAt: c.createdAt.toISOString(),
        }))
      );
    }

    if (!type || type === 'all' || type === 'prompts') {
      const prompts = await prisma.marketplacePrompt.findMany({
        where: { authorId: currentUser.id },
        select: {
          id: true,
          name: true,
          category: true,
          createdAt: true,
          PromptRating: {
            where: { rating: { gte: 4 } },
            select: { id: true },
          },
          PromptDownload: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: type === 'prompts' ? 50 : 10,
      });

      items.push(
        ...prompts.map((p) => ({
          id: p.id,
          type: 'prompt' as const,
          name: p.name,
          category: p.category,
          likes: p.PromptRating.length,
          downloads: p.PromptDownload.length,
          views: 0,
          comments: 0,
          createdAt: p.createdAt.toISOString(),
        }))
      );
    }

    if (!type || type === 'all' || type === 'themes') {
      const themes = await prisma.marketplaceTheme.findMany({
        where: { authorId: currentUser.id },
        select: {
          id: true,
          name: true,
          category: true,
          createdAt: true,
          rating: true,
          MarketplaceThemeDownload: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: type === 'themes' ? 50 : 10,
      });

      items.push(
        ...themes.map((t) => ({
          id: t.id,
          type: 'theme' as const,
          name: t.name,
          category: t.category || 'general',
          likes: Math.floor((t.rating || 0) * 10), // Aproximar likes del rating
          downloads: t.MarketplaceThemeDownload.length,
          views: 0,
          comments: 0,
          createdAt: t.createdAt.toISOString(),
        }))
      );
    }

    // Sort items por fecha
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      stats,
      items,
      count: items.length,
    });
  } catch (error: any) {
    console.error('Error loading shared content:', error);

    if (error.message === 'No autorizado') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Error al cargar el contenido compartido' },
      { status: 500 }
    );
  }
}
