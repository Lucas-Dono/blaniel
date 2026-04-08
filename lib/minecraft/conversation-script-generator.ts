/**
 * Complete Conversational Script Generator
 * 
 * Generates structured conversations with start, development, and end
 */

import { v4 as uuidv4 } from "uuid";
import { getVeniceClient, RECOMMENDED_MODELS } from "@/lib/emotional-system/llm/venice";
import { createLogger } from "@/lib/logger";
import {
  ConversationScript,
  ConversationPhase,
  DialogueLine,
  ScriptGenerationOptions,
  ScriptGenerationResult,
  ConversationTemplate,
} from "./conversation-script-types";

const log = createLogger("ConversationScriptGenerator");

/**
 * Pre-defined conversation templates
 */
const CONVERSATION_TEMPLATES: ConversationTemplate[] = [
  {
    id: "casual_weather",
    name: "Conversation about weather",
    topic: "Today's weather",
    category: "casual",
    minParticipants: 2,
    maxParticipants: 3,
    lines: [
      { speakerIndex: 0, message: "Hola {name1}, ¿cómo estás?", phase: ConversationPhase.GREETING },
      { speakerIndex: 1, message: "Hola! Muy bien, gracias. ¿Y tú?", phase: ConversationPhase.GREETING },
      {
        speakerIndex: 0,
        message: "Bien también. Qué buen día hace, ¿no?",
        phase: ConversationPhase.TOPIC_INTRODUCTION,
      },
      {
        speakerIndex: 1,
        message: "Sí, el sol está brillante hoy. Perfecto para trabajar afuera.",
        phase: ConversationPhase.TOPIC_INTRODUCTION,
      },
      {
        speakerIndex: 0,
        message: "Totalmente. Ayer llovió tanto que no pude salir.",
        phase: ConversationPhase.DEVELOPMENT,
      },
      {
        speakerIndex: 1,
        message: "Sí, yo también me quedé en casa. El trueno era ensordecedor.",
        phase: ConversationPhase.DEVELOPMENT,
      },
      {
        speakerIndex: 0,
        message: "Bueno, al menos ahora el jardín está bien regado.",
        phase: ConversationPhase.CONCLUSION,
      },
      {
        speakerIndex: 1,
        message: "Cierto, eso es bueno. Bueno, debo irme.",
        phase: ConversationPhase.CONCLUSION,
      },
      { speakerIndex: 0, message: "Nos vemos luego!", phase: ConversationPhase.FAREWELL },
      { speakerIndex: 1, message: "Hasta pronto, cuídate!", phase: ConversationPhase.FAREWELL },
    ],
  },
  {
    id: "work_planning",
    name: "Planning work",
    topic: "Daily tasks",
    category: "work",
    minParticipants: 2,
    maxParticipants: 3,
    lines: [
      { speakerIndex: 0, message: "Buenos días, {name1}.", phase: ConversationPhase.GREETING },
      { speakerIndex: 1, message: "Buenos días. ¿Qué hay que hacer hoy?", phase: ConversationPhase.GREETING },
      {
        speakerIndex: 0,
        message: "Tenemos que terminar la cerca del norte.",
        phase: ConversationPhase.TOPIC_INTRODUCTION,
      },
      {
        speakerIndex: 1,
        message: "Ah, cierto. ¿Trajiste suficiente madera?",
        phase: ConversationPhase.TOPIC_INTRODUCTION,
      },
      {
        speakerIndex: 0,
        message: "Sí, tengo lo necesario. También hay que revisar las cosechas.",
        phase: ConversationPhase.DEVELOPMENT,
      },
      {
        speakerIndex: 1,
        message: "Perfecto. Yo puedo encargarme de las cosechas.",
        phase: ConversationPhase.DEVELOPMENT,
      },
      {
        speakerIndex: 0,
        message: "Genial. Si terminamos temprano, mejor aún.",
        phase: ConversationPhase.CONCLUSION,
      },
      {
        speakerIndex: 1,
        message: "De acuerdo. Empecemos entonces.",
        phase: ConversationPhase.CONCLUSION,
      },
      { speakerIndex: 0, message: "¡Vamos!", phase: ConversationPhase.FAREWELL },
    ],
  },
  {
    id: "gossip_news",
    name: "Town gossip",
    topic: "Recent news",
    category: "gossip",
    minParticipants: 2,
    maxParticipants: 3,
    lines: [
      { speakerIndex: 0, message: "¿Escuchaste lo que pasó ayer?", phase: ConversationPhase.GREETING },
      { speakerIndex: 1, message: "No, ¿qué pasó?", phase: ConversationPhase.GREETING },
      {
        speakerIndex: 0,
        message: "Dicen que vieron zombies cerca del bosque.",
        phase: ConversationPhase.TOPIC_INTRODUCTION,
      },
      {
        speakerIndex: 1,
        message: "¿En serio? Eso suena peligroso.",
        phase: ConversationPhase.TOPIC_INTRODUCTION,
      },
      {
        speakerIndex: 0,
        message: "Sí, por eso los guardias reforzaron la patrulla.",
        phase: ConversationPhase.DEVELOPMENT,
      },
      {
        speakerIndex: 1,
        message: "Menos mal. Espero que no se acerquen mucho.",
        phase: ConversationPhase.DEVELOPMENT,
      },
      {
        speakerIndex: 0,
        message: "Yo también. Hay que estar atentos.",
        phase: ConversationPhase.CONCLUSION,
      },
      {
        speakerIndex: 1,
        message: "Definitivamente. Gracias por avisar.",
        phase: ConversationPhase.CONCLUSION,
      },
      { speakerIndex: 0, message: "De nada, cuídate.", phase: ConversationPhase.FAREWELL },
      { speakerIndex: 1, message: "Igualmente!", phase: ConversationPhase.FAREWELL },
    ],
  },
  {
    id: "storytelling",
    name: "Telling stories",
    topic: "Stories from the past",
    category: "storytelling",
    minParticipants: 2,
    maxParticipants: 3,
    lines: [
      {
        speakerIndex: 0,
        message: "¿Te conté alguna vez sobre mi viaje al desierto?",
        phase: ConversationPhase.GREETING,
      },
      { speakerIndex: 1, message: "No, cuéntame!", phase: ConversationPhase.GREETING },
      {
        speakerIndex: 0,
        message: "Fue hace años. El sol era tan intenso que casi me deshidrato.",
        phase: ConversationPhase.TOPIC_INTRODUCTION,
      },
      {
        speakerIndex: 1,
        message: "Wow, suena peligroso. ¿Cómo sobreviviste?",
        phase: ConversationPhase.TOPIC_INTRODUCTION,
      },
      {
        speakerIndex: 0,
        message: "Encontré un oasis justo a tiempo. La suerte estuvo de mi lado.",
        phase: ConversationPhase.DEVELOPMENT,
      },
      {
        speakerIndex: 1,
        message: "Qué alivio. ¿Volviste después?",
        phase: ConversationPhase.DEVELOPMENT,
      },
      {
        speakerIndex: 0,
        message: "Nunca más. El desierto no es para mí.",
        phase: ConversationPhase.CONCLUSION,
      },
      {
        speakerIndex: 1,
        message: "Lo entiendo. Buena historia, gracias por compartirla.",
        phase: ConversationPhase.CONCLUSION,
      },
      { speakerIndex: 0, message: "Un gusto!", phase: ConversationPhase.FAREWELL },
    ],
  },
];

