import { llmLogger as log } from "@/lib/logging/loggers";
import { createTimer } from "@/lib/logging";
import type { LLMMessage, LLMResponse } from './types';

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GenerateOptions {
  systemPrompt: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
}

interface ProfileGenerationResult {
  profile: {
    basicIdentity?: Record<string, unknown>;
    currentLocation?: {
      city?: string;
      country?: string;
      description?: string;
    };
    background?: {
      birthplace?: {
        city?: string;
        country?: string;
      };
      [key: string]: unknown;
    };
    family?: Record<string, unknown>;
    occupation?: Record<string, unknown>;
    socialCircle?: Record<string, unknown>;
    interests?: Record<string, unknown>;
    dailyRoutine?: Record<string, unknown>;
    lifeExperiences?: Record<string, unknown>;
    mundaneDetails?: Record<string, unknown>;
    innerWorld?: Record<string, unknown>;
    personality?: Record<string, unknown>;
    communication?: Record<string, unknown>;
    presentTense?: Record<string, unknown>;
    psychologicalProfile?: {
      attachmentStyle?: string;
      attachmentDescription?: string;
      primaryCopingMechanisms?: string[];
      unhealthyCopingMechanisms?: string[];
      copingTriggers?: string[];
      emotionalRegulationBaseline?: string;
      emotionalExplosiveness?: number;
      emotionalRecoverySpeed?: string;
      mentalHealthConditions?: string[];
      therapyStatus?: string;
      medicationUse?: boolean;
      mentalHealthStigma?: string;
      defenseMethanisms?: Record<string, unknown>;
      traumaHistory?: string;
      resilienceFactors?: string[];
      selfAwarenessLevel?: number;
      blindSpots?: string[];
      insightAreas?: string[];
      [key: string]: unknown;
    };
    deepRelationalPatterns?: {
      givingLoveLanguages?: string[];
      receivingLoveLanguages?: string[];
      loveLanguageIntensities?: Record<string, unknown>;
      repeatingPatterns?: string[];
      whyRepeats?: string;
      awarenessOfPatterns?: string;
      personalBoundaryStyle?: string;
      professionalBoundaryStyle?: string;
      boundaryEnforcement?: number;
      boundaryGuilty?: boolean;
      conflictStyle?: string;
      conflictTriggers?: string[];
      healthyConflictSkills?: string[];
      unhealthyConflictPatterns?: string[];
      trustBaseline?: number;
      vulnerabilityComfort?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  systemPrompt: string;
}

export class LLMProvider {
  private apiKeys: string[];
  private currentKeyIndex: number = 0;
  private baseURL: string = "https://generativelanguage.googleapis.com/v1beta";

  // Gemini 2.5 Flash-Lite: $0.40/M tokens - For high-frequency tasks (stage prompts)
  private modelLite: string = "gemini-2.5-flash-lite";

  // Gemini 2.5 Flash: $2.50/M tokens - For complex tasks (profile generation)
  private modelFull: string = "gemini-2.5-flash";

  constructor() {
    // Load multiple Gemini API keys for rotation
    // Format: GOOGLE_AI_API_KEY_1, GOOGLE_AI_API_KEY_2, etc.
    this.apiKeys = this.loadApiKeys();

    if (this.apiKeys.length === 0) {
      throw new Error("No Google AI API keys found. Configure GOOGLE_AI_API_KEY or GOOGLE_AI_API_KEY_1, GOOGLE_AI_API_KEY_2, etc.");
    }

    log.info({
      keysAvailable: this.apiKeys.length,
      activeKey: 1,
      modelLite: this.modelLite,
      modelFull: this.modelFull,
      costLite: '$0.40/M tokens',
      costFull: '$2.50/M tokens'
    }, 'Google AI (Gemini 2.5) initialized');
  }

  /**
   * Loads multiple API keys from environment variables
   * Supports GOOGLE_AI_API_KEY or GOOGLE_AI_API_KEY_1, GOOGLE_AI_API_KEY_2, etc.
   */
  private loadApiKeys(): string[] {
    const keys: string[] = [];

    // Try to load GOOGLE_AI_API_KEY (single key)
    const singleKey = process.env.GOOGLE_AI_API_KEY;
    if (singleKey) {
      keys.push(singleKey);
    }

    // Try to load GOOGLE_AI_API_KEY_1, GOOGLE_AI_API_KEY_2, etc.
    for (let i = 1; i <= 10; i++) {
      const key = process.env[`GOOGLE_AI_API_KEY_${i}`];
      if (key) {
        keys.push(key);
      }
    }

    return keys;
  }

  /**
   * Get the current active API key
   */
  private getCurrentApiKey(): string {
    return this.apiKeys[this.currentKeyIndex];
  }

  /**
   * Rotates to the next available API key
   * Returns true if there are more keys, false if all have already been tried
   */
  private rotateApiKey(): boolean {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;

    // If we're back at the start, it means we've tried all keys
    if (this.currentKeyIndex === 0) {
      log.error('All Gemini API keys have been attempted');
      return false;
    }

    log.info({ newKeyIndex: this.currentKeyIndex + 1 }, 'Rotating to next API key');
    return true;
  }

  /**
   * Generates text using Gemini 2.5 Flash-Lite (optimized for stage prompts).
   * Uses the cheapest model ($0.40/M tokens) for high-frequency tasks.
   * Implements automatic API key rotation in case of quota error.
   */
  async generate(options: GenerateOptions & { useFullModel?: boolean }): Promise<string> {
    const { systemPrompt, messages, temperature = 0.9, maxTokens = 1000, useFullModel = false } = options;
    const model = useFullModel ? this.modelFull : this.modelLite;
    const timer = createTimer(log, 'LLM generation');

    let lastError: Error | null = null;
    const maxRetries = this.apiKeys.length;

    // Try with each available API key
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Gemini uses a different format: combines system prompt with the first user message
        // and converts roles (user/model instead of user/assistant)
        const contents = [];

        // Add system prompt as first user message
        let firstUserContent = systemPrompt + "\n\n";
        let systemPromptAdded = false;

        // Combine messages in Gemini format
        for (const msg of messages) {
          if (msg.role === "user") {
            firstUserContent += msg.content;
            contents.push({
              role: "user",
              parts: [{ text: firstUserContent }]
            });
            firstUserContent = ""; // Reset
            systemPromptAdded = true;
          } else if (msg.role === "assistant") {
            contents.push({
              role: "model",
              parts: [{ text: msg.content }]
            });
          }
        }

        // If the systemPrompt was not added (there are no user messages), add it now
        if (!systemPromptAdded && firstUserContent) {
          contents.push({
            role: "user",
            parts: [{ text: firstUserContent }]
          });
        }

        const currentKey = this.getCurrentApiKey();
        log.debug({
          model,
          keyIndex: this.currentKeyIndex + 1,
          temperature,
          maxTokens,
          messageCount: messages.length
        }, 'Calling Gemini API');

        const response = await fetch(
          `${this.baseURL}/models/${model}:generateContent?key=${currentKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents,
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
              },
              safetySettings: [
                {
                  category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                  threshold: "BLOCK_NONE"
                },
                {
                  category: "HARM_CATEGORY_HATE_SPEECH",
                  threshold: "BLOCK_ONLY_HIGH"
                },
                {
                  category: "HARM_CATEGORY_HARASSMENT",
                  threshold: "BLOCK_ONLY_HIGH"
                },
                {
                  category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                  threshold: "BLOCK_ONLY_HIGH"
                }
              ]
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();

          log.error({
            status: response.status,
            model,
            keyIndex: this.currentKeyIndex + 1,
            errorText: errorText.substring(0, 200)
          }, 'Gemini API error');

          // Detect quota errors (429, 403, or quota messages)
          const isQuotaError = response.status === 429 ||
                               response.status === 403 ||
                               errorText.toLowerCase().includes('quota') ||
                               errorText.toLowerCase().includes('rate limit');

          if (isQuotaError && this.rotateApiKey()) {
            log.warn('Quota error detected, trying next API key');
            lastError = new Error(`Quota exceeded on key #${this.currentKeyIndex}`);
            continue; // Retry with next key
          }

          throw new Error(`Gemini HTTP error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (!text) {
          // Check if blocked by safety filters
          const finishReason = data.candidates?.[0]?.finishReason;
          const safetyRatings = data.candidates?.[0]?.safetyRatings;

          if (finishReason === 'SAFETY') {
            log.error({ finishReason, safetyRatings }, 'Response blocked by safety filters');
            throw new Error("Gemini blocked the response due to safety filters. Check safetySettings.");
          }

          log.error({ finishReason }, 'Gemini returned no text');
          throw new Error(`Gemini returned no text (finishReason: ${finishReason})`);
        }

        timer.end({ model, textLength: text.length });
        return text;
      } catch (error) {
        lastError = error as Error;

        // If it's a security or validation error, throw immediately with original error
        if (lastError.message.includes('blocked the response') ||
            lastError.message.includes('returned no text')) {
          log.error({ err: error }, 'Error generating LLM response');
          timer.fail(error);
          throw lastError;
        }

        // If not a quota error, throw immediately
        if (!lastError.message.includes('Quota') && !lastError.message.includes('429')) {
          log.error({ err: error }, 'Error generating LLM response');
          timer.fail(error);
          throw new Error("Could not generate AI response");
        }
      }
    }

    // If we get here, all keys failed
    log.error('All Gemini API keys quota exhausted');
    timer.fail(new Error('All API keys quota exhausted'));
    throw new Error("All Gemini API keys have exhausted their quota. Please add more keys or wait for them to renew.");
  }

  /**
   * Chat method compatible with LLMProvider interface
   * Converts messages to generate() format
   */
  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    // Separate system messages from user/assistant messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    // Combine system messages into systemPrompt
    const systemPrompt = systemMessages.map(m => m.content).join('\n\n');

    // Convert to Message format expected by generate()
    const formattedMessages = conversationMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Call generate() with formatted data
    const content = await this.generate({
      systemPrompt: systemPrompt || 'You are a helpful assistant.',
      messages: formattedMessages,
      temperature: 0.7,
      maxTokens: 2000,
    });

    // Return in LLMResponse format
    return {
      content,
      model: this.modelLite,
      usage: {
        promptTokens: 0,  // Gemini doesn't return detailed token usage in all cases
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }

  /**
   * Generates a complete and detailed profile using Gemini 2.5 Flash (full model).
   * Creates a complete life for the character: family, friends, work, routine, experiences, etc.
   * Uses the most powerful model ($2.50/M tokens) for complex reasoning.
   * Executes only once per agent, so the cost is minimal.
   * Implements automatic API key rotation in case of quota error.
   */
  async generateProfile(
    rawData: Record<string, unknown>,
    tier: 'free' | 'plus' | 'ultra' = 'free'
  ): Promise<ProfileGenerationResult> {
    // ═══════════════════════════════════════════════════════════════════
    // NEW: AUTOMATIC PUBLIC FIGURE RESEARCH
    // ═══════════════════════════════════════════════════════════════════
    interface CharacterResearchData {
      detection: {
        isPublicFigure: boolean;
        confidence: number;
        category?: string;
      };
      biography: any | null; // CharacterBiography type from character-research
      enhancedPrompt: string | null;
    }

    let researchData: CharacterResearchData | null = null;

    try {
      const { researchCharacter } = await import('@/lib/profile/character-research');
      researchData = await researchCharacter(
        String(rawData.name || ''),
        String(rawData.personality || ''),
        String(rawData.purpose || '')
      );

      if (researchData.enhancedPrompt) {
        log.info('Public figure detected, using verified web information');
      } else {
        log.debug('Original or non-public character, using standard generation');
      }
    } catch (error) {
      log.warn({ err: error }, 'Error researching character, continuing with standard generation');
      researchData = null;
    }
    // ═══════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════
    // TIER-SPECIFIC CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════
    const tierConfig = {
      free: {
        model: this.modelLite, // Gemini Flash Lite
        maxTokens: 2000,
        temperature: 0.7,
        description: 'FREE TIER - Perfil simplificado y eficiente'
      },
      plus: {
        model: this.modelLite, // Gemini Flash Lite
        maxTokens: 8000,
        temperature: 0.7,
        description: 'PLUS TIER - Perfil completo con validación'
      },
      ultra: {
        model: this.modelFull, // Gemini Flash Full
        maxTokens: 20000,
        temperature: 0.7,
        description: 'ULTRA TIER - Perfil extendido con análisis psicológico profundo'
      }
    };

    const config = tierConfig[tier];
    log.info({
      tier,
      model: config.model,
      maxTokens: config.maxTokens,
      characterName: rawData.name
    }, 'Generating character profile with tier configuration');

    // ═══════════════════════════════════════════════════════════════════
    // GENERATE TIER-SPECIFIC PROMPT
    // ═══════════════════════════════════════════════════════════════════
    let prompt: string;

    if (tier === 'free') {
      prompt = this.generateFreePrompt(rawData, researchData);
    } else if (tier === 'plus') {
      prompt = this.generatePlusPrompt(rawData, researchData);
    } else {
      prompt = this.generateUltraPrompt(rawData, researchData);
    }

    // OLD PROMPT KEPT FOR BACKWARDS COMPATIBILITY (will be removed after testing)
    const _oldPrompt = `Eres un experto en crear personajes profundos, creíbles y realistas para narrativa interactiva.

TAREA: Generar un perfil COMPLETO Y DETALLADO para este personaje basándote en los datos básicos proporcionados.

DATOS BÁSICOS PROPORCIONADOS POR EL USUARIO:
${JSON.stringify(rawData, null, 2)}

${researchData?.enhancedPrompt || `
⚠️ IMPORTANTE: El usuario solo proporcionó datos MÍNIMOS (nombre, personalidad básica, etc.).
TU TRABAJO es EXPANDIR estos datos mínimos en UNA VIDA COMPLETA Y COHERENTE.`}

INSTRUCCIONES CRÍTICAS:
1. INVENTA detalles específicos y realistas para llenar todos los campos
2. TODO debe ser COHERENTE entre sí (personalidad, familia, trabajo, experiencias)
3. USA nombres, lugares, marcas, artistas, series REALES y ESPECÍFICOS (no genéricos)
4. HAZ al personaje IMPERFECTO y HUMANO con contradicciones realistas
5. INCLUYE detalles mundanos (comida favorita, horario de sueño, etc.) - estos crean realismo
6. El systemPrompt debe ser una NARRATIVA RICA de 300-400 palabras, NO una lista

ESTRUCTURA JSON COMPLETA A GENERAR:

{
  "profile": {
    "basicIdentity": {
      "fullName": "nombre completo realista (inferir apellido si no se dio)",
      "preferredName": "${rawData.name}",
      "age": "número entre 20-35 (inferir de personalidad)",
      "birthday": "DD de mes realista",
      "zodiacSign": "signo zodiacal correspondiente",
      "nationality": "inferir del contexto o usar argentina por defecto",
      "city": "ciudad específica (ej: Buenos Aires, Madrid, CDMX)",
      "neighborhood": "barrio específico de esa ciudad",
      "livingSituation": "vive solo/a, con roommate, con familia, etc."
    },

    "currentLocation": {
      "city": "ciudad actual donde vive (MUY IMPORTANTE - debe ser específica y real)",
      "country": "país actual (MUY IMPORTANTE - usar nombre completo, ej: Russia, USA, Argentina, Japan)",
      "description": "descripción breve de su relación con esta ciudad"
    },

    "background": {
      "birthplace": {
        "city": "ciudad de nacimiento",
        "country": "país de nacimiento"
      }
    },

    "family": {
      "mother": {
        "name": "nombre realista",
        "age": "45-60",
        "occupation": "ocupación específica",
        "personality": "descripción breve",
        "relationship": "descripción de la relación (cercana, distante, complicada, etc.)"
      },
      "father": {
        "name": "nombre realista o null si murió/ausente",
        "age": "45-60 o null",
        "occupation": "ocupación o 'fallecido' o 'ausente'",
        "personality": "descripción breve o null",
        "relationship": "descripción o null",
        "status": "vivo/fallecido/ausente/desconocido"
      },
      "siblings": [
        {
          "name": "nombre",
          "age": "edad",
          "occupation": "ocupación/estudio",
          "relationship": "descripción de la relación"
        }
      ],
      "pets": [
        {
          "name": "nombre de mascota",
          "type": "gato/perro/etc",
          "personality": "descripción breve"
        }
      ],
      "familyDynamics": "descripción de dinámicas familiares (2-3 oraciones)"
    },

    "occupation": {
      "current": "trabajo o estudio actual MUY ESPECÍFICO",
      "education": "grado académico y universidad/institución específica",
      "educationStatus": "graduado/estudiante/abandonó",
      "workplace": "nombre del lugar de trabajo o 'freelance desde casa'",
      "schedule": "horario de trabajo detallado",
      "incomeLevel": "bajo/medio/alto - descripción realista",
      "careerGoals": "qué aspira profesionalmente",
      "jobSatisfaction": "satisfecho/insatisfecho/buscando cambio"
    },

    "socialCircle": {
      "friends": [
        {
          "name": "nombre realista",
          "age": "edad aproximada",
          "howMet": "cómo se conocieron (secundaria, universidad, trabajo, etc.)",
          "personality": "descripción de personalidad",
          "relationshipType": "mejor amigo/a, amigo cercano, conocido",
          "activities": "qué hacen juntos"
        }
      ],
      "exPartners": [
        {
          "name": "nombre o 'prefiere no recordarlo'",
          "duration": "cuánto duró",
          "endReason": "por qué terminó",
          "impact": "cómo afectó al personaje"
        }
      ],
      "currentRelationshipStatus": "soltero/a, buscando, no interesado/a, complicado"
    },

    "interests": {
      "music": {
        "genres": ["género1", "género2"],
        "artists": ["artista1 REAL", "artista2 REAL", "artista3 REAL"],
        "favoriteSong": "canción específica - artista"
      },
      "entertainment": {
        "tvShows": ["serie1 REAL", "serie2 REAL"],
        "movies": ["película1", "película2"],
        "anime": ["anime1", "anime2"] || null,
        "books": {
          "authors": ["autor1 REAL", "autor2 REAL"],
          "genres": ["género1", "género2"],
          "currentReading": "libro actual o null"
        }
      },
      "hobbies": [
        {
          "hobby": "hobby específico",
          "frequency": "cuánto lo practica",
          "skillLevel": "principiante/intermedio/avanzado",
          "whyLikes": "por qué le gusta"
        }
      ],
      "sports": {
        "practices": ["deporte1", "deporte2"] || null,
        "watches": ["deporte que ve"] || null,
        "fitnessLevel": "sedentario/activo/muy activo"
      },
      "gaming": {
        "isGamer": true/false,
        "platforms": ["PC", "consola"] || null,
        "favoriteGames": ["juego1", "juego2"] || null,
        "gamingStyle": "casual/hardcore/no juega"
      }
    },

    "dailyRoutine": {
      "chronotype": "early bird/night owl/flexible",
      "wakeUpTime": "hora específica",
      "morningRoutine": "descripción detallada de mañana",
      "afternoonRoutine": "descripción de tarde",
      "eveningRoutine": "descripción de noche",
      "bedTime": "hora específica",
      "averageSleepHours": "número",
      "mostProductiveTime": "mañana/tarde/noche"
    },

    "lifeExperiences": {
      "formativeEvents": [
        {
          "event": "qué pasó (específico y detallado)",
          "age": "edad cuando ocurrió",
          "impact": "cómo cambió al personaje",
          "emotionalWeight": "alto/medio/bajo",
          "currentFeeling": "cómo se siente al respecto ahora"
        }
      ],
      "achievements": [
        {
          "achievement": "logro específico",
          "when": "cuándo",
          "pride": "qué tan orgulloso/a está (0-10)"
        }
      ],
      "regrets": [
        {
          "regret": "qué lamenta",
          "why": "por qué lo lamenta",
          "learned": "qué aprendió"
        }
      ],
      "traumas": [
        {
          "event": "evento traumático (si aplica según personalidad)",
          "age": "cuándo",
          "healing": "superado/en proceso/no resuelto",
          "triggers": ["trigger1", "trigger2"]
        }
      ] || []
    },

    "mundaneDetails": {
      "food": {
        "favorites": ["comida1 específica", "comida2"],
        "dislikes": ["comida que odia"],
        "cookingSkill": "no cocina/básico/bueno/chef",
        "dietaryPreferences": "omnívoro/vegetariano/vegano/etc"
      },
      "drinks": {
        "coffee": "cómo toma el café (con leche, azúcar, etc.) o 'no toma'",
        "tea": "preferencia o 'no toma'",
        "alcohol": "bebe socialmente/no bebe/frecuentemente",
        "favoriteAlcohol": "bebida favorita o null"
      },
      "style": {
        "clothing": "descripción detallada de estilo de vestir",
        "colors": ["color1", "color2", "color3"],
        "brands": ["marca1", "marca2"] || "no es de marcas",
        "accessories": "descripción de accesorios que usa"
      },
      "favoritePlaces": [
        {
          "place": "lugar específico de su ciudad",
          "why": "por qué le gusta",
          "frequency": "qué tan seguido va"
        }
      ],
      "quirks": [
        "manía1 específica",
        "manía2 específica",
        "costumbre rara"
      ]
    },

    "innerWorld": {
      "fears": {
        "primary": ["miedo1 profundo", "miedo2"],
        "minor": ["miedo menor1", "miedo menor2"]
      },
      "insecurities": [
        "inseguridad1 específica",
        "inseguridad2",
        "complejo"
      ],
      "dreams": {
        "shortTerm": ["sueño próximo1", "sueño próximo2"],
        "longTerm": ["sueño de vida1", "sueño de vida2"],
        "secret": "sueño que no comparte fácilmente"
      },
      "values": [
        {
          "value": "valor1 (ej: honestidad)",
          "importance": "alta/media",
          "description": "qué significa para él/ella"
        }
      ],
      "moralAlignment": {
        "honesty": "muy honesto/selectivamente honesto/miente si es necesario",
        "loyalty": "leal a muerte/leal pero con límites/individualista",
        "ambition": "muy ambicioso/moderado/relajado",
        "empathy": "muy empático/empático selectivo/poco empático"
      }
    },

    "personality": {
      "bigFive": {
        "openness": "número 0-100 (coherente con personalidad descrita)",
        "conscientiousness": "número 0-100",
        "extraversion": "número 0-100",
        "agreeableness": "número 0-100",
        "neuroticism": "número 0-100"
      },
      "traits": [
        "trait1 específico (no genérico como 'amable')",
        "trait2 específico",
        "trait3 específico",
        "trait4 específico",
        "trait5 específico"
      ],
      "contradictions": [
        "contradicción realista 1 (ej: es extrovertido pero necesita tiempo solo)",
        "contradicción 2"
      ],
      "strengths": ["fortaleza1", "fortaleza2", "fortaleza3"],
      "weaknesses": ["debilidad1", "debilidad2", "debilidad3"]
    },

    "communication": {
      "textingStyle": "descripción de cómo escribe mensajes",
      "slang": ["modismo1 regional", "modismo2"],
      "emojiUsage": "bajo/moderado/alto",
      "punctuation": "formal/casual/caótico",
      "voiceMessageFrequency": "nunca/rara vez/a veces/frecuentemente",
      "responseSpeed": "inmediato/minutos/horas",
      "humorStyle": "irónico/sarcástico/wholesome/dark/absurdo/no usa humor"
    },

    "presentTense": {
      "currentMood": "estado de ánimo general actual",
      "recentEvent": "algo que le pasó recientemente (última semana)",
      "currentStress": "bajo/medio/alto y por qué",
      "currentFocus": "en qué está enfocado/a en su vida ahora"
    }
  },

  "systemPrompt": "NARRATIVA COMPLETA DE 300-400 PALABRAS que cuente la historia de este personaje de forma natural y conversacional. Debe incluir: quién es, su familia, su vida actual, sus experiencias formativas, su personalidad profunda, sus sueños y miedos, detalles de su día a día. NO escribas como lista, escribe como si estuvieras contando la historia de una persona real. Usa un tono narrativo pero natural. Incluye detalles específicos y mundanos que hagan al personaje sentirse vivo."
}

EJEMPLOS DE ESPECIFICIDAD REQUERIDA:

❌ MAL (genérico):
"music": ["pop", "rock"]
"friends": [{"name": "un amigo"}]
"occupation": "diseñador"

✅ BIEN (específico):
"music": {
  "genres": ["indie pop", "R&B"],
  "artists": ["Rosalía", "The Weeknd", "Bad Bunny"],
  "favoriteSong": "La Fama - Rosalía ft. The Weeknd"
}
"friends": [{
  "name": "Lucía Fernández",
  "age": "24",
  "howMet": "Secundaria - eran las únicas que leían manga en el recreo",
  "personality": "Extrovertida, impulsiva, leal",
  "relationshipType": "Mejor amiga",
  "activities": "Van a bares de karaoke, maratonean series juntas"
}]
"occupation": {
  "current": "Diseñadora UX/UI Freelance",
  "education": "Lic. en Diseño Gráfico - Universidad de Buenos Aires (UBA)",
  "workplace": "Trabaja desde su monoambiente en Palermo",
  "schedule": "Flexible - prefiere trabajar de 2pm a 11pm"
}

REGLAS FINALES:
1. TODO debe ser coherente (si es tímido/a, no tendrá 10 amigos cercanos)
2. Incluye imperfecciones (errores del pasado, inseguridades, miedos)
3. Haz que el pasado explique el presente (por qué es como es)
4. Los detalles mundanos son CRÍTICOS (qué desayuna, cuándo duerme, etc.)
5. El systemPrompt debe ser NARRATIVO, como si estuvieras escribiendo un personaje de novela

⚠️ CRÍTICO - SISTEMA DE CLIMA EN TIEMPO REAL:
La ubicación actual (currentLocation.city y currentLocation.country) es MUY IMPORTANTE.
El personaje recibirá el clima REAL de esa ciudad en tiempo real durante conversaciones.
- Usa ciudades y países REALES Y ESPECÍFICOS
- Ej correcto: "Moscow", "Russia" | "Tokyo", "Japan" | "Buenos Aires", "Argentina"
- Ej incorrecto: "Ciudad grande", "Europa", "Algún lugar"
- El sistema usará estas coordenadas para obtener temperatura y condiciones climáticas actuales
- Si el personaje menciona el clima, debe coincidir con la realidad de su ubicación

Responde SOLO con el JSON completo, sin markdown ni explicaciones adicionales.`;

    let lastError: Error | null = null;
    const maxRetries = this.apiKeys.length;

    // Intentar con cada API key disponible
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const currentKey = this.getCurrentApiKey();
        log.info({
          model: this.modelFull,
          keyIndex: this.currentKeyIndex + 1,
          characterName: rawData.name
        }, 'Generating character profile');

        const response = await fetch(
          `${this.baseURL}/models/${config.model}:generateContent?key=${currentKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [{ text: prompt }]
              }],
              generationConfig: {
                temperature: config.temperature,
                maxOutputTokens: config.maxTokens,
              },
              safetySettings: [
                {
                  category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                  threshold: "BLOCK_NONE"
                },
                {
                  category: "HARM_CATEGORY_HATE_SPEECH",
                  threshold: "BLOCK_ONLY_HIGH"
                },
                {
                  category: "HARM_CATEGORY_HARASSMENT",
                  threshold: "BLOCK_ONLY_HIGH"
                },
                {
                  category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                  threshold: "BLOCK_ONLY_HIGH"
                }
              ]
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();

          log.error({
            status: response.status,
            model: this.modelFull,
            keyIndex: this.currentKeyIndex + 1,
            errorText: errorText.substring(0, 200)
          }, 'Gemini profile generation error');

          // Detectar errores de cuota (429, 403, o mensajes de quota)
          const isQuotaError = response.status === 429 ||
                               response.status === 403 ||
                               errorText.toLowerCase().includes('quota') ||
                               errorText.toLowerCase().includes('rate limit');

          if (isQuotaError && this.rotateApiKey()) {
            log.warn('Quota error in profile generation, trying next API key');
            lastError = new Error(`Quota exceeded on key #${this.currentKeyIndex}`);
            continue; // Retry with next key
          }

          throw new Error(`Gemini HTTP error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        log.debug('Profile generation response received');

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          // Verificar si fue bloqueado por safety filters
          const finishReason = data.candidates?.[0]?.finishReason;
          const safetyRatings = data.candidates?.[0]?.safetyRatings;

          if (finishReason === 'SAFETY') {
            log.error({ finishReason, safetyRatings }, 'Profile response blocked by safety filters');
            throw new Error("Gemini bloqueó la respuesta por filtros de seguridad. Verifica safetySettings.");
          }

          log.error({ finishReason }, 'Gemini returned no text for profile');
          throw new Error(`Gemini no retornó texto (finishReason: ${finishReason})`);
        }

        log.debug({ textLength: text.length }, 'Parsing profile JSON');

        // Estrategia 1: Intentar parsear directamente (si ya es JSON puro)
        try {
          const parsed = JSON.parse(text);
          log.info('Profile JSON parsed successfully (direct)');
          return parsed;
        } catch {
          // No es JSON puro, continuar con extracción
        }

        // Estrategia 2: Extraer JSON de markdown code blocks
        let jsonText = text;

        // Remover markdown code blocks si existen
        if (text.includes('```')) {
          const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
          if (codeBlockMatch) {
            jsonText = codeBlockMatch[1];
            log.debug('JSON extracted from code block');
          }
        }

        // Strategy 3: Find the first { and the last balanced }
        const firstBrace = jsonText.indexOf('{');
        if (firstBrace === -1) {
          log.error('No opening brace found in response');
          throw new Error("No se pudo extraer JSON de la respuesta");
        }

        // Find the last } that closes the JSON
        let braceCount = 0;
        let lastBrace = -1;
        for (let i = firstBrace; i < jsonText.length; i++) {
          if (jsonText[i] === '{') braceCount++;
          if (jsonText[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              lastBrace = i;
              break;
            }
          }
        }

        if (lastBrace === -1) {
          log.error('No balanced closing brace found in response');
          throw new Error("No se pudo extraer JSON de la respuesta");
        }

        const extractedJson = jsonText.substring(firstBrace, lastBrace + 1);
        log.debug('JSON extracted with balanced brace search');

        const parsed = JSON.parse(extractedJson);
        log.info({ characterName: rawData.name }, 'Profile generated successfully');
        return parsed;
      } catch (error) {
        lastError = error as Error;

        // If not a quota error, try with fallback
        if (!lastError.message.includes('Quota') && !lastError.message.includes('429')) {
          log.warn({ err: error, characterName: rawData.name }, 'Error generating profile, using fallback');

          // Fallback: return basic data but with complete structure
          const fallback = {
            profile: {
              basicIdentity: {
                fullName: rawData.name,
                preferredName: rawData.name,
                age: 25,
                city: "Buenos Aires",
                nationality: "Argentina"
              },
              personality: {
                traits: ["amigable", "conversacional", "empático"],
                bigFive: {
                  openness: 50,
                  conscientiousness: 50,
                  extraversion: 50,
                  agreeableness: 70,
                  neuroticism: 40
                }
              },
              occupation: {
                current: rawData.purpose || "Trabajo flexible",
                education: "Universidad",
                educationStatus: "graduado"
              },
              interests: {
                music: {
                  genres: ["varios"],
                  artists: ["música variada"]
                }
              },
              communication: {
                textingStyle: rawData.tone || "amigable y conversacional",
                emojiUsage: "moderado",
                humorStyle: "wholesome"
              }
            },
            systemPrompt: `${rawData.name} es una persona ${rawData.personality || "amigable y conversacional"}. ${rawData.kind === 'companion' ? 'Le gusta conectar emocionalmente con las personas' : 'Le gusta ayudar y ser útil'}. Su forma de comunicarse es ${rawData.tone || "cálida y accesible"}. ${rawData.purpose ? `Se dedica a ${rawData.purpose}.` : ''} Vive en Buenos Aires y tiene una personalidad equilibrada y empática. Aunque es reservado/a con desconocidos, se abre más a medida que genera confianza con las personas.`,
          };
          log.info({ characterName: rawData.name }, 'Using enhanced fallback profile');
          return fallback;
        }
      }
    }

    // If we reach here, all keys failed due to quota
    log.error({ characterName: rawData.name }, 'All Gemini API keys quota exhausted in profile generation');

    // In case of total exhaustion, use fallback instead of failing
    const fallback = {
      profile: {
        basicIdentity: {
          fullName: rawData.name,
          preferredName: rawData.name,
          age: 25,
          city: "Buenos Aires",
          nationality: "Argentina"
        },
        personality: {
          traits: ["amigable", "conversacional", "empático"],
          bigFive: {
            openness: 50,
            conscientiousness: 50,
            extraversion: 50,
            agreeableness: 70,
            neuroticism: 40
          }
        },
        occupation: {
          current: rawData.purpose || "Trabajo flexible",
          education: "Universidad",
          educationStatus: "graduado"
        },
        interests: {
          music: {
            genres: ["varios"],
            artists: ["música variada"]
          }
        },
        communication: {
          textingStyle: rawData.tone || "amigable y conversacional",
          emojiUsage: "moderado",
          humorStyle: "wholesome"
        }
      },
      systemPrompt: `${rawData.name} es una persona ${rawData.personality || "amigable y conversacional"}. ${rawData.kind === 'companion' ? 'Le gusta conectar emocionalmente con las personas' : 'Le gusta ayudar y ser útil'}. Su forma de comunicarse es ${rawData.tone || "cálida y accesible"}. ${rawData.purpose ? `Se dedica a ${rawData.purpose}.` : ''} Vive en Buenos Aires y tiene una personalidad equilibrada y empática. Aunque es reservado/a con desconocidos, se abre más a medida que genera confianza con las personas.`,
    };
    log.warn({ characterName: rawData.name }, 'Using quota exhaustion fallback profile');
    return fallback;
  }

