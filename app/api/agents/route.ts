import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLLMProvider } from "@/lib/llm/provider";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { trackUsage } from '@/lib/usage/tracker';
import { createAgentBodySchema, formatValidationError } from "@/lib/validation/api-schemas";
import { saveDataUrlAsFile, isDataUrl } from "@/lib/utils/image-helpers";
import { trackEvent, EventType } from "@/lib/analytics/kpi-tracker";
import type { BehaviorType } from "@prisma/client";
import type { ProfileData } from "@/types/prisma-json";
import { atomicCheckAgentLimit } from "@/lib/usage/atomic-resource-check";
import { sanitizeAndValidateName } from "@/lib/security/unicode-sanitizer";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    console.log('[API] Starting agent creation...');

    // Get authenticated user (supports web and mobile)
    const user = await getAuthenticatedUser(req);
    if (!user?.id) {
      console.log('[API] No user session');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    console.log('[API] Authenticated user:', userId);

    // Get user plan BEFORE processing (for atomic validation after)
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    const userPlan = userData?.plan || "free";
    console.log('[API] User plan:', userPlan);

    const body = await req.json();

    // Validate data with Zod
    const validation = createAgentBodySchema.safeParse(body);
    if (!validation.success) {
      console.log('[API] Invalid data:', validation.error);
      return NextResponse.json(
        formatValidationError(validation.error),
        { status: 400 }
      );
    }

    const { name: rawName, kind, personality, purpose, tone, avatar, referenceImage, nsfwMode, allowDevelopTraumas, initialBehavior } = validation.data;

    // SECURITY: Sanitize name to prevent visual confusion attacks
    // (homoglyphs, zero-width characters, etc.)
    const nameValidation = sanitizeAndValidateName(rawName);
    if (!nameValidation.valid || !nameValidation.sanitized) {
      console.warn('[API] Name rejected for containing suspicious characters:', {
        original: rawName,
        reason: nameValidation.reason,
        detections: nameValidation.detections
      });
      return NextResponse.json(
        {
          error: nameValidation.reason || 'The name contains unauthorized characters',
          field: 'name',
          detections: nameValidation.detections
        },
        { status: 400 }
      );
    }

    const name = nameValidation.sanitized;

    // Log if anything was sanitized
    if (rawName !== name) {
      console.info('[API] Name sanitized:', {
        original: rawName,
        sanitized: name,
        detections: nameValidation.detections
      });
    }

    console.log('[API] Data received:', { name, kind, personality, purpose, tone, avatar: avatar ? 'provided' : 'none', referenceImage: referenceImage ? 'provided' : 'none', nsfwMode, allowDevelopTraumas, initialBehavior });

    // Process avatar: if it's a data URL (base64), convert to file
    let finalAvatar = avatar || null;
    if (avatar && isDataUrl(avatar)) {
      console.log('[API] Avatar is data URL, converting to file...');
      try {
        finalAvatar = await saveDataUrlAsFile(avatar, userId);
        console.log('[API] Avatar saved as:', finalAvatar);
      } catch (error) {
        console.error('[API] Error converting avatar:', error);
        // Continue without avatar if conversion fails
        finalAvatar = null;
      }
    }

    // Process reference image: if it's a data URL, convert to file
    let finalReferenceImage = referenceImage || null;
    if (referenceImage && isDataUrl(referenceImage)) {
      console.log('[API] ReferenceImage is data URL, converting to file...');
      try {
        finalReferenceImage = await saveDataUrlAsFile(referenceImage, userId);
        console.log('[API] ReferenceImage saved as:', finalReferenceImage);
      } catch (error) {
        console.error('[API] Error converting referenceImage:', error);
        // Continue without referenceImage if conversion fails
        finalReferenceImage = null;
      }
    }

    // Generate profile and systemPrompt with Gemini
    console.log('[API] Getting LLM provider...');
    const llm = getLLMProvider();
    console.log('[API] Generating profile with LLM...');
    const { profile, systemPrompt } = await llm.generateProfile({
      name,
      kind,
      personality,
      purpose,
      tone,
    });
    console.log('[API] Perfil generado exitosamente');

    // CRITICAL: Crear agente con verificación atómica de límite para prevenir race condition
    console.log('[API] Creando agente con verificación atómica...');
    const agent = await prisma.$transaction(
      async (tx) => {
        // Check rate limit WITHIN the transaction
        await atomicCheckAgentLimit(tx, userId, userPlan);

        // Create agente dentro de la transacción
        const newAgent = await tx.agent.create({
          data: {
            id: nanoid(),
            userId,
            kind,
            name,
            description: personality || purpose,
            personality,
            purpose,
            tone,
            avatar: finalAvatar,
            referenceImageUrl: finalReferenceImage,
            profile: profile as Record<string, string | number | boolean | null>,
            systemPrompt,
            visibility: "private",
            nsfwMode: nsfwMode || false,
            updatedAt: new Date(),
          },
        });

        return newAgent;
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 10000,
      }
    ).catch((error) => {
      // Si es error de límite, parsearlo
      if (error.message.startsWith("{")) {
        const errorData = JSON.parse(error.message);
        throw errorData;
      }
      throw error;
    });
    console.log('[API] Agente creado:', agent.id);

    // TRACKING: First Agent Created (Fase 6 - User Experience)
    try {
      const agentsCount = await prisma.agent.count({
        where: { userId },
      });

      if (agentsCount === 1) {
        await trackEvent(EventType.FIRST_AGENT_CREATED, {
          userId,
          agentId: agent.id,
          kind: agent.kind,
          creationMethod: "api",
        });
        console.log('[API] TRACKING: First agent created event tracked');
      }
    } catch (trackError) {
      // No lanzar error si falla el tracking, solo loguearlo
      console.error("[API] Error tracking first agent creation:", trackError);
    }

    // Create relación inicial con el usuario (necesario antes de behaviors y stage prompts)
    console.log('[API] Creando relación inicial...');
    await prisma.relation.create({
      data: {
        id: nanoid(),
        subjectId: agent.id,
        targetId: userId,
        targetType: "user",
        trust: 0.5,
        affinity: 0.5,
        respect: 0.5,
        privateState: { love: 0, curiosity: 0 },
        visibleState: { trust: 0.5, affinity: 0.5, respect: 0.5 },
        updatedAt: new Date(),
      },
    });
    console.log('[API] Relación creada');

    // BEHAVIOR SYSTEM: Crear BehaviorProfile si se configuró
    if (initialBehavior && initialBehavior !== "none") {
      console.log('[API] Configurando behavior system...');

      let behaviorType: string;

      // Si es "random_secret", elegir uno basado en personalidad
      if (initialBehavior === "random_secret") {
        console.log('[API] Seleccionando behavior aleatorio secreto...');
        const behaviorsPool = [
          "ANXIOUS_ATTACHMENT",
          "AVOIDANT_ATTACHMENT",
          "CODEPENDENCY",
          "BORDERLINE_PD",
          "NARCISSISTIC_PD",
          "YANDERE_OBSESSIVE",
        ];

        // Usar personalidad para "seed" la selección (más inteligente que random puro)
        const personalityLower = (personality || "").toLowerCase();
        if (personalityLower.includes("dependiente") || personalityLower.includes("necesit")) {
          behaviorType = Math.random() > 0.5 ? "ANXIOUS_ATTACHMENT" : "CODEPENDENCY";
        } else if (personalityLower.includes("distante") || personalityLower.includes("frío") || personalityLower.includes("independiente")) {
          behaviorType = "AVOIDANT_ATTACHMENT";
        } else if (personalityLower.includes("intenso") || personalityLower.includes("extremo") || personalityLower.includes("obsesiv")) {
          behaviorType = Math.random() > 0.5 ? "BORDERLINE_PD" : "YANDERE_OBSESSIVE";
        } else if (personalityLower.includes("orgullos") || personalityLower.includes("superior") || personalityLower.includes("perfeccion")) {
          behaviorType = "NARCISSISTIC_PD";
        } else {
          // Random real si no hay pistas en personalidad
          behaviorType = behaviorsPool[Math.floor(Math.random() * behaviorsPool.length)];
        }

        console.log(`[API] Behavior secreto seleccionado: ${behaviorType} (basado en: "${personality}")`);
      } else {
        behaviorType = initialBehavior;
      }

      // Create BehaviorProfile
      await prisma.behaviorProfile.create({
        data: {
          id: nanoid(),
          agentId: agent.id,
          behaviorType: behaviorType as BehaviorType,
          baseIntensity: 0.3, // Intensidad inicial moderada
          currentPhase: 1,
          volatility: 0.5, // Volatilidad media
          thresholdForDisplay: 0.4,
          triggers: [],
          phaseStartedAt: new Date(),
          phaseHistory: [],
          updatedAt: new Date(),
        },
      });

      console.log(`[API] BehaviorProfile creado: ${behaviorType}`);

      // Create BehaviorProgressionState inicial
      await prisma.behaviorProgressionState.create({
        data: {
          id: nanoid(),
          agentId: agent.id,
          totalInteractions: 0,
          positiveInteractions: 0,
          negativeInteractions: 0,
          currentIntensities: { [behaviorType]: 0.3 },
          lastCalculatedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log('[API] BehaviorProgressionState creado');
    }

    // Si allowDevelopTraumas está activado, loguear para futura implementación
    if (allowDevelopTraumas) {
      console.log('[API] allowDevelopTraumas activado - el agente podrá desarrollar behaviors durante interacción');
      // TODO: Implementar lógica de desarrollo gradual de behaviors
      // Por ahora, el sistema ya lo permite si se crean behaviors dinámicamente
    }

    // ========================================
    // OPTIMIZACIÓN CRÍTICA: RETORNAR AGENTE INMEDIATAMENTE
    // ========================================
    // Las operaciones multimedia y stage prompts se procesarán en background
    // Impacto estimado: Reduce tiempo de respuesta de ~15-30s a ~500ms-1s
    // El cliente puede obtener el estado actualizado mediante polling o webhooks
    console.log('[API] ✅ Agente creado, iniciando procesamiento en background...');

    // Retornar agente inmediatamente
    const response = NextResponse.json(agent, { status: 201 });

    // Iniciar procesamiento en background (sin await)
    // IMPORTANTE: Pasar finalAvatar y finalReferenceImage (ya convertidos a archivos)
    processAgentMultimediaInBackground(agent.id, {
      avatar: finalAvatar || undefined,
      referenceImage: finalReferenceImage || undefined,
      name: agent.name,
      personality: agent.personality || agent.description || '',
      systemPrompt,
      userId,
      behaviorTypes: (initialBehavior && initialBehavior !== 'none' ? [initialBehavior] : []) as BehaviorType[],
      profile: profile as ProfileData,
    }).catch((error) => {
      console.error('[API] Error in background processing:', error);
      // No fallar la respuesta, el cliente puede reintentar
    });

    // Track usage
    console.log('[API] Registrando uso...');
    await trackUsage(userId, "agent", 1, agent.id, {
      name: agent.name,
      kind: agent.kind,
    });

    return response;
  } catch (error: any) {
    console.error("[API] Error creating agent:", error);

    // If it's a rate limit error (thrown from the transaction)
    if (error.error && error.limit) {
      return NextResponse.json(error, { status: 403 });
    }

    // Prisma transaction errors
    if (error.code === "P2034") {
      // Serialization failure - race condition detectada
      return NextResponse.json(
        {
          error: "El límite de agentes fue alcanzado. Por favor intenta de nuevo.",
          hint: "Múltiples requests detectados"
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create agent", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Background processing function for multimedia and stage prompts
 * This runs asynchronously after the agent has been created and returned to the client
 */
async function processAgentMultimediaInBackground(
  agentId: string,
  config: {
    avatar?: string;
    referenceImage?: string;
    name: string;
    personality: string;
    systemPrompt: string;
    userId: string;
    behaviorTypes: BehaviorType[];
    profile: ProfileData;
  }
) {
  console.log('[BACKGROUND] Starting multimedia processing for agent:', agentId);
  const startTime = Date.now();

  const [multimediaResult, stagePromptsResult] = await Promise.allSettled([
    // OPERACIÓN 1: Generación de imagen de referencia y asignación de voz
    (async () => {
      console.log('[BACKGROUND] Configurando referencias multimedia...');
      try {
        let finalAvatarUrl: string | undefined;
        let finalReferenceImageUrl: string | undefined;
        let finalVoiceId: string | undefined;

        // Si el usuario proporcionó un avatar, usarlo directamente
        if (config.avatar) {
          console.log('[BACKGROUND] Usando avatar proporcionado por el usuario');
          finalAvatarUrl = config.avatar;
        }

        // Si el usuario proporcionó una imagen de referencia, usarla directamente
        if (config.referenceImage) {
          console.log('[BACKGROUND] Usando imagen de referencia proporcionada por el usuario');
          finalReferenceImageUrl = config.referenceImage;
        }

        // Generate/asignar referencias faltantes
        const { generateAgentReferences } = await import("@/lib/multimedia/reference-generator");

        // Llamar a generateAgentReferences solo si falta avatar o imagen de referencia
        const skipImageGeneration = !!(config.avatar && config.referenceImage);

        const references = await generateAgentReferences(
          config.name,
          config.personality,
          undefined, // gender - se infiere de la personalidad
          config.userId,
          agentId,
          skipImageGeneration
        );

        // Usar avatar del usuario si existe, sino la generada
        if (!finalAvatarUrl && references.referenceImageUrl) {
          finalAvatarUrl = references.referenceImageUrl;
        }

        // Usar imagen de referencia del usuario si existe, sino la generada
        if (!finalReferenceImageUrl && references.referenceImageUrl) {
          finalReferenceImageUrl = references.referenceImageUrl;
        }

        // Siempre usar la voz asignada
        if (references.voiceId) {
          finalVoiceId = references.voiceId;
        }

        if (references.errors.length > 0) {
          console.warn('[BACKGROUND] Errores durante generación de referencias:', references.errors);
        }

        // Update agente con las referencias
        if (finalAvatarUrl || finalReferenceImageUrl || finalVoiceId) {
          await prisma.agent.update({
            where: { id: agentId },
            data: {
              avatar: finalAvatarUrl, // Foto de cara para previews
              referenceImageUrl: finalReferenceImageUrl, // Imagen de cuerpo completo para generación
              voiceId: finalVoiceId,
            },
          });
          console.log('[BACKGROUND] Referencias multimedia configuradas exitosamente');
          console.log('[BACKGROUND] - Avatar:', finalAvatarUrl ? '✅' : '❌');
          console.log('[BACKGROUND] - Imagen de referencia:', finalReferenceImageUrl ? '✅' : '❌');
          console.log('[BACKGROUND] - Voz asignada:', finalVoiceId ? '✅' : '❌');
        }

        return { success: true };
      } catch (error) {
        console.error('[BACKGROUND] Error configurando referencias multimedia:', error);
        return { success: false, error };
      }
    })(),

    // OPERACIÓN 2: Generación de stage prompts
    (async () => {
      console.log('[BACKGROUND] Generando stage prompts...');
      try {
        const { generateStagePrompts } = await import("@/lib/relationship/prompt-generator");

        const stagePrompts = await generateStagePrompts(
          config.systemPrompt,
          config.name,
          config.personality,
          config.behaviorTypes
        );

        // Save stage prompts en el Agent
        await prisma.agent.update({
          where: { id: agentId },
          data: {
            stagePrompts: stagePrompts as any,
          },
        });

        // Create InternalState con campos correctos
        await prisma.internalState.create({
          data: {
            id: nanoid(),
            agentId: agentId,
            currentEmotions: {}, // Emociones iniciales vacías
            activeGoals: [], // Goals iniciales vacíos
            conversationBuffer: [], // Buffer de conversación vacío
          },
        });

        // 🆕 INICIALIZAR TODAS LAS MEMORIAS DEL PERSONAJE
        console.log('[BACKGROUND] Inicializando memorias completas del personaje...');
        const { initializeAllMemories } = await import("@/lib/profile/memory-initialization");

        try {
          await initializeAllMemories(agentId, config.profile, config.systemPrompt);
          console.log('[BACKGROUND] ✅ Memorias del personaje inicializadas exitosamente');
        } catch (memoryError) {
          console.error('[BACKGROUND] ⚠️  Error inicializando memorias:', memoryError);
          // No fallar toda la creación si falla la inicialización de memorias
          // Las memorias se pueden regenerar después
        }

        console.log('[BACKGROUND] Stage prompts generados y guardados exitosamente');
        return { success: true };
      } catch (error) {
        console.error('[BACKGROUND] Error generando stage prompts:', error);
        return { success: false, error };
      }
    })(),
  ]);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`[BACKGROUND] ✅ Background processing completed in ${duration}s for agent ${agentId}`);

  // Reportar resultados de operaciones paralelas
  if (multimediaResult.status === 'rejected') {
    console.error('[BACKGROUND] ⚠️  Multimedia generation failed:', multimediaResult.reason);
  } else if (!multimediaResult.value.success) {
    console.warn('[BACKGROUND] ⚠️  Multimedia generation completed with errors');
  }

  if (stagePromptsResult.status === 'rejected') {
    console.error('[BACKGROUND] ⚠️  Stage prompts generation failed:', stagePromptsResult.reason);
  } else if (!stagePromptsResult.value.success) {
    console.warn('[BACKGROUND] ⚠️  Stage prompts generation completed with errors');
  }
}

export async function GET(req: NextRequest) {
  try {
    console.log('[API GET] Obteniendo agentes...');

    // Get usuario autenticado (NextAuth o JWT)
    const user = await getAuthenticatedUser(req);
    const userId = user?.id || "default-user";

    console.log('[API GET] userId:', userId, 'autenticado:', !!user);

    const kind = req.nextUrl.searchParams.get("kind");

    // Construir where clause para incluir:
    // 1. Agentes del usuario (userId = userId)
    // 2. Agentes públicos del sistema (userId = null AND visibility = public)
    const where = {
      OR: [
        // Agentes del usuario
        kind ? { userId, kind } : { userId },
        // Agentes públicos del sistema
        {
          userId: null,
          visibility: "public",
          ...(kind && { kind }) // Incluir filtro de kind si existe
        }
      ]
    };

    const agents = await prisma.agent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            Review: true,
          },
        },
      },
    });

    console.log('[API GET] Agentes encontrados:', agents.length);
    console.log('[API GET] Agentes del usuario:', agents.filter(a => a.userId === userId).length);
    console.log('[API GET] Agentes públicos:', agents.filter(a => a.userId === null).length);

    // Mapear agents para incluir isPublic y reviewCount
    const mappedAgents = agents.map(agent => {
      const { _count, ...agentData } = agent;
      return {
        ...agentData,
        isPublic: agent.visibility === 'public',
        reviewCount: _count?.Review || 0,
      };
    });

    return NextResponse.json(mappedAgents);
  } catch (error) {
    console.error("[API GET] Error fetching agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}
