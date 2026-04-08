/**
 * CHARACTER GROWTH SYSTEM
 *
 * Updates character growth over time:
 * - Trust & Intimacy levels
 * - Personality drift (subtle changes in Big Five)
 * - Learned patterns about the user
 * - Consolidation of experiences
 */

import {
  CharacterGrowth,
  AppraisalScores,
  EmotionState,
  PersonalityDrift,
  ConflictEvent,
} from "../../types";
import { prisma } from "@/lib/prisma";

export interface GrowthUpdateParams {
  agentId: string;
  appraisal: AppraisalScores;
  _emotions: EmotionState;
  actionType: string;
  wasPositiveInteraction: boolean;
}

export class CharacterGrowthSystem {
  /** Updates growth after a conversation */
  async updateGrowth(params: GrowthUpdateParams): Promise<void> {
    console.log("[CharacterGrowth] Updating character growth...");

    try {
      const currentGrowth = await prisma.characterGrowth.findUnique({
        where: { agentId: params.agentId },
      });

      if (!currentGrowth) {
        console.error("[CharacterGrowth] No growth record found");
        return;
      }

      // 1. Update trust level
      const newTrustLevel = this.calculateNewTrustLevel(
        currentGrowth.trustLevel,
        params.appraisal,
        params.wasPositiveInteraction
      );

      // 2. Update intimacy level
      const newIntimacyLevel = this.calculateNewIntimacyLevel(
        currentGrowth.intimacyLevel,
        params.appraisal,
        params.actionType
      );

      // 3. Update counters
      const positiveCount = params.wasPositiveInteraction
        ? currentGrowth.positiveEventsCount + 1
        : currentGrowth.positiveEventsCount;

      const negativeCount = !params.wasPositiveInteraction
        ? currentGrowth.negativeEventsCount + 1
        : currentGrowth.negativeEventsCount;

      // 4. Detect conflict
      let conflictHistory = currentGrowth.conflictHistory as any[];
      if (params.appraisal.valueAlignment < -0.6) {
        const newConflict: ConflictEvent = {
          description: "Value conflict detected",
          severity: Math.abs(params.appraisal.valueAlignment),
          resolved: false,
          timestamp: new Date(),
        };
        conflictHistory = [...conflictHistory, newConflict];
      }

      // 5. Update personality drift (only every N conversations)
      const shouldUpdateDrift = currentGrowth.conversationCount % 10 === 0;
      let personalityDrift = currentGrowth.personalityDrift;

      if (shouldUpdateDrift) {
        personalityDrift = await this.updatePersonalityDrift(
          params.agentId,
          currentGrowth.personalityDrift as any,
          params.appraisal,
          params._emotions
        );
      }

      // 6. Save changes
      await prisma.characterGrowth.update({
        where: { agentId: params.agentId },
        data: {
          trustLevel: newTrustLevel,
          intimacyLevel: newIntimacyLevel,
          positiveEventsCount: positiveCount,
          negativeEventsCount: negativeCount,
          conflictHistory: conflictHistory as any,
          personalityDrift: personalityDrift as any,
          conversationCount: currentGrowth.conversationCount + 1,
          lastSignificantEvent: params.wasPositiveInteraction ? new Date() : currentGrowth.lastSignificantEvent,
          lastUpdated: new Date(),
        },
      });

      console.log(`[CharacterGrowth] Growth updated - Trust: ${newTrustLevel.toFixed(2)}, Intimacy: ${newIntimacyLevel.toFixed(2)}`);
    } catch (error) {
      console.error("[CharacterGrowth] Error updating growth:", error);
    }
  }

  /**
   * Calculates new trust level
   */
  private calculateNewTrustLevel(
    currentTrust: number,
    appraisal: AppraisalScores,
    wasPositive: boolean
  ): number {
    let trustChange = 0;

    if (wasPositive) {
      // Positive interactions gradually increase trust
      trustChange = 0.02; // +2% per positive interaction

      // If the user was vulnerable (shared something personal), more trust
      if (appraisal.desirabilityForUser < -0.5) {
        trustChange += 0.03; // Vulnerable user = more trust building
      }
    } else {
      // Negative interactions reduce trust
      trustChange = -0.05; // -5% per negative interaction

      // If there was a violation of values, more impact
      if (appraisal.valueAlignment < -0.6) {
        trustChange -= 0.05;
      }
    }

    const newTrust = currentTrust + trustChange;
    return Math.max(0, Math.min(1, newTrust)); // Clamp 0-1
  }

