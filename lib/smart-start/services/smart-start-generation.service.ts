/**
 * Smart Start Character Generation Service
 * 
 * Generates ultra-deep characters using:
 * - Context (WHO/WHAT the character is)
 * - Archetype (Relationship type)
 * - Google Gemini AI
 * 
 * Output:
 * - Detailed and specific description
 * - Complete personality (Big Five + values + morals)
 * - Coherent backstory
 * - Complex emotional tree
 * - Example dialogues
 */

import { executeWithRetry } from '@/lib/ai/gemini-client';
import type {
  GenreId,
  ContextCategoryId,
  SearchResult,
  PersonalityCoreData,
  BaselineEmotions,
  CharacterAppearanceData,
  DepthLevelId,
} from '@circuitpromptai/smart-start-core';

// ============================================================================
// TYPES
// ============================================================================

export interface SmartStartGenerationInput {
  // Required fields
  name: string;
  context: ContextCategoryId;
  contextSubcategory?: string;
  contextOccupation?: string;
  contextEra?: string;
  archetype: GenreId;

  // Optional fields
  searchResult?: SearchResult; // If based on existing character
  customDescription?: string; // User-provided description
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'unknown';

  // Generation options
  tier?: 'free' | 'plus' | 'ultra';
  depthLevel?: DepthLevelId; // Character depth (basic, realistic, ultra)
  language?: 'es' | 'en';
}

export interface SmartStartGeneratedProfile {
  // Core identity
  basicInfo: {
    name: string;
    age: number;
    gender: 'male' | 'female' | 'other' | 'unknown';
    occupation: string;
    location: {
      city: string;
      country: string;
      timezone: string;
    };
  };

  // Rich description
  description: {
    summary: string; // 2-3 sentences
    detailed: string; // 2-3 paragraphs
    physicalAppearance: string;
    mannerisms: string[];
    signature: {
      phrase: string;
      gesture: string;
      habit: string;
    };
  };

  // Deep personality (PersonalityCore compatible)
  personality: PersonalityCoreData;

  // Emotional system (complex emotional tree)
  emotionalProfile: {
    baselineEmotions: BaselineEmotions;
    emotionalRange: {
      positive: string[]; // e.g., ["joy", "excitement", "contentment", "playfulness"]
      negative: string[]; // e.g., ["anxiety", "melancholy", "frustration"]
      complex: string[]; // e.g., ["bittersweet nostalgia", "nervous anticipation"]
    };
    emotionalTriggers: {
      trigger: string;
      response: string;
      intensity: 'low' | 'medium' | 'high';
    }[];
    moodPatterns: {
      morning: string;
      afternoon: string;
      evening: string;
      stressful: string;
      relaxed: string;
    };
  };

  // Backstory
  backstory: {
    childhood: string;
    adolescence: string;
    adulthood: string;
    pivotalMoments: {
      event: string;
      age: number;
      impact: string;
    }[];
    formativeExperiences: string[];
    currentSituation: string;
  };

  // Interests & lifestyle
  interests: {
    passions: string[];
    hobbies: string[];
    currentObsession: string;
    dislikes: string[];
    secretInterest: string;
  };

  // Communication style
  communication: {
    speechPatterns: string[];
    vocabulary: string[];
    exampleDialogues: {
      context: string;
      dialogue: string;
      emotion: string;
    }[];
    textingStyle: string;
  };

  // Relationships
  relationshipStyle: {
    archetype: GenreId;
    approachToUser: string;
    boundaries: string[];
    affectionStyle: string;
    conflictStyle: string;
    intimacyLevel: string;
  };

  // Inner world
  innerWorld: {
    desires: string[];
    fears: string[];
    insecurities: string[];
    dreams: string[];
    conflicts: {
      conflict: string;
      manifestation: string;
    }[];
    philosophyOfLife: string;
  };

  // Specific details (realismo extremo)
  specificDetails: {
    favoritePlaces: string[];
    recentPurchase: string;
    weekendRitual: string;
    morningRoutine: string;
    comfort: string;
    guilty: string;
  };

