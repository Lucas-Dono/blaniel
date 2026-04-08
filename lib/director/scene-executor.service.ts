/**
 * Scene Executor Service
 *
 * Orquesta la ejecución de escenas:
 * - Prepara planes de ejecución
 * - Resuelve variables en directivas
 * - Procesa consecuencias (semillas, relaciones)
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import type {
  SceneExecutionPlan,
  Scene,
  SceneIntervention,
} from "./types";
import { sceneCatalogService } from "./scene-catalog.service";
import { tensionSeedService } from "./tension-seed.service";
import { aiRelationService } from "./ai-relation.service";

class SceneExecutorService {
  /**
   * Prepara el plan de ejecución de una escena
   */
  async preparePlan(
    sceneCode: string,
    roleAssignments: Record<string, string>,
    groupContext: {
      groupId: string;
      members: any[];
    }
  ): Promise<SceneExecutionPlan | null> {
    try {
      // 1. Cargar escena
      const scene = await sceneCatalogService.getByCode(sceneCode);
      if (!scene) {
        console.error(`[SceneExecutor] Escena ${sceneCode} no encontrada`);
        return null;
      }

      // 2. Resolver variables en directivas
      const interventionSequence = scene.interventionSequence as SceneIntervention[];

      const interventions = interventionSequence.map((int, index) => {
        const agentId = roleAssignments[int.role];

        if (!agentId) {
          console.warn(
            `[SceneExecutor] Rol ${int.role} no asignado en escena ${sceneCode}`
          );
        }

        const directive = this.resolveVariables(
          int.directive,
          roleAssignments,
          groupContext.members
        );

        return {
          step: index,
          agentId: agentId || "",
          role: int.role,
          directive,
          delay: int.delay || 0,
          targetAgentIds: int.targetRole
            ? [roleAssignments[int.targetRole]].filter(Boolean)
            : undefined,
          emotionalTone: int.emotionalTone,
        };
      });

      console.log(
        `[SceneExecutor] Plan preparado para ${sceneCode}: ${interventions.length} pasos`
      );

      return {
        scene,
        roleAssignments,
        interventions,
      };
    } catch (error) {
      console.error("[SceneExecutor] Error preparando plan:", error);
      return null;
    }
  }

  /**
   * Resuelve variables en una directiva
   * Ejemplo: "{{PROTAGONISTA}} debe expresar sorpresa" -> "Alice debe expresar sorpresa"
   */
  private resolveVariables(
    directive: string,
    roleAssignments: Record<string, string>,
    members: any[]
  ): string {
    let resolved = directive;

    // Reemplazar roles con nombres de agentes
    for (const [role, agentId] of Object.entries(roleAssignments)) {
      const agent = members.find((m) => m.agentId === agentId || m.agent?.id === agentId);
      const agentName = agent?.agent?.name || agentId;

      // Reemplazar {{ROLE}} con nombre
      resolved = resolved.replace(
        new RegExp(`\\{\\{${role}\\}\\}`, "g"),
        agentName
      );
    }

    return resolved;
  }

  /**
   * Obtiene la siguiente intervención en la secuencia
   */
  async executeNextStep(
    groupId: string,
    plan: SceneExecutionPlan,
    currentStep: number
  ): Promise<{
    nextAgentId: string;
    directive: string;
    isLastStep: boolean;
    emotionalTone?: string;
  } | null> {
    const intervention = plan.interventions[currentStep];
    if (!intervention) {
      console.warn(
        `[SceneExecutor] No hay intervención en paso ${currentStep}`
      );
      return null;
    }

    return {
      nextAgentId: intervention.agentId,
      directive: intervention.directive,
      isLastStep: currentStep === plan.interventions.length - 1,
      emotionalTone: intervention.emotionalTone,
    };
  }

  /**
   * Procesa las consecuencias de una escena completada
   */
  async processConsequences(
    groupId: string,
    scene: Scene,
    roleAssignments: Record<string, string>
  ): Promise<void> {
    try {
      const consequences = scene.consequences;

      if (!consequences) {
        console.log(
          `[SceneExecutor] Escena ${scene.code} sin consecuencias`
        );
        return;
      }

      // 1. Create tension seeds
      if (consequences.seeds && consequences.seeds.length > 0) {
        for (const seed of consequences.seeds) {
          // Resolver roles a IDs de agentes
          const involvedAgents = seed.involvedRoles
            .map((role) => roleAssignments[role])
            .filter(Boolean);

          if (involvedAgents.length > 0) {
            await tensionSeedService.create({
              groupId,
              type: seed.type,
              title: this.resolveVariables(
                seed.title,
                roleAssignments,
                [] // We don't need members here
              ),
              content: this.resolveVariables(
                seed.content,
                roleAssignments,
                []
              ),
              involvedAgents,
              latencyTurns: seed.latencyTurns || 5,
            });

            console.log(
              `[SceneExecutor] Semilla creada: ${seed.title}`
            );
          }
        }
      }

      // 2. Actualizar relaciones IA-IA
      if (consequences.relations && consequences.relations.length > 0) {
        for (const rel of consequences.relations) {
          const agentAId = roleAssignments[rel.roleA];
          const agentBId = roleAssignments[rel.roleB];

          if (agentAId && agentBId && agentAId !== agentBId) {
            await aiRelationService.updateRelation(
              groupId,
              agentAId,
              agentBId,
              {
                affinityChange: rel.affinityChange,
                dynamicToAdd: rel.dynamicToAdd,
              }
            );

            console.log(
              `[SceneExecutor] Relación actualizada: ${agentAId} <-> ${agentBId}`
            );
          }
        }
      }

      // 3. Aplicar efectos especiales (si los hay)
      if (consequences.effects && consequences.effects.length > 0) {
        for (const effect of consequences.effects) {
          await this.applyEffect(groupId, effect, roleAssignments);
        }
      }

      console.log(
        `[SceneExecutor] Consecuencias procesadas para ${scene.code}`
      );
    } catch (error) {
      console.error("[SceneExecutor] Error procesando consecuencias:", error);
    }
  }

  /**
   * Aplica un efecto especial
   */
  private async applyEffect(
    groupId: string,
    effect: { type: string; target: string; value: any },
    roleAssignments: Record<string, string>
  ): Promise<void> {
    try {
      switch (effect.type) {
        case "adjust_tension":
          // Adjust tension between two AIs
          const [roleA, roleB] = effect.target.split(",");
          const agentAId = roleAssignments[roleA];
          const agentBId = roleAssignments[roleB];

          if (agentAId && agentBId) {
            await aiRelationService.adjustTension(
              groupId,
              agentAId,
              agentBId,
              effect.value
            );
          }
          break;

        case "escalate_seed":
          // Escalar una semilla existente
          const seeds = await tensionSeedService.getActive(groupId);
          if (seeds.length > 0) {
            await tensionSeedService.escalate(seeds[0].id, "Escalado por escena");
          }
          break;

        case "resolve_seed":
          // Resolve a specific seed
          const targetSeeds = await tensionSeedService.getByType(
            groupId,
            effect.target
          );
          if (targetSeeds.length > 0) {
            await tensionSeedService.resolve(
              targetSeeds[0].id,
              effect.value,
              "natural"
            );
          }
          break;

        default:
          console.warn(
            `[SceneExecutor] Efecto desconocido: ${effect.type}`
          );
      }
    } catch (error) {
      console.error("[SceneExecutor] Error aplicando efecto:", error);
    }
  }

  /**
   * Registra la ejecución de una escena para analytics
   */
  async recordExecution(
    groupId: string,
    scene: Scene,
    completed: boolean,
    completedSteps: number,
    participantAgents: string[],
    triggerMessageId?: string,
    triggerUserId?: string
  ): Promise<void> {
    try {
      await prisma.sceneExecution.create({
        data: {
          id: nanoid(),
          groupId,
          sceneId: scene.id,
          sceneCode: scene.code,
          triggerMessageId,
          triggerUserId,
          completed,
          completedSteps,
          totalSteps: scene.interventionSequence.length,
          participantAgents,
          userMessages: 0, // Will be updated later if needed
        },
      });

      console.log(
        `[SceneExecutor] Ejecución registrada: ${scene.code} (${completed ? "completada" : "incompleta"})`
      );
    } catch (error) {
      console.error("[SceneExecutor] Error registrando ejecución:", error);
    }
  }

  /**
   * Cancela una escena en progreso
   */
  async cancelScene(groupId: string, reason: string): Promise<void> {
    try {
      const sceneState = await prisma.groupSceneState.findUnique({
        where: { groupId },
      });

      if (!sceneState || !sceneState.currentSceneCode) {
        return;
      }

      console.log(
        `[SceneExecutor] Cancelando escena ${sceneState.currentSceneCode}: ${reason}`
      );

      await prisma.groupSceneState.update({
        where: { groupId },
        data: {
          currentSceneId: null,
          currentSceneCode: null,
          currentStep: 0,
          totalSteps: 0,
        },
      });
    } catch (error) {
      console.error("[SceneExecutor] Error cancelando escena:", error);
    }
  }

  /**
   * Verifica si una escena está en progreso
   */
  async isSceneInProgress(groupId: string): Promise<boolean> {
    try {
      const sceneState = await prisma.groupSceneState.findUnique({
        where: { groupId },
      });

      return !!(sceneState && sceneState.currentSceneCode);
    } catch (error) {
      console.error(
        "[SceneExecutor] Error verificando escena en progreso:",
        error
      );
      return false;
    }
  }

  /**
   * Obtiene el estado actual de la escena
   */
  async getCurrentScene(groupId: string): Promise<{
    sceneCode: string;
    currentStep: number;
    totalSteps: number;
  } | null> {
    try {
      const sceneState = await prisma.groupSceneState.findUnique({
        where: { groupId },
      });

      if (!sceneState || !sceneState.currentSceneCode) {
        return null;
      }

      return {
        sceneCode: sceneState.currentSceneCode,
        currentStep: sceneState.currentStep,
        totalSteps: sceneState.totalSteps,
      };
    } catch (error) {
      console.error("[SceneExecutor] Error obteniendo escena actual:", error);
      return null;
    }
  }
}

// Singleton
export const sceneExecutorService = new SceneExecutorService();
