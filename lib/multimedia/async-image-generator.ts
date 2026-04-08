/**
 * ASYNC IMAGE GENERATOR
 *
 * Handles asynchronous image generation with AI Horde
 * Allows the conversation to continue while the image is being generated
 *
 * Flow:
 * 1. AI says it wants to send a photo [IMAGE: description]
 * 2. System generates a contextual waiting message using AI's personality
 * 3. Starts generation in background
 * 4. Returns waiting message to user immediately
 * 5. When finished, sends message with image
 */

import { prisma } from '@/lib/prisma';
import { getLLMProvider } from '@/lib/llm/provider';

import { createLogger } from '@/lib/logger';
import { nanoid } from 'nanoid';

const log = createLogger('AsyncImageGenerator');

export interface AsyncImageGenerationOptions {
  agentId: string;
  agentName: string;
  agentPersonality: string;
  agentSystemPrompt?: string;
  userId: string;
  referenceImageUrl?: string;
  description: string;
}

export interface WaitingMessageResult {
  waitingMessage: {
    id: string;
    content: string;
    createdAt: Date;
    metadata: Record<string, unknown>;
  };
  pendingGenerationId: string;
}

export class AsyncImageGenerator {
  /**
   * Generates a contextual waiting message using AI's personality
   * and starts image generation in background
   * @deprecated - pendingImageGeneration model no longer exists in schema
   */
  async startAsyncGeneration(
    options: AsyncImageGenerationOptions
  ): Promise<WaitingMessageResult> {
    throw new Error('AsyncImageGenerator is deprecated - pendingImageGeneration model no longer exists');
  }

  /** Generates contextual waiting message using agent's personality */
  private async generateWaitingMessage(
    agentName: string,
    agentPersonality: string,
    systemPrompt: string | undefined,
    imageDescription: string
  ): Promise<string> {
    const llm = getLLMProvider();

    const prompt = `Estás a punto de tomar una foto para el usuario.
La descripción de la foto que vas a tomar es: "${imageDescription}"

Genera un mensaje breve y natural (1-2 oraciones) donde le dices al usuario que:
- Estás tomando la foto
- Le llegará en un momento
- Pueden seguir conversando mientras tanto

IMPORTANTE:
- Usa tu personalidad y estilo natural
- NO uses formato de lista o bullets
- NO uses emojis excesivos (máximo 1)
- Habla en primera persona como si realmente estuvieras tomando la foto
- Sé breve, directo y natural

Ejemplos según personalidad:
- Persona alegre: "¡Dame un segundo que tomo la foto! Te la mando en un ratito, sigamos charlando 😊"
- Persona seria: "Voy a tomar la foto. Te llegará pronto, podemos seguir hablando."
- Persona tímida: "Mm, déjame tomar la foto... te la envío cuando esté lista, ¿de qué hablábamos?"
- Persona juguetona: "¡Momento fotográfico! Dame un minuto mientras la saco, ¿seguimos con la conve?"

Tu personalidad: ${agentPersonality}

Tu mensaje:`;

    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : `Eres ${agentName}. ${prompt}`;

    const response = await llm.generate({
      systemPrompt: fullPrompt,
      messages: [],
    });

    // Limpiar respuesta (remover comillas si las tiene)
    let cleaned = response.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }

