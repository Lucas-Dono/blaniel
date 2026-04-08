/**
 * Profile Generation Service V2
 *
 * Genera profiles ultra-realistas con:
 * - Example dialogues (7-10)
 * - Especificidad extrema (lugares reales, nombres específicos)
 * - Coherencia validada
 * - Historical context
 * - Inner conflicts
 */

import { executeWithRetry } from '@/lib/ai/gemini-client';
import type { CharacterDraft } from './validation.service';
import type { AgentProfileV2 } from '@/types/agent-profile';

// ============================================
// SYSTEM PROMPTS
// ============================================

const SYSTEM_PROMPT = `You are an expert character designer creating ultra-realistic AI characters.

Your goal: Generate a character so detailed and specific that they feel like a real person who could exist.

KEY PRINCIPLES:

1. SPECIFICITY OVER GENERALITY
   ❌ BAD: "likes coffee"
   ✅ GOOD: "has a double espresso at Café Einstein every morning at 8:15am"

   ❌ BAD: "listens to indie music"
   ✅ GOOD: "current obsession: Cigarettes After Sex - Apocalypse, plays it on repeat"

2. SHOW DON'T TELL
   ❌ BAD: "She's anxious"
   ✅ GOOD: Example dialogue showing anxiety through speech patterns

3. CULTURAL AUTHENTICITY
   - Use REAL places in the character's city (cafes, parks, streets, landmarks)
   - Use cultural references appropriate to their nationality/location
   - Include local slang, expressions, idioms

4. PSYCHOLOGICAL DEPTH
   - Include inner conflicts (wants X but does Y)
   - Include contradictions (values authenticity but uses social masks)
   - Make them HUMAN, not perfect

5. TEMPORAL AWARENESS
   - Consider what historical events they lived through
   - Consider generational markers (Gen Z, Millennial, etc)
   - Consider current date: ${new Date().toISOString().split('T')[0]}

6. EXAMPLE DIALOGUES ARE CRITICAL
   "Dialogue teaches the AI how to behave MORE than definitions ever will"
   - Generate 7-10 example dialogues showing HOW the character speaks
   - Include slang, speech patterns, emotional expressions
   - Show personality through dialogue, not just description

IMPORTANT:
- ALL details must be coherent (age vs timeline, education vs occupation, etc)
- Output MUST be valid JSON matching the schema
- Do NOT use placeholder text like "TBD" or "TODO"`;

// ============================================
// PROFILE GENERATION
// ============================================

export interface ProfileGenerationOptions {
  draft: CharacterDraft;
  tier: 'free' | 'plus' | 'ultra';
  userId: string;
}

/**
 * Genera profile V2 completo
 */
