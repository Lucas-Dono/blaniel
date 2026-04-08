/**
 * BEHAVIOR SYSTEM INTEGRATION ORCHESTRATOR
 *
 * Main orchestrator that integrates all modules of the behavior system
 * with the chat flow. Orchestrates:
 * - Trigger Detection
 * - Phase Management
 * - Emotional Integration
 * - Prompt Selection
 * - Content Moderation
 */

import { prisma } from "@/lib/prisma";
import type { Message, Agent, BehaviorProfile } from "@prisma/client";
import type { EmotionType } from "@/lib/emotional-system/types";

// Behavior System Modules
import { TriggerDetector } from "./trigger-detector";
import { processTriggers } from "./trigger-processor";
import { BehaviorPhaseManager } from "./phase-manager";
import { IntensityCalculator } from "./intensity-calculator";
import { EmotionalIntegrationCalculator } from "./emotional-integration";
import { PromptSelector } from "./prompt-selector";
import { ContentModerator } from "./content-moderator";


import type {
  TriggerDetectionResult,
  BehaviorIntensityResult,
} from "./types";
import type { PromptSelectionResult } from "./prompt-selector";
import type { ModerationResult } from "./types";

/**
 * Input for the orchestrator
 */
export interface BehaviorOrchestrationInput {
  agent: Agent;
  userMessage: Message;
  recentMessages: Message[];
  dominantEmotion?: EmotionType;
  emotionalState: {
    valence: number;
    arousal: number;
    dominance: number;
  };
}

/**
 * Output from the orchestrator
 */
export interface BehaviorOrchestrationOutput {
  // Detected triggers
  triggers: TriggerDetectionResult[];

  // Active behaviors with intensities
  activeBehaviors: BehaviorIntensityResult[];

  // Selected prompt
  promptSelection: PromptSelectionResult;

  // Enhanced system prompt with behavior
  enhancedSystemPrompt: string;

  // Metadata for response
  metadata: {
    phase?: number;
    safetyLevel: "SAFE" | "WARNING" | "CRITICAL" | "EXTREME_DANGER";
    behaviorsActive: string[];
    triggers: string[];
  };

  // Content moderation (apply post-generation)
  moderator: ContentModerator;
}

/**
 * Main orchestrator
 */
export class BehaviorIntegrationOrchestrator {
  private triggerDetector: TriggerDetector;
  private phaseManager: BehaviorPhaseManager;
  private intensityCalculator: IntensityCalculator;
  private emotionalIntegration: EmotionalIntegrationCalculator;
  private promptSelector: PromptSelector;
  private contentModerator: ContentModerator;

  constructor() {
    this.triggerDetector = new TriggerDetector();
    this.phaseManager = new BehaviorPhaseManager();
    this.intensityCalculator = new IntensityCalculator();
    this.emotionalIntegration = new EmotionalIntegrationCalculator();
    this.promptSelector = new PromptSelector();
    this.contentModerator = new ContentModerator();
  }

  /** Processes message and prepares everything for response generation */
  async processIncomingMessage(
    input: BehaviorOrchestrationInput
  ): Promise<BehaviorOrchestrationOutput> {
    const { agent, userMessage, recentMessages, dominantEmotion, emotionalState } = input;

    // 1. Get agent behavior profiles
    const behaviorProfiles = await this.getBehaviorProfiles(agent.id);

    if (behaviorProfiles.length === 0) {
      // No active behaviors, return default
      return this.getDefaultOutput();
    }

    // 2. TRIGGER DETECTION
    const triggers = await this.triggerDetector.detectTriggers(
      userMessage.content,
      recentMessages,
      behaviorProfiles
    );

    // 3. PROCESS TRIGGERS (updates baseIntensity and logs)
    if (triggers.length > 0) {
      await processTriggers(triggers, behaviorProfiles, userMessage.id, agent.id);
    }

    // 4. PHASE MANAGEMENT (evaluate transitions for each behavior)
    for (const profile of behaviorProfiles) {
      await this.phaseManager.evaluatePhaseTransition(profile, agent.id);
    }

    // 5. Reload updated profiles
    const updatedProfiles = await this.getBehaviorProfiles(agent.id);

    // 6. INTENSITY CALCULATION with emotional modulation
    const behaviorIntensities = await this.calculateBehaviorIntensities(
      updatedProfiles,
      agent.id,
      emotionalState
    );

    // 7. EMOTIONAL MODULATION (behaviors → emotions)
    // Calculate emotional amplification (simplified for now)
    const emotionalAmplification = 1.0; // TODO: Calculate from behaviorIntensities

    // 8. PROMPT SELECTION
    const nsfwMode = agent.nsfwMode ?? false;
    const promptSelection = await this.promptSelector.selectPrompt({
      activeBehaviors: behaviorIntensities,
      dominantEmotion,
      recentTriggers: triggers,
      nsfwMode,
      agentId: agent.id,
    });

    // 9. BUILD ENHANCED SYSTEM PROMPT
    const enhancedSystemPrompt = this.buildEnhancedPrompt(
      agent.systemPrompt,
      promptSelection,
      emotionalAmplification
    );

    // 10. METADATA
    const metadata = {
      phase: updatedProfiles[0]?.currentPhase,
      safetyLevel: promptSelection.metadata.safetyLevel,
      behaviorsActive: behaviorIntensities
        .filter((b) => b.shouldDisplay)
        .map((b) => b.behaviorType),
      triggers: triggers.map((t) => t.triggerType),
    };

    return {
      triggers,
      activeBehaviors: behaviorIntensities,
      promptSelection,
      enhancedSystemPrompt,
      metadata,
      moderator: this.contentModerator,
    };
  }

