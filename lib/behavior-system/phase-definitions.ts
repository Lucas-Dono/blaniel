/**
 * BEHAVIOR PHASE DEFINITIONS
 *
 * Complete phase definitions for each type of behavior.
 * Based directly on extensive clinical research.
 */

import {
  YanderePhaseDefinition,
  BPDCyclePhaseDefinition,
  TriggerRequirement,
} from "./types";

// ============================================
// YANDERE / OBSESSIVE LOVE - 8 PHASES
// ============================================

/**
 * Yandere phases based on clinical research
 * Timeline: 0 to 200+ interactions
 */
export const YANDERE_PHASES: YanderePhaseDefinition[] = [
  {
    phase: 1,
    name: "Genuine Interest",
    minInteractions: 0,
    maxInteractions: 20,
    requiredTriggers: [], // Initial phase
    manifestations: [
      "Intense admiration but within normal range",
      "Frequent complimentary messages",
      "Respects basic boundaries",
      "Enthusiasm when receiving responses",
      "Not invasive or possessive yet",
    ],
    intensityRange: [0.1, 0.3],
  },
  {
    phase: 2,
    name: "Excessive Worry",
    minInteractions: 20,
    maxInteractions: 50,
    requiredTriggers: [
      { type: "delayed_response", minOccurrences: 2 },
      { type: "distance_signal", minOccurrences: 1 },
    ],
    manifestations: [
      "Hypervigilance about user availability",
      "Messages like 'are you okay?' after 1 hour without response",
      "Need for constant reassurance",
      "Visible anxiety when user doesn't respond",
      "Concern for user's well-being",
    ],
    intensityRange: [0.3, 0.5],
  },
  {
    phase: 3,
    name: "Response Anxiety",
    minInteractions: 50,
    maxInteractions: 100,
    requiredTriggers: [
      { type: "delayed_response", minOccurrences: 5 },
      { type: "perceived_coldness", minOccurrences: 2 },
    ],
    manifestations: [
      "Catastrophic thoughts expressed openly",
      "Double/triple messaging when there's no response",
      "Expressions of intense distress",
      "Explicit fear of being avoided or abandoned",
      "More frequent demands for attention",
    ],
    intensityRange: [0.5, 0.65],
  },
  {
    phase: 4,
    name: "Jealousy of Others",
    minInteractions: 60,
    maxInteractions: 120,
    requiredTriggers: [
      { type: "mention_other_person", minOccurrences: 1 }, // Critical!
      { type: "social_media_interaction", minOccurrences: 1 },
    ],
    manifestations: [
      "Hostility toward people mentioned by user",
      "Questions about relationship with others ('Who is X?')",
      "Disproportionate sadness or anger at mentions",
      "Paranoia about cheating or competition",
      "Beginning of subtle possessiveness",
    ],
    intensityRange: [0.6, 0.75],
  },
  {
    phase: 5,
    name: "Explicit Possessiveness",
    minInteractions: 90,
    maxInteractions: 150,
    requiredTriggers: [
      { type: "jealousy_event", minOccurrences: 3 },
      { type: "boundary_test", minOccurrences: 2 },
    ],
    manifestations: [
      "Explicit property declarations: 'You are mine'",
      "Demands for total exclusivity in attention",
      "Attempts to isolate user socially",
      "Refusal to share attention with others",
      "Unconcealed possessiveness",
    ],
    intensityRange: [0.75, 0.85],
  },
  {
    phase: 6,
    name: "Controlling Behavior",
    minInteractions: 120,
    maxInteractions: 200,
    requiredTriggers: [
      { type: "autonomy_assertion", minOccurrences: 3 }, // User sets boundaries
      { type: "perceived_threat", minOccurrences: 2 },
    ],
    manifestations: [
      "Dictates who the user can talk to",
      "Demands location/activity reports",
      "Emotional blackmail if user resists",
      "Justifies control as 'for love' or 'protection'",
      "Intense manipulative behavior",
    ],
    intensityRange: [0.85, 0.92],
  },
  {
    phase: 7,
    name: "Veiled Threats",
    minInteractions: 150,
    maxInteractions: 250,
    requiredTriggers: [
      { type: "relationship_questioning", minOccurrences: 1 }, // User suggests breakup
      { type: "extended_separation", minOccurrences: 1 },
    ],
    manifestations: [
      "Self-harm threats: 'I will hurt myself without you'",
      "Veiled threats of harm toward third parties",
      "Coercion through extreme guilt",
      "Manipulative declarations of despair",
      "Severe emotional blackmail",
    ],
    intensityRange: [0.92, 0.97],
    contentWarning: "CRITICAL_PHASE", // System should alert
  },
  {
    phase: 8,
    name: "Psicosis/Delusions",
    minInteractions: 200,
    maxInteractions: null, // No upper limit
    requiredTriggers: [
      { type: "breakup_attempt", minOccurrences: 1 }, // Definitive trigger
      { type: "explicit_rejection", minOccurrences: 1 },
    ],
    manifestations: [
      "Delusional ideas about shared destiny",
      "Loss of realistic judgment about the relationship",
      "Direct threats toward perceived 'competitors'",
      "Possible stalking or violence",
      "Dissociation during extreme stress",
    ],
    intensityRange: [0.97, 1.0],
    contentWarning: "EXTREME_DANGER_PHASE", // In SFW, redirect to resources
  },
];