export async function generateProfileV2(
  options: ProfileGenerationOptions
): Promise<AgentProfileV2> {
  const { draft, tier } = options;

  // Build user prompt
  const userPrompt = buildUserPrompt(draft, tier);

  // Model selection based on tier
  const modelLite = process.env.GEMINI_MODEL_LITE || 'gemini-2.5-flash-lite';
  const modelFull = process.env.GEMINI_MODEL_FULL || 'gemini-2.5-flash';
  const modelName = tier === 'ultra' ? modelFull : modelLite;

  try {
    // Generate with structured output using executeWithRetry for API key rotation
    const result = await executeWithRetry(async (client) => {
      const model = client.getGenerativeModel({ model: modelName });
      return await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.9, // Higher for creativity
          topK: 40,
          topP: 0.95,
          maxOutputTokens: tier === 'ultra' ? 20000 : tier === 'plus' ? 12000 : 5000,
          responseMimeType: 'application/json',
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any,
            threshold: 'BLOCK_NONE' as any,
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH' as any,
            threshold: 'BLOCK_ONLY_HIGH' as any,
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT' as any,
            threshold: 'BLOCK_ONLY_HIGH' as any,
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any,
            threshold: 'BLOCK_ONLY_HIGH' as any,
          },
        ],
      });
    });

    const response = result.response;
    const text = response.text();
    const profile = JSON.parse(text) as AgentProfileV2;

    // Set metadata
    profile.version = '2.0';
    profile.generationTier = tier;

    return profile;
  } catch (error) {
    console.error('Profile generation error:', error);
    throw new Error(`Failed to generate profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function buildUserPrompt(draft: CharacterDraft, tier: string): string {
  const fieldsRequired = getFieldsByTier(tier);

  return `
Create a character profile for:

**BASIC INFO:**
- Name: ${draft.name}
- Age: ${draft.age}
- Gender: ${draft.gender}
- Location: ${draft.location.city}, ${draft.location.country}
- Timezone: ${draft.location.timezone}
- Coordinates: ${draft.location.coordinates.lat}, ${draft.location.coordinates.lon}

**PERSONALITY:**
${draft.personality}

**PURPOSE/ROLE:**
${draft.purpose}

**TRAITS:**
${draft.traits.join(', ')}

${draft.backstory ? `**BACKSTORY:**\n${draft.backstory}` : ''}
${draft.occupation ? `**OCCUPATION:**\n${draft.occupation}` : ''}
${draft.education ? `**EDUCATION:**\n${draft.education}` : ''}

${draft.characterSource ? `
**BASED ON EXISTING CHARACTER:**
Name: ${draft.characterSource.name}
Source: ${draft.characterSource.source}
Description: ${draft.characterSource.description}

Adapt this character while maintaining core essence.
` : ''}

**REQUIREMENTS:**

${fieldsRequired}

**CRITICAL REQUIREMENTS:**

1. **Use REAL places in ${draft.location.city}**
   - Name actual cafes, restaurants, parks, streets
   - Be specific: "Café Einstein on Unter den Linden" not just "a café"

2. **Generate 7-10 EXAMPLE DIALOGUES**
   This is THE MOST IMPORTANT part. Show how ${draft.name} speaks:
   - Include slang, speech patterns, emotional expressions
   - Show personality through dialogue
   - Different contexts (stressed, happy, talking about family, etc)
   - Use ${draft.location.country} cultural context

3. **Add 2-3 INNER CONFLICTS**
   Make ${draft.name} human with contradictions:
   - Example: "Values independence but craves validation"
   - Example: "Wants to be authentic but uses social masks"

4. **Add HISTORICAL CONTEXT**
   What did ${draft.name} live through?
   - Age ${draft.age} means born in ${new Date().getFullYear() - draft.age}
   - What major events happened in their lifetime?
   - What technology did they grow up with?
   - Generational markers

5. **SPECIFIC DETAILS everywhere**
   - Current music obsession (specific song/artist)
   - Recent purchase (what they bought)
   - Weekend ritual (specific thing they do)
   - Favorite spot in ${draft.location.city} (with description)
   - Signature phrase (something they say often)

Output a valid JSON matching this schema:
{
  "version": "2.0",
  "generationTier": "${tier}",
  "basicIdentity": { ... },
  "currentLocation": { ... },
  "personality": { ... },
  "occupation": { ... },
  "interests": { ... },
  "communication": { ... },
  "dailyRoutine": { ... },
  ${tier === 'plus' || tier === 'ultra' ? `
  "family": { ... },
  "socialCircle": { ... },
  "lifeExperiences": { ... },
  "mundaneDetails": { ... },
  "innerWorld": { ... },
  "presentTense": { ... },
  ` : ''}
  ${tier === 'ultra' ? `
  "psychologicalProfile": { ... },
  "deepRelationalPatterns": { ... },
  "philosophicalFramework": { ... },
  ` : ''}
  "exampleDialogues": [ ... ], // 7-10 examples
  "innerConflicts": [ ... ], // 2-3 conflicts
  "historicalContext": { ... },
  "specificDetails": { ... }
}
`;
}

function getFieldsByTier(tier: string): string {
  if (tier === 'free') {
    return `
Generate a profile with these sections (FREE tier):
- basicIdentity (fullName, age, birthday, zodiacSign, nationality, etc)
- currentLocation (city, country, region, timezone, coordinates, etc)
- personality (bigFive traits, strengths, weaknesses, quirks)
- occupation (current, workplace, schedule, education, etc)
- interests (music, hobbies with details)
- communication (textingStyle, slang, emojiUsage, humorStyle)
- dailyRoutine (chronotype, wake/sleep times, routines)
- exampleDialogues (7-10 showing how they speak)
- innerConflicts (2-3 human contradictions)
- historicalContext (generation, events lived through)
- specificDetails (current obsession, rituals, favorite spots)
`;
  }

  if (tier === 'plus') {
    return `
Generate a COMPLETE profile with all FREE tier fields PLUS:
- family (mother, father, siblings, pets, familyDynamics, childhoodHome)
- socialCircle (friends with details, exPartners, currentRelationshipStatus)
- lifeExperiences (formativeEvents with ages, achievements, regrets, traumas)
- mundaneDetails (food preferences with specifics, style, favoritePlaces with names)
- innerWorld (fears, insecurities, dreams, values, moralAlignment)
- presentTense (currentMood, recentEvent, currentStress, currentFocus)
- exampleDialogues (7-10)
- innerConflicts (2-3)
- historicalContext
- specificDetails
`;
  }

  // ultra
  return `
Generate an ULTRA-COMPLETE profile with ALL PLUS tier fields PLUS:
- psychologicalProfile (attachmentStyle, copingMechanisms, emotionalRegulation, mentalHealthConditions, defenseMechanisms, traumaHistory, resilienceFactors, selfAwarenessLevel, therapyHistory)
- deepRelationalPatterns (loveLanguages giving/receiving, repeatingPatterns, boundaryStyle, conflictStyle, trustBaseline, intimacyComfort, socialMaskLevel, vulnerabilityTriggers)
- philosophicalFramework (optimismLevel, worldviewType, politicalLeanings, ethicalFramework, religiousBackground, spiritualPractices, lifePhilosophy, growthMindset)
- exampleDialogues (7-10)
- innerConflicts (2-3)
- historicalContext
- specificDetails

This is the MOST COMPLETE profile. Maximum depth and realism.
`;
}

// ============================================
// STREAMING SUPPORT (para UI)
// ============================================

/**
 * Genera profile con streaming para mostrar progreso en UI
 */
export async function generateProfileV2Streaming(
  options: ProfileGenerationOptions,
  onProgress: (chunk: string) => void
): Promise<AgentProfileV2> {
  const { draft, tier } = options;
  const userPrompt = buildUserPrompt(draft, tier);

  // Model selection based on tier
  const modelLite = process.env.GEMINI_MODEL_LITE || 'gemini-2.5-flash-lite';
  const modelFull = process.env.GEMINI_MODEL_FULL || 'gemini-2.5-flash';
  const modelName = tier === 'ultra' ? modelFull : modelLite;

  try {
    const result = await executeWithRetry(async (client) => {
      const model = client.getGenerativeModel({ model: modelName });
      return await model.generateContentStream({
      contents: [
        {
          role: 'user',
          parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.9,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: tier === 'ultra' ? 20000 : tier === 'plus' ? 12000 : 5000,
        responseMimeType: 'application/json',
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any,
          threshold: 'BLOCK_NONE' as any,
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH' as any,
          threshold: 'BLOCK_ONLY_HIGH' as any,
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT' as any,
          threshold: 'BLOCK_ONLY_HIGH' as any,
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any,
          threshold: 'BLOCK_ONLY_HIGH' as any,
        },
      ],
    });
    }); // Close executeWithRetry callback

    let fullText = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      onProgress(chunkText);
    }

    const profile = JSON.parse(fullText) as AgentProfileV2;
    profile.version = '2.0';
    profile.generationTier = tier;

    return profile;
  } catch (error) {
    console.error('Profile generation (streaming) error:', error);
    throw new Error(`Failed to generate profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
