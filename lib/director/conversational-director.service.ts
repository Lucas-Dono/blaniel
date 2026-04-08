/**
 * Conversational Director Service
 * 
 * System core: selects the most appropriate scene for the current context
 * using a lightweight model (Qwen 3 4B via Venice API).
 */

import { getVeniceClient } from "@/lib/emotional-system/llm/venice";
import { SceneCategory } from "@prisma/client";
import type {
  DirectorInput,
  DirectorOutput,
  Scene,
  LoopPattern,
  DirectorPromptContext,
} from "./types";
import { sceneCatalogService } from "./scene-catalog.service";
import { roleAssigner } from "./role-assigner";
import { loopDetectorService } from "./loop-detector.service";

class ConversationalDirectorService {
  private veniceClient = getVeniceClient();

  // Modelo configurado desde .env
  private readonly DIRECTOR_MODEL =
    process.env.DIRECTOR_MODEL || "qwen-turbo";

  /** Selects the most appropriate scene for the current context */
  async selectScene(input: DirectorInput): Promise<DirectorOutput> {
    try {
      const { groupId, bufferedMessages, groupContext, sceneState } = input;

      // 1. Pre-filtrar escenas candidatas
      const candidates = await this.getCandidateScenes(input);

      if (candidates.length === 0) {
        console.log("[Director] No hay escenas candidatas disponibles");
        return {
          sceneCode: null,
          roleAssignments: {},
          reason: "no_candidates",
        };
      }

      // 2. Build optimized prompt for quick decision
      const prompt = this.buildDirectorPrompt(
        groupContext,
        bufferedMessages,
        candidates,
        input.detectedLoops || [],
        input.activeSeedsCount
      );

      // 3. Llamar al modelo ligero
      const response = await this.callDirectorModel(prompt);

      // 4. Parse response (scene code only)
      const sceneCode = this.parseSceneCode(response);

      if (!sceneCode || sceneCode === "NONE") {
        console.log("[Director] Decidió no usar escena");
        return {
          sceneCode: null,
          roleAssignments: {},
          reason: "director_chose_none",
        };
      }

      // 5. Verificar que la escena existe
      const selectedScene = candidates.find((s) => s.code === sceneCode);
      if (!selectedScene) {
        console.warn(`[Director] Escena ${sceneCode} no encontrada en candidatas`);
        return {
          sceneCode: null,
          roleAssignments: {},
          reason: "scene_not_found",
        };
      }

      // 6. Asignar roles
      const roleAssignments = await this.assignRoles(
        selectedScene,
        groupContext,
        groupId
      );

      console.log(
        `[Director] Escena seleccionada: ${sceneCode} con ${Object.keys(roleAssignments).length} roles`
      );

      return {
        sceneCode,
        roleAssignments,
        reason: "scene_selected",
      };
    } catch (error) {
      console.error("[Director] Error en selección de escena:", error);
      return {
        sceneCode: null,
        roleAssignments: {},
        reason: "error",
      };
    }
  }

  /** Pre-filters scenes based on rules and context */
  private async getCandidateScenes(
    input: DirectorInput
  ): Promise<Scene[]> {
    const { sceneState, groupContext, activeSeedsCount, detectedLoops } = input;

    // Rule 1: Rest between dramatic scenes
    const dramaticCategories: SceneCategory[] = ["TENSION", "VULNERABILIDAD"];
    let needsDramaRest = false;

    if (sceneState?.lastDramaticScene) {
      const timeSinceDrama =
        Date.now() - sceneState.lastDramaticScene.getTime();
      const minutesSinceDrama = timeSinceDrama / (60 * 1000);
      needsDramaRest = minutesSinceDrama < 10; // 10 minutos de descanso
    }

    // Regla 2: No repetir escenas recientes
    const recentSceneCodes = sceneState?.recentScenes?.slice(-5) || [];

    // Regla 3: Limitar semillas activas
    const canCreateSeeds = activeSeedsCount < 5;

    // Regla 4: Priorizar escenas que rompan loops detectados
    let preferredCategories: SceneCategory[] | undefined;
    if (detectedLoops && detectedLoops.length > 0) {
      const correctiveAction = loopDetectorService.getCorrectiveAction(
        detectedLoops[0]
      );
      preferredCategories = correctiveAction.suggestedCategories;
    }

    // Query catalog with filters
    const candidates = await sceneCatalogService.findCandidates({
      excludeCategories: needsDramaRest ? dramaticCategories : [],
      excludeCodes: recentSceneCodes,
      energyRange: {
        min: Math.max(0, groupContext.currentEnergy - 0.3),
        max: Math.min(1, groupContext.currentEnergy + 0.3),
      },
      canCreateSeeds,
      minAIs: groupContext.aiMembers.length,
      maxAIs: groupContext.aiMembers.length,
      preferredCategories,
    });

    // Limit to top 10 for LLM decision
    return candidates.slice(0, 10);
  }

