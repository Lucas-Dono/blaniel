/**
 * Validation Service
 * 
 * Validation services for the character creator V2:
 * - Location validation and geocoding
 * - Name validation and character search
 * - Complete draft validation
 */

import { z } from 'zod';

// ============================================
// TYPES & SCHEMAS
// ============================================

export const LocationDataSchema = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
  region: z.string().optional(),
  timezone: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lon: z.number(),
  }),
  verified: z.boolean(),
});

export type LocationData = z.infer<typeof LocationDataSchema>;

export interface LocationValidationResult {
  valid: boolean;
  location?: LocationData;
  error?: string;
  suggestions?: string[];
}

export interface NameValidationResult {
  valid: boolean;
  available: boolean;
  characterSearchResults?: CharacterSearchResult[];
  error?: string;
}

export interface CharacterSearchResult {
  name: string;
  source: 'wikipedia' | 'myanimelist' | 'fandom' | 'custom';
  description: string;
  imageUrl?: string;
  sourceUrl?: string;
  metadata?: Record<string, any>;
}

// ============================================
// LOCATION VALIDATION
// ============================================

/**
 * Validates and enriches a location using geocoding
 * 
 * Uses OpenStreetMap Nominatim API (free, no API key needed)
 * Alternative: Google Maps Geocoding API (requires key)
 */