export class ConversationScriptGenerator {
  /**
   * Cache of generated scripts
   * Key: hash of participants + topic
   */
  private static scriptCache = new Map<string, ConversationScript>();

  /** Generate hash for cache */
  private static generateCacheKey(participants: any[], topic: string): string {
    const ids = participants.map((p) => p.agentId).sort().join("_");
    return `${ids}_${topic.replace(/\s+/g, "_")}`;
  }

  /** Generate complete conversational script */
  static async generateScript(
    options: ScriptGenerationOptions
  ): Promise<ScriptGenerationResult> {
    const { participants, location, contextHint, topic, desiredLength = 12, useTemplate = true } =
      options;

    // Validate participants
    if (participants.length < 2) {
      throw new Error("At least 2 participants are required");
    }

    // Determine topic if not provided
    const conversationTopic = topic || this.generateRandomTopic(participants);

    // Verify cache
    const cacheKey = this.generateCacheKey(participants, conversationTopic);
    const cached = this.scriptCache.get(cacheKey);

    if (cached && !options.forceAI) {
      log.info({ scriptId: cached.scriptId, topic: conversationTopic }, "Using cached script");
      return {
        script: cached,
        cached: true,
        cost: 0,
        source: "cache",
      };
    }

    // Try to use template first
    if (useTemplate && !options.forceAI) {
      const templateScript = this.generateFromTemplate(participants, location, contextHint);

      if (templateScript) {
        log.info({
          scriptId: templateScript.scriptId,
          topic: templateScript.topic,
        }, "Using template script");

        // Cachear
        this.scriptCache.set(cacheKey, templateScript);

        return {
          script: templateScript,
          cached: false,
          cost: 0,
          source: "template",
        };
      }
    }

    // Generate with AI (more expensive but customized)
    log.info({ topic: conversationTopic, participants: participants.length }, "Generating AI script");

    const aiScript = await this.generateWithAI(
      participants,
      conversationTopic,
      location,
      contextHint,
      desiredLength
    );

    // Cachear
    this.scriptCache.set(cacheKey, aiScript.script);

    return aiScript;
  }

