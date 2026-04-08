/**
 * VISUAL GENERATION SERVICE
 * 
 * Unified service for generation and management of visual expressions
 * - Smart cache (generates once, reuses many times)
 * - Automatic provider selection (Gemini vs Hugging Face)
 * - Integration with emotional system
 */

import { prisma } from "@/lib/prisma";
import { getVeniceClient } from "@/lib/emotional-system/llm/venice";
import { getGeminiImagenClient } from "./gemini-imagen-client";
import { getHuggingFaceSpacesClient } from "./huggingface-spaces-client";
import { getFastSDLocalClient } from "./fastsd-local-client";
import { getAIHordeClient } from "./ai-horde-client";
import { trackImageGeneration } from "@/lib/cost-tracking/tracker";
import { nanoid } from "nanoid";

export type ContentType = "sfw" | "suggestive" | "nsfw";
export type UserTier = "free" | "plus" | "ultra";
export type VisualProvider = "venice" | "aihorde" | "fastsd" | "gemini" | "huggingface";

export interface VisualGenerationRequest {
  agentId: string;
  emotionType: string;
  intensity: "low" | "medium" | "high";
  context?: string;
  contentType?: ContentType;
  userTier?: UserTier;
}

export interface VisualGenerationResult {
  imageUrl: string;
  type: "photo";
  cached: boolean;
  provider: string;
}

export class VisualGenerationService {
  /**
   * Gets or generates visual expression for an agent
   * FIRST searches in cache, THEN generates if it doesn't exist
   */
  async getOrGenerateExpression(
    request: VisualGenerationRequest
  ): Promise<VisualGenerationResult> {
    const {
      agentId,
      emotionType,
      intensity,
      context,
      contentType = "sfw",
      userTier = "free",
    } = request;

    console.log(
      `[VisualGen] Request for ${agentId}: ${emotionType}/${intensity}`
    );

    // 1. BUSCAR EN CACHE
    const cached = await prisma.visualExpression.findFirst({
      where: {
        agentId,
        emotionType,
        intensity,
        ...(context && { context }),
      },
      orderBy: {
        timesUsed: "desc", // Prefer the most used (probably the best)
      },
    });

    if (cached) {
      // Update usage statistics
      await prisma.visualExpression.update({
        where: { id: cached.id },
        data: {
          timesUsed: { increment: 1 },
          lastUsed: new Date(),
        },
      });

      console.log(`[VisualGen] ✅ Using cached expression: ${cached.id}`);

      return {
        imageUrl: cached.url,
        type: "photo",
        cached: true,
        provider: cached.provider,
      };
    }

    // 2. NO EXISTE EN CACHE - GENERAR NUEVA
    console.log(
      `[VisualGen] Cache miss - generating new expression for ${emotionType}/${intensity}`
    );

    const result = await this.generateNewExpression({
      agentId,
      emotionType,
      intensity,
      context,
      contentType,
      userTier,
    });

    return {
      imageUrl: result.imageUrl,
      type: "photo",
      cached: false,
      provider: result.provider,
    };
  }

  /** Generates new expression and stores it in cache */
  private async generateNewExpression(params: {
    agentId: string;
    emotionType: string;
    intensity: "low" | "medium" | "high";
    context?: string;
    contentType: ContentType;
    userTier: UserTier;
  }): Promise<{ imageUrl: string; seed: number; provider: string }> {
    const { agentId, emotionType, intensity, context, contentType, userTier } =
      params;

    // 1. Get character appearance
    const appearance = await prisma.characterAppearance.findUnique({
      where: { agentId },
    });

    if (!appearance) {
      throw new Error(`Character appearance not found for agent: ${agentId}`);
    }

    // 2. Seleccionar proveedor con fallback chain
    const providerChain = await this.selectProviderChain({
      contentType,
      userTier,
      preferredProvider: appearance.preferredProvider as VisualProvider,
    });

    console.log(`[VisualGen] Provider chain: ${providerChain.join(" -> ")}`);

    // 3. Intentar generar con cada proveedor en orden
    let lastError: any = null;

    for (const provider of providerChain) {
      try {
        console.log(`[VisualGen] Trying provider: ${provider}`);

        const result = await this.generateWithProvider({
          provider,
          appearance,
          emotionType,
          intensity,
          userTier,
        });

        // Success - store in cache and return
        await this.saveToCache({
          agentId,
          emotionType,
          intensity,
          context,
          imageUrl: result.imageUrl,
          seed: result.seed,
          provider,
        });

        return {
          imageUrl: result.imageUrl,
          seed: result.seed,
          provider,
        };
      } catch (error) {
        console.error(`[VisualGen] Provider ${provider} failed:`, error);
        lastError = error;
        // Continuar con siguiente proveedor
      }
    }

    // Todos los proveedores fallaron
    throw new Error(
      `All providers failed. Last error: ${lastError?.message || lastError}`
    );
  }

