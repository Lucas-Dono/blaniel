/**
 * Modular Skin Assembler
 * 
 * Takes individual components and assembles them into a complete 64x64 skin
 * Applies programmatic recoloring based on the color palette
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import {SkinConfiguration, ComponentCategory} from '@/types/minecraft-skin-components';
import { UV_REGIONS, SKIN_WIDTH, SKIN_HEIGHT } from './component-generator';
import { logError } from '@/lib/logger';

// ============================================================================
// UTILIDADES DE COLOR
// ============================================================================

/**
 * Convierte hex a RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 128, g: 128, b: 128 };
}

/**
 * Recolors an image by replacing grays with a specific color
 * 
 * Algorithm:
 * 1. Reads each pixel of the PNG
 * 2. If the pixel is gray (R ≈ G ≈ B), map its luminosity to the target color
 * 3. Pixels of other colors (white, black) are preserved
 */
async function recolorImage(
  imagePath: string,
  targetColor: string
): Promise<Buffer> {
  try {
    const imageBuffer = await fs.readFile(imagePath);
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const targetRgb = hexToRgb(targetColor);
    const pixelCount = info.width * info.height;
    const newData = Buffer.alloc(data.length);

    for (let i = 0; i < pixelCount; i++) {
      const offset = i * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];

      // Detectar si es un pixel gris (R ≈ G ≈ B)
      const isGray = Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - b) < 10;

      // Excluir blanco puro (para ojos) y negro puro (para detalles)
      const isWhite = r > 245 && g > 245 && b > 245;
      const isBlack = r < 10 && g < 10 && b < 10;

      // Solo recolorear grises intermedios (no blanco ni negro)
      if (isGray && !isWhite && !isBlack && a > 0) {
        // Mapear luminosidad del gris al color target
        const luminosity = r / 255; // Normalizar 0-1

        newData[offset] = Math.round(targetRgb.r * luminosity);
        newData[offset + 1] = Math.round(targetRgb.g * luminosity);
        newData[offset + 2] = Math.round(targetRgb.b * luminosity);
        newData[offset + 3] = a;
      } else {
        // Mantener pixel original (blanco, negro, o transparente)
        newData[offset] = r;
        newData[offset + 1] = g;
        newData[offset + 2] = b;
        newData[offset + 3] = a;
      }
    }

    return sharp(newData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    })
      .png()
      .toBuffer();
  } catch (error) {
    logError(error, { context: 'recolorImage', imagePath, targetColor });
    throw error;
  }
}

// ============================================================================
// ENSAMBLADOR PRINCIPAL
// ============================================================================

/** Assembles a complete skin from modular configuration */
export async function assembleSkin(
  config: SkinConfiguration,
  componentsBaseDir: string
): Promise<Buffer> {
  try {
    console.log('[Skin Assembler] Iniciando ensamblaje de skin...');

    // 1. Crear canvas base 64x64 transparente (raw buffer)
    const canvasData = Buffer.alloc(SKIN_WIDTH * SKIN_HEIGHT * 4, 0);

    // 2. Construir lista de capas ordenadas por layer (menor = abajo, mayor = arriba)
    const layers: { buffer: Buffer; top: number; left: number }[] = [];

    // 3. CAPA BASE: Generar cabeza base (devuelve buffer en vez de agregar a layers)
    const headBase = await generateHeadBase(config, componentsBaseDir);

    // 4. CAPA BASE: Piel del cuerpo (torso, brazos, piernas)
    await addBodyBaseLayers(layers, config, componentsBaseDir);

    // 5. CAPA: Ropa (remeras, camisas, chaquetas, pantalones)
    await addClothingLayers(layers, config, componentsBaseDir);

    // 6. CAPA: Cabeza con ojos pre-compuestos manualmente + otros elementos faciales
    await addFacialLayers(layers, headBase, config, componentsBaseDir);

    // 7. CAPA: Pelo (overlay de cabeza)
    await addHairLayers(layers, config, componentsBaseDir);

    // 8. CAPA: Accesorios extremidades (guantes, zapatos/botas)
    await addExtremityAccessories(layers, config, componentsBaseDir);

    // 9. CAPA: Accesorios cabeza (lentes, sombreros)
    await addHeadAccessories(layers, config, componentsBaseDir);

    // 10. Compose all layers pixel-by-pixel (without antialiasing)
    console.log(`[Skin Assembler] Componiendo ${layers.length} capas pixel-por-pixel...`);
    for (const layer of layers) {
      await composeLayerManually(canvasData, layer.buffer, layer.left, layer.top);
    }

    // 11. Convertir canvas raw a PNG
    console.log('[Skin Assembler] ✓ Skin ensamblada exitosamente');
    return sharp(canvasData, {
      raw: {
        width: SKIN_WIDTH,
        height: SKIN_HEIGHT,
        channels: 4,
      },
    })
      .png()
      .toBuffer();
  } catch (error) {
    logError(error, { context: 'assembleSkin', config });
    throw error;
  }
}