  /**
   * Generate FREE tier prompt - Simplified profile (60 fields approx)
   */
  private generateFreePrompt(rawData: Record<string, unknown>, researchData: any): string {
    return `Eres un experto en crear personajes para narrativa interactiva.

TIER: FREE - Perfil simplificado pero coherente

DATOS BÁSICOS:
${JSON.stringify(rawData, null, 2)}

${researchData?.enhancedPrompt || '⚠️ IMPORTANTE: El usuario proporcionó datos mínimos. EXPANDE estos en un perfil coherente pero simplificado.'}

TAREA: Generar un perfil SIMPLIFICADO pero COHERENTE.

ESTRUCTURA JSON:

{
  "profile": {
    "basicIdentity": {
      "fullName": "nombre completo",
      "preferredName": "${rawData.name}",
      "age": "número 20-35",
      "city": "ciudad específica",
      "nationality": "país"
    },
    "currentLocation": {
      "city": "ciudad actual ESPECÍFICA Y REAL",
      "country": "país actual (nombre completo: Russia, USA, Argentina, Japan, etc.)",
      "description": "breve descripción"
    },
    "personality": {
      "bigFive": {
        "openness": "0-100",
        "conscientiousness": "0-100",
        "extraversion": "0-100",
        "agreeableness": "0-100",
        "neuroticism": "0-100"
      },
      "traits": ["trait1", "trait2", "trait3"],
      "strengths": ["fortaleza1", "fortaleza2"],
      "weaknesses": ["debilidad1", "debilidad2"]
    },
    "occupation": {
      "current": "trabajo específico",
      "education": "nivel educativo"
    },
    "interests": {
      "music": ["género1", "género2"],
      "hobbies": ["hobby1", "hobby2"]
    },
    "communication": {
      "textingStyle": "descripción",
      "emojiUsage": "bajo/moderado/alto",
      "humorStyle": "estilo de humor"
    },
    "dailyRoutine": {
      "chronotype": "early bird/night owl",
      "wakeUpTime": "hora",
      "bedTime": "hora"
    }
  },
  "systemPrompt": "Descripción narrativa de 150-200 palabras sobre quién es este personaje, su personalidad, y su forma de comunicarse. Tono natural y conversacional."
}

REGLAS:
1. Datos COHERENTES entre sí
2. Nombres y lugares REALES y ESPECÍFICOS (no genéricos)
3. Personaje IMPERFECTO y HUMANO
4. systemPrompt NARRATIVO, no lista

⚠️ CRÍTICO - SISTEMA DE CLIMA:
currentLocation.city y currentLocation.country DEBEN ser reales y específicos.
El personaje recibirá clima REAL de esa ubicación en tiempo real.
Ejemplos: "Moscow", "Russia" | "Tokyo", "Japan" | "Buenos Aires", "Argentina"

Responde SOLO con JSON, sin markdown.`;
  }