  /** Builds prompt for emotional expression */
  private buildEmotionPrompt(params: {
    basePrompt: string;
    emotionType: string;
    intensity: "low" | "medium" | "high";
  }): string {
    const { basePrompt, emotionType, intensity } = params;

    // Mapeo de emociones a descripciones visuales
    const emotionDescriptions: Record<string, Record<string, string>> = {
      joy: {
        low: 'slight smile, relaxed',
        medium: 'warm smile, bright eyes',
        high: 'beaming smile, radiant, joyful expression',
      },
      distress: {
        low: 'slightly worried, furrowed brow',
        medium: 'concerned expression, tense',
        high: 'deeply distressed, tearful eyes',
      },
      anger: {
        low: 'slightly annoyed, tense jaw',
        medium: 'angry expression, furrowed brow',
        high: 'furious, intense glare, clenched teeth',
      },
      fear: {
        low: 'slightly anxious, uncertain',
        medium: 'fearful expression, wide eyes',
        high: 'terrified, panicked expression',
      },
      affection: {
        low: 'gentle smile, soft gaze',
        medium: 'loving expression, warm eyes',
        high: 'deeply affectionate, tender loving gaze',
      },
      neutral: {
        low: 'calm neutral expression',
        medium: 'neutral expression, composed',
        high: 'serene, peaceful expression',
      },
    };

    const emotionDesc = emotionDescriptions[emotionType]?.[intensity] || 'neutral expression';

    return `${basePrompt}, ${emotionDesc}`;
  }

