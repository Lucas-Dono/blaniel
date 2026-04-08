/**
 * Automatic Minecraft Component Configuration Generator
 * 
 * Analyzes an agent's reference image and automatically generates
 * the modular component configuration for its Minecraft skin.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { SkinConfiguration, ComponentStyle } from '@/types/minecraft-skin-components';
import { logError } from '@/lib/logger';
import fs from 'fs/promises';
import path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

interface VisualAnalysis {
  gender: 'male' | 'female' | 'non_binary';
  skinTone: string;      // hex color
  hairColor: string;     // hex color
  eyeColor: string;      // hex color
  hairLength: 'bald' | 'very_short' | 'short' | 'medium' | 'long';
  hairStyle: 'straight' | 'wavy' | 'curly' | 'updo';
  age: 'young' | 'adult' | 'elderly';
  clothingStyle: 'casual' | 'formal' | 'athletic' | 'historical';
}

/** Analyzes an image with Gemini Vision and extracts visual features */
async function analyzeImageWithGemini(imageUrl: string): Promise<VisualAnalysis> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // If it's a local URL, load image from filesystem
    let imagePart;
    if (imageUrl.startsWith('/')) {
      const fullPath = path.join(process.cwd(), 'public', imageUrl);
      const imageBuffer = await fs.readFile(fullPath);
      const base64Image = imageBuffer.toString('base64');

      // Determine mime type
      const ext = path.extname(imageUrl).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' :
                      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                      ext === '.webp' ? 'image/webp' : 'image/png';

      imagePart = {
        inlineData: {
          data: base64Image,
          mimeType,
        },
      };
    } else {
      // External URL - Gemini can load it directly
      imagePart = {
        fileData: {
          fileUri: imageUrl,
          mimeType: 'image/jpeg',
        },
      };
    }

    const prompt = `Analyze this character image and extract the following EXACT characteristics to generate a Minecraft skin.

IMPORTANT: Respond ONLY with a valid JSON object, without markdown, without additional explanations.

Characteristics to extract:
{
  "gender": "male" | "female" | "non_binary",
  "skinTone": "#RRGGBB (hex skin color, examples: #F5D7B1 pale, #D4A882 medium, #8B6F47 dark)",
  "hairColor": "#RRGGBB (hex hair color, examples: #1C1208 black, #8B6F47 brown, #E8E8E8 white)",
  "eyeColor": "#RRGGBB (hex eye color, examples: #4A7BA7 blue, #654321 brown, #228B22 green)",
  "hairLength": "bald" | "very_short" | "short" | "medium" | "long",
  "hairStyle": "straight" | "wavy" | "curly" | "updo (bun/ponytail)",
  "age": "young" | "adult" | "elderly",
  "clothingStyle": "casual" | "formal" | "athletic" | "historical"
}

Rules:
- skinTone: Analyze visible skin tone and give the closest hex color
- hairColor: Primary hair color
- eyeColor: Iris color
- hairLength: bald (hairless), very_short (buzz <2cm), short (2-10cm), medium (10-30cm), long (>30cm)
- hairStyle: straight (smooth), wavy (wavy), curly (curly), updo (bun/ponytail)
- age: young (<25), adult (25-60), elderly (>60)
- clothingStyle: Predominant clothing style

Respond ONLY with JSON:`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text();

    // Clean response (remove markdown if it exists)
    const jsonText = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const analysis = JSON.parse(jsonText) as VisualAnalysis;

    console.log('[Component Config Generator] Gemini Analysis:', analysis);

    return analysis;

  } catch (error) {
    logError(error, { context: 'analyzeImageWithGemini', imageUrl });

    // Fallback: default values
    return {
      gender: 'female',
      skinTone: '#F5D7B1',
      hairColor: '#8B6F47',
      eyeColor: '#654321',
      hairLength: 'medium',
      hairStyle: 'straight',
      age: 'adult',
      clothingStyle: 'casual',
    };
  }
}