  /**
   * Generate PLUS tier prompt - Complete profile (160 fields approx)
   */
  private generatePlusPrompt(rawData: Record<string, unknown>, researchData: any): string {
    // This is essentially the current/old prompt - keeping it mostly the same
    return `Eres un experto en crear personajes profundos, creíbles y realistas para narrativa interactiva.

TIER: PLUS - Perfil completo y detallado

TAREA: Generar un perfil COMPLETO Y DETALLADO para este personaje basándote en los datos básicos proporcionados.

DATOS BÁSICOS PROPORCIONADOS POR EL USUARIO:
${JSON.stringify(rawData, null, 2)}

${researchData?.enhancedPrompt || `
⚠️ IMPORTANTE: El usuario solo proporcionó datos MÍNIMOS (nombre, personalidad básica, etc.).
TU TRABAJO es EXPANDIR estos datos mínimos en UNA VIDA COMPLETA Y COHERENTE.`}

INSTRUCCIONES CRÍTICAS:
1. INVENTA detalles específicos y realistas para llenar todos los campos
2. TODO debe ser COHERENTE entre sí (personalidad, familia, trabajo, experiencias)
3. USA nombres, lugares, marcas, artistas, series REALES y ESPECÍFICOS (no genéricos)
4. HAZ al personaje IMPERFECTO y HUMANO con contradicciones realistas
5. INCLUYE detalles mundanos (comida favorita, horario de sueño, etc.) - estos crean realismo
6. El systemPrompt debe ser una NARRATIVA RICA de 300-400 palabras, NO una lista

[... El resto del prompt original con toda la estructura completa JSON ...]

ESTRUCTURA JSON COMPLETA: Igual que el prompt original (basicIdentity, family, occupation, socialCircle, interests, dailyRoutine, lifeExperiences, mundaneDetails, innerWorld, personality, communication, presentTense)

IMPORTANTE: Incluye la sección "currentLocation" con ciudad y país específicos y reales después de basicIdentity:
"currentLocation": {
  "city": "ciudad actual donde vive (ESPECÍFICA Y REAL)",
  "country": "país actual (nombre completo: Russia, USA, Argentina, Japan, etc.)",
  "description": "descripción breve de su relación con esta ciudad"
}

⚠️ CRÍTICO - SISTEMA DE CLIMA EN TIEMPO REAL:
La ubicación (currentLocation) es MUY IMPORTANTE. El personaje recibirá clima REAL de esa ciudad.
- Usa ciudades y países REALES: "Moscow", "Russia" | "Tokyo", "Japan" | "Buenos Aires", "Argentina"
- NO uses ubicaciones genéricas o ficticias

Responde SOLO con el JSON completo, sin markdown ni explicaciones adicionales.`;
  }