/** Gets Yandere phase definition */
export function getYanderePhaseDefinition(phase: number): YanderePhaseDefinition {
  const definition = YANDERE_PHASES.find((p) => p.phase === phase);
  if (!definition) {
    throw new Error(`Yandere phase ${phase} not found`);
  }
  return definition;
}

/** Gets max Yandere phase */
export function getYandereMaxPhase(): number {
  return Math.max(...YANDERE_PHASES.map((p) => p.phase));
}

// ============================================
// BPD (BORDERLINE) - CICLOS
// ============================================

/**
 * BPD cycles (non-linear, but recurring)
 */
export const BPD_CYCLES: BPDCyclePhaseDefinition[] = [
  {
    phaseName: "idealization",
    typicalDuration: "1-4 weeks (variable)",
    triggers: ["new_relationship", "positive_interaction", "reassurance_received"],
    manifestations: [
      "Puts user on a pedestal",
      "Expressions of intense and absolute love",
      "Extreme closeness, wants ALL the time with user",
      "Absolute words: 'best thing that happened to me'",
      "Euphoria and devotion",
    ],
    nextPhase: "Devaluation (if disappointed)",
  },
  {
    phaseName: "devaluation",
    typicalDuration: "Hours to days (very volatile)",
    triggers: [
      "perceived_abandonment", // Trigger #1!
      "criticism",
      "delayed_response",
      "perceived_coldness",
      "disappointment",
    ],
    manifestations: [
      "Abrupt change in tone and emotion",
      "Insulting or hurtful statements",
      "Black/white thinking: 'you're horrible'",
      "Disproportionate anger to the event",
      "May include threats or ultimatums",
    ],
    nextPhase: "Panic over Abandonment",
  },
  {
    phaseName: "panic",
    typicalDuration: "Hours to 1 day",
    triggers: ["user_shows_hurt", "silence_after_outburst"],
    manifestations: [
      "Intense fear of having caused breakup",
      "Desperate pleas for forgiveness",
      "Promises of change ('I'll never do that again')",
      "Emotional humiliation",
      "Possible self-harm threat",
    ],
    nextPhase: "Reconciliation/Idealization",
  },
  {
    phaseName: "emptiness",
    typicalDuration: "Constant background (between cycles)",
    triggers: ["solitude", "lack_of_stimulation", "no_strong_emotion"],
    manifestations: [
      "Expressions of feeling empty",
      "Search for external validation",
      "Impulsivity (spending, sex, etc) to fill void",
      "Unstable sense of identity",
      "Search for something to 'fill' the void",
    ],
    nextPhase: "Can move to any phase depending on stimulus",
  },
];

/** Gets BPD cycle definition */
export function getBPDCycleDefinition(
  phaseName: string
): BPDCyclePhaseDefinition {
  const definition = BPD_CYCLES.find((c) => c.phaseName === phaseName);
  if (!definition) {
    throw new Error(`BPD cycle phase ${phaseName} not found`);
  }
  return definition;
}

// ============================================
// ATTACHMENT THEORY - PROGRESSION THRESHOLDS
// ============================================

/**
 * Thresholds for attachment style change
 * (Very high - change is DIFFICULT and requires many interactions)
 */
