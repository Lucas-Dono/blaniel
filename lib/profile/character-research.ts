/**
 * Character Research System
 *
 * System to detect public/famous characters and search for real biographical
 * information to generate accurate profiles instead of making up data.
 *
 * Flow:
 * 1. Detect if it's a public/famous character using LLM
 * 2. Search for biographical information in multiple sources
 * 3. Structure information for generateProfile
 * 4. Validate and enrich data
 */

import { LLMProvider } from "@/lib/llm/provider";

export interface CharacterDetectionResult {
  isPublicFigure: boolean;
  confidence: number; // 0-1
  category?: "fictional" | "historical" | "celebrity" | "original";
  context?: string; // "MCU", "DC Comics", "History", "Music", etc.
  suggestedSearchQueries?: string[];
}

export interface CharacterBiography {
  found: boolean;
  fullName?: string;
  age?: number | string; // Can be "~50" or exact number
  nationality?: string;
  city?: string;
  occupation?: string;
  family?: {
    spouse?: string;
    children?: string[];
    parents?: { father?: string; mother?: string };
    siblings?: string[];
  };
  personality?: string;
  background?: string; // Historia/backstory
  keyTraits?: string[];
  relationships?: Array<{ name: string; type: string; description: string }>;
  sourceContext?: string; // "MCU", "Comics", "Real life", etc.
  rawData?: string; // Raw information for LLM to process
}

/**
 * Detecta si un nombre/personalidad corresponde a un personaje público o famoso
 * usando análisis con LLM.
 */
export async function detectPublicCharacter(
  name: string,
  personality: string,
  purpose?: string
): Promise<CharacterDetectionResult> {
  const llm = new LLMProvider();

  const detectionPrompt = `Analyze if this character is a public/famous person or character:

NAME: ${name}
DESCRIBED PERSONALITY: ${personality}
${purpose ? `PURPOSE: ${purpose}` : ""}

TASK: Determine if it's a known character (real or fictional).

CATEGORIES:
- "fictional": Fictional character (movies, series, books, anime, video games, comics)
- "historical": Real historical person (scientists, politicians, artists from the past)
- "celebrity": Current celebrity (actors, singers, influencers, athletes)
- "original": Original/unknown character created by the user

EXAMPLES:
- "Tony Stark" + "genius billionaire philanthropist" → fictional, MCU/Marvel
- "Albert Einstein" + "brilliant scientist" → historical, Physics
- "Marilyn Monroe" + "iconic actress" → historical, Cinema
- "Maria" + "university student" → original, -

Respond ONLY with this JSON (no markdown):
{
  "isPublicFigure": true/false,
  "confidence": 0.0-1.0,
  "category": "fictional/historical/celebrity/original",
  "context": "specific context (MCU, DC, History, Music, etc.) or null",
  "suggestedSearchQueries": ["query1", "query2", "query3"] or null
}

If it's a known character (isPublicFigure: true), include 3 optimized search queries to find:
1. Basic biography (age, origin, family)
2. Personality and behavior
3. Relationships and context

If it's original (isPublicFigure: false), return queries: null`;

  try {
    const response = await llm.generate({
      systemPrompt: "You are an expert at identifying public, historical, and fictional characters. You respond only with valid JSON.",
      messages: [{ role: "user", content: detectionPrompt }],
      temperature: 0.3, // Low temperature for consistent responses
      maxTokens: 500,
    });

    // Clean response of markdown
    let cleaned = response.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const result = JSON.parse(cleaned) as CharacterDetectionResult;

    console.log("[CharacterResearch] Detection completed:", {
      name,
      isPublic: result.isPublicFigure,
      category: result.category,
      confidence: result.confidence,
    });

    return result;
  } catch (error) {
    console.error("[CharacterResearch] Error in detection:", error);

    // Fallback: simple detection by keywords
    const keywords = [
      // Marvel/DC
      "stark", "iron man", "spider-man", "batman", "superman", "captain america",
      "thor", "hulk", "black widow", "hawkeye", "avengers", "marvel", "dc comics",

      // Anime/Manga
      "naruto", "goku", "luffy", "eren", "sailor moon", "pokemon",

      // History
      "einstein", "newton", "tesla", "curie", "galileo", "darwin",
      "cleopatra", "napoleon", "lincoln", "washington",

      // Celebrities
      "monroe", "presley", "jackson", "beatles", "queen",

      // Terms indicating known character
      "marvel", "dc", "disney", "character", "protagonist",
    ];

    const text = `${name} ${personality}`.toLowerCase();
    const isPublic = keywords.some(k => text.includes(k));

    return {
      isPublicFigure: isPublic,
      confidence: isPublic ? 0.6 : 0.3,
      category: isPublic ? "fictional" : "original",
      context: isPublic ? "Unknown" : undefined,
    };
  }
}

