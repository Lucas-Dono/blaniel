/**
 * Role Assigner
 *
 * Asigna roles de escenas a IAs específicas basándose en:
 * - Personalidades
 * - Participación reciente
 * - Relaciones entre IAs
 * - Contexto de la conversación
 */

import type { RoleAssignmentContext, Scene, AIRelation } from "./types";
import { aiRelationService } from "./ai-relation.service";

class RoleAssigner {
  /**
   * Asigna roles de una escena a IAs específicas
   */
  async assignRoles(
    context: RoleAssignmentContext,
    groupId: string
  ): Promise<Record<string, string>> {
    const { scene, aiMembers, recentMessages } = context;
    const roleAssignments: Record<string, string> = {};

    // Load relationships if not in context
    const relations =
      context.activeRelations ||
      (await aiRelationService.getGroupRelations(groupId));

    // Get roles requeridos por la escena
    const roles = scene.participantRoles;

    // Asignar cada rol
    for (const role of roles) {
      const assignedId = await this.selectAgentForRole(
        role,
        scene,
        aiMembers,
        recentMessages,
        relations,
        roleAssignments
      );

      if (assignedId) {
        roleAssignments[role] = assignedId;
      }
    }

    return roleAssignments;
  }

  /**
   * Selecciona el mejor agente para un rol específico
   */
  private async selectAgentForRole(
    role: string,
    scene: Scene,
    aiMembers: RoleAssignmentContext["aiMembers"],
    recentMessages: any[],
    relations: AIRelation[],
    alreadyAssigned: Record<string, string>
  ): Promise<string | null> {
    // Filtrar agentes ya asignados
    const assignedIds = new Set(Object.values(alreadyAssigned));
    const availableAgents = aiMembers.filter((ai) => !assignedIds.has(ai.id));

    if (availableAgents.length === 0) {
      // Si no hay agentes disponibles, permitir reutilizar
      return aiMembers[0]?.id || null;
    }

    // Calcular scores para cada agente
    const scores = availableAgents.map((agent) => ({
      agentId: agent.id,
      score: this.calculateRoleScore(
        agent,
        role,
        scene,
        recentMessages,
        relations,
        alreadyAssigned
      ),
    }));

    // Ordenar por score
    scores.sort((a, b) => b.score - a.score);

    return scores[0]?.agentId || null;
  }

  /**
   * Calcula un score de qué tan bien un agente encaja en un rol
   */
  private calculateRoleScore(
    agent: RoleAssignmentContext["aiMembers"][0],
    role: string,
    scene: Scene,
    recentMessages: any[],
    relations: AIRelation[],
    alreadyAssigned: Record<string, string>
  ): number {
    let score = 0;

    // Factor 1: Protagonist rotation (avoid monopolies)
    if (role.includes("PROTAGONISTA") || role.includes("MAIN")) {
      const turnsSinceProtagonist = agent.lastProtagonistTurn
        ? recentMessages.length - agent.lastProtagonistTurn
        : 999;

      // Penalizar si fue protagonista recientemente
      if (turnsSinceProtagonist < 3) {
        score -= 10;
      } else {
        score += Math.min(turnsSinceProtagonist, 10);
      }
    }

    // Factor 2: Recent participation (give opportunity to the quiet ones)
    // Note: We use recentMessages to estimate participation if not available
    const totalParticipation = recentMessages.length || 1;
    const avgParticipation = totalParticipation / (recentMessages.length ? 5 : 1);

    if (agent.recentParticipation < avgParticipation * 0.5) {
      score += 5; // Bonus para IAs calladas
    } else if (agent.recentParticipation > avgParticipation * 1.5) {
      score -= 5; // Penalty for dominant AIs
    }

    // Factor 3: Personalidad compatible con el rol
    score += this.getPersonalityScore(agent.personality, role, scene);

    // Factor 4: Relaciones con otros agentes ya asignados
    score += this.getRelationScore(
      agent.id,
      alreadyAssigned,
      relations,
      role
    );

    // Factor 5: Relevancia en mensajes recientes
    if (this.wasMentionedRecently(agent.name, recentMessages)) {
      score += 8;
    }

    return score;
  }