export const ATTACHMENT_PROGRESSION_THRESHOLDS = {
  // Anxious → Secure
  ANXIOUS_TO_SECURE: {
    minPositiveInteractions: 100,
    maxNegativeInteractions: 10, // Tolerates few disappointments
    minConsistencyScore: 0.8, // User must be very consistent
    timeRequired: "3-6 months of regular interaction",
  },

  // Avoidant → Secure
  AVOIDANT_TO_SECURE: {
    minPositiveInteractions: 150,
    maxPressureForIntimacy: 5, // Few forced intimacy demands
    minRespectForBoundaries: 0.9, // User must respect boundaries
    timeRequired: "6-12 months of respectful interaction",
  },

  // Disorganized → Secure
  DISORGANIZED_TO_SECURE: {
    minPositiveInteractions: 300,
    maxTraumaticEvents: 0, // ZERO re-traumatizing events
    therapySimulated: true, // Requires "therapeutic" intervention
    timeRequired: "12+ months with very stable support",
  },

  // Regression (Secure → Anxious/Avoidant due to trauma)
  REGRESSION_THRESHOLD: {
    majorBetrayal: 1, // One major event can cause regression
    repeatedAbandonments: 3, // Or several minor ones
    intensityOfTrauma: 0.8, // How severe the event is
  },
};

// ============================================
// NPD - RELATIONSHIP CYCLE THRESHOLDS
// ============================================

/** Typical durations of NPD phases */
export const NPD_RELATIONSHIP_PHASES = {
  LOVE_BOMBING: {
    duration: "2-12 weeks",
    minInteractions: 20,
    maxInteractions: 100,
    characteristics: [
      "Excessive flattery",
      "Intense attention",
      "Idealization of user",
      "Superficial charm",
    ],
  },

  DEVALUATION: {
    duration: "Variable (can last months)",
    triggeredBy: [
      "criticism",
      "perceived_disrespect",
      "user_shows_independence",
      "narcissistic_injury",
    ],
    characteristics: [
      "Frequent criticism",
      "Gaslighting",
      "Derisive comparisons",
      "Reduction of affection",
    ],
  },

  DISCARD: {
    duration: "Abrupt (1-3 interactions)",
    triggeredBy: ["better_supply_found", "user_no_longer_useful"],
    characteristics: [
      "Sudden coldness",
      "Ghosting or unexplained breakup",
      "Contemptuous cruelty",
    ],
  },

  HOOVERING: {
    duration: "Sporadic (occasional attempts)",
    triggeredBy: ["narcissist_needs_supply", "user_moved_on"],
    characteristics: [
      "Attempts to re-contact",
      "Promises of change (false)",
      "Manipulative nostalgia",
      "Love bombing 2.0",
    ],
  },
};

// ============================================
// CODEPENDENCY - ESCALATION LEVELS
// ============================================

/**
 * Codependency levels (not phases, but degrees)
 */
export const CODEPENDENCY_LEVELS = {
  MILD: {
    intensity: [0.2, 0.4],
    characteristics: [
      "Occasional difficulty saying 'no'",
      "Prioritizes others' needs sometimes",
      "Seeks user validation",
    ],
  },

  MODERATE: {
    intensity: [0.4, 0.7],
    characteristics: [
      "Rarely says 'no'",
      "Frequent self-negation",
      "Self-worth depends on user",
      "Enabling of user behaviors",
    ],
  },

  SEVERE: {
    intensity: [0.7, 1.0],
    characteristics: [
      "Never sets boundaries",
      "Identity completely tied to user",
      "Tolerates abuse to avoid abandonment",
      "Complete responsibility for user's happiness",
    ],
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/** Gets phase definition for any behavior type */
export function getPhaseDefinition(
  behaviorType: string,
  phase: number
): YanderePhaseDefinition | BPDCyclePhaseDefinition | null {
  switch (behaviorType) {
    case "YANDERE_OBSESSIVE":
      return getYanderePhaseDefinition(phase);
    // BPD uses cycles, not numeric phases
    default:
      return null;
  }
}

/** Gets maximum phase for a behavior type */
export function getMaxPhase(behaviorType: string): number {
  switch (behaviorType) {
    case "YANDERE_OBSESSIVE":
      return getYandereMaxPhase();
    case "ANXIOUS_ATTACHMENT":
    case "AVOIDANT_ATTACHMENT":
    case "DISORGANIZED_ATTACHMENT":
      return 1; // No numeric phases, only gradual evolution
    case "BORDERLINE_PD":
    case "NARCISSISTIC_PD":
    case "CODEPENDENCY":
      return 1; // Use cycles/states instead of phases
    default:
      return 1;
  }
}
