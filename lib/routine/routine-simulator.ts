/**
 * ROUTINE SIMULATOR
 *
 * Simulates routine instances with personality-driven variations
 * Manages current activity state and generates context for conversations
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import type {
  SimulationInput,
  SimulationOutput,
  AppliedVariations,
  MoodImpact,
  CurrentActivity,
  NextActivity,
  RoutineContext,
  ResponseModification,
  ResponseStyle,
  ActivityType,
  VariationParameters,
} from "@/types/routine";

// ============================================
// VARIATION ENGINE
// ============================================

/**
 * Generates variations for a routine instance based on personality
 */
export function generateVariations(input: SimulationInput): AppliedVariations {
  const {
    personalityCore,
    internalState,
    variationIntensity,
    seed,
  } = input;

  // Use seed for deterministic randomness (optional)
  const rng = seed ? seededRandom(seed) : Math.random;

  const variations: AppliedVariations = {};

  // Get template variation parameters
  const _template = input.templateId; // We'll need to fetch this in the real implementation
  // For now, we'll use default parameters

  const conscientiousness = personalityCore.conscientiousness / 100;
  const neuroticism = personalityCore.neuroticism / 100;
  const openness = personalityCore.openness / 100;

  // 1. Calculate lateness probability
  // High conscientiousness = rarely late
  // Low conscientiousness = often late
  // High neuroticism = may be early (anxiety) or late (overwhelmed)
  const baseLateProb = 0.15; // 15% base
  const conscientModifier = (1 - conscientiousness) * 0.3; // Up to +30%
  const neuroticModifier = neuroticism * 0.2; // Up to +20%

  const lateProb = (baseLateProb + conscientModifier + neuroticModifier) * variationIntensity;

  if (rng() < lateProb) {
    variations.arrivedLate = true;

    // How late? Inversely proportional to conscientiousness
    const maxLateness = 30; // 30 minutes max
    const lateMultiplier = (1 - conscientiousness) * variationIntensity;
    variations.lateMinutes = Math.floor(rng() * maxLateness * lateMultiplier) + 1;

    // Generate reason based on personality
    variations.reason = generateLatenessReason({
      conscientiousness,
      neuroticism,
      openness,
      minutes: variations.lateMinutes,
    });
  } else {
    variations.arrivedLate = false;
    variations.lateMinutes = 0;

    // Small chance of being early (high conscientiousness)
    if (conscientiousness > 0.7 && rng() < conscientiousness * 0.3) {
      variations.lateMinutes = -Math.floor(rng() * 10) - 1; // 1-10 minutes early
    }
  }

  // 2. Calculate skip probability
  // Very low for critical events, higher for low-priority events
  const baseSkipProb = 0.02; // 2% base
  const skipModifier = (1 - conscientiousness) * 0.1; // Up to +10%
  // Neuroticism may cause skipping stressful events
  const _skipProb = (baseSkipProb + skipModifier) * variationIntensity;

  // We'll handle skipping in the instance creation

  // 3. Early leave probability
  const earlyLeaveProb = 0.05 * variationIntensity;
  if (rng() < earlyLeaveProb) {
    variations.leftEarly = true;
    variations.earlyMinutes = Math.floor(rng() * 20) + 5; // 5-25 minutes early
  }

  // 4. Mood during event
  variations.moodDuringEvent = calculateMoodDuringEvent({
    internalState,
    arrivedLate: variations.arrivedLate,
    neuroticism,
  });

  // 5. Personality influence documentation
  variations.personalityInfluence = {
    conscientiousness: getConscientiousnessInfluence(conscientiousness, variations),
    neuroticism: getNeuroticismInfluence(neuroticism, variations),
    openness: getOpennessInfluence(openness, variations),
  };

  // 6. Execution quality (how well they perform)
  variations.executionQuality = calculateExecutionQuality({
    conscientiousness,
    arrivedLate: variations.arrivedLate,
    moodValence: internalState?.moodValence || 0,
  });

  return variations;
}

/**
 * Seeded random number generator for deterministic results
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

/**
 * Generate reason for lateness based on personality
 */
