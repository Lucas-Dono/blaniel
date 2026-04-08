/**
 * Event Resolution System
 *
 * Resolves scheduled events by:
 * 1. Rolling dice against probability
 * 2. Determining actual outcome
 * 3. Applying consequences (goal progress, emotional impact, memory creation)
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import type { Agent, ScheduledEvent, PersonalityCore, InternalState } from "@prisma/client";

// ============================================================================
// EXTERNAL EVENT PROBABILITIES
// ============================================================================

/**
 * Realistic probabilities for external random events
 * Based on real-world statistics
 */
export const EXTERNAL_EVENT_PROBABILITIES: Record<string, number> = {
  // Lottery & Money
  lottery_win_major: 0.00000714, // 1 in 14 million
  lottery_win_minor: 0.001, // 1 in 100,000
  find_money_street: 0.5, // 0.5% chance per day
  unexpected_windfall: 0.01,

  // Social Events
  friend_cancels_plans: 20.0,
  friend_reaches_out: 15.0,
  unexpected_visitor: 5.0,
  run_into_old_friend: 3.0,
  awkward_encounter: 8.0,

  // Nature & Environment
  see_butterfly: 15.0,
  see_rainbow: 5.0,
  see_shooting_star: 1.0,
  perfect_weather_day: 10.0,
  rain_ruins_plans: 25.0,

  // Health & Body
  get_sick_minor: 20.0, // Cold, headache, etc.
  get_sick_major: 2.0, // Flu, food poisoning
  injury_minor: 10.0,
  injury_major: 1.0,
  sleep_extremely_well: 15.0,
  sleep_terribly: 25.0,

  // Technology & Objects
  phone_battery_dies: 30.0,
  lose_important_item: 5.0,
  find_lost_item: 8.0,
  tech_malfunction: 20.0,
  spill_drink_on_self: 12.0,

  // Transportation
  miss_bus_train: 15.0,
  traffic_jam: 40.0, // In cities
  car_breakdown: 3.0,
  flight_delayed: 25.0,

  // Serendipity & Discovery
  discover_new_favorite_thing: 15.0,
  discover_new_place: 10.0,
  receive_unexpected_compliment: 12.0,
  find_perfect_parking_spot: 8.0,

  // Work & Professional
  work_cancelled_unexpectedly: 5.0,
  surprise_work_assignment: 15.0,
  praised_by_boss: 10.0,
  criticized_by_boss: 8.0,

  // Miscellaneous
  perfect_timing_moment: 5.0,
  extremely_bad_timing: 8.0,
  weird_coincidence: 3.0,
  deja_vu_moment: 10.0,
};

// ============================================================================
// EVENT RESOLUTION
// ============================================================================

type AgentWithRelations = Agent & {
  personalityCore: PersonalityCore | null;
  internalState: InternalState | null;
};

/**
 * Main event resolution function
 * Rolls dice, determines outcome, applies consequences
 */
export async function resolveEvent(
  event: ScheduledEvent,
  agent: AgentWithRelations
): Promise<ScheduledEvent> {
  // Step 1: Determine outcome
  const { wasSuccess, selectedOutcome } = determineOutcome(event, agent);

  // Step 2: Apply consequences
  await applyConsequences(event, agent, selectedOutcome, wasSuccess);

  // Step 3: Mark event as resolved
  const resolvedEvent = await prisma.scheduledEvent.update({
    where: { id: event.id },
    data: {
      resolved: true,
      resolvedAt: new Date(),
      wasSuccess,
      actualOutcome: selectedOutcome,
      emotionalImpactApplied: true,
      memoryCreated: true,
    },
  });

  return resolvedEvent;
}

/**
 * Determine the outcome of an event by rolling dice
 */
function determineOutcome(
  event: ScheduledEvent,
  agent: AgentWithRelations
): { wasSuccess: boolean; selectedOutcome: any } {
  const possibleOutcomes = event.possibleOutcomes as any[];

  if (possibleOutcomes.length === 0) {
    throw new Error("Event has no possible outcomes");
  }

  // For external random events with fixed probabilities
  if (event.category === "external_random") {
    const probability = EXTERNAL_EVENT_PROBABILITIES[event.eventType] || 50.0;
    const roll = Math.random() * 100;

    const wasSuccess = roll <= probability;

    // Find success or failure outcome
    const selectedOutcome = possibleOutcomes.find(
      (o) => o.type === (wasSuccess ? "success" : "failure")
    ) || possibleOutcomes[0];

    return { wasSuccess, selectedOutcome };
  }

  // For skill-based events with AI-estimated probability
  if (event.successProbability !== null) {
    const roll = Math.random() * 100;
    const wasSuccess = roll <= event.successProbability;

    const selectedOutcome = possibleOutcomes.find(
      (o) => o.type === (wasSuccess ? "success" : "failure")
    ) || possibleOutcomes[0];

    return { wasSuccess, selectedOutcome };
  }

  // Fallback: random selection from possible outcomes
  const randomIndex = Math.floor(Math.random() * possibleOutcomes.length);
  const selectedOutcome = possibleOutcomes[randomIndex];
  const wasSuccess = selectedOutcome.type === "success";

  return { wasSuccess, selectedOutcome };
}