  /** Generate script from template */
  private static generateFromTemplate(
    participants: any[],
    location: string,
    contextHint?: string
  ): ConversationScript | null {
    // Filtrar templates compatibles
    const compatibleTemplates = CONVERSATION_TEMPLATES.filter(
      (t) =>
        participants.length >= t.minParticipants && participants.length <= t.maxParticipants
    );

    if (compatibleTemplates.length === 0) {
      return null;
    }

    // Seleccionar template aleatorio
    const template =
      compatibleTemplates[Math.floor(Math.random() * compatibleTemplates.length)];

    // Build lines with real names
    const lines: DialogueLine[] = template.lines.map((line, index) => {
      const speaker = participants[line.speakerIndex % participants.length];

      // Reemplazar placeholders
      let message = line.message;
      participants.forEach((p, i) => {
        message = message.replace(`{name${i}}`, p.name);
        message = message.replace("{name}", p.name);
        message = message.replace("{personality}", p.personality);
      });

      return {
        agentId: speaker.agentId,
        agentName: speaker.name,
        message,
        phase: line.phase,
        lineNumber: index,
      };
    });

    // Calculate duration (3-5 seconds per line)
    const duration = lines.length * 4;

    const now = new Date();
    return {
      scriptId: uuidv4(),
      version: 1, // First version
      participants,
      topic: template.topic,
      location,
      contextHint,
      lines,
      duration,
      createdAt: now,
      updatedAt: now,
      generatedBy: "template",
    };
  }