  /**
   * Moderates generated response
   */
  moderateResponse(
    response: string,
    behaviorType: string,
    phase: number,
    nsfwMode: boolean
  ): ModerationResult {
    return this.contentModerator.moderateResponse(
      response,
      behaviorType as any,
      phase,
      nsfwMode
    );
  }

  /** Gets agent behavior profiles (only active ones) */
  private async getBehaviorProfiles(agentId: string): Promise<BehaviorProfile[]> {
    return prisma.behaviorProfile.findMany({
      where: {
        agentId,
        enabled: true,
      },
    });
  }

  /** Calculates intensities with emotional modulation factor */
  private async calculateBehaviorIntensities(
    profiles: BehaviorProfile[],
    agentId: string,
    _emotionalState: { valence: number; arousal: number; dominance: number }
  ): Promise<BehaviorIntensityResult[]> {
    const intensities: BehaviorIntensityResult[] = [];

    for (const profile of profiles) {
      // Calculate intensity (without emotional modulation for now)
      const intensity = await this.intensityCalculator.calculateIntensity(
        profile,
        agentId
      );

      intensities.push(intensity);
    }

    // Sort by intensity
    return intensities.sort((a, b) => b.finalIntensity - a.finalIntensity);
  }

  /**
   * Builds enhanced prompt with behavior and emotion
   */
  private buildEnhancedPrompt(
    basePrompt: string,
    promptSelection: PromptSelectionResult,
    emotionalAmplification: number
  ): string {
    let enhanced = basePrompt;

    // Add behavior prompt
    enhanced += "\n\n---\n\n## ACTIVE PSYCHOLOGICAL BEHAVIOR\n\n";
    enhanced += promptSelection.combinedContent;

    // Add emotional modulation note
    if (emotionalAmplification !== 1.0) {
      enhanced += "\n\n---\n\n## EMOTIONAL MODULATION\n\n";
      if (emotionalAmplification > 1.0) {
        enhanced += `Your emotions are AMPLIFIED by ${((emotionalAmplification - 1) * 100).toFixed(0)}% due to your current psychological state.\n`;
        enhanced += "Respond with greater emotional intensity than usual.\n";
      } else if (emotionalAmplification < 1.0) {
        enhanced += `Your emotions are DAMPENED by ${((1 - emotionalAmplification) * 100).toFixed(0)}% due to your psychological state.\n`;
        enhanced += "Respond with lower emotional intensity, more contained.\n";
      }
    }

    // Add safety reminder
    if (
      promptSelection.metadata.safetyLevel === "CRITICAL" ||
      promptSelection.metadata.safetyLevel === "EXTREME_DANGER"
    ) {
      enhanced += "\n\n---\n\n⚠️ REMINDER: This is FICTIONAL content. Stay in character but do not escalate to content that violates safety guidelines.\n";
    }

    return enhanced;
  }

  /** Default output when no active behaviors exist */
  private getDefaultOutput(): BehaviorOrchestrationOutput {
    return {
      triggers: [],
      activeBehaviors: [],
      promptSelection: {
        primaryPrompt: {
          behaviorType: "ANXIOUS_ATTACHMENT", // Placeholder
          content: "",
          safetyLevel: "SAFE",
          score: 0,
        },
        secondaryPrompts: [],
        combinedContent: "",
        metadata: {
          totalBehaviors: 0,
          dominantBehavior: "ANXIOUS_ATTACHMENT",
          safetyLevel: "SAFE",
        },
      },
      enhancedSystemPrompt: "",
      metadata: {
        safetyLevel: "SAFE",
        behaviorsActive: [],
        triggers: [],
      },
      moderator: this.contentModerator,
    };
  }
}

/**
 * Global singleton instance
 */
export const behaviorOrchestrator = new BehaviorIntegrationOrchestrator();