export async function validateLocation(
  city: string,
  country: string
): Promise<LocationValidationResult> {
  try {
    // Normalize inputs
    const normalizedCity = city.trim();
    const normalizedCountry = country.trim();

    if (!normalizedCity || !normalizedCountry) {
      return {
        valid: false,
        error: 'City and country are required',
      };
    }

    // Query OpenStreetMap Nominatim
    const query = encodeURIComponent(`${normalizedCity}, ${normalizedCountry}`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CreadorInteligencias/1.0', // Required by Nominatim
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      return {
        valid: false,
        error: `Location "${normalizedCity}, ${normalizedCountry}" not found`,
        suggestions: await getSuggestions(normalizedCity, normalizedCountry),
      };
    }

    // Pick best match (first result is usually best)
    const best = results[0];
    const address = best.address;

    // Get timezone from coordinates
    const timezone = await getTimezoneFromCoordinates(
      parseFloat(best.lat),
      parseFloat(best.lon)
    );

    const locationData: LocationData = {
      city: address.city || address.town || address.village || normalizedCity,
      country: address.country || normalizedCountry,
      region: address.state || address.region,
      timezone,
      coordinates: {
        lat: parseFloat(best.lat),
        lon: parseFloat(best.lon),
      },
      verified: true,
    };

    return {
      valid: true,
      location: locationData,
    };
  } catch (error) {
    console.error('Location validation error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get timezone from coordinates
 * Uses timeapi.io (free, no key needed)
 */
async function getTimezoneFromCoordinates(
  lat: number,
  lon: number
): Promise<string> {
  try {
    const url = `https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lon}`;
    const response = await fetch(url);

    if (!response.ok) {
      // Fallback: estimate timezone from longitude
      return estimateTimezoneFromLongitude(lon);
    }

    const data = await response.json();
    return data.timeZone || estimateTimezoneFromLongitude(lon);
  } catch (error) {
    console.error('Timezone lookup error:', error);
    return estimateTimezoneFromLongitude(lon);
  }
}

/**
 * Estimate timezone from longitude (rough approximation)
 */
function estimateTimezoneFromLongitude(lon: number): string {
  // Rough estimation: UTC offset = longitude / 15
  const offset = Math.round(lon / 15);
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  return `UTC${sign}${absOffset.toString().padStart(2, '0')}:00`;
}

/**
 * Get location suggestions for typos/alternatives
 */
async function getSuggestions(
  city: string,
  country: string
): Promise<string[]> {
  try {
    // Search with broader query
    const query = encodeURIComponent(country);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=10`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CreadorInteligencias/1.0',
      },
    });

    if (!response.ok) return [];

    const results = await response.json();

    // Extract city names from results
    const suggestions = results
      .filter((r: any) => r.address?.city || r.address?.town)
      .map((r: any) => r.address.city || r.address.town)
      .filter((name: string, index: number, arr: string[]) =>
        // Remove duplicates
        arr.indexOf(name) === index
      )
      .slice(0, 5);

    return suggestions;
  } catch (error) {
    console.error('Error getting suggestions:', error);
    return [];
  }
}

// ============================================
// NAME VALIDATION
// ============================================

/**
 * Valida nombre y busca personajes existentes
 */
export async function validateName(name: string): Promise<NameValidationResult> {
  try {
    const normalizedName = name.trim();

    if (!normalizedName) {
      return {
        valid: false,
        available: false,
        error: 'Name is required',
      };
    }

    if (normalizedName.length < 2) {
      return {
        valid: false,
        available: false,
        error: 'Name must be at least 2 characters',
      };
    }

    if (normalizedName.length > 100) {
      return {
        valid: false,
        available: false,
        error: 'Name must be less than 100 characters',
      };
    }

    // Search for existing characters (optional)
    const searchResults = await searchCharacters(normalizedName);

    return {
      valid: true,
      available: true,
      characterSearchResults: searchResults.length > 0 ? searchResults : undefined,
    };
  } catch (error) {
    console.error('Name validation error:', error);
    return {
      valid: false,
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** Searches for characters in multiple sources */
async function searchCharacters(name: string): Promise<CharacterSearchResult[]> {
  const results: CharacterSearchResult[] = [];

  try {
    // Search Wikipedia (real people, historical figures)
    const wikiResults = await searchWikipedia(name);
    results.push(...wikiResults);

    // Search MyAnimeList (anime characters)
    const animeResults = await searchMyAnimeList(name);
    results.push(...animeResults);

    // Search Fandom wikis (fictional characters)
    const fandomResults = await searchFandom(name);
    results.push(...fandomResults);
  } catch (error) {
    console.error('Character search error:', error);
  }

  return results.slice(0, 5); // Return top 5 results
}

async function searchWikipedia(name: string): Promise<CharacterSearchResult[]> {
  try {
    const query = encodeURIComponent(name);
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${query}&format=json&origin=*&srlimit=3`;

    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const searches = data.query?.search || [];

    return searches.map((result: any) => ({
      name: result.title,
      source: 'wikipedia' as const,
      description: result.snippet.replace(/<[^>]*>/g, ''), // Remove HTML tags
      sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title)}`,
    }));
  } catch (error) {
    console.error('Wikipedia search error:', error);
    return [];
  }
}

async function searchMyAnimeList(name: string): Promise<CharacterSearchResult[]> {
  try {
    const query = encodeURIComponent(name);
    // Using Jikan API (unofficial MyAnimeList API)
    const url = `https://api.jikan.moe/v4/characters?q=${query}&limit=3`;

    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const characters = data.data || [];

    return characters.map((char: any) => ({
      name: char.name,
      source: 'myanimelist' as const,
      description: char.about?.substring(0, 200) || 'Anime character',
      imageUrl: char.images?.jpg?.image_url,
      sourceUrl: char.url,
      metadata: {
        favorites: char.favorites,
      },
    }));
  } catch (error) {
    console.error('MyAnimeList search error:', error);
    return [];
  }
}

async function searchFandom(_name: string): Promise<CharacterSearchResult[]> {
  // Fandom search is more complex, requires wiki-specific queries
  // For now, return empty array
  // TODO: Implement if needed
  return [];
}

// ============================================
// DRAFT VALIDATION
// ============================================

export const CharacterDraftSchema = z.object({
  // Step 1: Identity
  name: z.string().min(1).max(100),
  age: z.number().min(13).max(150),
  gender: z.enum(['male', 'female', 'non-binary', 'other']),
  location: LocationDataSchema,

  // Step 2: Personality
  personality: z.string().min(10).max(2000),
  purpose: z.string().min(10).max(2000),
  traits: z.array(z.string()).min(1).max(10),

  // Step 3: Appearance
  physicalAppearance: z.string().min(10).max(2000).optional(),
  avatar: z.string().url().optional(),
  referenceImage: z.string().url().optional(),

  // Step 4: Backstory (optional)
  backstory: z.string().max(5000).optional(),
  occupation: z.string().max(200).optional(),
  education: z.string().max(500).optional(),

  // Step 5: Configuration
  nsfwMode: z.boolean().default(false),
  allowDevelopTraumas: z.boolean().default(false),
  initialBehavior: z.string().optional(),

  // Meta
  characterSource: z.any().optional(),
  version: z.literal('2.0'),
});

export type CharacterDraft = z.infer<typeof CharacterDraftSchema>;

/**
 * Valida draft completo
 */
export function validateDraft(draft: unknown): {
  valid: boolean;
  data?: CharacterDraft;
  errors?: z.ZodError;
} {
  try {
    const validated = CharacterDraftSchema.parse(draft);
    return {
      valid: true,
      data: validated,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error,
      };
    }
    throw error;
  }
}

/** Validates specific step */
export function validateStep(
  step: number,
  data: Partial<CharacterDraft>
): {
  valid: boolean;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  switch (step) {
    case 1: // Identity
      if (!data.name || data.name.length < 1) {
        errors.name = 'Name is required';
      }
      if (!data.age || data.age < 13 || data.age > 150) {
        errors.age = 'Age must be between 13 and 150';
      }
      if (!data.gender) {
        errors.gender = 'Gender is required';
      }
      if (!data.location || !data.location.verified) {
        errors.location = 'Valid location is required';
      }
      break;

    case 2: // Personality
      if (!data.personality || data.personality.length < 10) {
        errors.personality = 'Personality description must be at least 10 characters';
      }
      if (!data.purpose || data.purpose.length < 10) {
        errors.purpose = 'Purpose must be at least 10 characters';
      }
      if (!data.traits || data.traits.length < 1) {
        errors.traits = 'At least one trait is required';
      }
      break;

    case 3: // Appearance (all optional)
      break;

    case 4: // Backstory (all optional)
      break;

    case 5: // Configuration (all optional with defaults)
      break;

    default:
      break;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}