  /**
   * Calculates new intimacy level
   */
  private calculateNewIntimacyLevel(
    currentIntimacy: number,
    appraisal: AppraisalScores,
    actionType: string
  ): number {
    let intimacyChange = 0;

    // Intimacy increases with shared vulnerability
    if (actionType === "be_vulnerable" || actionType === "share_experience") {
      intimacyChange = 0.03; // +3% for vulnerability
    }

    // User sharing something very personal
    if (appraisal.novelty > 0.7 && appraisal.desirabilityForUser < 0) {
      intimacyChange += 0.02; // User opens up = more intimacy
    }

    // Conflicts can temporarily reduce intimacy
    if (appraisal.valueAlignment < -0.5) {
      intimacyChange -= 0.02;
    }

    const newIntimacy = currentIntimacy + intimacyChange;
    return Math.max(0, Math.min(1, newIntimacy));
  }

  /**
   * Updates personality drift (subtle changes in Big Five)
   */
  private async updatePersonalityDrift(
    agentId: string,
    currentDrift: PersonalityDrift | null,
    appraisal: AppraisalScores,
    emotions: EmotionState
  ): Promise<PersonalityDrift> {
    // Get current personality
    const personalityCore = await prisma.personalityCore.findUnique({
      where: { agentId },
    });

    if (!personalityCore) {
      return currentDrift || {};
    }

    const drift: PersonalityDrift = currentDrift || {};

    // Example: If the user exposes the character to a lot of novelty, Openness can increase slightly
    if (appraisal.novelty > 0.8) {
      if (!drift.openness) {
        drift.openness = {
          current: personalityCore.openness,
          initial: personalityCore.openness,
          influencedBy: [],
        };
      }

      // Increase openness very subtly (max +5 points in the character's entire lifetime)
      const maxDrift = 5;
      const currentDriftAmount = drift.openness.current - drift.openness.initial;

      if (currentDriftAmount < maxDrift) {
        drift.openness.current += 0.1;
        drift.openness.influencedBy.push("Exposure to new experiences from user");

        // Update in DB if drift is significant
        if (Math.abs(currentDriftAmount) > 1) {
          await prisma.personalityCore.update({
            where: { agentId },
            data: { openness: Math.round(drift.openness.current) },
          });
        }
      }
    }

    // Other drifts can be added similarly...
    // Ex: Neuroticism can decrease with a stable and secure relationship
    // Ex: Agreeableness can change based on conflicts/harmony

    return drift;
  }

  /**
   * Updates relationship stage based on trust + intimacy
   */
  async updateRelationshipStage(agentId: string): Promise<void> {
    const growth = await prisma.characterGrowth.findUnique({
      where: { agentId },
    });

    if (!growth) return;

    const semanticMemory = await prisma.semanticMemory.findUnique({
      where: { agentId },
    });

    if (!semanticMemory) return;

    let newStage = semanticMemory.relationshipStage;

    // Determinar stage basado en trust + intimacy
    const combinedLevel = (growth.trustLevel + growth.intimacyLevel) / 2;

    if (combinedLevel < 0.3) {
      newStage = "first_meeting";
    } else if (combinedLevel < 0.5) {
      newStage = "acquaintance";
    } else if (combinedLevel < 0.7) {
      newStage = "friend";
    } else if (combinedLevel < 0.85) {
      newStage = "close_friend";
    } else {
      newStage = "intimate";
    }

    // Detect tense relationship due to conflicts
    const conflictHistory = (growth.conflictHistory as unknown) as ConflictEvent[];
    const unresolvedConflicts = conflictHistory.filter((c) => !c.resolved);

    if (unresolvedConflicts.length > 2) {
      newStage = "strained";
    }

    // Update if changed
    if (newStage !== semanticMemory.relationshipStage) {
      await prisma.semanticMemory.update({
        where: { agentId },
        data: { relationshipStage: newStage },
      });

      console.log(`[CharacterGrowth] Relationship stage updated: ${semanticMemory.relationshipStage} → ${newStage}`);
    }
  }
}