    return cleaned;
  }

  /**
   * Processes image generation in the background
   * @deprecated - pendingImageGeneration model no longer exists in schema
   */
  private async processImageGeneration(
    pendingGenerationId: string,
    options: AsyncImageGenerationOptions
  ): Promise<void> {
    throw new Error('processImageGeneration is deprecated - pendingImageGeneration model no longer exists');
  }

  /** Generates completion message when the image is ready */
  private async generateCompletionMessage(
    agentName: string,
    agentPersonality: string,
    systemPrompt: string | undefined,
    imageDescription: string
  ): Promise<string> {
    const llm = getLLMProvider();

    const prompt = `La foto que estabas tomando ya está lista.
Descripción de la foto: "${imageDescription}"

Genera un mensaje breve y natural (1 oración) donde le dices al usuario que la foto está lista.

IMPORTANTE:
- Usa tu personalidad y estilo natural
- NO uses formato de lista o bullets
- NO uses emojis excesivos (máximo 1)
- Habla en primera persona
- Sé breve, directo y natural

Ejemplos según personalidad:
- Persona alegre: "¡Aquí está la foto que te prometí! 📸"
- Persona seria: "La foto está lista."
- Persona tímida: "Ya terminé con la foto... espero que te guste"
- Persona juguetona: "¡Tadaaa! Foto lista para admirar 😎"

Tu personalidad: ${agentPersonality}

Tu mensaje:`;

    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : `Eres ${agentName}. ${prompt}`;

    const response = await llm.generate({
      systemPrompt: fullPrompt,
      messages: [],
    });

    // Limpiar respuesta
    let cleaned = response.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }

    return cleaned;
  }

  /** Sends error message to user if generation fails */
  private async sendErrorMessage(
    pendingGenerationId: string,
    options: AsyncImageGenerationOptions
  ): Promise<void> {
    const errorMessage = await this.generateErrorMessage(
      options.agentName,
      options.agentPersonality,
      options.agentSystemPrompt
    );

    await prisma.message.create({
      data: {
        id: nanoid(),
        agentId: options.agentId,
        userId: options.userId,
        role: 'assistant',
        content: errorMessage,
        metadata: {
          type: 'image_generation_error',
          pendingGenerationId,
        },
      },
    });
  }

  /**
   * Genera mensaje de error contextual
   */
  private async generateErrorMessage(
    agentName: string,
    agentPersonality: string,
    systemPrompt: string | undefined
  ): Promise<string> {
    const llm = getLLMProvider();

    const prompt = `No pudiste tomar la foto porque hubo un problema técnico.

Genera un mensaje breve y natural (1-2 oraciones) donde:
- Le dices que hubo un problema con la foto
- Te disculpas de forma natural
- Ofreces continuar la conversación

IMPORTANTE:
- Usa tu personalidad y estilo natural
- NO menciones "errores técnicos" o "sistema"
- Habla como si realmente intentaste tomar la foto pero no salió
- Sé genuino y natural

Ejemplos:
- "Ay, no salió la foto... lo siento 😅 ¿Quieres que hablemos de otra cosa?"
- "Mm, parece que no pude tomar la foto. Disculpa, ¿de qué más querías hablar?"
- "Ups, la foto no salió bien. ¿Seguimos con la conversación?"

Tu personalidad: ${agentPersonality}

Tu mensaje:`;

    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : `Eres ${agentName}. ${prompt}`;

    const response = await llm.generate({
      systemPrompt: fullPrompt,
      messages: [],
    });

    let cleaned = response.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }

    return cleaned;
  }

  /** Converts narrative description into technical prompt for Stable Diffusion */
  private async narrativeToTechnicalPrompt(
    narrativeDescription: string,
    agentName: string,
    baseAppearance: string
  ): Promise<string> {
    const llm = getLLMProvider();

    const systemPrompt = `You are an expert at converting narrative photo descriptions into technical Stable Diffusion prompts.

CRITICAL RULES:
1. If the narrative mentions "taking a selfie" or "taking a photo":
   → Output: "POV selfie, arm extended, front camera view"
   → DO NOT show the person holding a phone in third person

2. If the narrative mentions an action (drinking coffee, reading, etc.):
   → Focus on the POSE and SETTING, not the action verb
   → "drinking coffee" → "holding coffee cup near face, warm café setting"

3. Simplify complex scenes:
   → "in a busy café with lots of people" → "café interior, blurred background, bokeh"
   → Focus on what's visually important, blur the rest

4. Maintain perspective consistency:
   → Choose ONE camera angle and stick to it
   → Don't mix "looking at camera" with "profile view"

5. Keep prompts under 50 words, focus on composition.

Return ONLY the technical prompt, no JSON, no explanation.`;

    const userPrompt = `Convert this narrative description into a technical SD prompt:

NARRATIVE: "${narrativeDescription}"

CHARACTER BASE APPEARANCE: ${baseAppearance}

Technical prompt:`;

    const response = await llm.generate({
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.4, // Más determinista
    });

    return response.trim();
  }

  /** Build an improved prompt for image generation */
  private async buildImagePrompt(
    description: string,
    agentName: string,
    agentPersonality: string,
    baseAppearance: string
  ): Promise<string> {
    // Detect if the description is narrative (contains action verbs)
    const narrativePatterns = /\b(taking|tomando|drinking|tomando|eating|comiendo|walking|caminando|sitting|sentado|holding|sosteniendo|wearing|usando|looking|mirando|posing|posando)\b/i;
    const isNarrative = narrativePatterns.test(description);

    if (isNarrative) {
      log.info({ description }, 'Detected narrative description, converting to technical prompt');

      // Use the translation system
      const technicalPrompt = await this.narrativeToTechnicalPrompt(
        description,
        agentName,
        baseAppearance
      );

      return `${technicalPrompt}.
${baseAppearance}.
Professional photography, natural lighting, high quality, photorealistic, sharp focus.
IMPORTANT: Maintain exact same person appearance as reference image.`;
    }

    // If it is already technical, use directly
    const personalityKeywords = this.extractPersonalityKeywords(agentPersonality);

    return `${description}.
Character: ${agentName}, personality traits: ${personalityKeywords}.
${baseAppearance}.
Professional photography, natural lighting, high quality, photorealistic, sharp focus.
IMPORTANT: Maintain exact same person appearance as reference image.`;
  }

  /**
   * Extrae keywords relevantes de la personalidad
   */
  private extractPersonalityKeywords(personality: string): string {
    const keywords = personality
      .toLowerCase()
      .split(/[,;.]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 3);

    return keywords.join(', ');
  }

  /**
   * Convierte URL de imagen a base64
   */
  private async imageUrlToBase64(imageUrl: string): Promise<string | null> {
    try {
      // Usar el helper centralizado para convertir URL a base64
      const { convertUrlToBase64 } = await import('@/lib/utils/image-helpers');
      const dataUrl = await convertUrlToBase64(imageUrl);

      // Extraer solo el base64 (sin el prefijo data:image/...)
      const base64Match = dataUrl.match(/base64,(.+)/);
      return base64Match ? base64Match[1] : null;
    } catch (error) {
      log.error({ error, imageUrl }, 'Error converting image to base64');
      return null;
    }
  }
}

// Export singleton
export const asyncImageGenerator = new AsyncImageGenerator();