/**
 * Apply consequences of the event outcome
 */
async function applyConsequences(
  event: ScheduledEvent,
  agent: AgentWithRelations,
  outcome: any,
  wasSuccess: boolean
): Promise<void> {
  const consequences = outcome.consequences || {};

  // 1. Update related goal progress
  if (event.relatedGoalId && consequences.goalProgressChange) {
    const goal = await prisma.personalGoal.findUnique({
      where: { id: event.relatedGoalId },
    });

    if (goal) {
      const progressChange = consequences.goalProgressChange;
      const newProgress = Math.max(0, Math.min(100, goal.progress + progressChange));

      await prisma.personalGoal.update({
        where: { id: event.relatedGoalId },
        data: {
          progress: newProgress,
          daysSinceProgress: 0,
          lastProgressUpdate: new Date(),
          progressHistory: [
            ...(goal.progressHistory as any[]),
            {
              date: new Date().toISOString(),
              progress: newProgress,
              note: `${event.title}: ${outcome.description}`,
            },
          ],
          // Auto-complete if 100%
          status: newProgress >= 100 ? "completed" : goal.status,
        },
      });
    }
  }

  // 2. Apply emotional impact
  if (agent.internalState && consequences.emotionalImpact) {
    const emotionalImpact = consequences.emotionalImpact;
    const currentEmotions = agent.internalState.currentEmotions as Record<string, number>;

    // Merge emotional impacts
    for (const [emotion, change] of Object.entries(emotionalImpact)) {
      if (typeof change === "number") {
        const current = currentEmotions[emotion] || 0;
        currentEmotions[emotion] = Math.max(0, Math.min(1, current + change));
      }
    }

    // Update mood based on outcome
    let moodValenceChange = 0;
    if (wasSuccess) {
      moodValenceChange = consequences.moodImpact || 0.1;
    } else {
      moodValenceChange = consequences.moodImpact || -0.1;
    }

    await prisma.internalState.update({
      where: { agentId: agent.id },
      data: {
        currentEmotions,
        moodValence: Math.max(
          -1,
          Math.min(1, agent.internalState.moodValence + moodValenceChange)
        ),
      },
    });
  }

  // 3. Create episodic memory
  await prisma.episodicMemory.create({
    data: {
      id: nanoid(),
      agentId: agent.id,
      event: `${event.title}: ${outcome.description}`,
      userEmotion: wasSuccess ? "joy" : "distress",
      characterEmotion: wasSuccess ? "happy_for" : "pity",
      emotionalValence: wasSuccess ? 0.7 : -0.6,
      importance: consequences.memoryImportance || (wasSuccess ? 0.7 : 0.6),
      metadata: {
        outcome: wasSuccess ? "success" : "failure",
        feelings: outcome.emotionalImpact || {},
        tags: [event.eventType, wasSuccess ? "success" : "failure"],
        relatedEntities: event.relatedGoalId ? [event.relatedGoalId] : [],
      },
    },
  });

  // 4. Update stress level if goal-related
  if (event.relatedGoalId && consequences.stressChange) {
    const goal = await prisma.personalGoal.findUnique({
      where: { id: event.relatedGoalId },
    });

    if (goal) {
      const newStress = Math.max(
        0,
        Math.min(100, goal.stressLevel + consequences.stressChange)
      );

      await prisma.personalGoal.update({
        where: { id: event.relatedGoalId },
        data: { stressLevel: newStress },
      });
    }
  }
}

// ============================================================================
// AUTO-RESOLUTION CRON JOB HELPER
// ============================================================================

/**
 * Find and resolve all events that are due
 * Should be called by a cron job every hour
 */
export async function resolveOverdueEvents(): Promise<{
  resolved: number;
  errors: number;
}> {
  const now = new Date();

  // Find events that should be resolved
  const overdueEvents = await prisma.scheduledEvent.findMany({
    where: {
      resolved: false,
      scheduledFor: {
        lte: now,
      },
    },
    include: {
      Agent: {
        include: {
          PersonalityCore: true,
          InternalState: true,
        },
      },
    },
  });

  let resolved = 0;
  let errors = 0;

  for (const event of overdueEvents) {
    try {
      const agentWithRelations = {
        ...event.Agent,
        personalityCore: event.Agent.PersonalityCore,
        internalState: event.Agent.InternalState,
      } as AgentWithRelations;
      await resolveEvent(event, agentWithRelations);
      resolved++;
    } catch (error) {
      console.error(`Failed to resolve event ${event.id}:`, error);
      errors++;
    }
  }

  return { resolved, errors };
}
