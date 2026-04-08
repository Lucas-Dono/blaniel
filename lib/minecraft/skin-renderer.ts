import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { MinecraftSkinTraits } from '@/types/minecraft-skin';
import { logError } from '@/lib/logger';
import { assembleSkin } from './skin-assembler';
import { SkinConfiguration, ComponentStyle } from '@/types/minecraft-skin-components';
import { getCharacterSkinConfig, CharacterSkinConfig } from './character-skin-configs';

const COMPONENTS_DIR = path.join(process.cwd(), 'public/minecraft/components');

/**
 * Generates skin PNG (64x64) from traits
 * This function runs on-the-fly when the client requests the skin
 *
 * Improved flow:
 * 1. If specific configuration exists for the character → use modular components
 * 2. If not → use legacy template system with coloring
 */
export async function renderSkinFromTraits(
  traits: MinecraftSkinTraits,
  characterName?: string
): Promise<Buffer> {
  try {
    console.log('[Minecraft Skin] Rendering skin:', traits.templateId);

    // Try to use modular component configuration if it exists
    const characterConfig = characterName ? getCharacterSkinConfig(characterName) : null;

    if (characterConfig) {
      console.log('[Minecraft Skin] Using modular configuration for:', characterName);
      return renderFromComponentConfig(characterConfig, traits);
    }

    // Fallback: legacy template system
    return renderFromTemplate(traits);

  } catch (error) {
    logError(error, { context: 'renderSkinFromTraits', traits, characterName });

    // Fallback: return default Steve skin
    return getDefaultSteveSkin();
  }
}

/**
 * Renders skin using modular component system
 */
async function renderFromComponentConfig(
  config: CharacterSkinConfig,
  traits: MinecraftSkinTraits
): Promise<Buffer> {
  // Construir SkinConfiguration completa desde el config del personaje
  const skinConfig: SkinConfiguration = {
    bodyGenes: {
      height: 'average',
      build: config.gender === 'female' ? 'slim' : 'athletic',
      armModel: config.gender === 'female' ? 'slim' : 'classic',
      chest: config.gender === 'female' ? 'medium' : 'flat',
      hips: 'average',
      shoulders: config.gender === 'female' ? 'narrow' : 'average',
      headSize: 'normal',
      legLength: 'normal',
    },
    facialGenes: {
      faceShape: 'oval',
      eyeSize: config.gender === 'female' ? 'large' : 'medium',
      eyeSpacing: 'normal',
      noseSize: 'medium',
      mouthWidth: 'normal',
      jawline: config.gender === 'female' ? 'soft' : 'normal',
      eyeExpression: 'neutral',
      mouthExpression: 'neutral',
    },
    colors: {
      skinTone: config.skinTone,
      skinShadow: adjustColorBrightness(config.skinTone, -20),
      skinHighlight: adjustColorBrightness(config.skinTone, 20),
      hairPrimary: config.hairColor,
      eyeColor: config.eyeColor,
      eyeWhite: '#FFFFFF',
      eyePupil: '#000000',
      clothingPrimary: '#4169E1', // Azul por defecto
      clothingSecondary: '#2C3E50',
    },
    components: config.components as SkinConfiguration['components'],
    style: ComponentStyle.PIXEL,
    version: 1,
    generatedAt: new Date().toISOString(),
  };

  return assembleSkin(skinConfig, COMPONENTS_DIR);
}

/**
 * Legacy rendering system with templates and coloring
 */
