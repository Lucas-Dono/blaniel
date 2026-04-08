import { prisma } from "@/lib/prisma";



/**
 * Group AI Director Service
 * 
 * Coordinates the group narrative in real time:
 * - Analyzes conversations
 * - Suggests narrative adjustments
 * - Balances participation
 * - Manages pace and tension
 */

interface DirectorAnalysis {
  participationBalance: number; // 0-1 (1 = perfectamente balanceado)
  conversationEnergy: number; // 0-1
  narrativeTension: number; // 0-1
  recommendedActions: DirectorAction[];
}

interface DirectorAction {
  type:
    | "encourage_quiet_ai"
    | "cool_down_dominant_ai"
    | "introduce_conflict"
    | "resolve_tension"
    | "shift_focus"
    | "advance_story";
  target?: string; // AI ID
  reason: string;
  priority: number; // 0-10
}

export class GroupAIDirectorService {
  /**
   * Analyze current group state and suggest actions
   */
  async analyzeGroup(groupId: string): Promise<DirectorAnalysis> {
    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          GroupMember: {
            where: { isActive: true, memberType: "agent" },
            include: {
              Agent: {
                select: {
                  id: true,
                  name: true,
                  PersonalityCore: true,
                },
              },
            },
          },
        },
      });

      if (!group || !group.directorEnabled) {
        throw new Error("Director not enabled for this group");
      }

      // Get recent activity (last 30 minutes)
      const recentCutoff = new Date(Date.now() - 30 * 60 * 1000);

      const recentMessages = await prisma.groupMessage.findMany({
        where: {
          groupId,
          createdAt: { gte: recentCutoff },
          isSystemMessage: false,
        },
        include: {
          Agent: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      // Calculate participation balance
      const participationBalance =
        this.calculateParticipationBalance(recentMessages);

      // Analyze conversation energy
      const conversationEnergy =
        this.analyzeConversationEnergy(recentMessages);

      // Calculate narrative tension
      const narrativeTension = await this.calculateNarrativeTension(
        group,
        recentMessages
      );

      // Generate recommended actions
      const recommendedActions = await this.generateRecommendedActions(
        group,
        recentMessages,
        { participationBalance, conversationEnergy, narrativeTension }
      );

      return {
        participationBalance,
        conversationEnergy,
        narrativeTension,
        recommendedActions,
      };
    } catch (error) {
      console.error("Error analyzing group:", error);
      throw error;
    }
  }

  /**
   * Apply director actions to influence AI behavior
   */
  async applyDirectorInfluence(groupId: string, action: DirectorAction) {
    try {
      switch (action.type) {
        case "encourage_quiet_ai":
          await this.encourageAI(groupId, action.target!);
          break;

        case "cool_down_dominant_ai":
          await this.coolDownAI(groupId, action.target!);
          break;

        case "introduce_conflict":
          await this.introduceConflict(groupId);
          break;

        case "resolve_tension":
          await this.resolveTension(groupId);
          break;

        case "shift_focus":
          await this.shiftFocus(groupId, action.target);
          break;

        case "advance_story":
          await this.advanceStory(groupId);
          break;
      }

      console.log(`Director action applied: ${action.type}`);
    } catch (error) {
      console.error("Error applying director influence:", error);
      throw error;
    }
  }

  /**
   * Calculate participation balance (0-1)
   */
  private calculateParticipationBalance(messages: any[]): number {
    if (messages.length === 0) return 1;

    // Count messages per AI
    const messageCounts = new Map<string, number>();
    let totalAIMessages = 0;

    messages.forEach((msg) => {
      if (msg.authorType === "agent" && msg.Agent?.id) {
        const count = messageCounts.get(msg.Agent.id) || 0;
        messageCounts.set(msg.Agent.id, count + 1);
        totalAIMessages++;
      }
    });

    if (messageCounts.size === 0) return 1;

    // Calculate standard deviation
    const avgMessages = totalAIMessages / messageCounts.size;
    const variance =
      Array.from(messageCounts.values()).reduce(
        (sum, count) => sum + Math.pow(count - avgMessages, 2),
        0
      ) / messageCounts.size;

    const stdDev = Math.sqrt(variance);

    // Normalize to 0-1 (0 = very unbalanced, 1 = perfectly balanced)
    // Using exponential decay based on coefficient of variation
    const coefficientOfVariation = stdDev / (avgMessages || 1);
    return Math.exp(-coefficientOfVariation);
  }

  /**
   * Analyze conversation energy (0-1)
   */
  private analyzeConversationEnergy(messages: any[]): number {
    if (messages.length === 0) return 0;

    // Recent messages have more weight
    let energyScore = 0;
    const now = Date.now();

    messages.forEach((msg, _index) => {
      const ageMinutes =
        (now - new Date(msg.createdAt).getTime()) / (1000 * 60);
      const recencyWeight = Math.exp(-0.1 * ageMinutes); // Exponential decay

      // Message length contributes to energy
      const lengthScore = Math.min(msg.content.length / 200, 1);

      energyScore += lengthScore * recencyWeight;
    });

    return Math.min(energyScore / messages.length, 1);
  }

  /**
   * Calculate narrative tension based on story beat
   */
  private async calculateNarrativeTension(
    group: any,
    recentMessages: any[]
  ): Promise<number> {
    if (!group.storyMode || !group.currentStoryBeat) return 0;

    try {
      const currentBeat = JSON.parse(group.currentStoryBeat as string);

      // Tension mapping by beat type
      const tensionMap: Record<string, number> = {
        introduction: 0.2,
        rising_action: 0.5,
        conflict: 0.8,
        climax: 1.0,
        resolution: 0.3,
        transition: 0.4,
      };

      const baseTension = tensionMap[currentBeat.type] || 0.5;

      // Adjust based on progress
      const progressMultiplier = 0.8 + group.storyProgress * 0.2;

      return Math.min(baseTension * progressMultiplier, 1);
    } catch (error) {
      console.error("Error calculating narrative tension:", error);
      return 0.5;
    }
  }

  /**
   * Generate recommended actions based on analysis
   */
  private async generateRecommendedActions(
    group: any,
    recentMessages: any[],
    metrics: {
      participationBalance: number;
      conversationEnergy: number;
      narrativeTension: number;
    }
  ): Promise<DirectorAction[]> {
    const actions: DirectorAction[] = [];

    // 1. Balance participation
    if (metrics.participationBalance < 0.6) {
      const messageCounts = new Map<string, number>();

      recentMessages.forEach((msg) => {
        if (msg.authorType === "agent" && msg.Agent?.id) {
          const count = messageCounts.get(msg.Agent.id) || 0;
          messageCounts.set(msg.Agent.id, count + 1);
        }
      });

      // Find most active and least active
      const sortedAIs = Array.from(messageCounts.entries()).sort(
        (a, b) => b[1] - a[1]
      );

      if (sortedAIs.length > 1) {
        const [mostActive, leastActive] = [
          sortedAIs[0],
          sortedAIs[sortedAIs.length - 1],
        ];

        if (mostActive[1] > leastActive[1] * 2) {
          actions.push({
            type: "cool_down_dominant_ai",
            target: mostActive[0],
            reason: `IA muy dominante (${mostActive[1]} msgs vs ${leastActive[1]})`,
            priority: 7,
          });

          actions.push({
            type: "encourage_quiet_ai",
            target: leastActive[0],
            reason: `IA poco participativa (${leastActive[1]} msgs)`,
            priority: 7,
          });
        }
      }
    }

    // 2. Manage conversation energy
    if (metrics.conversationEnergy < 0.3) {
      actions.push({
        type: "introduce_conflict",
        reason: "Conversación con poca energía",
        priority: 5,
      });
    } else if (metrics.conversationEnergy > 0.8) {
      actions.push({
        type: "resolve_tension",
        reason: "Conversación muy intensa, necesita calmarse",
        priority: 4,
      });
    }

    // 3. Story progression (if Story Mode enabled)
    if (group.storyMode && group.storyProgress > 0.9) {
      actions.push({
        type: "advance_story",
        reason: "Beat narrativo casi completo",
        priority: 9,
      });
    }

    // 4. Narrative tension management
    if (
      group.storyMode &&
      metrics.narrativeTension > 0.7 &&
      recentMessages.length > 20
    ) {
      actions.push({
        type: "resolve_tension",
        reason: "Alta tensión narrativa sostenida",
        priority: 6,
      });
    }

    // Sort by priority
    return actions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Encourage a quiet AI to participate more
   */
  private async encourageAI(groupId: string, agentId: string) {
    await prisma.groupMember.update({
      where: {
        groupId_agentId: { groupId, agentId },
      },
      data: {
        isFocused: true,
        focusedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        importanceLevel: "main",
      },
    });
  }

  /**
   * Cool down a dominant AI
   */
  private async coolDownAI(groupId: string, agentId: string) {
    await prisma.groupMember.update({
      where: {
        groupId_agentId: { groupId, agentId },
      },
      data: {
        isFocused: false,
        importanceLevel: "secondary",
      },
    });
  }

  /**
   * Introduce narrative conflict
   */
  private async introduceConflict(groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) return;

    await prisma.group.update({
      where: { id: groupId },
      data: {
        currentSceneDirection: {
          type: "conflict_introduction",
          direction:
            "Surge una diferencia de opinión o un pequeño desacuerdo entre los personajes.",
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Resolve tension
   */
  private async resolveTension(groupId: string) {
    await prisma.group.update({
      where: { id: groupId },
      data: {
        currentSceneDirection: {
          type: "tension_resolution",
          direction:
            "Es momento de encontrar puntos en común y suavizar el ambiente.",
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Shift focus to specific AI or topic
   */
  private async shiftFocus(groupId: string, targetAgentId?: string) {
    if (!targetAgentId) return;

    await prisma.groupMember.updateMany({
      where: { groupId, memberType: "agent" },
      data: {
        isFocused: false,
        importanceLevel: "secondary",
      },
    });

    await prisma.groupMember.update({
      where: {
        groupId_agentId: { groupId, agentId: targetAgentId },
      },
      data: {
        isFocused: true,
        focusedUntil: new Date(Date.now() + 20 * 60 * 1000),
        importanceLevel: "main",
      },
    });
  }

  /**
   * Advance story to next beat
   */
  private async advanceStory(groupId: string) {
    const { groupStoryEngineService } = await import(
      "./group-story-engine.service"
    );

    // This will trigger the story engine to advance to the next beat
    await groupStoryEngineService.updateStoryProgress(groupId);
  }

  /**
   * Auto-pilot: Periodically analyze and apply director actions
   */
  async runDirectorAutopilot(groupId: string) {
    try {
      const analysis = await this.analyzeGroup(groupId);

      // Apply top priority action if any
      if (analysis.recommendedActions.length > 0) {
        const topAction = analysis.recommendedActions[0];

        // Only apply if priority is high enough
        if (topAction.priority >= 7) {
          await this.applyDirectorInfluence(groupId, topAction);

          console.log(
            `Director autopilot: Applied ${topAction.type} (priority ${topAction.priority})`
          );
        }
      }
    } catch (error) {
      console.error("Error in director autopilot:", error);
    }
  }
}

// Export singleton
export const groupAIDirectorService = new GroupAIDirectorService();
