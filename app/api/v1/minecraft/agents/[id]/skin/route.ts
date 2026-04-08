import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderSkinFromTraits } from '@/lib/minecraft/skin-renderer';
import { MinecraftSkinTraitsSchema, MinecraftSkinTraits } from '@/types/minecraft-skin';
import { assembleSkin } from '@/lib/minecraft/skin-assembler';
import { SkinConfiguration } from '@/types/minecraft-skin-components';
import path from 'path';

/**
 * GET /api/v1/minecraft/agents/:id/skin
 *
 * Genera y retorna la skin PNG (64x64) del agente desde sus traits
 * La skin se genera on-the-fly y se cachea agresivamente en el cliente
 *
 * Costo: $0 (generación local con Sharp)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    console.log('[Minecraft Skin] Solicitud de skin para agente:', agentId);

    // 1. Obtener traits del agente
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        metadata: true,
        name: true, // For buscar configuración de componentes por nombre
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const metadata = agent.metadata as any;
    const skinTraits = metadata?.minecraft?.skinTraits as MinecraftSkinTraits | undefined;
    const componentConfig = metadata?.minecraft?.componentConfig as SkinConfiguration | undefined;

    // Convertir nombre a slug para buscar configuración de componentes modulares
    // Ej: "Albert Einstein" -> "albert-einstein"
    const characterSlug = agent.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // PRIORIDAD 1: Configuración de componentes en metadata (personajes de usuario)
    if (componentConfig) {
      console.log('[Minecraft Skin] Usando componentConfig de metadata para:', agent.name);

      const COMPONENTS_DIR = path.join(process.cwd(), 'public/minecraft/components');
      const skinBuffer = await assembleSkin(componentConfig, COMPONENTS_DIR);

      return new NextResponse(new Uint8Array(skinBuffer), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': `"${agentId}-component-metadata"`,
          'X-Skin-Source': 'component-metadata',
          'X-Character-Name': agent.name,
        },
      });
    }

    // PRIORIDAD 2: SkinTraits (sistema legacy, se mantiene por compatibilidad)
    if (skinTraits) {
      const validation = MinecraftSkinTraitsSchema.safeParse(skinTraits);
      if (!validation.success) {
        console.error('[Minecraft Skin] Invalid traits:', validation.error);
        return NextResponse.json(
          {
            error: 'Invalid skin traits',
            details: validation.error.issues,
          },
          { status: 400 }
        );
      }

      // 3. Generar PNG on-the-fly desde traits
      const skinBuffer = await renderSkinFromTraits(validation.data, characterSlug);

      return new NextResponse(new Uint8Array(skinBuffer), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable', // 1 año
          'ETag': `"${agentId}-${skinTraits.generatedAt}"`,
          'X-Skin-Version': String(skinTraits.version),
          'X-Template-Id': skinTraits.templateId,
        },
      });
    }

    // PRIORIDAD 3: Configuración hardcodeada (personajes premium/históricos)
    console.log('[Minecraft Skin] Intentando con configuración hardcodeada para:', characterSlug);

    // Create skinTraits dummy para el renderer (solo se usará characterSlug)
    const dummyTraits: MinecraftSkinTraits = {
      version: 1,
      gender: 'female',
      skinTone: '#F5D7B1',
      hairColor: '#3D2817',
      eyeColor: '#4A7BA7',
      hairStyle: 'long',
      clothingStyle: 'casual',
      templateId: 'default',
      generatedAt: new Date().toISOString(),
    };

    const skinBuffer = await renderSkinFromTraits(dummyTraits, characterSlug);

    // 4. Retornar con headers de caché agresivo (desde configuración de componentes)
    return new NextResponse(new Uint8Array(skinBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable', // 1 año
        'ETag': `"${agentId}-component-config"`,
        'X-Skin-Source': 'component-config',
        'X-Character-Slug': characterSlug,
      },
    });

  } catch (error) {
    console.error('[Minecraft Skin] Error:', error);
    return NextResponse.json(
      {
        error: 'Error rendering skin',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