async function renderFromTemplate(traits: MinecraftSkinTraits): Promise<Buffer> {
  // 1. Load base template from filesystem
  const templatePath = path.join(
    process.cwd(),
    'public/minecraft/templates',
    `${traits.templateId}.png`
  );

  // Check if specific template exists, otherwise use generic
  let finalTemplatePath = templatePath;
  try {
    await fs.access(templatePath);
  } catch {
    console.warn('[Minecraft Skin] Template not found, using generic:', traits.templateId);
    finalTemplatePath = path.join(
      process.cwd(),
      'public/minecraft/templates',
      `${traits.gender}_generic.png`
    );

    // If generic doesn't exist either, use universal base
    try {
      await fs.access(finalTemplatePath);
    } catch {
      finalTemplatePath = path.join(
        process.cwd(),
        'public/minecraft/templates',
        'base_steve.png'
      );
    }
  }

  const baseImage = await sharp(finalTemplatePath);

  // 2. Define Minecraft UV regions (standard 64x64 format)
  const skinRegions = [
    // Head
    { x: 8, y: 8, w: 8, h: 8 },   // Front face
    { x: 0, y: 8, w: 8, h: 8 },   // Right side
    { x: 16, y: 8, w: 8, h: 8 },  // Left side
    { x: 8, y: 0, w: 8, h: 8 },   // Top
    { x: 16, y: 0, w: 8, h: 8 },  // Bottom
    { x: 24, y: 8, w: 8, h: 8 },  // Back

    // Torso
    { x: 20, y: 20, w: 8, h: 12 }, // Front

    // Arms
    { x: 44, y: 20, w: 4, h: 12 }, // Right arm
    { x: 36, y: 52, w: 4, h: 12 }, // Left arm

    // Legs
    { x: 4, y: 20, w: 4, h: 12 },  // Right leg
    { x: 20, y: 52, w: 4, h: 12 }, // Left leg
  ];

  const hairRegions = [
    { x: 40, y: 0, w: 8, h: 8 },   // Hair overlay top
    { x: 40, y: 8, w: 8, h: 8 },   // Hair overlay face
  ];

  // 3. Generate color layers (only if not bald)
  const composites: sharp.OverlayOptions[] = [];

  // Skin layer
  const skinLayer = await createColorOverlay(64, 64, traits.skinTone, skinRegions);
  composites.push({ input: skinLayer, blend: 'multiply' });

  // Hair layer (only if not bald)
  if (traits.hairStyle !== 'bald') {
    const hairLayer = await createColorOverlay(64, 64, traits.hairColor, hairRegions);
    composites.push({ input: hairLayer, blend: 'overlay' });
  }

  // 4. Composite layers
  const finalSkin = await baseImage
    .composite(composites)
    .png()
    .toBuffer();

  console.log('[Minecraft Skin] Skin rendered successfully');

  return finalSkin;
}

/**
 * Adjust brightness of a hex color
 */
function adjustColorBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  const adjust = (value: number) => Math.min(255, Math.max(0, value + Math.round(value * percent / 100)));
  return rgbToHex(adjust(rgb.r), adjust(rgb.g), adjust(rgb.b));
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/** Creates an overlay color layer in specific regions */
async function createColorOverlay(
  width: number,
  height: number,
  color: string,
  regions: Array<{ x: number; y: number; w: number; h: number }>
): Promise<Buffer> {
  try {
    // Convert hex to RGB
    const rgb = hexToRgb(color);

    // Create SVG with rectangles in each region
    const svgRects = regions.map(r =>
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"
             fill="rgb(${rgb.r},${rgb.g},${rgb.b})" />`
    ).join('\n');

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${svgRects}
      </svg>
    `;

    // Convert SVG to PNG buffer
    const buffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    return buffer;

  } catch (error) {
    logError(error, { context: 'createColorOverlay', color });
    throw error;
  }
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 128, g: 128, b: 128 }; // Default gray
}

/** Returns Steve's default skin (64x64) */
async function getDefaultSteveSkin(): Promise<Buffer> {
  try {
    const defaultPath = path.join(
      process.cwd(),
      'public/minecraft/templates',
      'base_steve.png'
    );

    return await fs.readFile(defaultPath);
  } catch {
    // If base_steve.png does not exist, create a minimal skin
    return createMinimalSkin();
  }
}

/** Creates a minimal skin if there are no template files */
async function createMinimalSkin(): Promise<Buffer> {
  // Basic Skin of Steve (simplified)
  const svg = `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <!-- Head (light skin) -->
      <rect x="8" y="8" width="8" height="8" fill="#F5D7B1" />
      <rect x="0" y="8" width="8" height="8" fill="#E5C7A1" />
      <rect x="16" y="8" width="8" height="8" fill="#E5C7A1" />
      <rect x="8" y="0" width="8" height="8" fill="#F5D7B1" />

      <!-- Torso (blue shirt) -->
      <rect x="20" y="20" width="8" height="12" fill="#0066CC" />

      <!-- Arms (skin) -->
      <rect x="44" y="20" width="4" height="12" fill="#F5D7B1" />
      <rect x="36" y="52" width="4" height="12" fill="#F5D7B1" />

      <!-- Legs (dark blue pants) -->
      <rect x="4" y="20" width="4" height="12" fill="#003366" />
      <rect x="20" y="52" width="4" height="12" fill="#003366" />
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}
