/**
 * Group Disposition Service
 * 
 * Calculates the "disposition" of each AI to reply to a message,
 * based on the existing relationship between the user who wrote
 * and each AI in the group.
 * 
 * The score is calculated using:
 * - Direct mentions (@name)
 * - Relation data: trust, affinity, respect, stage
 * - SymbolicBond data: emotionalResonance, status
 * - Personality: extraversion
 * - Recent participation balance
 */

import { prisma } from "@/lib/prisma";
import { checkAvailability } from "@/lib/chat/availability-system";

export interface DispositionInput {
  agentId: string;
  userId: string;
  groupId: string;
  messageContent: string;
  mentionedAgents: string[];
}

export interface DispositionBreakdown {
  mention: number;           // +100 si mencionado
  affinity: number;          // 0-30 basado en Relation.affinity
  trust: number;             // 0-25 basado en Relation.trust
  respect: number;           // 0-15 basado en Relation.respect
  stage: number;             // 0-20 basado en stage
  emotionalResonance: number; // 0-15 basado en SymbolicBond
  bondStatus: number;        // 0-10 (active=10, dormant=5, fragile=2, at_risk=0)
  personality: number;       // 0-10 extraversion
  recency: number;           // 0-10 participation balance
  randomness: number;        // 0-5
  availability: number;      // -1000 a 0
}

export interface DispositionScore {
  agentId: string;
  agentName: string;
  score: number;
  breakdown: DispositionBreakdown;
  reasons: string[];
}

// Mapeo de stage a puntos
const STAGE_SCORES: Record<string, number> = {
  stranger: 0,
  acquaintance: 5,
  friend: 10,
  close: 15,
  intimate: 20,
};

// Mapeo de bond status a puntos
const BOND_STATUS_SCORES: Record<string, number> = {
  active: 10,
  dormant: 5,
  fragile: 2,
  at_risk: 0,
};

class GroupDispositionService {
  /** Calculate disposition score for a specific AI */
  async calculateScore(input: DispositionInput): Promise<DispositionScore> {
    const { agentId, userId, groupId, messageContent, mentionedAgents } = input;

    const breakdown: DispositionBreakdown = {
      mention: 0,
      affinity: 0,
      trust: 0,
      respect: 0,
      stage: 0,
      emotionalResonance: 0,
      bondStatus: 0,
      personality: 0,
      recency: 0,
      randomness: 0,
      availability: 0,
    };
    const reasons: string[] = [];

    // Cargar datos en paralelo
    const [agent, relation, bond, recentParticipation] = await Promise.all([
      prisma.agent.findUnique({
        where: { id: agentId },
        select: {
          id: true,
          name: true,
          PersonalityCore: {
            select: {
              extraversion: true,
              agreeableness: true,
            },
          },
        },
      }),
      prisma.relation.findFirst({
        where: {
          subjectId: agentId,
          targetId: userId,
          targetType: "user",
        },
        select: {
          trust: true,
          affinity: true,
          respect: true,
          stage: true,
        },
      }),
      prisma.symbolicBond.findFirst({
        where: {
          agentId,
          userId,
        },
        select: {
          emotionalResonance: true,
          status: true,
          affinityLevel: true,
        },
      }),
      this.getRecentParticipation(groupId, agentId),
    ]);

    if (!agent) {
      return {
        agentId,
        agentName: "Unknown",
        score: 0,
        breakdown,
        reasons: ["agent_not_found"],
      };
    }

    // Verificar disponibilidad del agente
    const availabilityStatus = await checkAvailability(agentId, relation?.stage ?? "stranger");

    // Calculate availability penalty
    if (!availabilityStatus.available && !availabilityStatus.canRespondSpaced) {
      // Completamente bloqueado
      breakdown.availability = -1000;
      reasons.push(`no disponible (${availabilityStatus.reason || 'ocupado'})`);
    } else if (availabilityStatus.canRespondSpaced && !availabilityStatus.available) {
      // Esperando ventana de respuesta espaciada
      breakdown.availability = -500;
      reasons.push("esperando ventana de respuesta");
    } else {
      breakdown.availability = 0; // Disponible
    }

    // 1. Direct mentions (highest priority)
    if (mentionedAgents.includes(agentId)) {
      breakdown.mention = 100;
      reasons.push("mencionado directamente");
    }

    // 2. Affinity (0-30 puntos)
    const affinity = relation?.affinity ?? 0.5;
    breakdown.affinity = affinity * 30;
    if (affinity > 0.7) {
      reasons.push("alta afinidad");
    }

    // 3. Trust (0-25 puntos)
    const trust = relation?.trust ?? 0.5;
    breakdown.trust = trust * 25;
    if (trust > 0.7) {
      reasons.push("alta confianza");
    }

    // 4. Respect (0-15 puntos)
    const respect = relation?.respect ?? 0.5;
    breakdown.respect = respect * 15;

    // 5. Stage bonus (0-20 puntos)
    const stage = relation?.stage ?? "stranger";
    breakdown.stage = STAGE_SCORES[stage] ?? 0;
    if (stage === "intimate" || stage === "close") {
      reasons.push(`relación ${stage}`);
    }

    // 6. Emotional resonance from SymbolicBond (0-15 puntos)
    if (bond) {
      breakdown.emotionalResonance = (bond.emotionalResonance ?? 0) * 15;
      if (bond.emotionalResonance && bond.emotionalResonance > 0.6) {
        reasons.push("alta resonancia emocional");
      }

      // 7. Bond status (0-10 puntos)
      breakdown.bondStatus = BOND_STATUS_SCORES[bond.status ?? "active"] ?? 10;
      if (bond.status === "at_risk" || bond.status === "fragile") {
        reasons.push("bond en riesgo");
      }
    } else {
      // No bond, use default values
      breakdown.bondStatus = 5; // Neutral
    }

    // 8. Personality - Extraversion (0-10 points)
    const extraversion = agent.PersonalityCore?.extraversion ?? 50;
    breakdown.personality = (extraversion / 100) * 10;
    if (extraversion > 70) {
      reasons.push("personalidad extrovertida");
    }

    // 9. Balance of recent participation (0-10 points)
    // Less recent participation = higher probability
    const participationScore = Math.max(0, 10 - recentParticipation * 2);
    breakdown.recency = participationScore;
    if (recentParticipation === 0) {
      reasons.push("no ha participado recientemente");
    }

    // 10. Randomness (0-5 puntos)
    breakdown.randomness = Math.random() * 5;

    // Calcular score total
    const score = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    return {
      agentId,
      agentName: agent.name,
      score,
      breakdown,
      reasons,
    };
  }