  /** Generates image with a specific provider */
  private async generateWithProvider(params: {
    provider: VisualProvider;
    appearance: any;
    emotionType: string;
    intensity: "low" | "medium" | "high";
    userTier?: UserTier;
  }): Promise<{ imageUrl: string; seed: number }> {
    const { provider, appearance, emotionType, intensity, userTier = 'free' } = params;

    if (provider === "venice") {
      // Venice AI - Proveedor principal con modelos tier-based
      // The difference is in the MODEL (z-image-turbo vs imagineart-1.5-pro),
      // not in technical parameters. imagineart has better realism and lighting inherently.
      const veniceClient = getVeniceClient();

      const prompt = this.buildEmotionPrompt({
        basePrompt: appearance.basePrompt,
        emotionType,
        intensity,
      });

      const negativePrompt = 'deformed, distorted, disfigured, bad anatomy, multiple people, text, watermark, low quality';

      const result = await veniceClient.generateImage({
        prompt,
        negativePrompt,
        width: 1024,
        height: 1024,
        style: 'natural',
        userTier,
      });

      // Track cost
      const cost = userTier === 'free' ? 0.01 : 0.05;
      trackImageGeneration({
        agentId: appearance.agentId,
        provider: 'venice',
        model: userTier === 'free' ? 'z-image-turbo' : 'imagineart-1.5-pro',
        resolution: '1024x1024',
        cost,
        metadata: {
          emotionType,
          intensity,
        },
      }).catch(err => console.warn('[VisualGen] Failed to track image cost:', err));

      return {
        imageUrl: result.imageUrl,
        seed: Math.floor(Math.random() * 1000000), // Venice no retorna seed
      };
    } else if (provider === "aihorde") {
      // AI Horde - Primary provider (free, fast, high quality)
      const aihorde = getAIHordeClient({
        apiKey: process.env.AI_HORDE_API_KEY,
      });
      const result = await aihorde.generateCharacterExpression({
        characterDescription: appearance.basePrompt,
        emotionType,
        intensity,
        seed: appearance.seed,
      });

      // Track image generation cost (AI Horde is free)
      trackImageGeneration({
        agentId: appearance.agentId,
        provider: 'aihorde',
        model: 'stable-diffusion-xl',
        resolution: '512x512',
        cost: 0, // AI Horde is free
        metadata: {
          emotionType,
          intensity,
          seed: result.seed,
        },
      }).catch(err => console.warn('[VisualGen] Failed to track image cost:', err));

      return {
        imageUrl: result.imageUrl, // Ya es una URL de R2 storage
        seed: result.seed,
      };
    } else if (provider === "fastsd") {
      // FastSD CPU Local (fallback)
      const fastsd = getFastSDLocalClient({ autoStart: true });
      const result = await fastsd.generateCharacterExpression({
        characterDescription: appearance.basePrompt,
        emotionType,
        intensity,
        seed: appearance.seed || undefined,
      });

      // Track image generation cost (FastSD local is free)
      trackImageGeneration({
        agentId: appearance.agentId,
        provider: 'fastsd-local',
        model: 'stable-diffusion-cpu',
        resolution: '512x512',
        cost: 0, // Local model
        metadata: {
          emotionType,
          intensity,
          seed: result.seed,
        },
      }).catch(err => console.warn('[VisualGen] Failed to track image cost:', err));

      // Convertir base64 a data URL
      return {
        imageUrl: `data:image/png;base64,${result.imageBase64}`,
        seed: result.seed,
      };
    } else if (provider === "gemini") {
      // Gemini Imagen
      const gemini = getGeminiImagenClient();
      const result = await gemini.generateCharacterExpression({
        characterDescription: appearance.basePrompt,
        emotionType,
        intensity,
        referenceImage: appearance.basePhotoUrl || undefined,
        seed: appearance.seed || undefined,
      });

      return {
        imageUrl: `data:image/png;base64,${result.imageBase64}`,
        seed: result.seed,
      };
    } else {
      // Hugging Face Spaces
      const hf = getHuggingFaceSpacesClient();
      const result = await hf.generateCharacterExpression({
        characterDescription: appearance.basePrompt,
        emotionType,
        intensity,
        seed: appearance.seed || undefined,
      });

      return {
        imageUrl: result.imageUrl,
        seed: result.seed,
      };
    }
  }

  /** Saves generated expression in cache */
  private async saveToCache(params: {
    agentId: string;
    emotionType: string;
    intensity: "low" | "medium" | "high";
    context?: string;
    imageUrl: string;
    seed: number;
    provider: string;
  }): Promise<void> {
    const { agentId, emotionType, intensity, context, imageUrl, seed, provider } = params;

    await prisma.visualExpression.create({
      data: {
        id: nanoid(),
        agentId,
        emotionType,
        intensity,
        context,
        type: "photo",
        url: imageUrl,
        provider,
        generationParams: {
          seed,
          emotionType,
          intensity,
          provider,
          timestamp: new Date().toISOString(),
        },
        width: 512,
        height: 512,
        timesUsed: 1,
        lastUsed: new Date(),
      },
    });

    await prisma.characterAppearance.update({
      where: { agentId },
      data: {
        totalGenerations: { increment: 1 },
      },
    });

    console.log(`[VisualGen] ✅ Expression cached with provider: ${provider}`);
  }

