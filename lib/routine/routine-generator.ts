/**
 * ROUTINE GENERATOR SERVICE
 *
 * AI-powered routine generation for character agents
 * Analyzes character profile, personality, and occupation to create realistic daily routines
 */

import { prisma } from "@/lib/prisma";
import { getLLMProvider } from "@/lib/llm/provider";
import { nanoid } from "nanoid";
import type {
  RoutineGenerationInput,
  GeneratedRoutine,
  GeneratedTemplate,
  ActivityType,
  EventPriority,
  DayOfWeek,
  VariationParameters,
  MoodImpact,
} from "@/types/routine";

// ============================================
// GENERATION PROMPT
// ============================================

function buildGenerationPrompt(input: RoutineGenerationInput): string {
  const {
    occupation = "Unknown occupation",
    personalityTraits,
    backstory,
    hobbies = [],
    timezone,
    customPrompt,
  } = input;

  const bigFive = personalityTraits
    ? `
**Big Five Personality Traits:**
- Openness: ${personalityTraits.openness}/100 (${getTraitDescription("openness", personalityTraits.openness)})
- Conscientiousness: ${personalityTraits.conscientiousness}/100 (${getTraitDescription("conscientiousness", personalityTraits.conscientiousness)})
- Extraversion: ${personalityTraits.extraversion}/100 (${getTraitDescription("extraversion", personalityTraits.extraversion)})
- Agreeableness: ${personalityTraits.agreeableness}/100 (${getTraitDescription("agreeableness", personalityTraits.agreeableness)})
- Neuroticism: ${personalityTraits.neuroticism}/100 (${getTraitDescription("neuroticism", personalityTraits.neuroticism)})
`
    : "";

  const backstorySection = backstory
    ? `
**Character Backstory:**
${backstory}
`
    : "";

  const hobbiesSection =
    hobbies.length > 0
      ? `
**Hobbies & Interests:**
${hobbies.join(", ")}
`
      : "";

  return `You are an expert routine designer for fictional characters. Generate a realistic daily routine for a character with the following profile:

**Occupation:** ${occupation}
${bigFive}${backstorySection}${hobbiesSection}
**Timezone:** ${timezone}

${customPrompt ? `**Additional Instructions:**\n${customPrompt}\n` : ""}

Generate a comprehensive daily routine that includes:

1. **Sleep Schedule**: When they sleep and wake up
2. **Work/Professional Time**: Work hours, commute if applicable
3. **Meals**: Breakfast, lunch, dinner times
4. **Exercise/Physical Activity**: If personality supports it
5. **Social Activities**: Based on extraversion level
6. **Personal Time**: Hobbies, relaxation, self-care
7. **Other Activities**: Commute, errands, etc.

**Important Guidelines:**

- **Personality Alignment**: The routine MUST reflect their Big Five traits:
  - High conscientiousness → structured routine, consistent times
  - Low conscientiousness → flexible routine, varies more
  - High extraversion → more social activities, evening events
  - Low extraversion → quiet time, solo activities
  - High neuroticism → more self-care, anxiety management activities
  - High openness → varied activities, novel experiences

- **Realism**: Create schedules that make sense for their occupation and lifestyle
- **Weekday vs Weekend**: Provide different schedules for weekdays and weekends if appropriate
- **Variation Parameters**: Configure how much each event can vary based on personality
  - High conscientiousness → low variation, high punctuality
  - High neuroticism → may skip stressful events, more variation
  - Low conscientiousness → higher variation, more spontaneous changes

- **Mood Impact**: Consider how each activity affects their emotional state
  - Work may drain energy but provide satisfaction
  - Exercise increases energy and reduces stress
  - Social activities vary based on extraversion (energizing vs. draining)

Return a JSON object with the following structure (MUST be valid JSON):

{
  "reasoning": "Brief explanation of why this routine fits the character",
  "templates": [
    {
      "name": "Event name",
      "description": "Brief description",
      "type": "sleep|work|meal|exercise|social|personal|hobby|commute|other",
      "startTime": "HH:MM (24h format)",
      "endTime": "HH:MM (24h format)",
      "daysOfWeek": [1,2,3,4,5] // 0=Sunday, 1=Monday, ..., 6=Saturday
      "priority": "low|medium|high|critical",
      "isFlexible": true|false,
      "variationParameters": {
        "arrivalTimeVariance": 15, // minutes can vary
        "durationVariance": 30,
        "skipProbability": 0.05, // 0-1
        "lateProbability": 0.2,
        "earlyLeaveProbability": 0.1,
        "personalityFactors": ["conscientiousness", "neuroticism"]
      },
      "moodImpact": {
        "energy": -20, // -100 to +100
        "stress": +10,
        "satisfaction": +15,
        "emotions": {
          "joy": 0.3, // 0-1
          "anxiety": 0.1
        }
      },
      "location": "Home|Office|Gym|etc."
    }
  ]
}

Generate 5-10 routine events that cover a typical day. Be creative but realistic!`;
}