  /** Calculate scores for all AIs in a group */
  async calculateGroupScores(
    groupId: string,
    triggeredByUserId: string,
    messageContent: string,
    mentionedAgents: string[] = []
  ): Promise<DispositionScore[]> {
    // Get all active AIs from the group
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        memberType: "agent",
        isActive: true,
      },
      select: {
        agentId: true,
      },
    });

    // Calcular scores en paralelo
    const scorePromises = members
      .filter((m) => m.agentId !== null)
      .map((member) =>
        this.calculateScore({
          agentId: member.agentId!,
          userId: triggeredByUserId,
          groupId,
          messageContent,
          mentionedAgents,
        })
      );

    const scores = await Promise.all(scorePromises);

    // Ordenar por score descendente
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Select which AIs will respond based on the scores
   * 
   * Logic:
   * - If there is a direct mention, that AI always responds
   * - Probability: 60% one AI, 30% two AIs, 10% three AIs
   * - If scores are very close (< 5 points), both can respond
   */
  selectRespondingAIs(scores: DispositionScore[]): DispositionScore[] {
    if (scores.length === 0) {
      return [];
    }

    // Separar mencionados de no mencionados
    const mentioned = scores.filter((s) => s.breakdown.mention > 0);
    const notMentioned = scores.filter((s) => s.breakdown.mention === 0);

    // Los mencionados siempre responden
    const responding: DispositionScore[] = [...mentioned];

    // Determine how many additional AIs will respond
    const random = Math.random();
    let additionalCount = 0;

    if (mentioned.length === 0) {
      // Sin menciones: 60% una, 30% dos, 10% tres
      if (random < 0.6) additionalCount = 1;
      else if (random < 0.9) additionalCount = 2;
      else additionalCount = 3;
    } else {
      // Con menciones: 70% solo mencionado, 25% +1, 5% +2
      if (random < 0.7) additionalCount = 0;
      else if (random < 0.95) additionalCount = 1;
      else additionalCount = 2;
    }

    // Add unmentioned AIs based on the count
    const toAdd = notMentioned.slice(0, additionalCount);
    responding.push(...toAdd);

    // Si hay empate cercano (< 5 puntos) entre top 2, ambas responden
    if (
      notMentioned.length >= 2 &&
      Math.abs(notMentioned[0].score - notMentioned[1].score) < 5
    ) {
      if (!responding.includes(notMentioned[0])) {
        responding.push(notMentioned[0]);
      }
      if (!responding.includes(notMentioned[1])) {
        responding.push(notMentioned[1]);
      }
    }

    // Limit to a maximum of 3 AIs responding
    return responding.slice(0, 3);
  }

  /**
   * Get recent participation of an AI in a group
   * Returns the number of messages in the last 10 minutes
   */
  private async getRecentParticipation(
    groupId: string,
    agentId: string
  ): Promise<number> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const count = await prisma.groupMessage.count({
      where: {
        groupId,
        agentId,
        createdAt: {
          gte: tenMinutesAgo,
        },
      },
    });

    return count;
  }
}

// Export singleton instance
export const groupDispositionService = new GroupDispositionService();