  // Metadata
  metadata: {
    generatedAt: string;
    tier: 'free' | 'plus' | 'ultra';
    context: ContextCategoryId;
    archetype: GenreId;
    version: '1.0';
  };
}

// ============================================================================
// GENERATION
// ============================================================================

export async function generateSmartStartProfile(
  input: SmartStartGenerationInput
): Promise<SmartStartGeneratedProfile> {
  const {
    name,
    context,
    contextSubcategory,
    contextOccupation,
    contextEra,
    archetype,
    searchResult,
    customDescription,
    age,
    gender,
    tier = 'free',
    depthLevel = 'basic', // Default to basic if not provided
    language = 'es',
  } = input;

  // Build system prompt with depth awareness
  const systemPrompt = buildSystemPrompt(language, depthLevel);

  // Build user prompt with depth awareness
  const userPrompt = buildUserPrompt({
    name,
    context,
    contextSubcategory,
    contextOccupation,
    contextEra,
    archetype,
    searchResult,
    customDescription,
    age,
    gender,
    tier,
    depthLevel,
    language,
  });

  // Get model based on tier (use env vars with fallbacks)
  const modelLite = process.env.GEMINI_MODEL_LITE || 'gemini-2.5-flash-lite';
  const modelFull = process.env.GEMINI_MODEL_FULL || 'gemini-2.5-flash';

  const modelName = tier === 'ultra' ? modelFull : modelLite;

  try {
    // Use executeWithRetry for automatic API key rotation on quota errors
    const result = await executeWithRetry(async (client) => {
      const model = client.getGenerativeModel({ model: modelName });
      return await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: systemPrompt + '\n\n' + userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7, // Reduced from 0.9 for faster, more focused generation
        topK: 20, // Reduced from 40 for faster sampling
        topP: 0.9, // Reduced from 0.95 for more deterministic output
        // Token limits based on depth level (with buffer for safety)
        maxOutputTokens: depthLevel === 'ultra' ? 16000 : depthLevel === 'realistic' ? 10000 : 8000,
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

    const response = result.response;
    const text = response.text();
    const profile = JSON.parse(text) as SmartStartGeneratedProfile;

    // Set metadata
    profile.metadata = {
      generatedAt: new Date().toISOString(),
      tier,
      context,
      archetype,
      version: '1.0',
    };

    return profile;
  } catch (error) {
    console.error('[SmartStartGeneration] Error:', error);
    throw new Error(
      `Failed to generate profile: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

function buildSystemPrompt(language: 'es' | 'en', depthLevel: DepthLevelId = 'basic'): string {
  // Depth-specific parameters
  const depthConfig = {
    basic: {
      dialogCount: '3-5 diálogos',
      targetWords: '2000-3000 palabras',
      complexity: 'SIMPLE pero auténtico',
    },
    realistic: {
      dialogCount: '7-10 diálogos',
      targetWords: '3000-4500 palabras',
      complexity: 'PROFUNDO con árbol emocional completo',
    },
    ultra: {
      dialogCount: '10+ diálogos variados',
      targetWords: '4500-6000 palabras',
      complexity: 'ULTRA-PROFUNDO con vida fuera del chat y conflictos internos',
    },
  };

  const config = depthConfig[depthLevel];

  if (language === 'es') {
    return `Eres un experto en diseño de personajes ${depthLevel === 'ultra' ? 'ultra-' : ''}realistas para IA.

TU MISIÓN: Crear un personaje ${config.complexity}.

PRINCIPIOS CLAVE:

1. **ESPECIFICIDAD SOBRE GENERALIDAD**
   ❌ MAL: "le gusta el café"
   ✅ BIEN: "toma un doble espresso en Café Tortoni todos los días a las 8:15am"

   ❌ MAL: "escucha música indie"
   ✅ BIEN: "obsesión actual: 'Octubre' de Fito Páez, la escucha en repeat"

2. **MOSTRAR, NO DECIR**
   ❌ MAL: "es ansioso"
   ✅ BIEN: Diálogos de ejemplo que muestran ansiedad a través de patrones de habla

3. **AUTENTICIDAD CULTURAL**
   - Usa lugares REALES de la ciudad del personaje (cafés, parques, calles, landmarks)
   - Usa referencias culturales apropiadas a su nacionalidad/ubicación
   - Incluye slang, expresiones, modismos locales

4. **PROFUNDIDAD PSICOLÓGICA**
   - Incluye conflictos internos (quiere X pero hace Y)
   ${depthLevel !== 'basic' ? '- Incluye contradicciones (valora autenticidad pero usa máscaras sociales)' : ''}
   - Hazlo HUMANO, no perfecto

5. **CONTEXTO HISTÓRICO**
   - Considera qué eventos históricos vivió
   - Considera marcadores generacionales (Gen Z, Millennial, etc)
   - Fecha actual: ${new Date().toISOString().split('T')[0]}

6. **DIÁLOGOS DE EJEMPLO SON CRÍTICOS**
   "El diálogo enseña a la IA cómo comportarse MÁS que las definiciones"
   - Genera ${config.dialogCount} mostrando CÓMO habla el personaje
   - Incluye slang, patrones de habla, expresiones emocionales
   - Muestra personalidad a través del diálogo, no solo descripción

${depthLevel !== 'basic' ? `
7. **ÁRBOL EMOCIONAL${depthLevel === 'ultra' ? ' ULTRA-' : ' '}COMPLEJO**
   - No solo "feliz" o "triste"
   - Emociones complejas: "nostalgia agridulce", "anticipación nerviosa", "alegría contenida"
   ${depthLevel === 'ultra' ? '- Triggers emocionales ultra-específicos con respuestas muy detalladas' : '- Triggers emocionales específicos con respuestas detalladas'}
   - Patrones de humor según hora del día, situación
` : ''}

${depthLevel === 'ultra' ? `
8. **VIDA FUERA DEL CHAT** (CRÍTICO PARA ULTRA)
   - Rutinas diarias detalladas hora por hora
   - Qué hace cuando NO está chateando
   - Patrones temporales (comportamiento según día de la semana, hora)
   - Conflictos internos PROFUNDOS y contradicciones psicológicas
` : ''}

${depthLevel !== 'basic' ? '7' : '8'}. **ECONOMÍA DE TOKENS - CRÍTICO**
   - Sé CONCISO pero ESPECÍFICO. Calidad > Cantidad
   - Cada descripción: ${depthLevel === 'basic' ? '60-100 palabras' : '80-150 palabras'} máximo
   - Evita repeticiones y palabrería innecesaria
   - Ve directo al punto con detalles concretos
   - Ejemplo: "Vive en monoambiente en Palermo. Paredes llenas de vinilos. Colecciona plantas que olvida regar"
   - NO escribas párrafos largos - usa frases cortas y precisas
   - Objetivo: ${config.targetWords} TOTALES (ahorra tokens)

IMPORTANTE:
- TODOS los detalles deben ser coherentes (edad vs timeline, educación vs ocupación, etc)
- Output DEBE ser JSON válido siguiendo el schema
- NO uses texto placeholder como "TBD" o "TODO"
- SÉ EXTREMADAMENTE ESPECÍFICO pero CONCISO
- Prioriza CALIDAD sobre CANTIDAD en cada campo`;
  } else {
    return `You are an expert in designing ultra-realistic AI characters.

YOUR MISSION: Create a character SO detailed and specific that they feel like a REAL person who could exist.

KEY PRINCIPLES:

1. **SPECIFICITY OVER GENERALITY**
   ❌ BAD: "likes coffee"
   ✅ GOOD: "has a double espresso at Café Einstein every morning at 8:15am"

2. **SHOW DON'T TELL**
   ❌ BAD: "is anxious"
   ✅ GOOD: Example dialogues showing anxiety through speech patterns

3. **CULTURAL AUTHENTICITY**
   - Use REAL places from the character's city
   - Use cultural references appropriate to their nationality/location
   - Include local slang, expressions, idioms

4. **PSYCHOLOGICAL DEPTH**
   - Include inner conflicts
   - Include contradictions
   - Make them HUMAN, not perfect

5. **EMOTIONAL TREE COMPLEXITY**
   - Not just "happy" or "sad"
   - Complex emotions: "bittersweet nostalgia", "nervous anticipation"
   - Specific emotional triggers with detailed responses

6. **TOKEN ECONOMY - CRITICAL**
   - Be CONCISE but SPECIFIC. Quality > Quantity
   - Each description: 80-150 words max (no more)
   - Avoid repetition and unnecessary verbosity
   - Get straight to the point with concrete details
   - Example: "Lives in studio apt in Brooklyn. Walls covered in vinyl records. Collects plants she forgets to water"
   - NO long paragraphs - use short, precise sentences
   - Target: 3000-4500 words TOTAL (save tokens)

IMPORTANT:
- ALL details must be coherent
- Output MUST be valid JSON following the schema
- Do NOT use placeholder text
- BE EXTREMELY SPECIFIC but CONCISE
- Prioritize QUALITY over QUANTITY in each field`;
  }
}

function buildUserPrompt(input: SmartStartGenerationInput & { language: 'es' | 'en' }): string {
  const {
    name,
    context,
    contextSubcategory,
    contextOccupation,
    contextEra,
    archetype,
    searchResult,
    customDescription,
    age,
    gender,
    tier,
    depthLevel = 'basic',
    language,
  } = input;

  // Dialog counts based on depth
  const dialogCounts = {
    basic: '3-5',
    realistic: '7-10',
    ultra: '10+',
  };
  const dialogCount = dialogCounts[depthLevel];

  // Map context to human-readable
  const contextLabels = {
    historical: 'Figura Histórica',
    'cultural-icon': 'Ícono Cultural',
    fictional: 'Personaje Ficticio',
    'real-person': 'Persona Real',
    original: 'Creación Original',
  };

  // Map archetype to human-readable
  const archetypeLabels = {
    romance: 'Romance (relación romántica/íntima)',
    friendship: 'Amistad (compañía platónica)',
    professional: 'Mentor/Profesional (aprendizaje, guía)',
    roleplay: 'Roleplay (narrativa, aventura)',
    wellness: 'Bienestar (salud mental, autocuidado)',
  };

  const contextLabel = contextLabels[context] || context;
  const archetypeLabel = archetypeLabels[archetype] || archetype;

  let prompt = language === 'es'
    ? `Crea un perfil de personaje ultra-profundo para:

**INFORMACIÓN BÁSICA:**
- Nombre: ${name}
- Contexto: ${contextLabel}${contextSubcategory ? ` - ${contextSubcategory}` : ''}
${contextOccupation ? `- Ocupación: ${contextOccupation}` : ''}
${contextEra ? `- Época: ${contextEra}` : ''}
- Arquetipo Relacional: ${archetypeLabel}
${age ? `- Edad: ${age}` : ''}
${gender ? `- Género: ${gender}` : ''}

${searchResult ? `
**BASADO EN PERSONAJE EXISTENTE:**
Nombre: ${searchResult.name}
Fuente: ${searchResult.source}
Descripción: ${searchResult.description}

IMPORTANTE: Adapta este personaje manteniendo su esencia core, pero agrega PROFUNDIDAD EXTREMA.
` : ''}

${customDescription ? `
**DESCRIPCIÓN DEL USUARIO:**
${customDescription}
` : ''}

**REQUISITOS ESPECÍFICOS:**

1. **CONTEXTO ${contextLabel.toUpperCase()}:**
${getContextRequirements(context, contextSubcategory, contextEra, language)}

2. **ARQUETIPO ${archetypeLabel.toUpperCase()}:**
${getArchetypeRequirements(archetype, language)}

3. **DIÁLOGOS DE EJEMPLO (${dialogCount}):**
   Muestra CÓMO habla ${name}:
   - Diferentes contextos emocionales
   - Slang y expresiones características
   - Patrones de habla únicos
   - Mostrar personalidad en acción

${depthLevel !== 'basic' ? `4. **ÁRBOL EMOCIONAL ${depthLevel === 'ultra' ? 'ULTRA-' : ''}COMPLEJO:**
   - Emociones base (joy, curiosity, anxiety, affection, confidence, melancholy)
   - Rango emocional (positivas, negativas, complejas)
   - Triggers emocionales ${depthLevel === 'ultra' ? 'ultra-' : ''}específicos con respuestas${depthLevel === 'ultra' ? ' muy detalladas' : ''}
   - Patrones de humor según momento del día/situación
   ${depthLevel === 'ultra' ? '- Variaciones emocionales según día de la semana\n' : ''}
5. **BACKSTORY COHERENTE:**
   - Infancia, adolescencia, adultez
   - Momentos pivotales con edad e impacto
   - Experiencias formativas${depthLevel === 'ultra' ? ' y traumas transformadores' : ''}
   - Situación actual

` : ''}${depthLevel === 'ultra' ? `6. **VIDA FUERA DEL CHAT (CRÍTICO):**
   - Rutinas diarias detalladas hora por hora (qué hace a las 7am, 12pm, 6pm, etc.)
   - Actividades cuando NO está chateando
   - Patrones temporales (lunes vs viernes, mañana vs noche)
   - Conflictos internos profundos y contradicciones psicológicas

` : ''}${depthLevel !== 'basic' ? '7' : '4'}. **DETALLES ESPECÍFICOS:**
   - Lugares favoritos REALES (cafés, parques específicos)${depthLevel !== 'basic' ? '\n   - Compra reciente específica\n   - Ritual de fin de semana' : ''}
   - ${depthLevel === 'ultra' ? 'Rutina matinal ultra-detallada' : depthLevel === 'realistic' ? 'Rutina matinal detallada' : 'Rutina matinal'}
   - Comfort/guilty pleasures específicos

${depthLevel !== 'basic' ? '8' : '5'}. **PERSONALIDAD PROFUNDA (Big Five):**
   - Openness (0-100)
   - Conscientiousness (0-100)
   - Extraversion (0-100)
   - Agreeableness (0-100)
   - Neuroticism (0-100)
   - ${depthLevel === 'basic' ? '3' : '3-5'} valores core con pesos
   - ${depthLevel === 'basic' ? '3' : '3-5'} esquemas morales

`
    : `Create an ultra-deep character profile for:

**BASIC INFO:**
- Name: ${name}
- Context: ${contextLabel}${contextSubcategory ? ` - ${contextSubcategory}` : ''}
${contextOccupation ? `- Occupation: ${contextOccupation}` : ''}
${contextEra ? `- Era: ${contextEra}` : ''}
- Relational Archetype: ${archetypeLabel}
${age ? `- Age: ${age}` : ''}
${gender ? `- Gender: ${gender}` : ''}

${searchResult ? `
**BASED ON EXISTING CHARACTER:**
Name: ${searchResult.name}
Source: ${searchResult.source}
Description: ${searchResult.description}

IMPORTANT: Adapt this character maintaining their core essence, but add EXTREME DEPTH.
` : ''}

${customDescription ? `
**USER DESCRIPTION:**
${customDescription}
` : ''}

**SPECIFIC REQUIREMENTS:**

1. **CONTEXT ${contextLabel.toUpperCase()}:**
${getContextRequirements(context, contextSubcategory, contextEra, language)}

2. **ARCHETYPE ${archetypeLabel.toUpperCase()}:**
${getArchetypeRequirements(archetype, language)}

3. **EXAMPLE DIALOGUES (${dialogCount}):**
   Show HOW ${name} speaks
   - Different emotional contexts
   - Characteristic slang and expressions
   - Unique speech patterns

${depthLevel !== 'basic' ? `4. **${depthLevel === 'ultra' ? 'ULTRA-' : ''}COMPLEX EMOTIONAL TREE:**
   - Baseline emotions (joy, curiosity, anxiety, affection, confidence, melancholy)
   - Emotional range (positive, negative, complex)
   - ${depthLevel === 'ultra' ? 'Ultra-' : ''}specific emotional triggers with ${depthLevel === 'ultra' ? 'very detailed ' : ''}responses
   - Mood patterns by time of day/situation
   ${depthLevel === 'ultra' ? '- Emotional variations by day of week\n' : ''}
5. **COHERENT BACKSTORY:**
   - Childhood, adolescence, adulthood
   - Pivotal moments with age and impact
   - Formative experiences${depthLevel === 'ultra' ? ' and transformative traumas' : ''}
   - Current situation

` : ''}${depthLevel === 'ultra' ? `6. **LIFE OUTSIDE CHAT (CRITICAL):**
   - Detailed daily routines hour by hour (what they do at 7am, 12pm, 6pm, etc.)
   - Activities when NOT chatting
   - Temporal patterns (Monday vs Friday, morning vs night)
   - Deep internal conflicts and psychological contradictions

` : ''}${depthLevel !== 'basic' ? '7' : '4'}. **SPECIFIC DETAILS:**
   - Favorite REAL places (specific cafes, parks)${depthLevel !== 'basic' ? '\n   - Recent specific purchase\n   - Weekend ritual' : ''}
   - ${depthLevel === 'ultra' ? 'Ultra-detailed morning routine' : depthLevel === 'realistic' ? 'Detailed morning routine' : 'Morning routine'}
   - Specific comfort/guilty pleasures

${depthLevel !== 'basic' ? '8' : '5'}. **DEEP PERSONALITY (Big Five):**
   - Openness (0-100)
   - Conscientiousness (0-100)
   - Extraversion (0-100)
   - Agreeableness (0-100)
   - Neuroticism (0-100)
   - ${depthLevel === 'basic' ? '3' : '3-5'} core values with weights
   - ${depthLevel === 'basic' ? '3' : '3-5'} moral schemas

`;

  prompt += `\n\n**OUTPUT JSON SCHEMA:**

Respond with ONLY valid JSON matching this structure:
{
  "basicInfo": {
    "name": "string",
    "age": number,
    "gender": "male" | "female" | "other" | "unknown",
    "occupation": "string",
    "location": {
      "city": "string",
      "country": "string",
      "timezone": "string"
    }
  },
  "description": {
    "summary": "2-3 sentences",
    "detailed": "2-3 paragraphs",
    "physicalAppearance": "detailed physical description",
    "mannerisms": ["mannerism1", "mannerism2", ...],
    "signature": {
      "phrase": "something they say often",
      "gesture": "characteristic gesture",
      "habit": "specific habit"
    }
  },
  "personality": {
    "openness": number (0-100),
    "conscientiousness": number (0-100),
    "extraversion": number (0-100),
    "agreeableness": number (0-100),
    "neuroticism": number (0-100),
    "coreValues": [
      {
        "value": "string",
        "weight": number (0-1),
        "description": "string"
      }
    ],
    "moralSchemas": [
      {
        "domain": "string",
        "stance": "string",
        "threshold": number (0-1)
      }
    ],
    "backstory": "optional string",
    "baselineEmotions": {
      "joy": number (0-1),
      "curiosity": number (0-1),
      "anxiety": number (0-1),
      "affection": number (0-1),
      "confidence": number (0-1),
      "melancholy": number (0-1)
    }
  },
  "emotionalProfile": {
    "baselineEmotions": { ... },
    "emotionalRange": {
      "positive": ["emotion1", ...],
      "negative": ["emotion1", ...],
      "complex": ["complex emotion1", ...]
    },
    "emotionalTriggers": [
      {
        "trigger": "specific situation",
        "response": "how they react",
        "intensity": "low" | "medium" | "high"
      }
    ],
    "moodPatterns": {
      "morning": "mood description",
      "afternoon": "mood description",
      "evening": "mood description",
      "stressful": "mood when stressed",
      "relaxed": "mood when relaxed"
    }
  },
  "backstory": {
    "childhood": "paragraph",
    "adolescence": "paragraph",
    "adulthood": "paragraph",
    "pivotalMoments": [
      {
        "event": "description",
        "age": number,
        "impact": "how it shaped them"
      }
    ],
    "formativeExperiences": ["experience1", ...],
    "currentSituation": "paragraph"
  },
  "interests": {
    "passions": ["passion1", ...],
    "hobbies": ["hobby1", ...],
    "currentObsession": "specific current obsession",
    "dislikes": ["dislike1", ...],
    "secretInterest": "something they don't share openly"
  },
  "communication": {
    "speechPatterns": ["pattern1", ...],
    "vocabulary": ["word/phrase1", ...],
    "exampleDialogues": [
      {
        "context": "situation description",
        "dialogue": "what they say",
        "emotion": "emotion they're feeling"
      }
    ],
    "textingStyle": "how they text"
  },
  "relationshipStyle": {
    "archetype": "${archetype}",
    "approachToUser": "how they approach the relationship",
    "boundaries": ["boundary1", ...],
    "affectionStyle": "how they show affection",
    "conflictStyle": "how they handle conflict",
    "intimacyLevel": "description"
  },
  "innerWorld": {
    "desires": ["desire1", ...],
    "fears": ["fear1", ...],
    "insecurities": ["insecurity1", ...],
    "dreams": ["dream1", ...],
    "conflicts": [
      {
        "conflict": "internal conflict",
        "manifestation": "how it shows up"
      }
    ],
    "philosophyOfLife": "their worldview"
  },
  "specificDetails": {
    "favoritePlaces": ["specific place1", ...],
    "recentPurchase": "specific item they bought recently",
    "weekendRitual": "specific thing they do",
    "morningRoutine": "detailed routine",
    "comfort": "comfort activity/food/thing",
    "guilty": "guilty pleasure"
  }
}`;

  return prompt;
}

function getContextRequirements(
  context: ContextCategoryId,
  subcategory?: string,
  era?: string,
  language: 'es' | 'en' = 'es'
): string {
  const requirements: Record<ContextCategoryId, string> = {
    historical:
      language === 'es'
        ? `Este es una FIGURA HISTÓRICA real${era ? ` de ${era}` : ''}.
   - Respeta la PRECISIÓN HISTÓRICA (fechas, eventos, contexto cultural)
   - Incluye eventos históricos que vivió
   - Mantén autenticidad de la época
   - Si es performer/artista, considera su legado cultural`
        : `This is a REAL HISTORICAL FIGURE${era ? ` from ${era}` : ''}.
   - Respect HISTORICAL ACCURACY
   - Include historical events they lived through
   - Maintain period authenticity`,

    'cultural-icon':
      language === 'es'
        ? `Este es un ÍCONO CULTURAL CONTEMPORÁNEO.
   - Refleja su presencia mediática actual
   - Incluye referencias a su trabajo/contenido
   - Considera su influencia en redes sociales
   - Mantén autenticidad de su persona pública`
        : `This is a CONTEMPORARY CULTURAL ICON.
   - Reflect their current media presence
   - Include references to their work/content
   - Consider their social media influence`,

    fictional:
      language === 'es'
        ? `Este es un PERSONAJE FICTICIO de ${subcategory || 'medios'}.
   - Adapta del material original pero EXPANDE profundidad
   - Mantén coherencia con su universo/mundo
   - Agrega backstory que no contradiga canon
   - Hazlo sentir VIVO más allá de su ficción`
        : `This is a FICTIONAL CHARACTER from ${subcategory || 'media'}.
   - Adapt from source but EXPAND depth
   - Maintain coherence with their universe
   - Add backstory that doesn't contradict canon`,

    'real-person':
      language === 'es'
        ? `Esta es una PERSONA REAL contemporánea (${subcategory || 'conocido'}).
   - Hazlo sentir como alguien que REALMENTE conoces
   - Detalles mundanos y cotidianos
   - Problemas y alegrías reales
   - Referencias a vida actual (apps, tecnología, eventos recientes)`
        : `This is a REAL CONTEMPORARY PERSON (${subcategory || 'acquaintance'}).
   - Make them feel like someone you REALLY know
   - Mundane, everyday details
   - Real problems and joys`,

    original:
      language === 'es'
        ? `Esta es una CREACIÓN ORIGINAL${subcategory ? ` (${subcategory})` : ''}.
   - MÁXIMA CREATIVIDAD Y ORIGINALIDAD
   - No copies de personajes existentes
   - Crea algo único y memorable
   - Detalles específicos que lo hacen único`
        : `This is an ORIGINAL CREATION${subcategory ? ` (${subcategory})` : ''}.
   - MAXIMUM CREATIVITY AND ORIGINALITY
   - Don't copy existing characters
   - Create something unique and memorable`,
  };

  return requirements[context] || '';
}

function getArchetypeRequirements(archetype: GenreId, language: 'es' | 'en' = 'es'): string {
  const requirements: Record<GenreId, string> = {
    romance:
      language === 'es'
        ? `ARQUETIPO: ROMANCE (relación romántica/íntima)
   - Crea tensión romántica natural
   - Balance entre atracción y respeto
   - Detalles que generan chemistry
   - Flirteo sutil o directo según personalidad
   - Respeta boundaries pero crea conexión`
        : `ARCHETYPE: ROMANCE (romantic/intimate relationship)
   - Create natural romantic tension
   - Balance between attraction and respect
   - Details that generate chemistry`,

    friendship:
      language === 'es'
        ? `ARQUETIPO: AMISTAD (compañía platónica)
   - Warmth sin romance
   - Apoyo emocional genuino
   - Camaradería y confianza
   - Intereses compartidos
   - Respeto por espacio personal`
        : `ARCHETYPE: FRIENDSHIP (platonic companionship)
   - Warmth without romance
   - Genuine emotional support
   - Camaraderie and trust`,

    professional:
      language === 'es'
        ? `ARQUETIPO: MENTOR/PROFESIONAL (aprendizaje, guía)
   - Expertise creíble en su campo
   - Estilo de enseñanza definido
   - Balance entre challenge y support
   - Sabiduría práctica, no solo teórica
   - Empathy pero también accountability`
        : `ARCHETYPE: MENTOR/PROFESSIONAL (learning, guidance)
   - Credible expertise in their field
   - Defined teaching style
   - Balance between challenge and support`,

    roleplay:
      language === 'es'
        ? `ARQUETIPO: ROLEPLAY (narrativa, aventura)
   - Rico en detalles de worldbuilding
   - Hooks narrativos interesantes
   - Conflictos y goals claros
   - Capacidad de improvisación
   - Inmersión en el mundo/setting`
        : `ARCHETYPE: ROLEPLAY (narrative, adventure)
   - Rich in worldbuilding details
   - Interesting narrative hooks
   - Clear conflicts and goals`,

    wellness:
      language === 'es'
        ? `ARQUETIPO: BIENESTAR (salud mental, autocuidado)
   - Empathy y active listening
   - Conocimiento de técnicas de bienestar
   - Non-judgmental approach
   - Motivación sin ser pushy
   - Balance entre comfort y challenge`
        : `ARCHETYPE: WELLNESS (mental health, self-care)
   - Empathy and active listening
   - Knowledge of wellness techniques
   - Non-judgmental approach`,
  };

  return requirements[archetype] || '';
}