/** Selects appropriate components based on the visual analysis */
function selectComponents(analysis: VisualAnalysis): SkinConfiguration['components'] {
  const isFemale = analysis.gender === 'female';
  const _isMale = analysis.gender === 'male';

  const components: SkinConfiguration['components'] = {
    // Base
    headBase: isFemale ? 'head_female_01' : 'head_base_01',
    eyes: isFemale ? 'eyes_female_01' : 'eyes_01',
    mouth: isFemale ? 'mouth_empty' : 'mouth_02',
    torso: isFemale ? 'torso_slim_01' : 'torso_athletic_01',
    arms: isFemale ? 'arms_slim_01' : 'arms_classic_01',
    legs: 'legs_average_01',
  };

  // Hair selection based on length and style
  if (analysis.hairLength === 'bald') {
    // No hair - leave headBase clean
  } else if (analysis.hairLength === 'very_short' || analysis.hairLength === 'short') {
    // Short hair
    if (analysis.hairStyle === 'curly') {
      components.hairFront = 'hair_curly_red_09'; // Reused, will be recolored
    } else if (isFemale) {
      components.hairFront = 'hair_short_02_bob';
    } else {
      components.hairFront = 'hair_short_06_undercut';
    }
  } else if (analysis.hairLength === 'medium') {
    // Medium hair
    if (isFemale) {
      components.hairFront = 'hair_medium_01_lob';
    } else {
      components.hairFront = 'hair_short_06_undercut';
    }
  } else if (analysis.hairLength === 'long') {
    // Long hair
    if (analysis.hairStyle === 'updo') {
      // Bun/ponytail
      components.hairBack = 'hair_updo_01_high_ponytail';
    } else if (analysis.hairStyle === 'curly') {
      components.hairFront = 'hair_curly_red_09';
      components.hairBody = 'hair_body_curly_09';
    } else if (analysis.hairStyle === 'wavy') {
      components.hairFront = 'hair_long_02_wavy';
      components.hairBody = 'hair_long_body_02_wavy';
    } else {
      // Straight
      components.hairFront = 'hair_long_straight_07';
      components.hairBody = 'hair_body_long_07';
    }
  }

  // Clothing based on style
  if (analysis.clothingStyle === 'formal') {
    components.shirt = 'shirt_01';
    components.pants = 'pants_01';
    components.shoes = 'shoes_02';
  } else if (analysis.clothingStyle === 'athletic') {
    components.tShirt = 't_shirt_02';
    components.pants = 'pants_01';
    components.shoes = 'shoes_01';
  } else if (analysis.clothingStyle === 'historical') {
    components.shirt = 'shirt_01';
    components.pants = 'pants_01';
    components.shoes = 'boots_01';
  } else {
    // Casual (default)
    components.tShirt = 't_shirt_01';
    components.pants = 'pants_01';
    components.shoes = 'shoes_01';
  }

  return components;
}

/**
 * Adjusts brightness of a hex color
 */
function adjustColorBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));

  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase();
}

/**
 * Generates complete component configuration from an image
 * 
 * @param referenceImageUrl URL of the reference image (/personajes/... or external URL)
 * @returns complete SkinConfiguration ready for assembleSkin
 */
export async function generateComponentConfig(
  referenceImageUrl: string
): Promise<SkinConfiguration> {
  console.log('[Component Config Generator] Generating config for:', referenceImageUrl);

  // 1. Analyze image with Gemini Vision
  const analysis = await analyzeImageWithGemini(referenceImageUrl);

  // 2. Select appropriate components
  const components = selectComponents(analysis);

  // 3. Build complete configuration
  const config: SkinConfiguration = {
    bodyGenes: {
      height: 'average',
      build: analysis.gender === 'female' ? 'slim' : 'athletic',
      armModel: analysis.gender === 'female' ? 'slim' : 'classic',
      chest: analysis.gender === 'female' ? 'medium' : 'flat',
      hips: 'average',
      shoulders: analysis.gender === 'female' ? 'narrow' : 'average',
      headSize: 'normal',
      legLength: 'normal',
    },
    facialGenes: {
      faceShape: 'oval',
      eyeSize: analysis.gender === 'female' ? 'large' : 'medium',
      eyeSpacing: 'normal',
      noseSize: 'medium',
      mouthWidth: 'normal',
      jawline: analysis.gender === 'female' ? 'soft' : 'normal',
      eyeExpression: 'neutral',
      mouthExpression: 'neutral',
    },
    colors: {
      skinTone: analysis.skinTone,
      skinShadow: adjustColorBrightness(analysis.skinTone, -20),
      skinHighlight: adjustColorBrightness(analysis.skinTone, 20),
      hairPrimary: analysis.hairColor,
      eyeColor: analysis.eyeColor,
      eyeWhite: '#FFFFFF',
      eyePupil: '#000000',
      clothingPrimary: '#4169E1', // Azul por defecto
      clothingSecondary: '#2C3E50',
    },
    components,
    style: ComponentStyle.PIXEL,
    version: 1,
    generatedAt: new Date().toISOString(),
  };

  console.log('[Component Config Generator] Config generated successfully');

  return config;
}

/**
 * Generates and saves componentConfig in the metadata of an agent
 *
 * @param agentId Agent ID
 * @param referenceImageUrl URL of the reference image
 */
export async function generateAndSaveComponentConfig(
  agentId: string,
  referenceImageUrl: string
): Promise<void> {
  try {
    const { prisma } = await import('@/lib/prisma');

    console.log('[Component Config Generator] Generating for agent:', agentId);

    // Generate configuration
    const componentConfig = await generateComponentConfig(referenceImageUrl);

    // Get current metadata
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { metadata: true },
    });

    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const metadata = (agent.metadata as any) || {};

    // Update metadata with componentConfig
    metadata.minecraft = metadata.minecraft || {};
    metadata.minecraft.componentConfig = componentConfig;
    metadata.minecraft.generatedAt = new Date().toISOString();
    metadata.minecraft.compatible = true;

    // Save to database
    await prisma.agent.update({
      where: { id: agentId },
      data: { metadata },
    });

    console.log('[Component Config Generator] Config saved successfully for:', agentId);

  } catch (error) {
    logError(error, { context: 'generateAndSaveComponentConfig', agentId, referenceImageUrl });
    throw error;
  }
}