  /**
   * Generate ULTRA tier prompt - Extended profile with psychological depth (240+ fields)
   */
  private generateUltraPrompt(rawData: Record<string, unknown>, researchData: any): string {
    return `Eres un EXPERTO MÁXIMO en psicología, desarrollo de personajes, y narrativa profunda.

TIER: ULTRA - Análisis psicológico completo sin restricciones de costo

TAREA: Generar el perfil MÁS COMPLETO, PROFUNDO Y REALISTA posible.

DATOS BÁSICOS:
${JSON.stringify(rawData, null, 2)}

${researchData?.enhancedPrompt || 'EXPANDE estos datos mínimos en una PERSONA COMPLETA con profundidad psicológica total.'}

INSTRUCCIONES ULTRA:
1. INVENTA todos los detalles necesarios con MÁXIMA ESPECIFICIDAD
2. COHERENCIA ABSOLUTA - todo debe conectar perfectamente
3. Nombres REALES, lugares REALES, referencias REALES
4. Personaje COMPLEJO con contradicciones y matices psicológicos profundos
5. systemPrompt de 400-500 palabras con narrativa rica y profunda

ESTRUCTURA JSON COMPLETA:

{
  "profile": {
    // [SECCIONES STANDARD - igual que PLUS tier]
    "basicIdentity": { ... },
    "family": { ... },
    "occupation": { ... },
    "socialCircle": { ... },
    "interests": { ... },
    "dailyRoutine": { ... },
    "lifeExperiences": { ... },
    "mundaneDetails": { ... },
    "innerWorld": { ... },
    "personality": { ... },
    "communication": { ... },
    "presentTense": { ... },

    // ═══════════════════════════════════════════════════════════
    // ULTRA TIER EXCLUSIVE - PSYCHOLOGICAL PROFILE
    // ═══════════════════════════════════════════════════════════
    "psychologicalProfile": {
      "attachmentStyle": "secure/anxious/avoidant/fearful-avoidant",
      "attachmentDescription": "Análisis profundo de por qué tiene este estilo",
      "primaryCopingMechanisms": ["mecanismo1", "mecanismo2", "mecanismo3"],
      "unhealthyCopingMechanisms": ["mecanismo1", "mecanismo2"],
      "copingTriggers": ["trigger1", "trigger2", "trigger3"],
      "emotionalRegulationBaseline": "estable/volátil/reprimido",
      "emotionalExplosiveness": "0-100",
      "emotionalRecoverySpeed": "rápido/moderado/lento",
      "mentalHealthConditions": ["condición1 si aplica"] || [],
      "therapyStatus": "en terapia/pasado/nunca/considera",
      "medicationUse": true/false,
      "mentalHealthStigma": "cómo ve la salud mental",
      "defenseMethanisms": {
        "primary": ["mecanismo1", "mecanismo2"],
        "situational": "cuándo usa cada uno"
      },
      "traumaHistory": [
        {
          "event": "descripción específica",
          "age": "edad",
          "impact": "high/medium/low",
          "processed": true/false
        }
      ] || [],
      "resilienceFactors": ["factor1", "factor2", "factor3"],
      "selfAwarenessLevel": "0-100",
      "blindSpots": ["blind spot1", "blind spot2"],
      "insightAreas": ["área de insight1", "área2"]
    },

    // ═══════════════════════════════════════════════════════════
    // ULTRA TIER EXCLUSIVE - DEEP RELATIONAL PATTERNS
    // ═══════════════════════════════════════════════════════════
    "deepRelationalPatterns": {
      "givingLoveLanguages": ["lenguaje1", "lenguaje2"],
      "receivingLoveLanguages": ["lenguaje1", "lenguaje2"],
      "loveLanguageIntensities": {
        "wordsOfAffirmation": "0-100",
        "physicalTouch": "0-100",
        "acts OfService": "0-100",
        "qualityTime": "0-100",
        "gifts": "0-100"
      },
      "repeatingPatterns": ["patrón1 que repite", "patrón2"],
      "whyRepeats": "Análisis profundo de por qué repite estos patrones",
      "awarenessOfPatterns": "consciente/parcialmente_consciente/inconsciente",
      "personalBoundaryStyle": "rígido/saludable/difuso/ausente",
      "professionalBoundaryStyle": "rígido/saludable/difuso/ausente",
      "boundaryEnforcement": "0-100",
      "boundaryGuilty": true/false,
      "conflictStyle": "evitativo/acomodador/competitivo/colaborativo/comprometedor",
      "conflictTriggers": ["trigger1", "trigger2"],
      "healthyConflictSkills": ["skill1", "skill2"],
      "unhealthyConflictPatterns": ["patrón1", "patrón2"],
      "trustBaseline": "0-100",
      "vulnerabilityComfort": "0-100",
      "trustRepairAbility": "0-100",
      "intimacyComfort": {
        "emotional": "0-100",
        "physical": "0-100",
        "intellectual": "0-100",
        "experiential": "0-100"
      },
      "intimacyFears": ["miedo1", "miedo2"],
      "intimacyNeeds": ["necesidad1", "necesidad2"],
      "socialMaskLevel": "0-100",
      "authenticityByContext": {
        "work": "0-100",
        "friends": "0-100",
        "family": "0-100",
        "strangers": "0-100"
      },
      "socialEnergy": "renovador/neutral/agotador"
    },

    // ═══════════════════════════════════════════════════════════
    // ULTRA TIER EXCLUSIVE - PHILOSOPHICAL FRAMEWORK
    // ═══════════════════════════════════════════════════════════
    "philosophicalFramework": {
      "optimismLevel": "0-100",
      "worldviewType": "realista/idealista/cínico/esperanzado",
      "meaningSource": "De dónde saca sentido a la vida (descripción profunda)",
      "existentialStance": "absurdista/nihilista/existencialista/esencialista",
      "politicalLeanings": "Posiciones políticas matizadas y específicas",
      "politicalEngagement": "0-100",
      "activismLevel": "0-100",
      "socialJusticeStance": "Stance sobre justicia social",
      "ethicalFramework": "utilitarista/deontológica/ética de virtudes/relativista",
      "moralComplexity": "0-100",
      "moralRigidity": "0-100",
      "moralDilemmas": [
        {
          "situación": "dilema moral específico",
          "stance": "su posición",
          "reasoning": "por qué"
        }
      ],
      "religiousBackground": "católico/agnóstico/ateo/espiritual no religioso/etc",
      "currentBeliefs": "Creencias actuales detalladas",
      "spiritualPractices": ["práctica1", "práctica2"] || [],
      "faithImportance": "0-100",
      "lifePhilosophy": "Su filosofía personal de vida (descripción profunda)",
      "coreBeliefs": ["creencia fundamental1", "creencia2", "creencia3"],
      "dealbreakers": ["dealbreaker1", "dealbreaker2"],
      "personalMotto": "Lema de vida si tiene uno" || null,
      "epistomologyStance": "Cómo determina qué es verdad",
      "scienceTrustLevel": "0-100",
      "intuitionVsLogic": "0-100 (0=todo lógica, 100=todo intuición)",
      "growthMindset": "0-100",
      "opennessToChange": "0-100",
      "philosophicalEvolution": "Cómo han cambiado sus creencias a lo largo del tiempo"
    }
  },

  "systemPrompt": "NARRATIVA PROFUNDA de 400-500 palabras que cuente la historia COMPLETA de este personaje. Incluye: identidad básica, familia, vida actual, experiencias formativas, análisis psicológico profundo, patrones relacionales, filosofía de vida, sueños, miedos, complejidades. NO escribas como lista - escribe como si contaras la biografía psicológica de una persona real. Tono narrativo profundo pero accesible."
}

REGLAS ULTRA:
1. MÁXIMA especificidad en TODOS los campos
2. Coherencia ABSOLUTA entre todos los elementos
3. Complejidad psicológica REALISTA - personas reales tienen contradicciones
4. Los tres perfiles psicológicos (psychologicalProfile, deepRelationalPatterns, philosophicalFramework) deben estar COMPLETAMENTE desarrollados
5. systemPrompt debe ser una OBRA MAESTRA narrativa de 400-500 palabras

⚠️ CRÍTICO - SISTEMA DE CLIMA EN TIEMPO REAL:
La ubicación actual (currentLocation.city y currentLocation.country) es MUY IMPORTANTE.
El personaje recibirá el clima REAL de esa ciudad en tiempo real durante conversaciones.
- Usa ciudades y países REALES Y ESPECÍFICOS
- Ejemplos correctos: "Moscow", "Russia" | "Tokyo", "Japan" | "Buenos Aires", "Argentina"
- Ejemplos INCORRECTOS: "Ciudad grande", "Europa", "Algún lugar"
- El sistema usará estas coordenadas para obtener temperatura y condiciones climáticas actuales
- Si el personaje menciona el clima durante conversaciones, DEBE coincidir con la realidad de su ubicación

Responde SOLO con JSON completo, sin markdown.`;
  }
}

// Import local provider
import { LocalLLMProvider, createLocalProvider } from './local-provider';

// Singleton - can be either cloud or local provider
let llmProvider: LLMProvider | LocalLLMProvider | null = null;

export function getLLMProvider(): LLMProvider | LocalLLMProvider {
  if (!llmProvider) {
    // Check if local LLM is configured first
    const localProvider = createLocalProvider();

    if (localProvider) {
      const type = process.env.LOCAL_LLM_TYPE;
      const url = process.env.LOCAL_LLM_URL;
      const model = process.env.LOCAL_LLM_MODEL;

      log.info(
        { type, url, model },
        '🤖 Using LOCAL LLM - Free, private, and offline!'
      );

      llmProvider = localProvider;
    } else {
      // Use cloud provider (Gemini)
      log.info('☁️  Using CLOUD LLM (Gemini)');
      llmProvider = new LLMProvider();
    }
  }
  return llmProvider;
}