function generateLatenessReason(params: {
  conscientiousness: number;
  neuroticism: number;
  openness: number;
  minutes: number;
}): string {
  const { conscientiousness, neuroticism, minutes } = params;

  const reasons: string[] = [];

  if (neuroticism > 0.6) {
    reasons.push(
      "Got anxious and needed extra time to prepare",
      "Couldn't decide what to wear and it took longer than expected",
      "Had to double-check everything multiple times"
    );
  }

  if (conscientiousness < 0.4) {
    reasons.push(
      "Lost track of time",
      "Didn't set an alarm",
      "Hit snooze a few too many times",
      "Underestimated how long it would take"
    );
  } else {
    // Even conscientious people can be late for external reasons
    reasons.push(
      "Traffic was heavier than usual",
      "Public transport was delayed",
      "Had an unexpected phone call",
      "Helped someone and it took longer than expected"
    );
  }

  const selectedReason = reasons[Math.floor(Math.random() * reasons.length)];

  if (minutes > 20) {
    return `Significantly delayed: ${selectedReason}`;
  } else if (minutes > 10) {
    return selectedReason;
  } else {
    return `Slightly delayed: ${selectedReason}`;
  }
}

/**
 * Calculate mood during event
 */
function calculateMoodDuringEvent(params: {
  internalState: SimulationInput["internalState"];
  arrivedLate?: boolean;
  neuroticism: number;
}): string {
  const { internalState, arrivedLate, neuroticism } = params;

  if (!internalState) {
    return "neutral";
  }

  let mood = "neutral";

  // Base mood from internal state
  if (internalState.moodValence > 0.3) {
    mood = "content";
  } else if (internalState.moodValence < -0.3) {
    mood = "stressed";
  }

  // Modifiers
  if (arrivedLate && neuroticism > 0.5) {
    mood = "slightly_stressed";
  }

  if (internalState.moodArousal > 0.7) {
    mood = "energetic";
  } else if (internalState.moodArousal < 0.3) {
    mood = "tired";
  }

  return mood;
}

/**
 * Calculate execution quality
 */
function calculateExecutionQuality(params: {
  conscientiousness: number;
  arrivedLate?: boolean;
  moodValence: number;
}): number {
  const { conscientiousness, arrivedLate, moodValence } = params;

  let quality = 0.7; // Base 70%

  // Conscientiousness boost
  quality += conscientiousness * 0.2; // Up to +20%

  // Mood impact
  quality += moodValence * 0.1; // ±10%

  // Penalty for being late
  if (arrivedLate) {
    quality -= 0.1;
  }

  return Math.max(0, Math.min(1, quality));
}

/**
 * Personality influence descriptions
 */
function getConscientiousnessInfluence(
  conscientiousness: number,
  variations: AppliedVariations
): string {
  if (conscientiousness > 0.7) {
    return variations.arrivedLate
      ? "High conscientiousness made them feel guilty about being late, despite it being beyond their control"
      : "High conscientiousness ensured punctual arrival and well-prepared execution";
  } else if (conscientiousness < 0.4) {
    return "Low conscientiousness led to a more relaxed attitude about timing and preparation";
  }
  return "Moderate conscientiousness balanced flexibility with responsibility";
}

function getNeuroticismInfluence(
  neuroticism: number,
  variations: AppliedVariations
): string {
  if (neuroticism > 0.6 && variations.arrivedLate) {
    return "High neuroticism amplified stress and self-criticism about being late";
  } else if (neuroticism > 0.6) {
    return "High neuroticism led to extra preparation time and careful planning";
  }
  return "Neuroticism level had minimal impact on this event";
}

function getOpennessInfluence(openness: number, _variations: AppliedVariations): string {
  if (openness > 0.7) {
    return "High openness made them adaptable to unexpected situations";
  }
  return "Openness level had minimal direct impact on timing";
}

// ============================================
// INSTANCE SIMULATION
// ============================================

/**
 * Simulate a routine instance for a specific date
 */
