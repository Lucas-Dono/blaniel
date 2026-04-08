import { GoogleGenerativeAI } from '@google/generative-ai';
import { MinecraftSkinTraits } from '@/types/minecraft-skin';
import { logError } from '@/lib/logger';

/**
 * Analyzes an image to extract Minecraft skin traits
 * Cost: ~$0.001 per analysis (Gemini 2.0 Flash)
 */
export async function analyzeSkinTraits(
  imageUrl: string
): Promise<MinecraftSkinTraits> {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `Analyze this character image to create a Minecraft skin.
Extract the following characteristics IN JSON FORMAT:

{
  "gender": "male|female|non_binary",
  "skinTone": "#HEXCOLOR (average skin tone)",
  "hairColor": "#HEXCOLOR (dominant hair color, if bald use #000000)",
  "eyeColor": "#HEXCOLOR (eye color)",
  "hairStyle": "short|long|bald|ponytail|curly",
  "clothingStyle": "modern|fantasy|medieval|casual|formal|athletic",
  "hasGlasses": true/false,
  "hasHat": true/false,
  "hasFacialHair": true/false
}

IMPORTANT:
- Respond ONLY with JSON, no additional text
- Use real hex colors extracted from the image
- If you cannot determine something, use reasonable default values`;

    // Download image and convert to base64
    const imageBase64 = await fetchImageAsBase64(imageUrl);

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg',
        },
      },
    ]);

    const responseText = result.response.text();

    // Clean response (Gemini sometimes adds ```json```)
    const cleanJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const analysis = JSON.parse(cleanJson);

    // Select optimal template
    const templateId = selectTemplate(analysis);

    const traits: MinecraftSkinTraits = {
      version: 1,
      ...analysis,
      templateId,
      generatedAt: new Date().toISOString(),
    };

    console.log('[Minecraft Skin] Traits generated:', traits);

    return traits;

  } catch (error) {
    logError(error, { context: 'analyzeSkinTraits', imageUrl });

    // Fallback to default values
    console.warn('[Minecraft Skin] Using default traits due to error');
    return getDefaultTraits();
  }
}

/**
 * Select optimal template based on analyzed traits
 */
function selectTemplate(analysis: Partial<MinecraftSkinTraits>): string {
  const { gender, clothingStyle, hairStyle } = analysis;

  // Formato: {gender}_{clothingStyle}_{hairStyle}_{variant}
  const g = gender || 'male';
  const c = clothingStyle || 'casual';
  const h = hairStyle || 'short';

  return `${g}_${c}_${h}_01`;
}

/**
 * Download image and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');

  } catch (error) {
    logError(error, { context: 'fetchImageAsBase64', url });
    throw error;
  }
}

/**
 * Default traits (fallback)
 */
function getDefaultTraits(): MinecraftSkinTraits {
  return {
    version: 1,
    gender: 'non_binary',
    skinTone: '#F5D7B1', // Medium tone
    hairColor: '#3D2817', // Dark brown
    eyeColor: '#4A7BA7',  // Blue
    hairStyle: 'short',
    clothingStyle: 'casual',
    hasGlasses: false,
    hasHat: false,
    hasFacialHair: false,
    templateId: 'non_binary_casual_short_01',
    generatedAt: new Date().toISOString(),
  };
}