  /** Generate script with AI */
  private static async generateWithAI(
    participants: any[],
    topic: string,
    location: string,
    contextHint: string | undefined,
    desiredLength: number
  ): Promise<ScriptGenerationResult> {
    const venice = getVeniceClient();

    const participantInfo = participants
      .map((p, i) => `${i + 1}. ${p.name}: ${p.personality}`)
      .join("\n");

    const systemPrompt = `Eres un guionista experto para videojuegos.

Tu tarea es crear un GUIÓN CONVERSACIONAL COMPLETO para un grupo de NPCs en Minecraft.

La conversación debe tener estructura clara:
1. SALUDO (1-2 intercambios): Saludos iniciales naturales
2. INTRODUCCIÓN DEL TEMA (2-3 intercambios): Presentar el tema de conversación
3. DESARROLLO (3-5 intercambios): Explorar el tema con profundidad
4. CONCLUSIÓN (1-2 intercambios): Cerrar el tema elegantemente
5. DESPEDIDA (1-2 intercambios): Despedidas naturales

REGLAS IMPORTANTES:
- Total de ${desiredLength} líneas aproximadamente
- Mensajes cortos y naturales (8-20 palabras)
- Usar personalidad de cada NPC
- Conversación coherente de inicio a fin
- Español coloquial y natural
- Los jugadores deben poder entender la conversación completa si escuchan desde cualquier punto

PARTICIPANTES:
${participantInfo}

UBICACIÓN: ${location}
${contextHint ? `CONTEXTO: ${contextHint}` : ""}
TEMA: ${topic}`;

    const userPrompt = `Genera el guión conversacional completo.

Formato JSON:
{
  "lines": [
    {
      "agentId": "id_del_agente",
      "message": "mensaje corto y natural",
      "phase": "greeting|topic_introduction|development|conclusion|farewell"
    },
    ...
  ]
}`;

    try {
      const response = await venice.generateJSON<{
        lines: Array<{ agentId: string; message: string; phase: ConversationPhase }>;
      }>(systemPrompt, userPrompt, {
        model: RECOMMENDED_MODELS.AMBIENT_DIALOGUE, // Qwen 3 4B
        temperature: 0.85,
      });

      // Enrich with participant information
      const lines: DialogueLine[] = response.lines.map((line: { agentId: string; message: string; phase: ConversationPhase }, index: number) => {
        const participant = participants.find((p) => p.agentId === line.agentId);

        return {
          agentId: line.agentId,
          agentName: participant?.name || "NPC",
          message: line.message,
          phase: line.phase,
          lineNumber: index,
        };
      });

      const totalTokens = 0; // generateJSON doesn't return usage
      const cost = (totalTokens * 0.15) / 1_000_000; // $0.15 por millón tokens

      const now = new Date();
      const script: ConversationScript = {
        scriptId: uuidv4(),
        version: 1, // First version
        participants,
        topic,
        location,
        contextHint,
        lines,
        duration: lines.length * 4, // 4 segundos por línea
        createdAt: now,
        updatedAt: now,
        generatedBy: "ai",
      };

      log.info({
        scriptId: script.scriptId,
        lines: lines.length,
        tokens: totalTokens,
        cost,
      }, "AI script generated");

      return {
        script,
        cached: false,
        cost,
        source: "ai",
      };
    } catch (error) {
      log.error({ error }, "Failed to generate AI script");

      // Fallback: usar template
      const fallbackScript = this.generateFromTemplate(participants, location, contextHint);

      if (fallbackScript) {
        return {
          script: fallbackScript,
          cached: false,
          cost: 0,
          source: "template",
        };
      }

      throw new Error("Failed to generate conversation script");
    }
  }

  /**
   * Generate random topic
   */
  private static generateRandomTopic(_participants: any[]): string {
    const topics = [
      "Today's weather",
      "Plans for the week",
      "Recent events in town",
      "Stories from the past",
      "Pending tasks",
      "Town rumors",
      "This year's harvest",
      "The travelers who passed",
      "Nearby dangers",
      "Upcoming celebration",
    ];

    return topics[Math.floor(Math.random() * topics.length)];
  }

  /** Regenerate existing script with incremented version */
  static async regenerateScript(
    existingScript: ConversationScript,
    options?: Partial<ScriptGenerationOptions>
  ): Promise<ScriptGenerationResult> {
    log.info({
      scriptId: existingScript.scriptId,
      currentVersion: existingScript.version,
    }, "Regenerating script");

    // Generate new script
    const result = await this.generateScript({
      participants: existingScript.participants,
      location: existingScript.location,
      contextHint: existingScript.contextHint,
      topic: existingScript.topic,
      ...options,
      forceAI: options?.forceAI ?? false, // Allow using templates in regeneration
    });

    // Keep the same scriptId but increment version
    result.script.scriptId = existingScript.scriptId;
    result.script.version = existingScript.version + 1;
    result.script.createdAt = existingScript.createdAt; // Maintain original creation date
    result.script.updatedAt = new Date(); // New update date

    // Update cache
    const cacheKey = this.generateCacheKey(
      existingScript.participants,
      existingScript.topic
    );
    this.scriptCache.set(cacheKey, result.script);

    log.info({
      scriptId: result.script.scriptId,
      newVersion: result.script.version,
      source: result.source,
    }, "Script regenerated");

    return result;
  }

  /** Invalidate script (increment version to force update) */
  static invalidateScript(scriptId: string): void {
    // Search for script in cache
    for (const [key, script] of this.scriptCache.entries()) {
      if (script.scriptId === scriptId) {
        script.version++;
        script.updatedAt = new Date();
        log.info({ scriptId, newVersion: script.version }, "Script invalidated");
        return;
      }
    }

    log.warn({ scriptId }, "Script not found for invalidation");
  }

  /** Clear cache */
  static clearCache(): void {
    this.scriptCache.clear();
    log.info("Script cache cleared");
  }

  /** Get cache statistics */
  static getCacheStats() {
    return {
      cachedScripts: this.scriptCache.size,
      templates: CONVERSATION_TEMPLATES.length,
    };
  }
}