export async function simulateInstance(
  templateId: string,
  date: Date,
  agentId: string
): Promise<SimulationOutput> {
  // 1. Fetch template
  const template = await prisma.routineTemplate.findUnique({
    where: { id: templateId },
    include: {
      CharacterRoutine: {
        include: {
          Agent: {
            include: {
              PersonalityCore: true,
              InternalState: true,
            },
          },
        },
      },
    },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  const agent = template.CharacterRoutine?.Agent;
  if (!agent?.PersonalityCore) {
    throw new Error("Agent missing personality core");
  }

  // 2. Parse start/end times
  const [startHour, startMinute] = template.startTime.split(":").map(Number);
  const [endHour, endMinute] = template.endTime.split(":").map(Number);

  const scheduledStart = new Date(date);
  scheduledStart.setHours(startHour, startMinute, 0, 0);

  const scheduledEnd = new Date(date);
  scheduledEnd.setHours(endHour, endMinute, 0, 0);

  // Handle overnight events (e.g., sleep from 23:00 to 07:00)
  if (scheduledEnd < scheduledStart) {
    scheduledEnd.setDate(scheduledEnd.getDate() + 1);
  }

  // 3. Generate variations
  const simulationInput: SimulationInput = {
    templateId,
    date,
    personalityCore: {
      openness: agent.PersonalityCore.openness,
      conscientiousness: agent.PersonalityCore.conscientiousness,
      extraversion: agent.PersonalityCore.extraversion,
      agreeableness: agent.PersonalityCore.agreeableness,
      neuroticism: agent.PersonalityCore.neuroticism,
    },
    internalState: agent.InternalState
      ? {
          moodValence: agent.InternalState.moodValence,
          moodArousal: agent.InternalState.moodArousal,
          moodDominance: agent.InternalState.moodDominance,
          needConnection: agent.InternalState.needConnection,
          needAutonomy: agent.InternalState.needAutonomy,
          needCompetence: agent.InternalState.needCompetence,
          needNovelty: agent.InternalState.needNovelty,
        }
      : undefined,
    variationIntensity: template.CharacterRoutine?.variationIntensity || 0.5,
  };

  const variations = template.allowVariations
    ? generateVariations(simulationInput)
    : {};

  // 4. Apply variations to times
  const actualStart = new Date(scheduledStart);
  if (variations.lateMinutes) {
    actualStart.setMinutes(actualStart.getMinutes() + variations.lateMinutes);
  }

  const actualEnd = new Date(scheduledEnd);
  if (variations.leftEarly && variations.earlyMinutes) {
    actualEnd.setMinutes(actualEnd.getMinutes() - variations.earlyMinutes);
  }

  // 5. Calculate mood impact
  const baseMoodImpact = (template.moodImpact as MoodImpact) || {};
  const actualMoodImpact = calculateActualMoodImpact(baseMoodImpact, variations);

  // 6. Generate narrative notes
  const notes = generateInstanceNotes({
    templateName: template.name,
    type: template.type,
    variations,
    quality: variations.executionQuality || 0.7,
  });

  // 7. Create instance in database
  const instance = await prisma.routineInstance.create({
    data: {
      id: nanoid(),
      updatedAt: new Date(),
      templateId,
      routineId: template.routineId,
      agentId,
      name: template.name,
      type: template.type,
      date,
      scheduledStart,
      scheduledEnd,
      actualStart,
      actualEnd,
      status: "scheduled",
      variations: variations as any,
      actualMoodImpact: actualMoodImpact as any,
      notes,
    },
  });

  return {
    instanceId: instance.id,
    scheduledStart,
    scheduledEnd,
    actualStart,
    actualEnd,
    variations,
    moodImpact: actualMoodImpact,
    notes,
    status: "scheduled",
  };
}

/**
 * Calculate actual mood impact based on variations
 */
function calculateActualMoodImpact(
  baseMoodImpact: MoodImpact,
  variations: AppliedVariations
): MoodImpact {
  const impact = { ...baseMoodImpact };

  // Adjust based on variations
  if (variations.arrivedLate) {
    impact.stress = (impact.stress || 0) + 15;
    impact.satisfaction = (impact.satisfaction || 0) - 10;
  }

  if (variations.leftEarly) {
    impact.energy = (impact.energy || 0) + 10;
  }

  if (variations.executionQuality && variations.executionQuality < 0.5) {
    impact.satisfaction = (impact.satisfaction || 0) - 20;
    impact.stress = (impact.stress || 0) + 10;
  } else if (variations.executionQuality && variations.executionQuality > 0.8) {
    impact.satisfaction = (impact.satisfaction || 0) + 15;
  }

  return impact;
}

/**
 * Generate narrative notes for instance
 */
function generateInstanceNotes(params: {
  templateName: string;
  type: string;
  variations: AppliedVariations;
  quality: number;
}): string {
  const { templateName, type, variations, quality } = params;

  let notes = `${templateName} - `;

  if (variations.arrivedLate && variations.lateMinutes) {
    notes += `Arrived ${variations.lateMinutes} minutes late. ${variations.reason || ""}. `;
  } else if (variations.lateMinutes && variations.lateMinutes < 0) {
    notes += `Arrived ${Math.abs(variations.lateMinutes)} minutes early. `;
  } else {
    notes += "Arrived on time. ";
  }

  // Quality assessment
  if (quality > 0.85) {
    notes += "Executed excellently with high focus and dedication.";
  } else if (quality > 0.7) {
    notes += "Completed satisfactorily.";
  } else if (quality > 0.5) {
    notes += "Completed adequately despite some challenges.";
  } else {
    notes += "Struggled to complete effectively.";
  }

  if (variations.leftEarly && variations.earlyMinutes) {
    notes += ` Left ${variations.earlyMinutes} minutes early.`;
  }

  return notes;
}

// ============================================
// CURRENT STATE CALCULATION
// ============================================

/**
 * Get current activity state for an agent
 */
export async function getCurrentActivity(
  agentId: string,
  timezone: string = "America/Argentina/Buenos_Aires"
): Promise<CurrentActivity | null> {
  const now = new Date();

  // Find current instance
  const instance = await prisma.routineInstance.findFirst({
    where: {
      agentId,
      status: "in_progress",
      actualStart: { lte: now },
      actualEnd: { gte: now },
    },
    orderBy: { actualStart: "desc" },
  });

  if (!instance) {
    return null;
  }

  const variations = instance.variations as AppliedVariations || {};

  return {
    instanceId: instance.id,
    name: instance.name,
    type: instance.type as ActivityType,
    startedAt: instance.actualStart?.toISOString() || instance.scheduledStart.toISOString(),
    expectedEnd: instance.actualEnd?.toISOString() || instance.scheduledEnd.toISOString(),
    status: instance.status as any,
    canRespond: determineCanRespond(instance.type as ActivityType, variations),
    responseStyle: determineResponseStyle(instance.type as ActivityType, variations),
    location: undefined, // Template relation not included in query
    notes: variations.moodDuringEvent,
  };
}

/**
 * Get next scheduled activity
 */
export async function getNextActivity(agentId: string): Promise<NextActivity | null> {
  const now = new Date();

  const instance = await prisma.routineInstance.findFirst({
    where: {
      agentId,
      status: "scheduled",
      scheduledStart: { gt: now },
    },
    orderBy: { scheduledStart: "asc" },
  });

  if (!instance) {
    return null;
  }

  const duration = instance.scheduledEnd.getTime() - instance.scheduledStart.getTime();
  const durationMinutes = Math.floor(duration / (1000 * 60));

  return {
    instanceId: instance.id,
    name: instance.name,
    type: instance.type as ActivityType,
    scheduledStart: instance.scheduledStart.toISOString(),
    durationMinutes,
  };
}

/**
 * Determine if character can respond based on activity
 */
function determineCanRespond(type: ActivityType, _variations: AppliedVariations): boolean {
  // Sleep = cannot respond (in immersive mode)
  if (type === "sleep") {
    return false;
  }

  // Most activities allow response
  return true;
}

/**
 * Determine response style based on activity
 */
function determineResponseStyle(
  type: ActivityType,
  variations: AppliedVariations
): ResponseStyle {
  switch (type) {
    case "sleep":
      return "unavailable";
    case "work":
      return "brief_professional";
    case "exercise":
      return "energetic";
    case "meal":
      return "brief_casual";
    case "commute":
      return "distracted";
    case "social":
      return "relaxed";
    case "hobby":
      return "relaxed";
    default:
      return "normal";
  }
}

// ============================================
// CONTEXT GENERATION
// ============================================

/**
 * Generate complete routine context for system prompt
 */
export async function generateRoutineContext(agentId: string): Promise<RoutineContext> {
  const routine = await prisma.characterRoutine.findUnique({
    where: { agentId },
  });

  if (!routine || !routine.enabled) {
    return {
      promptContext: "",
      generatedAt: new Date(),
      timezone: "America/Argentina/Buenos_Aires",
    };
  }

  const currentActivity = await getCurrentActivity(agentId, routine.timezone);
  const nextActivity = await getNextActivity(agentId);

  // Generate context string
  let contextParts: string[] = [];

  if (currentActivity) {
    contextParts.push(`## Current Activity`);
    contextParts.push(
      `You are currently: ${currentActivity.name} (${currentActivity.type})`
    );
    contextParts.push(`Started at: ${formatTime(currentActivity.startedAt)}`);
    contextParts.push(`Expected to end: ${formatTime(currentActivity.expectedEnd)}`);

    if (currentActivity.location) {
      contextParts.push(`Location: ${currentActivity.location}`);
    }

    if (currentActivity.notes) {
      contextParts.push(`Current mood: ${currentActivity.notes}`);
    }

    // Response modification
    if (routine.realismLevel !== "subtle") {
      const modification = getResponseModification(
        currentActivity,
        routine.realismLevel as "moderate" | "immersive"
      );

      if (modification.contextPrompt) {
        contextParts.push(`\n${modification.contextPrompt}`);
      }
    }
  }

  if (nextActivity) {
    contextParts.push(`\n## Next Activity`);
    contextParts.push(`Coming up: ${nextActivity.name} at ${formatTime(nextActivity.scheduledStart)}`);
  }

  const promptContext = contextParts.join("\n");

  // Determine response modification
  const responseModification = currentActivity
    ? getResponseModification(currentActivity, routine.realismLevel as any)
    : undefined;

  return {
    currentActivity: currentActivity || undefined,
    nextActivity: nextActivity || undefined,
    responseModification,
    promptContext,
    generatedAt: new Date(),
    timezone: routine.timezone,
  };
}

/**
 * Get response modification rules
 */
function getResponseModification(
  activity: CurrentActivity,
  realismLevel: "moderate" | "immersive"
): ResponseModification {
  const style = activity.responseStyle || "normal";

  const modification: ResponseModification = {
    style,
  };

  // Moderate realism
  if (realismLevel === "moderate") {
    switch (style) {
      case "brief_professional":
        modification.lengthMultiplier = 0.7;
        modification.contextPrompt =
          "Keep responses professional and relatively brief as you're working.";
        break;
      case "brief_casual":
        modification.lengthMultiplier = 0.8;
        modification.contextPrompt = "Keep responses casual and brief as you're busy eating.";
        break;
      case "energetic":
        modification.contextPrompt =
          "Respond with energy and enthusiasm, you just exercised and feel great!";
        break;
      case "relaxed":
        modification.contextPrompt = "You're relaxed and have time for a nice conversation.";
        break;
      case "distracted":
        modification.lengthMultiplier = 0.6;
        modification.contextPrompt =
          "You're a bit distracted (commuting/multitasking), keep responses brief.";
        break;
    }
  }

  // Immersive realism
  if (realismLevel === "immersive") {
    switch (style) {
      case "unavailable":
        // canRespond is set on CurrentActivity, not ResponseModification
        modification.contextPrompt =
          "You are sleeping and cannot respond. If the user messages, they should see a notification that you're unavailable.";
        break;
      case "brief_professional":
        modification.lengthMultiplier = 0.5;
        modification.delaySeconds = 30;
        modification.contextPrompt =
          "You're at work and very busy. Respond briefly and professionally, and there may be delays.";
        break;
      case "distracted":
        modification.lengthMultiplier = 0.5;
        modification.delaySeconds = 60;
        modification.contextPrompt =
          "You're commuting/traveling and can barely check your phone. Very brief responses with delays.";
        break;
    }
  }

  return modification;
}

/**
 * Format time for display
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