  /**
   * Selects provider chain with fallback
   * Returns array ordered by priority
   */
  private async selectProviderChain(params: {
    contentType: ContentType;
    userTier: UserTier;
    preferredProvider: VisualProvider;
  }): Promise<VisualProvider[]> {
    const { contentType, userTier, preferredProvider } = params;

    // Venice AI is the primary provider for all tiers
    // - FREE: z-image-turbo ($0.01/imagen)
    // - PLUS/ULTRA: imagineart-1.5-pro ($0.05/imagen, 4K)
    // - Fast and reliable
    // - Sin requisitos de hardware

    // 1. NSFW solo para premium users
    if (contentType === "nsfw") {
      if (userTier !== "ultra") {
        throw new Error("NSFW content requires ultra tier");
      }
      // Premium NSFW: Venice -> AI Horde -> FastSD local -> HF (fallback)
      const fastsdAvailable = await this.isFastSDAvailable();
      return fastsdAvailable
        ? ["venice", "aihorde", "fastsd", "huggingface"]
        : ["venice", "aihorde", "huggingface"];
    }

    // 2. Contenido SFW/Suggestive - Venice para todos
    // Chain de fallback: Venice -> AI Horde -> Gemini -> FastSD Local -> HF

    const chain: VisualProvider[] = ["venice"];

    // AI Horde como segundo fallback (gratis)
    chain.push("aihorde");

    // Agregar Gemini si hay API key configurada
    if (process.env.GEMINI_API_KEY) {
      chain.push("gemini");
    }

    // Add FastSD if available locally
    const fastsdAvailable = await this.isFastSDAvailable();
    if (fastsdAvailable) {
      chain.push("fastsd");
    }

    // Always include HF as last fallback
    chain.push("huggingface");

    return chain;
  }

  /** Verifies if FastSD is available locally */
  private async isFastSDAvailable(): Promise<boolean> {
    try {
      const fastsd = getFastSDLocalClient();
      const info = await fastsd.getSystemInfo();
      return info.installed && info.running;
    } catch {
      return false;
    }
  }

  /** Gets information about FastSD and initiates installation if user approves */
  async checkAndInstallFastSD(): Promise<{
    installed: boolean;
    running: boolean;
    needsInstallation: boolean;
    installationApproved?: boolean;
  }> {
    const fastsd = getFastSDLocalClient();
    const info = await fastsd.getSystemInfo();

    if (!info.installed) {
      console.log("[VisualGen] FastSD not installed");

      // TODO: In production, user approval must be requested here
      // For now we return state
      return {
        installed: false,
        running: false,
        needsInstallation: true,
      };
    }

    if (!info.running) {
      console.log("[VisualGen] FastSD installed but not running, starting...");
      const started = await fastsd.startServer();
      return {
        installed: true,
        running: started,
        needsInstallation: false,
      };
    }

    return {
      installed: true,
      running: true,
      needsInstallation: false,
    };
  }

  /**
   * Pre-generates set of base expressions when creating character
   * This makes the first interactions instantaneous
   */
  async generateBaseExpressions(
    agentId: string,
    options?: {
      count?: number;
      userTier?: UserTier;
    }
  ): Promise<void> {
    const count = options?.count || 10;
    const userTier = options?.userTier || "free";

    console.log(
      `[VisualGen] Generating ${count} base expressions for agent: ${agentId}`
    );

    // Set of most common expressions
    const baseExpressions = [
      { emotionType: "neutral", intensity: "medium" as const },
      { emotionType: "joy", intensity: "low" as const },
      { emotionType: "joy", intensity: "medium" as const },
      { emotionType: "joy", intensity: "high" as const },
      { emotionType: "distress", intensity: "low" as const },
      { emotionType: "distress", intensity: "medium" as const },
      { emotionType: "affection", intensity: "medium" as const },
      { emotionType: "concern", intensity: "medium" as const },
      { emotionType: "curiosity", intensity: "medium" as const },
      { emotionType: "excitement", intensity: "medium" as const },
      // Opcionales si count > 10
      { emotionType: "anger", intensity: "low" as const },
      { emotionType: "fear", intensity: "medium" as const },
      { emotionType: "affection", intensity: "high" as const },
    ];

    const expressionsToGenerate = baseExpressions.slice(0, count);

    let successCount = 0;
    let failCount = 0;

    for (const expr of expressionsToGenerate) {
      try {
        await this.getOrGenerateExpression({
          agentId,
          emotionType: expr.emotionType,
          intensity: expr.intensity,
          contentType: "sfw",
          userTier,
        });
        successCount++;
        console.log(
          `[VisualGen] ✅ Generated ${expr.emotionType}/${expr.intensity} (${successCount}/${count})`
        );
      } catch (error) {
        failCount++;
        console.error(
          `[VisualGen] ❌ Failed to generate ${expr.emotionType}/${expr.intensity}:`,
          error
        );
        // Continue with the others even if one fails
      }
    }

    console.log(
      `[VisualGen] ✅ Base expressions generation complete: ${successCount} success, ${failCount} failed`
    );
  }

