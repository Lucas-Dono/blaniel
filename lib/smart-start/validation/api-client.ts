/**
 * API Client with built-in Zod validation for Smart Start
 * Provides type-safe API calls with automatic validation
 */

import {
  validateAPIResponse,
  InitializeResponseSchema,
  SearchResponseSchema,
  DetailsResponseSchema,
  GenerateResponseSchema,
  type InitializeResponse,
  type SearchResponse,
  type DetailsResponse,
  type GenerateResponse,
} from './schemas';

/**
 * Base API client configuration
 */
const API_BASE = '/api/smart-start';

/**
 * Initialize a new Smart Start session
 */
export async function initializeSession(): Promise<InitializeResponse> {
  const response = await fetch(`${API_BASE}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  return validateAPIResponse(
    InitializeResponseSchema,
    response,
    'Initialize session'
  );
}

/**
 * Update session with new data
 */
export async function updateSession(sessionId: string, updates: Record<string, any>): Promise<void> {
  const response = await fetch(`${API_BASE}/session`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      action: { type: 'update', data: updates },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || 'Failed to update session');
  }
}

/**
 * Perform character search
 */
export async function searchCharacters(
  sessionId: string,
  query: string,
  limit: number = 10
): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, query, limit }),
  });

  return validateAPIResponse(
    SearchResponseSchema,
    response,
    'Character search'
  );
}

/**
 * Get detailed character information
 */
export async function getCharacterDetails(
  sourceId: string,
  externalId: string
): Promise<DetailsResponse> {
  const response = await fetch(`${API_BASE}/details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId, externalId }),
  });

  return validateAPIResponse(
    DetailsResponseSchema,
    response,
    'Character details'
  );
}

/**
 * Generate character from search result or from scratch
 */
export async function generateCharacter(
  sessionId: string,
  options: {
    searchResult?: any;
    searchResultId?: string;
    fromScratch?: boolean;
    customizations?: Record<string, any>;
  }
): Promise<GenerateResponse> {
  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      ...options,
    }),
  });

  return validateAPIResponse(
    GenerateResponseSchema,
    response,
    'Character generation'
  );
}

/**
 * Finalize character creation
 */
export async function finalizeCharacter(
  sessionId: string,
  characterDraft: any,
  genreId?: string
): Promise<{ id: string; agent: any }> {
  const response = await fetch(`${API_BASE}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      characterDraft,
      genreId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || 'Failed to finalize character');
  }

  const data = await response.json();

  // Validate that we got an ID back
  if (!data.id) {
    throw new Error('Server did not return character ID');
  }

  return data;
}

/**
 * Generic API call with error handling
 * For endpoints that don't need specific validation
 */
export async function apiCall<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.details || error.error || `API call failed: ${response.statusText}`
    );
  }

  return response.json();
}
