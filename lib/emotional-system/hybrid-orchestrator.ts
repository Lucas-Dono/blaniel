/**
 * HYBRID EMOTIONAL ORCHESTRATOR
 * 
 * Intelligent hybrid system that combines:
 * - Plutchik System (rule-based, fast, with dyads)
 * - OCC Orchestrator System (LLM-based, context-aware, deep)
 * 
 * Automatic routing:
 * - FAST PATH: Simple messages → Plutchik rule-based (50ms, $0)
 * - DEEP PATH: Complex messages → OCC + Plutchik mapping (2500ms, $0.007)
 * 
 * Unified result: Plutchik state with 8 primary + 20 dyads
 */

import { PlutchikEmotionState } from "@/lib/emotions/plutchik";
import { analyzeMessageEmotions, applyEmotionDeltas } from "@/lib/emotions/system";
import { ComplexityAnalyzer } from "./complexity-analyzer";
import { OCCToPlutchikMapper } from "./occ-to-plutchik-mapper";
import { DyadCalculator, DyadResult } from "./modules/emotion/dyad-calculator";
import { EmotionalSystemOrchestrator } from "./orchestrator";
import { ResponseGenerationOutput } from "./types";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

export interface HybridProcessingResult {
  // Unified emotional state (Plutchik)
  emotionState: PlutchikEmotionState;

  // Active dyads (secondary emotions)
  activeDyads: DyadResult[];

  // Processing metadata
  metadata: {
    path: "fast" | "deep";
    processingTimeMs: number;
    costEstimate: number; // USD
    complexityScore: number;
    emotionsTriggered: string[];
    primaryEmotion: string;
    dominantDyad: string | null;
    emotionalStability: number;
  };

  // Response (only if deep path with full orchestration)
  response?: ResponseGenerationOutput;
}

export class HybridEmotionalOrchestrator {
  private complexityAnalyzer: ComplexityAnalyzer;
  private occMapper: OCCToPlutchikMapper;
  private dyadCalculator: DyadCalculator;
  private deepOrchestrator: EmotionalSystemOrchestrator;

  constructor() {
    this.complexityAnalyzer = new ComplexityAnalyzer();
    this.occMapper = new OCCToPlutchikMapper();
    this.dyadCalculator = new DyadCalculator();
    this.deepOrchestrator = new EmotionalSystemOrchestrator();
  }

  /** Processes a message with automatic routing */
  async processMessage(params: {
    agentId: string;
    userMessage: string;
    userId: string;
    generateResponse?: boolean; // If false, only processes emotions
  }): Promise<HybridProcessingResult> {
    const { agentId, userMessage, generateResponse = true } = params;
    const startTime = Date.now();

    const complexityAnalysis = this.complexityAnalyzer.analyze(userMessage);

    // 2. ROUTING
    if (complexityAnalysis.recommendedPath === "fast") {
      // ===== FAST PATH: Plutchik Rule-Based =====
      return await this.processFastPath(agentId, userMessage, startTime, complexityAnalysis.score);
    } else {
      // ===== DEEP PATH: OCC Orchestrator + Plutchik Mapping =====
      return await this.processDeepPath(agentId, userMessage, params.userId, startTime, complexityAnalysis.score, generateResponse);
    }
  }

  /** FAST PATH: Fast processing with Plutchik rule-based */
  private async processFastPath(
    agentId: string,
    userMessage: string,
    startTime: number,
    complexityScore: number
  ): Promise<HybridProcessingResult> {
    console.log("\n[Hybrid] ⚡ FAST PATH: Plutchik rule-based");

    // 1. Get current emotional state
    let internalState = await prisma.internalState.findUnique({
      where: { agentId },
    });

    if (!internalState) {
      // Create neutral state if it doesn't exist
      const { createNeutralState } = await import("@/lib/emotions");
      const neutralState = createNeutralState();

      internalState = await prisma.internalState.create({
        data: {
          id: nanoid(),
          agentId,
          currentEmotions: neutralState as any,
          moodValence: 0.0,
          moodArousal: 0.5,
          moodDominance: 0.5,
          activeGoals: [],
          conversationBuffer: [],
        },
      });
    }

    // 2. Parse current emotions
    const emotionsFromDB = internalState.currentEmotions as any;
    const currentEmotions: PlutchikEmotionState = {
      joy: typeof emotionsFromDB?.joy === "number" ? emotionsFromDB.joy : 0.5,
      trust: typeof emotionsFromDB?.trust === "number" ? emotionsFromDB.trust : 0.5,
      fear: typeof emotionsFromDB?.fear === "number" ? emotionsFromDB.fear : 0.2,
      surprise: typeof emotionsFromDB?.surprise === "number" ? emotionsFromDB.surprise : 0.1,
      sadness: typeof emotionsFromDB?.sadness === "number" ? emotionsFromDB.sadness : 0.2,
      disgust: typeof emotionsFromDB?.disgust === "number" ? emotionsFromDB.disgust : 0.1,
      anger: typeof emotionsFromDB?.anger === "number" ? emotionsFromDB.anger : 0.1,
      anticipation: typeof emotionsFromDB?.anticipation === "number" ? emotionsFromDB.anticipation : 0.4,
      lastUpdated: new Date(),
    };

    // 3. Analizar mensaje y generar deltas emocionales (Plutchik rule-based)
    const emotionDeltas = analyzeMessageEmotions(userMessage);

    // 4. Apply deltas with decay and inertia
    const newEmotionState = applyEmotionDeltas(
      currentEmotions,
      emotionDeltas,
      internalState.emotionDecayRate,
      internalState.emotionInertia
    );

    // 5. Calcular dyads (emociones secundarias)
    const activeDyads = this.dyadCalculator.calculateDyads(newEmotionState);

    // 6. Actualizar InternalState en DB
    const { emotionStateToPAD } = await import("@/lib/emotions/system");
    const pad = emotionStateToPAD(newEmotionState);

    await prisma.internalState.update({
      where: { agentId },
      data: {
        currentEmotions: newEmotionState as any,
        moodValence: pad.valence,
        moodArousal: pad.arousal,
        moodDominance: pad.dominance,
        lastUpdated: new Date(),
      },
    });

    // 7. Metadata
    const processingTime = Date.now() - startTime;
    const emotionsTriggered = Object.entries(newEmotionState)
      .filter(([key, value]) => key !== "lastUpdated" && typeof value === "number" && value > 0.5)
      .map(([key]) => key)
      .slice(0, 3);

    const primaryEmotion = this.getPrimaryEmotion(newEmotionState);
    const dominantDyad = activeDyads.length > 0 ? activeDyads[0].label : null;
    const emotionalStability = this.dyadCalculator.calculateEmotionalStability(newEmotionState);

    return {
      emotionState: newEmotionState,
      activeDyads,
      metadata: {
        path: "fast",
        processingTimeMs: processingTime,
        costEstimate: 0,
        complexityScore,
        emotionsTriggered,
        primaryEmotion,
        dominantDyad,
        emotionalStability,
      },
    };
  }