  /**
   * Inicializa la apariencia de un personaje
   */
  async initializeCharacterAppearance(params: {
    agentId: string;
    name: string;
    gender: "male" | "female" | "non-binary";
    description?: string;
    style?: "realistic" | "anime" | "semi-realistic";
    ethnicity?: string;
    age?: string;
    referencePhotoUrl?: string;
  }): Promise<void> {
    const {
      agentId,
      name,
      gender,
      description,
      style = "realistic",
      ethnicity,
      age = "25-30",
      referencePhotoUrl,
    } = params;

    console.log(
      `[VisualGen] Initializing character appearance for: ${name} (${agentId})`
    );

    // Construir prompt base
    const basePrompt = this.buildBasePrompt({
      name,
      gender,
      description,
      style,
      ethnicity,
      age,
    });

    // Create CharacterAppearance
    await prisma.characterAppearance.create({
      data: {
        id: nanoid(),
        agentId,
        basePrompt,
        style,
        gender,
        ethnicity,
        age,
        referencePhotoUrl,
        negativePrompt:
          "deformed, distorted, disfigured, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated hands, bad hands, long neck, mutation, ugly, disgusting, blurry, low quality, watermark, text, signature, multiple people",
        seed: Math.floor(Math.random() * 1000000),
        preferredProvider: "venice", // Venice AI como proveedor principal
        totalGenerations: 0,
        updatedAt: new Date(),
      },
    });

    console.log(`[VisualGen] ✅ Character appearance initialized`);
  }

  /**
   * Construye prompt base para el personaje
   */
  private buildBasePrompt(params: {
    name: string;
    gender: "male" | "female" | "non-binary";
    description?: string;
    style: "realistic" | "anime" | "semi-realistic";
    ethnicity?: string;
    age?: string;
  }): string {
    const { name, gender, description, style, ethnicity, age } = params;

    const parts: string[] = [];

    // Estilo
    if (style === "realistic") {
      parts.push("photorealistic portrait");
    } else if (style === "anime") {
      parts.push("anime style portrait");
    } else {
      parts.push("semi-realistic portrait");
    }

    // Gender
    if (gender === "male") {
      parts.push("handsome man");
    } else if (gender === "female") {
      parts.push("beautiful woman");
    } else {
      parts.push("person");
    }

    // Edad
    if (age) {
      parts.push(`age ${age}`);
    }

    // Etnicidad
    if (ethnicity) {
      parts.push(ethnicity);
    }

    // Additional description
    if (description) {
      parts.push(description);
    }

    // Technical features
    parts.push(
      "professional photography, high quality, detailed face, natural lighting, looking at camera"
    );

    return parts.join(", ");
  }

  /** Gets usage statistics of expressions */
  async getExpressionStats(agentId: string): Promise<{
    totalExpressions: number;
    totalGenerations: number;
    mostUsedExpression: any;
    cacheHitRate: number;
  }> {
    const expressions = await prisma.visualExpression.findMany({
      where: { agentId },
      orderBy: { timesUsed: "desc" },
    });

    const appearance = await prisma.characterAppearance.findUnique({
      where: { agentId },
    });

    const totalExpressions = expressions.length;
    const totalGenerations = appearance?.totalGenerations || 0;
    const mostUsedExpression = expressions[0] || null;

    // Calcular cache hit rate (aproximado)
    const totalTimesUsed = expressions.reduce(
      (sum, expr) => sum + expr.timesUsed,
      0
    );
    const cacheHitRate =
      totalTimesUsed > 0
        ? ((totalTimesUsed - totalGenerations) / totalTimesUsed) * 100
        : 0;

    return {
      totalExpressions,
      totalGenerations,
      mostUsedExpression,
      cacheHitRate,
    };
  }
}

// Singleton
let visualGenService: VisualGenerationService | null = null;

export function getVisualGenerationService(): VisualGenerationService {
  if (!visualGenService) {
    visualGenService = new VisualGenerationService();
  }
  return visualGenService;
}