  /**
   * Score basado en personalidad
   */
  private getPersonalityScore(
    personality: any,
    role: string,
    scene: Scene
  ): number {
    if (!personality) return 0;

    let score = 0;

    // Mapeo de roles a traits de personalidad
    const rolePersonalityMap: Record<
      string,
      { trait: string; preferred: "high" | "low" }[]
    > = {
      PROTAGONISTA: [
        { trait: "extraversion", preferred: "high" },
        { trait: "openness", preferred: "high" },
      ],
      ANTAGONISTA: [
        { trait: "agreeableness", preferred: "low" },
        { trait: "neuroticism", preferred: "high" },
      ],
      MEDIADOR: [
        { trait: "agreeableness", preferred: "high" },
        { trait: "conscientiousness", preferred: "high" },
      ],
      OBSERVADOR: [
        { trait: "openness", preferred: "high" },
        { trait: "extraversion", preferred: "low" },
      ],
      COMICO: [
        { trait: "extraversion", preferred: "high" },
        { trait: "openness", preferred: "high" },
      ],
      VULNERABLE: [
        { trait: "neuroticism", preferred: "high" },
        { trait: "openness", preferred: "high" },
      ],
    };

    const relevantTraits = rolePersonalityMap[role];
    if (!relevantTraits) return 0;

    for (const { trait, preferred } of relevantTraits) {
      const value = personality[trait];
      if (value !== undefined) {
        if (preferred === "high" && value > 60) {
          score += 3;
        } else if (preferred === "low" && value < 40) {
          score += 3;
        }
      }
    }

    // Bonus for scene category
    if (scene.category === "HUMOR" && role.includes("COMICO")) {
      score += 5;
    } else if (scene.category === "TENSION" && role.includes("ANTAGONISTA")) {
      score += 5;
    } else if (
      scene.category === "VULNERABILIDAD" &&
      role.includes("VULNERABLE")
    ) {
      score += 5;
    }

    return score;
  }

  /**
   * Score basado en relaciones con agentes ya asignados
   */
  private getRelationScore(
    agentId: string,
    alreadyAssigned: Record<string, string>,
    relations: AIRelation[],
    role: string
  ): number {
    let score = 0;

    for (const [otherRole, otherAgentId] of Object.entries(alreadyAssigned)) {
      // Search for relationship between agentId and otherAgentId
      const relation = relations.find(
        (r) =>
          (r.agentAId === agentId && r.agentBId === otherAgentId) ||
          (r.agentAId === otherAgentId && r.agentBId === agentId)
      );

      if (!relation) continue;

      // Si es ANTAGONISTA y el otro es PROTAGONISTA, preferir rivales
      if (
        role.includes("ANTAGONISTA") &&
        otherRole.includes("PROTAGONISTA")
      ) {
        if (relation.affinity < -3) {
          score += 7; // Buena rivalidad
        } else if (relation.affinity > 5) {
          score -= 5; // Amigos no pelean
        }
      }

      // Si es ALIADO y el otro es PROTAGONISTA, preferir amigos
      if (role.includes("ALIADO") && otherRole.includes("PROTAGONISTA")) {
        if (relation.affinity > 5) {
          score += 7; // Buenos amigos
        } else if (relation.affinity < -3) {
          score -= 5; // Rivales no se apoyan
        }
      }

      // Romantic roles prefer chemistry
      if (
        (role.includes("ROMANTIC") || role.includes("LOVE")) &&
        otherRole.includes("PROTAGONISTA")
      ) {
        if (relation.affinity > 6 && relation.tensionLevel < 0.3) {
          score += 10; // Good romantic chemistry
        }
      }
    }

    return score;
  }

  /**
   * Verifica si un agente fue mencionado recientemente
   */
  private wasMentionedRecently(
    agentName: string,
    recentMessages: any[]
  ): boolean {
    const lastFive = recentMessages.slice(-5);
    return lastFive.some((msg) =>
      msg.content?.toLowerCase().includes(agentName.toLowerCase())
    );
  }

  /**
   * Asigna un rol específico a un agente específico (override manual)
   */
  assignSpecificRole(
    role: string,
    agentId: string,
    currentAssignments: Record<string, string>
  ): Record<string, string> {
    return {
      ...currentAssignments,
      [role]: agentId,
    };
  }

  /**
   * Valida que todos los roles requeridos estén asignados
   */
  validateAssignments(
    roles: string[],
    assignments: Record<string, string>
  ): { valid: boolean; missingRoles: string[] } {
    const missingRoles = roles.filter((role) => !assignments[role]);

    return {
      valid: missingRoles.length === 0,
      missingRoles,
    };
  }
}

// Singleton
export const roleAssigner = new RoleAssigner();