// ============================================================================
// MANUAL PIXEL-BY-PIXEL COMPOSITION
// ============================================================================

/** Composes a layer onto the main canvas pixel-by-pixel without antialiasing */
async function composeLayerManually(
  canvasData: Buffer,
  layerBuffer: Buffer,
  offsetX: number,
  offsetY: number
): Promise<void> {
  const layerData = await sharp(layerBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Copy layer pixels onto canvas where alpha > 0
  for (let y = 0; y < layerData.info.height; y++) {
    for (let x = 0; x < layerData.info.width; x++) {
      const layerIdx = (y * layerData.info.width + x) * 4;
      const layerAlpha = layerData.data[layerIdx + 3];

      if (layerAlpha > 0) {
        const canvasX = x + offsetX;
        const canvasY = y + offsetY;

        // Check bounds
        if (canvasX >= 0 && canvasX < SKIN_WIDTH && canvasY >= 0 && canvasY < SKIN_HEIGHT) {
          const canvasIdx = (canvasY * SKIN_WIDTH + canvasX) * 4;

          // Copy pixel directly (without blending)
          canvasData[canvasIdx] = layerData.data[layerIdx];         // R
          canvasData[canvasIdx + 1] = layerData.data[layerIdx + 1]; // G
          canvasData[canvasIdx + 2] = layerData.data[layerIdx + 2]; // B
          canvasData[canvasIdx + 3] = 255;                           // Alpha total
        }
      }
    }
  }
}

/**
 * Composes the eyes manually onto the base head pixel-by-pixel
 * to avoid Sharp antialiasing/blending
 */
async function composeEyesManually(
  headBaseBuffer: Buffer,
  eyesBuffer: Buffer
): Promise<Buffer> {
  const headData = await sharp(headBaseBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const eyesData = await sharp(eyesBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Copy eye pixels onto head where alpha > 0
  for (let y = 0; y < eyesData.info.height; y++) {
    for (let x = 0; x < eyesData.info.width; x++) {
      const eyeIdx = (y * eyesData.info.width + x) * 4;
      const eyeAlpha = eyesData.data[eyeIdx + 3];

      if (eyeAlpha > 0) {
        // Calculate position in head_base (eyes go in HEAD_FRONT: x+8, y+8)
        const headX = x + UV_REGIONS.HEAD_FRONT.x;
        const headY = y + UV_REGIONS.HEAD_FRONT.y;
        const headIdx = (headY * headData.info.width + headX) * 4;

        // Copy pixel directly (without blending)
        headData.data[headIdx] = eyesData.data[eyeIdx];         // R
        headData.data[headIdx + 1] = eyesData.data[eyeIdx + 1]; // G
        headData.data[headIdx + 2] = eyesData.data[eyeIdx + 2]; // B
        headData.data[headIdx + 3] = 255;                        // Alpha total
      }
    }
  }

  // Convertir de vuelta a PNG
  return sharp(headData.data, {
    raw: {
      width: headData.info.width,
      height: headData.info.height,
      channels: 4,
    },
  })
  .png()
  .toBuffer();
}

// ============================================================================
// ASSEMBLY FUNCTIONS BY CATEGORY
// ============================================================================

/** Generates base head layer (skin) and returns the buffer */
async function generateHeadBase(
  config: SkinConfiguration,
  baseDir: string
): Promise<Buffer> {
  const { colors, components } = config;

  // Usar headBase de config o default a head_base_01
  const headBaseId = components.headBase || 'head_base_01';
  const headBasePath = path.join(baseDir, 'head_base', `${headBaseId}.png`);
  const recoloredHead = await recolorImage(headBasePath, colors.skinTone);
  return recoloredHead;
}

/**
 * Adds base body layers (skin)
 * Body sprites are now complete 64x64 with all faces
 */
async function addBodyBaseLayers(
  layers: { buffer: Buffer; top: number; left: number }[],
  config: SkinConfiguration,
  baseDir: string
): Promise<void> {
  const { colors, components } = config;

  // Torso (complete 64x64 sprite with all faces)
  if (components.torso) {
    const torsoPath = path.join(baseDir, ComponentCategory.TORSO_BASE, `${components.torso}.png`);
    const recoloredTorso = await recolorImage(torsoPath, colors.skinTone);
    layers.push({
      buffer: recoloredTorso,
      top: 0,
      left: 0,
    });
  }

  // Arms (complete 64x64 sprite with all faces)
  if (components.arms) {
    const armsPath = path.join(baseDir, ComponentCategory.ARMS_BASE, `${components.arms}.png`);
    const recoloredArms = await recolorImage(armsPath, colors.skinTone);
    layers.push({
      buffer: recoloredArms,
      top: 0,
      left: 0,
    });
  }

  // Legs (complete 64x64 sprite with all faces)
  if (components.legs) {
    const legsPath = path.join(baseDir, ComponentCategory.LEGS_BASE, `${components.legs}.png`);
    const recoloredLegs = await recolorImage(legsPath, colors.skinTone);
    layers.push({
      buffer: recoloredLegs,
      top: 0,
      left: 0,
    });
  }
}

/**
 * Adds clothing layers in correct order
 * Clothing sprites are now complete 64x64 with all faces
 * 
 * Layer order (from bottom to top):
 * 1. T-shirt (short sleeve)
 * 2. Shirt (long sleeve) - can be combined with t-shirt
 * 3. Jacket - top layer
 * 4. Pants
 */
async function addClothingLayers(
  layers: { buffer: Buffer; top: number; left: number }[],
  config: SkinConfiguration,
  baseDir: string
): Promise<void> {
  const { colors, components } = config;

  // 1. Remera/T-shirt (manga corta, capa base)
  if (components.tShirt) {
    const tShirtPath = path.join(baseDir, ComponentCategory.T_SHIRT, `${components.tShirt}.png`);
    const recoloredTShirt = await recolorImage(tShirtPath, colors.clothingPrimary);
    layers.push({
      buffer: recoloredTShirt,
      top: 0,
      left: 0,
    });
  }

  // 2. Camisa (manga larga, sobre remera si existe)
  if (components.shirt) {
    const shirtPath = path.join(baseDir, ComponentCategory.SHIRT, `${components.shirt}.png`);
    const recoloredShirt = await recolorImage(
      shirtPath,
      components.tShirt ? (colors.clothingSecondary || colors.clothingPrimary) : colors.clothingPrimary
    );
    layers.push({
      buffer: recoloredShirt,
      top: 0,
      left: 0,
    });
  }

  // 3. Chaqueta/Jacket (capa superior)
  if (components.jacket) {
    const jacketPath = path.join(baseDir, ComponentCategory.JACKET, `${components.jacket}.png`);
    const recoloredJacket = await recolorImage(
      jacketPath,
      colors.clothingSecondary || colors.clothingPrimary
    );
    layers.push({
      buffer: recoloredJacket,
      top: 0,
      left: 0,
    });
  }

  // 4. Pantalones
  if (components.pants) {
    const pantsPath = path.join(baseDir, ComponentCategory.PANTS, `${components.pants}.png`);
    const recoloredPants = await recolorImage(pantsPath, colors.clothingPrimary);
    layers.push({
      buffer: recoloredPants,
      top: 0,
      left: 0,
    });
  }
}

/**
 * Pre-compone elementos faciales (ojos) sobre la cabeza base y agrega a layers
 */
async function addFacialLayers(
  layers: { buffer: Buffer; top: number; left: number }[],
  headBaseBuffer: Buffer,
  config: SkinConfiguration,
  baseDir: string
): Promise<void> {
  const { colors, components } = config;

  let composedHead = headBaseBuffer;

  // Eyes (manual pixel-by-pixel composition to avoid antialiasing)
  if (components.eyes) {
    const eyesPath = path.join(baseDir, ComponentCategory.EYES, `${components.eyes}.png`);
    const recoloredEyes = await recolorImage(eyesPath, colors.eyeColor);
    composedHead = await composeEyesManually(composedHead, recoloredEyes);
  }

  // Agregar cabeza (con ojos pre-compuestos)
  layers.push({
    buffer: composedHead,
    top: 0,
    left: 0,
  });

  // Boca
  if (components.mouth) {
    const mouthPath = path.join(baseDir, ComponentCategory.MOUTH, `${components.mouth}.png`);
    const mouthBuffer = await fs.readFile(mouthPath);
    layers.push({
      buffer: mouthBuffer,
      top: UV_REGIONS.HEAD_FRONT.y,
      left: UV_REGIONS.HEAD_FRONT.x,
    });
  }

  // Nariz (si tiene)
  if (components.nose) {
    const nosePath = path.join(baseDir, ComponentCategory.NOSE, `${components.nose}.png`);
    const noseBuffer = await fs.readFile(nosePath);
    layers.push({
      buffer: noseBuffer,
      top: UV_REGIONS.HEAD_FRONT.y,
      left: UV_REGIONS.HEAD_FRONT.x,
    });
  }

  // Cejas (si tiene)
  if (components.eyebrows) {
    const eyebrowsPath = path.join(baseDir, ComponentCategory.EYEBROWS, `${components.eyebrows}.png`);
    const recoloredEyebrows = await recolorImage(eyebrowsPath, colors.hairPrimary);
    layers.push({
      buffer: recoloredEyebrows,
      top: UV_REGIONS.HEAD_FRONT.y,
      left: UV_REGIONS.HEAD_FRONT.x,
    });
  }
}

/**
 * Adds hair layers (head overlay)
 * Hair sprites are now full 64x64 with all faces
 */
async function addHairLayers(
  layers: { buffer: Buffer; top: number; left: number }[],
  config: SkinConfiguration,
  baseDir: string
): Promise<void> {
  const { colors, components } = config;

  // Pelo frontal (incluye todas las caras: front, top, back, left, right)
  if (components.hairFront) {
    const hairPath = path.join(baseDir, ComponentCategory.HAIR_FRONT, `${components.hairFront}.png`);
    const recoloredHair = await recolorImage(hairPath, colors.hairPrimary);
    layers.push({
      buffer: recoloredHair,
      top: 0,
      left: 0,
    });
  }

  // Top hair (small component only for HAT_TOP, overlaps)
  if (components.hairTop) {
    const hairPath = path.join(baseDir, ComponentCategory.HAIR_TOP, `${components.hairTop}.png`);
    const recoloredHair = await recolorImage(hairPath, colors.hairPrimary);
    layers.push({
      buffer: recoloredHair,
      top: UV_REGIONS.HAT_TOP.y,
      left: UV_REGIONS.HAT_TOP.x,
    });
  }

  // Back hair (small component only for HAT_BACK, overlaps)
  if (components.hairBack) {
    const hairPath = path.join(baseDir, ComponentCategory.HAIR_BACK, `${components.hairBack}.png`);
    const recoloredHair = await recolorImage(hairPath, colors.hairPrimary);
    layers.push({
      buffer: recoloredHair,
      top: UV_REGIONS.HAT_BACK.y,
      left: UV_REGIONS.HAT_BACK.x,
    });
  }

  // Pelo cayendo en cuerpo (para pelo largo que cae en espalda/hombros)
  if (components.hairBody) {
    const hairBodyPath = path.join(baseDir, ComponentCategory.HAIR_BODY, `${components.hairBody}.png`);
    const recoloredHairBody = await recolorImage(hairBodyPath, colors.hairPrimary);
    layers.push({
      buffer: recoloredHairBody,
      top: 0,
      left: 0,
    });
  }

  // Barba/bigote
  if (components.facialHair) {
    const facialHairPath = path.join(baseDir, ComponentCategory.FACIAL_HAIR, `${components.facialHair}.png`);
    const recoloredFacialHair = await recolorImage(facialHairPath, colors.hairPrimary);
    layers.push({
      buffer: recoloredFacialHair,
      top: UV_REGIONS.HEAD_FRONT.y,
      left: UV_REGIONS.HEAD_FRONT.x,
    });
  }
}

/**
 * Agrega accesorios de extremidades (guantes, zapatos, botas)
 */
async function addExtremityAccessories(
  layers: { buffer: Buffer; top: number; left: number }[],
  config: SkinConfiguration,
  baseDir: string
): Promise<void> {
  const { colors, components } = config;

  // Guantes (cubren solo las manos)
  if (components.gloves) {
    const glovesPath = path.join(baseDir, ComponentCategory.GLOVES, `${components.gloves}.png`);
    const recoloredGloves = await recolorImage(glovesPath, colors.clothingSecondary || colors.clothingPrimary);
    layers.push({
      buffer: recoloredGloves,
      top: 0,
      left: 0,
    });
  }

  // Zapatos o Botas (cubren solo los pies)
  if (components.shoes) {
    const shoesPath = path.join(baseDir, ComponentCategory.SHOES, `${components.shoes}.png`);
    const recoloredShoes = await recolorImage(shoesPath, colors.clothingSecondary || colors.clothingPrimary);
    layers.push({
      buffer: recoloredShoes,
      top: 0,
      left: 0,
    });
  } else if (components.boots) {
    const bootsPath = path.join(baseDir, ComponentCategory.BOOTS, `${components.boots}.png`);
    const recoloredBoots = await recolorImage(bootsPath, colors.clothingSecondary || colors.clothingPrimary);
    layers.push({
      buffer: recoloredBoots,
      top: 0,
      left: 0,
    });
  }
}

/**
 * Agrega accesorios de cabeza (lentes, sombreros)
 */
async function addHeadAccessories(
  layers: { buffer: Buffer; top: number; left: number }[],
  config: SkinConfiguration,
  baseDir: string
): Promise<void> {
  const { components } = config;

  // Lentes (sin recolorear, mantiene color original)
  if (components.glasses) {
    const glassesPath = path.join(baseDir, ComponentCategory.GLASSES, `${components.glasses}.png`);
    const glassesBuffer = await fs.readFile(glassesPath);
    layers.push({
      buffer: glassesBuffer,
      top: UV_REGIONS.HEAD_FRONT.y,
      left: UV_REGIONS.HEAD_FRONT.x,
    });
  }

  // Sombrero
  if (components.hat) {
    const hatPath = path.join(baseDir, ComponentCategory.HAT, `${components.hat}.png`);
    const hatBuffer = await fs.readFile(hatPath);
    layers.push({
      buffer: hatBuffer,
      top: UV_REGIONS.HAT_TOP.y,
      left: UV_REGIONS.HAT_TOP.x,
    });
  }
}

// ============================================================================
// EJEMPLO DE USO
// ============================================================================

/**
 * Genera una skin de ejemplo completa
 */
export async function generateExampleSkin(componentsDir: string): Promise<Buffer> {
  const exampleConfig: SkinConfiguration = {
    bodyGenes: {
      height: 'average',
      build: 'athletic',
      armModel: 'classic',
      chest: 'medium',
      hips: 'average',
      shoulders: 'average',
      headSize: 'normal',
      legLength: 'normal',
    },
    facialGenes: {
      faceShape: 'oval',
      eyeSize: 'medium',
      eyeSpacing: 'normal',
      noseSize: 'medium',
      mouthWidth: 'normal',
      jawline: 'normal',
      eyeExpression: 'happy',
      mouthExpression: 'smile',
    },
    colors: {
      skinTone: '#D4A574',
      skinShadow: '#B8895E',
      skinHighlight: '#F0C18A',
      hairPrimary: '#3D2817',
      eyeColor: '#4169E1',
      eyeWhite: '#FFFFFF',
      eyePupil: '#000000',
      clothingPrimary: '#4B0082',
      clothingSecondary: '#9370DB',
    },
    components: {
      eyes: 'eyes_01',
      mouth: 'mouth_01',
      torso: 'torso_average_01',
      arms: 'arms_classic_01',
      legs: 'legs_average_01',
      hairFront: 'hair_front_01',
      hairTop: 'hair_top_01',
      hairBack: 'hair_back_01',
      shirt: 'shirt_01',
      pants: 'pants_01',
    },
    style: 'pixel' as any,
    version: 1,
    generatedAt: new Date().toISOString(),
  };

  return assembleSkin(exampleConfig, componentsDir);
}