  /** Builds optimized prompt for quick decision */
  private buildDirectorPrompt(
    groupContext: DirectorInput["groupContext"],
    bufferedMessages: DirectorInput["bufferedMessages"],
    candidates: Scene[],
    detectedLoops: LoopPattern[],
    activeSeedsCount: number
  ): string {
    const aiNames = groupContext.aiMembers.map((ai) => ai.name).join(", ");

    let prompt = `DIRECTOR CONVERSACIONAL
=======================

ESTADO ACTUAL:
- IAs: ${aiNames}
- Energía: ${Math.round(groupContext.currentEnergy * 100)}%
- Tensión: ${Math.round(groupContext.currentTension * 100)}%
- Balance: ${Math.round(groupContext.participationBalance * 100)}%
- Semillas activas: ${activeSeedsCount}
`;

    // Agregar loops detectados si existen
    if (detectedLoops.length > 0) {
      prompt += `\nLOOPS DETECTADOS:\n`;
      for (const loop of detectedLoops.slice(0, 2)) {
        prompt += `- ${loop.type}: ${loop.count}/${loop.threshold}\n`;
      }
      prompt += "\n";
    }

    // Last messages (summarized)
    prompt += `\nÚLTIMOS MENSAJES:\n`;
    const lastMessages = bufferedMessages.slice(-5);
    for (const msg of lastMessages) {
      const content =
        msg.content.length > 60
          ? msg.content.substring(0, 57) + "..."
          : msg.content;
      prompt += `${msg.userName}: ${content}\n`;
    }

    // Lista de escenas candidatas
    prompt += `\nESCENAS DISPONIBLES:\n`;
    for (const scene of candidates) {
      const desc =
        scene.description.length > 60
          ? scene.description.substring(0, 57) + "..."
          : scene.description;
      prompt += `${scene.code}: ${scene.name} - ${desc}\n`;
    }

    // Final instruction
    prompt += `
REGLAS:
1. Prioriza romper loops si fueron detectados
2. Respeta el descanso entre escenas dramáticas
3. Considera semillas activas para continuidad
4. Elige NONE si la conversación fluye bien naturalmente

RESPUESTA: Solo el código (ej: COT_001) o NONE`;

    return prompt;
  }

  /** Calls the lightweight model for decision */
  private async callDirectorModel(prompt: string): Promise<string> {
    try {
      // Agregar /no_think para Qwen 3 modelos
      const promptWithNoThink = `/no_think\n\n${prompt}`;

      const response = await this.veniceClient.generate({
        prompt: promptWithNoThink,
        model: this.DIRECTOR_MODEL,
        temperature: 0.3, // Baja temperatura para decisiones consistentes
        maxTokens: 50, // Aumentado para dar margen sin razonamiento interno
      });

      const responseText = typeof response === 'string' ? response : (response as any).text || (response as any).content || '';

      // Post-procesamiento: Limpiar etiquetas <think> y normalizar espacios
      let cleanedResponse = responseText.trim();

      // Remove blocks ... (empty or with content)
      cleanedResponse = cleanedResponse.replace(/<think>[\s\S]*?<\/think>/gi, '');

      // Remove multiple line breaks and replace with space
      cleanedResponse = cleanedResponse.replace(/\n+/g, ' ');

      // Remove multiple spaces
      cleanedResponse = cleanedResponse.replace(/\s+/g, ' ');

      // Trim final
      cleanedResponse = cleanedResponse.trim();

      return cleanedResponse;
    } catch (error) {
      console.error("[Director] Error llamando modelo:", error);
      return "NONE";
    }
  }

  /** Parses the scene code from the model response */
  private parseSceneCode(response: string): string | null {
    // Search for pattern XXX_NNN (e.g., COT_001, HUM_042)
    const match = response.match(/([A-Z]{3,10}_\d{3})/);

    if (match) {
      return match[1];
    }

    // If it explicitly says NONE
    if (response.toUpperCase().includes("NONE")) {
      return "NONE";
    }

    // Si no se puede parsear, retornar null
    console.warn(`[Director] No se pudo parsear código de escena: ${response}`);
    return null;
  }

  /** Assigns roles to AIs based on the selected scene */
  private async assignRoles(
    scene: Scene,
    groupContext: DirectorInput["groupContext"],
    groupId: string
  ): Promise<Record<string, string>> {
    try {
      // Preparar contexto para el role assigner
      const aiMembersWithContext = groupContext.aiMembers.map((ai) => {
        const recentParticipation = groupContext.recentMessages
          .slice(-10)
          .filter((m) => m.agentId === ai.id).length;

        return {
          ...ai,
          recentParticipation,
          lastProtagonistTurn: undefined, // TODO: trackear esto si es necesario
        };
      });

      const roleContext = {
        aiMembers: aiMembersWithContext,
        scene,
        recentMessages: groupContext.recentMessages,
      };

      const assignments = await roleAssigner.assignRoles(
        roleContext,
        groupId
      );

      return assignments;
    } catch (error) {
      console.error("[Director] Error asignando roles:", error);
      return {};
    }
  }

  /** Evaluates if it should interrupt a scene in progress */
  shouldInterruptScene(
    currentScene: string,
    newMessage: string,
    userIsMentioningAgent: boolean
  ): boolean {
    // Interrumpir si el usuario menciona directamente a un agente
    if (userIsMentioningAgent) {
      return true;
    }

    // Interrumpir si el mensaje es urgente (detectar palabras clave)
    const urgentKeywords = [
      "ayuda",
      "urgente",
      "ahora",
      "inmediatamente",
      "rápido",
      "ya",
    ];
    const isUrgent = urgentKeywords.some((kw) =>
      newMessage.toLowerCase().includes(kw)
    );

    return isUrgent;
  }
}

// Singleton
export const conversationalDirectorService =
  new ConversationalDirectorService();