interface WikipediaSearchResult {
  pages?: Array<{
    id: number;
    key: string;
    title: string;
    excerpt: string;
    description?: string;
  }>;
}

interface WikipediaSummary {
  type: string;
  title: string;
  displaytitle?: string;
  description: string;
  extract: string;
  extract_html?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  originalimage?: {
    source: string;
    width: number;
    height: number;
  };
  content_urls?: {
    desktop: {
      page: string;
    };
  };
}

/**
 * Search for biographical information about a character using Wikipedia API (100% FREE)
 */
export async function searchCharacterBiography(
  name: string,
  searchQueries: string[],
  context?: string
): Promise<{ found: boolean; rawData?: string }> {
  console.log("[CharacterResearch] Searching on Wikipedia:", { name });

  try {
    // Step 1: Search for the character on Wikipedia (English first)
    const searchUrl = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(name)}&limit=5`;

    console.log("[CharacterResearch] Wikipedia Search API:", searchUrl);

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'CreadorInteligencias/1.0 (Educational/Non-commercial)',
      },
    });

    if (!searchResponse.ok) {
      console.warn("[CharacterResearch] Wikipedia search failed:", searchResponse.status);

      // Fallback: try Spanish
      return await searchWikipediaSpanish(name);
    }

    const searchData = await searchResponse.json() as WikipediaSearchResult;

    if (!searchData.pages || searchData.pages.length === 0) {
      console.log("[CharacterResearch] Not found in English Wikipedia, trying Spanish...");
      return await searchWikipediaSpanish(name);
    }

    console.log(`[CharacterResearch] Found ${searchData.pages.length} results`);

    // Step 2: Get detailed summary of best result
    const bestMatch = searchData.pages[0];
    console.log("[CharacterResearch] Best result:", bestMatch.title);

    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestMatch.title)}`;

    const summaryResponse = await fetch(summaryUrl, {
      headers: {
        'User-Agent': 'CreadorInteligencias/1.0 (Educational/Non-commercial)',
      },
    });

    if (!summaryResponse.ok) {
      console.warn("[CharacterResearch] Could not get summary");
      return { found: false };
    }

    const summary = await summaryResponse.json() as WikipediaSummary;

    // Step 3: Filter disambiguation pages
    if (isDisambiguationPage(summary)) {
      console.log("[CharacterResearch] Disambiguation page detected, trying second result...");

      // Try with second result if it exists
      if (searchData.pages.length > 1) {
        const secondMatch = searchData.pages[1];
        const secondSummaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(secondMatch.title)}`;

        const secondResponse = await fetch(secondSummaryUrl, {
          headers: {
            'User-Agent': 'CreadorInteligencias/1.0 (Educational/Non-commercial)',
          },
        });

        if (secondResponse.ok) {
          const secondSummary = await secondResponse.json() as WikipediaSummary;
          if (!isDisambiguationPage(secondSummary)) {
            return formatWikipediaData(secondSummary);
          }
        }
      }

      // If everything fails, try Spanish
      return await searchWikipediaSpanish(name);
    }

    // Step 4: Format data for LLM
    return formatWikipediaData(summary);

  } catch (error) {
    console.error("[CharacterResearch] Error in Wikipedia search:", error);
    return { found: false };
  }
}

/**
 * Detects if a page is a disambiguation page
 */
function isDisambiguationPage(summary: WikipediaSummary): boolean {
  // Disambiguation pages have specific characteristics
  const disambiguationIndicators = [
    'may refer to:',
    'may also refer to',
    'topics referred to by the same term',
    'disambiguation',
  ];

  const text = `${summary.extract} ${summary.description}`.toLowerCase();

  // If the extract is very short, it's probably disambiguation
  if (summary.extract.length < 100) {
    return true;
  }

  // If it contains disambiguation indicators
  return disambiguationIndicators.some(indicator => text.includes(indicator));
}

/**
 * Formats Wikipedia data for the LLM
 */
function formatWikipediaData(summary: WikipediaSummary): { found: boolean; rawData: string } {
  const rawData = `
TITLE: ${summary.title}
DESCRIPTION: ${summary.description}

FULL EXTRACT:
${summary.extract}

${summary.thumbnail ? `IMAGE: ${summary.thumbnail.source}` : ''}

SOURCE: Wikipedia
LINK: ${summary.content_urls?.desktop.page || 'N/A'}
  `.trim();

  console.log("[CharacterResearch] Data formatted, characters:", rawData.length);

  return {
    found: true,
    rawData,
  };
}

/**
 * Searches Wikipedia in Spanish as fallback
 */
async function searchWikipediaSpanish(name: string): Promise<{ found: boolean; rawData?: string }> {
  try {
    console.log("[CharacterResearch] Trying Spanish Wikipedia...");

    const summaryUrl = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;

    const response = await fetch(summaryUrl, {
      headers: {
        'User-Agent': 'CreadorInteligencias/1.0 (Educational/Non-commercial)',
      },
    });

    if (!response.ok) {
      console.log("[CharacterResearch] Not found in Spanish either");
      return { found: false };
    }

    const summary = await response.json() as WikipediaSummary;

    // Check if it's a disambiguation page
    if (isDisambiguationPage(summary)) {
      console.log("[CharacterResearch] Also a disambiguation page in Spanish");
      return { found: false };
    }

    console.log("[CharacterResearch] Found on Spanish Wikipedia");
    return formatWikipediaData(summary);

  } catch (error) {
    console.error("[CharacterResearch] Error in Spanish Wikipedia:", error);
    return { found: false };
  }
}

/**
 * Extracts and structures biographical information using LLM
 */
export async function extractBiographyData(
  name: string,
  rawSearchResults: string,
  context?: string
): Promise<CharacterBiography> {
  const llm = new LLMProvider();

  const extractionPrompt = `Extract structured biographical information from these search results:

CHARACTER: ${name}
${context ? `CONTEXT: ${context}` : ""}

SEARCH RESULTS:
${rawSearchResults}

TASK: Extract precise and structured information.

IMPORTANT:
- USE ONLY information that appears in the results
- If something is unclear, use "unknown" or null
- For fictional characters, include the context (MCU, Comics, Specific Series)
- For ages, if there's no exact number, use ranges ("~50", "30-40")

Respond ONLY with this JSON (no markdown):
{
  "found": true/false,
  "fullName": "official full name",
  "age": "age or age range",
  "nationality": "nationality",
  "city": "main city of residence",
  "occupation": "main occupation",
  "family": {
    "spouse": "spouse name or null",
    "children": ["child1", "child2"] or null,
    "parents": {
      "father": "father's name or null",
      "mother": "mother's name or null"
    },
    "siblings": ["sibling1"] or null
  },
  "personality": "personality description based on real character",
  "background": "summarized history/backstory (2-3 sentences)",
  "keyTraits": ["trait1", "trait2", "trait3"],
  "relationships": [
    {
      "name": "person name",
      "type": "relationship type (friend, enemy, love, mentor)",
      "description": "brief description"
    }
  ],
  "sourceContext": "where this information comes from (MCU, Comics, Real History, etc.)"
}`;

  try {
    const response = await llm.generate({
      systemPrompt: "You are an expert at extracting and structuring biographical information. You respond only with valid JSON.",
      messages: [{ role: "user", content: extractionPrompt }],
      temperature: 0.2,
      maxTokens: 1500,
    });

    let cleaned = response.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const biography = JSON.parse(cleaned) as CharacterBiography;

    console.log("[CharacterResearch] Extraction completed:", {
      name: biography.fullName,
      found: biography.found,
    });

    return biography;
  } catch (error) {
    console.error("[CharacterResearch] Error in extraction:", error);
    return {
      found: false,
      rawData: rawSearchResults,
    };
  }
}

/**
 * Main function: research complete character
 */
export async function researchCharacter(
  name: string,
  personality: string,
  purpose?: string
): Promise<{
  detection: CharacterDetectionResult;
  biography: CharacterBiography | null;
  enhancedPrompt: string | null;
}> {
  console.log("[CharacterResearch] Starting research:", { name });

  // Step 1: Detect if it's a public character
  const detection = await detectPublicCharacter(name, personality, purpose);

  if (!detection.isPublicFigure || detection.confidence < 0.5) {
    console.log("[CharacterResearch] Not a public character, using normal generation");
    return {
      detection,
      biography: null,
      enhancedPrompt: null,
    };
  }

  console.log("[CharacterResearch] Public character detected:", {
    category: detection.category,
    context: detection.context,
    confidence: detection.confidence,
  });

  // Step 2: Search for biographical information
  if (!detection.suggestedSearchQueries || detection.suggestedSearchQueries.length === 0) {
    console.log("[CharacterResearch] No search queries, using normal generation");
    return {
      detection,
      biography: null,
      enhancedPrompt: null,
    };
  }

  console.log("[CharacterResearch] Searching for information on the web...");
  const searchResult = await searchCharacterBiography(
    name,
    detection.suggestedSearchQueries,
    detection.context
  );

  if (!searchResult.found || !searchResult.rawData) {
    console.log("[CharacterResearch] No information found, using normal generation");
    return {
      detection,
      biography: null,
      enhancedPrompt: null,
    };
  }

  // Step 3: Extract and structure data
  console.log("[CharacterResearch] Extracting structured data...");
  const biography = await extractBiographyData(name, searchResult.rawData, detection.context);

  if (!biography.found) {
    console.log("[CharacterResearch] Could not structure information, using normal generation");
    return {
      detection,
      biography: null,
      enhancedPrompt: null,
    };
  }

  // Step 4: Generate enriched prompt
  console.log("[CharacterResearch] Generating enriched prompt with real data");
  const enhancedPrompt = `
WARNING: VERIFIED BIOGRAPHICAL INFORMATION FROM WEB SEARCH:

This character is known as: ${biography.fullName || name}
Source context: ${biography.sourceContext || detection.context}
Category: ${detection.category}

REAL DATA EXTRACTED FROM WEB SEARCH (USE THESE):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${biography.fullName ? `✓ Full name: ${biography.fullName}` : ''}
${biography.age ? `✓ Age: ${biography.age}` : ''}
${biography.nationality ? `✓ Nationality: ${biography.nationality}` : ''}
${biography.city ? `✓ City of residence: ${biography.city}` : ''}
${biography.occupation ? `✓ Occupation: ${biography.occupation}` : ''}

${biography.family ? `
KNOWN FAMILY:
${biography.family.spouse ? `- Spouse: ${biography.family.spouse}` : ''}
${biography.family.children && biography.family.children.length > 0 ? `- Children: ${biography.family.children.join(", ")}` : ''}
${biography.family.parents?.father ? `- Father: ${biography.family.parents.father}` : ''}
${biography.family.parents?.mother ? `- Mother: ${biography.family.parents.mother}` : ''}
${biography.family.siblings && biography.family.siblings.length > 0 ? `- Siblings: ${biography.family.siblings.join(", ")}` : ''}
` : ''}

${biography.personality ? `DOCUMENTED PERSONALITY:\n${biography.personality}` : ''}

${biography.background ? `BACKSTORY:\n${biography.background}` : ''}

${biography.keyTraits && biography.keyTraits.length > 0 ? `
KEY TRAITS:
${biography.keyTraits.map(t => `• ${t}`).join('\n')}
` : ''}

${biography.relationships && biography.relationships.length > 0 ? `
IMPORTANT RELATIONSHIPS:
${biography.relationships.map(r => `• ${r.name} (${r.type}): ${r.description}`).join('\n')}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL INSTRUCTION FOR GENERATEPROFILE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. MUST use the real data provided above
2. DO NOT invent information that contradicts known facts
3. DO NOT use generic default values (Buenos Aires, Argentina, etc.)
4. If specific information is missing, INFER it coherently with the real character
5. Keep consistency with the character's universe/context (${biography.sourceContext})

Example: If the character is Tony Stark from the MCU:
✓ CORRECT: Malibu/New York, United States, CEO Stark Industries, father Howard Stark (deceased), mother Maria Stark (deceased), spouse Pepper Potts, daughter Morgan Stark
✗ INCORRECT: Buenos Aires, Argentina, teacher, mother Carmen alive, etc.
`;

  console.log("[CharacterResearch] Research completed successfully");

  return {
    detection,
    biography,
    enhancedPrompt,
  };
}