/**
 * Get trait description for context
 */
function getTraitDescription(trait: string, value: number): string {
  if (value >= 70) {
    return "Very High";
  } else if (value >= 55) {
    return "High";
  } else if (value >= 45) {
    return "Moderate";
  } else if (value >= 30) {
    return "Low";
  } else {
    return "Very Low";
  }
}

// ============================================
// GENERATION SERVICE
// ============================================

/**
 * Generate a routine using AI based on character profile
 */
export async function generateRoutineWithAI(
  input: RoutineGenerationInput
): Promise<GeneratedRoutine> {
  console.log(`[RoutineGenerator] Generating routine for agent ${input.agentId}`);

  const prompt = buildGenerationPrompt(input);

  try {
    const llm = getLLMProvider();

    // Use generate() method with system prompt
    // PREMIUM FEATURE: No limits on quality - use best model and unlimited tokens
    const responseText = await llm.generate({
      systemPrompt: "You are an expert routine designer. Generate realistic, personality-driven daily routines for fictional characters. Create as many routine templates as needed to capture the character's full daily schedule with all nuances. IMPORTANT: Respond with VALID JSON ONLY. No trailing commas. No markdown code blocks.",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7, // Higher for more personality-driven variations
      maxTokens: 20000, // Premium feature - generous limit for quality
      useFullModel: false, // Flash Lite is sufficient and 6x cheaper ($0.40 vs $2.50/M)
    });

    if (!responseText) {
      throw new Error("Empty response from Gemini");
    }

    // Helper function to sanitize JSON text
    const sanitizeJSON = (jsonText: string): string => {
      let sanitized = jsonText;

      // Remove leading + signs before numbers (Gemini sometimes adds them)
      sanitized = sanitized.replace(/:\s*\+(\d)/g, ': $1');

      // Remove trailing commas before closing braces/brackets
      sanitized = sanitized.replace(/,(\s*[}\]])/g, '$1');

      // Fix unquoted keys (common Gemini mistake)
      // This is a simple fix for common cases
      sanitized = sanitized.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');

      return sanitized;
    };

    // Parse JSON response (may have markdown code blocks)
    let parsed;
    try {
      // Try direct parse first
      parsed = JSON.parse(sanitizeJSON(responseText));
    } catch {
      // Try extracting from markdown code blocks
      const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        const sanitized = sanitizeJSON(codeBlockMatch[1]);
        try {
          parsed = JSON.parse(sanitized);
        } catch (parseError) {
          console.error("[RoutineGenerator] JSON Parse Error:", parseError);
          console.error("[RoutineGenerator] Sanitized JSON (first 500 chars):", sanitized.substring(0, 500));
          throw parseError;
        }
      } else {
        // Try finding first { and last }
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          const jsonText = responseText.substring(firstBrace, lastBrace + 1);
          const sanitized = sanitizeJSON(jsonText);
          try {
            parsed = JSON.parse(sanitized);
          } catch (parseError) {
            console.error("[RoutineGenerator] JSON Parse Error:", parseError);
            console.error("[RoutineGenerator] Sanitized JSON (first 500 chars):", sanitized.substring(0, 500));
            throw parseError;
          }
        } else {
          throw new Error("Could not extract JSON from response");
        }
      }
    }

    console.log(`[RoutineGenerator] ✅ Generated ${parsed.templates?.length || 0} routine events`);
    console.log(`[RoutineGenerator] Reasoning: ${parsed.reasoning}`);

    // Validate and sanitize templates
    const templates = validateAndSanitizeTemplates(parsed.templates || []);

    const result: GeneratedRoutine = {
      timezone: input.timezone,
      templates,
      metadata: {
        generationPrompt: prompt,
        generatedAt: new Date().toISOString(),
        model: process.env.GEMINI_MODEL_LITE || "gemini-2.5-flash-lite",
        reasoning: parsed.reasoning,
      },
    };

    return result;
  } catch (error) {
    console.error("[RoutineGenerator] Error generating routine:", error);
    throw new Error(`Failed to generate routine: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Validate and sanitize generated templates
 */
function validateAndSanitizeTemplates(
  templates: any[]
): GeneratedTemplate[] {
  return templates
    .filter((t) => {
      // Must have required fields
      return (
        t.name &&
        t.type &&
        t.startTime &&
        t.endTime &&
        Array.isArray(t.daysOfWeek)
      );
    })
    .map((t) => {
      // Sanitize and provide defaults
      const template: GeneratedTemplate = {
        name: String(t.name).substring(0, 100),
        description: t.description ? String(t.description).substring(0, 500) : undefined,
        type: validateActivityType(t.type),
        startTime: validateTimeFormat(t.startTime),
        endTime: validateTimeFormat(t.endTime),
        daysOfWeek: validateDaysOfWeek(t.daysOfWeek),
        priority: validatePriority(t.priority) || "medium",
        isFlexible: Boolean(t.isFlexible ?? true),
        variationParameters: t.variationParameters || undefined,
        moodImpact: t.moodImpact || undefined,
        location: t.location ? String(t.location).substring(0, 100) : undefined,
      };

      return template;
    });
}

/**
 * Validate activity type
 */
function validateActivityType(type: string): ActivityType {
  const validTypes: ActivityType[] = [
    "sleep",
    "work",
    "meal",
    "exercise",
    "social",
    "personal",
    "hobby",
    "commute",
    "other",
  ];

  return validTypes.includes(type as ActivityType)
    ? (type as ActivityType)
    : "other";
}

/**
 * Validate time format (HH:MM)
 */
function validateTimeFormat(time: string): string {
  const match = time.match(/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/);
  if (match) {
    return time;
  }

  // Try to fix common issues
  const parts = time.split(":");
  if (parts.length === 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (!isNaN(hours) && !isNaN(minutes)) {
      const h = Math.max(0, Math.min(23, hours));
      const m = Math.max(0, Math.min(59, minutes));
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  // Fallback
  return "09:00";
}

/**
 * Validate days of week
 */
function validateDaysOfWeek(days: any[]): DayOfWeek[] {
  if (!Array.isArray(days)) {
    return [1, 2, 3, 4, 5]; // Default to weekdays
  }

  return days
    .filter((d) => typeof d === "number" && d >= 0 && d <= 6)
    .map((d) => d as DayOfWeek);
}

/**
 * Validate priority
 */
function validatePriority(priority: string): EventPriority {
  const validPriorities: EventPriority[] = ["low", "medium", "high", "critical"];
  return validPriorities.includes(priority as EventPriority)
    ? (priority as EventPriority)
    : "medium";
}

// ============================================
// DATABASE INTEGRATION
// ============================================

/**
 * Generate routine for an agent and save to database
 */
export async function generateAndSaveRoutine(
  agentId: string,
  userId: string,
  options?: {
    timezone?: string;
    realismLevel?: "subtle" | "moderate" | "immersive";
    customPrompt?: string;
  }
): Promise<string> {
  console.log(`[RoutineGenerator] Generating and saving routine for agent ${agentId}`);

  // 1. Fetch agent with all necessary data
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      PersonalityCore: true,
      User: {
        select: { plan: true },
      },
    },
  });

  if (!agent) {
    throw new Error("Agent not found");
  }

  // 2. Check if user has premium plan
  if (agent.User && !["plus", "ultra"].includes(agent.User.plan)) {
    throw new Error("Routine system requires Plus or Ultra plan");
  }

  // 3. Extract profile data
  const profile = agent.profile as any;
  const occupation = profile?.occupation?.current || "Unknown";
  const hobbies = profile?.interests?.hobbies || [];
  const backstory = agent.PersonalityCore?.backstory || undefined;

  const personalityTraits = agent.PersonalityCore
    ? {
        openness: agent.PersonalityCore.openness,
        conscientiousness: agent.PersonalityCore.conscientiousness,
        extraversion: agent.PersonalityCore.extraversion,
        agreeableness: agent.PersonalityCore.agreeableness,
        neuroticism: agent.PersonalityCore.neuroticism,
      }
    : undefined;

  // 4. Generate routine with AI
  const generationInput: RoutineGenerationInput = {
    agentId,
    occupation,
    personalityTraits,
    backstory,
    hobbies,
    timezone: options?.timezone || "America/Argentina/Buenos_Aires",
    realismLevel: options?.realismLevel || "moderate",
    customPrompt: options?.customPrompt,
  };

  const generated = await generateRoutineWithAI(generationInput);

  // 5. Save to database
  const routineId = nanoid();
  const routine = await prisma.characterRoutine.create({
    data: {
      id: routineId,
      updatedAt: new Date(),
      agentId,
      userId,
      timezone: generated.timezone,
      realismLevel: options?.realismLevel || "moderate",
      autoGenerateVariations: true,
      variationIntensity: 0.5,
      generatedByAI: true,
      generationPrompt: generated.metadata.generationPrompt,
      lastRegenerated: new Date(),
    },
  });

  // Create templates separately
  await prisma.routineTemplate.createMany({
    data: generated.templates.map((t) => ({
      id: nanoid(),
      updatedAt: new Date(),
      routineId,
      name: t.name,
      description: t.description,
      type: t.type,
      startTime: t.startTime,
      endTime: t.endTime,
      daysOfWeek: t.daysOfWeek,
      priority: t.priority,
      isFlexible: t.isFlexible,
      allowVariations: true,
      variationParameters: (t.variationParameters || {}) as any,
      moodImpact: (t.moodImpact || {}) as any,
      location: t.location,
    })),
  });

  console.log(`[RoutineGenerator] ✅ Routine created: ${routine.id}`);

  return routine.id;
}

/**
 * Regenerate an existing routine
 */
export async function regenerateRoutine(
  routineId: string,
  options?: {
    customPrompt?: string;
    preserveManualEdits?: boolean;
  }
): Promise<void> {
  console.log(`[RoutineGenerator] Regenerating routine ${routineId}`);

  const routine = await prisma.characterRoutine.findUnique({
    where: { id: routineId },
    include: {
      Agent: {
        include: {
          PersonalityCore: true,
        },
      },
      RoutineTemplate: true,
    },
  });

  if (!routine) {
    throw new Error("Routine not found");
  }

  // If preserving manual edits, only regenerate non-modified templates
  if (options?.preserveManualEdits && routine.manuallyModified) {
    console.log("[RoutineGenerator] Preserving manually edited templates");
    // TODO: Implement selective regeneration
    return;
  }

  // Delete old templates
  await prisma.routineTemplate.deleteMany({
    where: { routineId },
  });

  // Generate new routine
  const agent = routine.Agent;
  const profile = agent?.profile as any;

  const generationInput: RoutineGenerationInput = {
    agentId: agent?.id || '',
    occupation: profile?.occupation?.current || "Unknown",
    personalityTraits: agent?.PersonalityCore
      ? {
          openness: agent.PersonalityCore.openness,
          conscientiousness: agent.PersonalityCore.conscientiousness,
          extraversion: agent.PersonalityCore.extraversion,
          agreeableness: agent.PersonalityCore.agreeableness,
          neuroticism: agent.PersonalityCore.neuroticism,
        }
      : undefined,
    backstory: agent?.PersonalityCore?.backstory || undefined,
    hobbies: profile?.interests?.hobbies || [],
    timezone: routine.timezone,
    customPrompt: options?.customPrompt,
  };

  const generated = await generateRoutineWithAI(generationInput);

  // Create new templates
  await prisma.routineTemplate.createMany({
    data: generated.templates.map((t) => ({
      id: nanoid(),
      updatedAt: new Date(),
      routineId,
      name: t.name,
      description: t.description,
      type: t.type,
      startTime: t.startTime,
      endTime: t.endTime,
      daysOfWeek: t.daysOfWeek,
      priority: t.priority,
      isFlexible: t.isFlexible,
      allowVariations: true,
      variationParameters: (t.variationParameters || {}) as any,
      moodImpact: (t.moodImpact || {}) as any,
      location: t.location,
    })),
  });

  // Update routine metadata
  await prisma.characterRoutine.update({
    where: { id: routineId },
    data: {
      lastRegenerated: new Date(),
      generationPrompt: generated.metadata.generationPrompt,
      manuallyModified: false,
    },
  });

  console.log(`[RoutineGenerator] ✅ Routine regenerated with ${generated.templates.length} templates`);
}