  /**
   * DEEP PATH: Deep processing with OCC Orchestrator
   */
  private async processDeepPath(
    agentId: string,
    userMessage: string,
    userId: string,
    startTime: number,
    complexityScore: number,
    generateResponse: boolean
  ): Promise<HybridProcessingResult> {
    // 1. Process with complete Orchestrator (9 phases)
    const orchestratorResult = await this.deepOrchestrator.processMessage({
      agentId,
      userMessage,
      userId,
    });

    // 2. Map OCC emotions to Plutchik
    const currentEmotions = (orchestratorResult.updatedState.currentEmotions as any) || {};
    const plutchikState = this.occMapper.mapOCCToPlutchik(currentEmotions);

    // 3. Calcular dyads desde Plutchik state
    const activeDyads = this.dyadCalculator.calculateDyads(plutchikState);

    // 4. Update InternalState with unified Plutchik state
    const { emotionStateToPAD } = await import("@/lib/emotions/system");
    const pad = emotionStateToPAD(plutchikState);

    await prisma.internalState.update({
      where: { agentId },
      data: {
        currentEmotions: plutchikState as any,
        moodValence: pad.valence,
        moodArousal: pad.arousal,
        moodDominance: pad.dominance,
        lastUpdated: new Date(),
      },
    });

    // 5. Metadata
    const processingTime = Date.now() - startTime;
    const costEstimate = 0.007; // Approx: 5 LLM calls × ~500 average tokens × $2.50/M

    const emotionsTriggered = Object.entries(plutchikState)
      .filter(([key, value]) => key !== "lastUpdated" && typeof value === "number" && value > 0.5)
      .map(([key]) => key)
      .slice(0, 3);

    const primaryEmotion = this.getPrimaryEmotion(plutchikState);
    const dominantDyad = activeDyads.length > 0 ? activeDyads[0].label : null;
    const emotionalStability = this.dyadCalculator.calculateEmotionalStability(plutchikState);

    return {
      emotionState: plutchikState,
      activeDyads,
      metadata: {
        path: "deep",
        processingTimeMs: processingTime,
        costEstimate,
        complexityScore,
        emotionsTriggered,
        primaryEmotion,
        dominantDyad,
        emotionalStability,
      },
      response: generateResponse ? orchestratorResult : undefined,
    };
  }

  /** Helper: Gets the most intense primary emotion */
  private getPrimaryEmotion(state: PlutchikEmotionState): string {
    const emotions = [
      { name: "joy", value: state.joy },
      { name: "trust", value: state.trust },
      { name: "fear", value: state.fear },
      { name: "surprise", value: state.surprise },
      { name: "sadness", value: state.sadness },
      { name: "disgust", value: state.disgust },
      { name: "anger", value: state.anger },
      { name: "anticipation", value: state.anticipation },
    ];

    emotions.sort((a, b) => b.value - a.value);
    return emotions[0].name;
  }

  /** Get system usage statistics (for analytics) */
  async getUsageStats(agentId: string, _period: "day" | "week" | "month" = "day"): Promise<{
    totalMessages: number;
    fastPathCount: number;
    deepPathCount: number;
    fastPathPercentage: number;
    deepPathPercentage: number;
    averageProcessingTime: number;
    totalCostEstimate: number;
    costSavedVsAlwaysDeep: number;
  }> {
    // TODO: Implement analytics tracking
    // For now return mock data
    return {
      totalMessages: 100,
      fastPathCount: 80,
      deepPathCount: 20,
      fastPathPercentage: 80,
      deepPathPercentage: 20,
      averageProcessingTime: 440, // 80% × 50ms + 20% × 2500ms
      totalCostEstimate: 0.14, // 20 × $0.007
      costSavedVsAlwaysDeep: 0.56, // (100 × $0.007) - $0.14
    };
  }
}

/**
 * Singleton instance
 */
export const hybridEmotionalOrchestrator = new HybridEmotionalOrchestrator();

/**
 * Helper function for simple usage
 */
export async function processMessageHybrid(
  agentId: string,
  userMessage: string,
  userId: string
): Promise<HybridProcessingResult> {
  return hybridEmotionalOrchestrator.processMessage({
    agentId,
    userMessage,
    userId,
  });
}
