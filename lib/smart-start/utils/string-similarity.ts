/**
 * String Similarity Utilities
 * Used for calculating match scores between search queries and results
 */

/**
 * Calculate Jaro-Winkler similarity between two strings
 * Returns a score between 0 and 1, where 1 is a perfect match
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Similarity score between 0 and 1
 */
export function jaroWinklerSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  // Calculate Jaro similarity
  const jaroScore = jaroSimilarity(s1, s2);

  // Apply Winkler modification for common prefixes
  const prefixLength = Math.min(
    commonPrefixLength(s1, s2),
    4 // Standard Jaro-Winkler uses max prefix of 4
  );

  const p = 0.1; // Standard scaling factor
  return jaroScore + prefixLength * p * (1 - jaroScore);
}

/**
 * Calculate Jaro similarity
 */
function jaroSimilarity(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 && len2 === 0) return 1.0;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchWindow = Math.max(len1, len2) / 2 - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  );
}

/**
 * Calculate common prefix length
 */
function commonPrefixLength(s1: string, s2: string): number {
  let length = 0;
  const maxLength = Math.min(s1.length, s2.length);

  for (let i = 0; i < maxLength; i++) {
    if (s1[i] === s2[i]) {
      length++;
    } else {
      break;
    }
  }

  return length;
}

/**
 * Calculate match score considering multiple factors
 *
 * @param query - The search query
 * @param resultName - The name from the search result
 * @param alternateNames - Any alternate names for the result
 * @returns Match score between 0 and 1
 */
export function calculateMatchScore(
  query: string,
  resultName: string,
  alternateNames?: string[]
): number {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedName = resultName.toLowerCase().trim();

  // Exact match
  if (normalizedQuery === normalizedName) return 1.0;

  // Calculate Jaro-Winkler similarity for primary name
  let maxScore = jaroWinklerSimilarity(normalizedQuery, normalizedName);

  // Check if query is contained in name (substring match)
  if (normalizedName.includes(normalizedQuery)) {
    const containmentScore = normalizedQuery.length / normalizedName.length;
    maxScore = Math.max(maxScore, 0.7 + containmentScore * 0.3);
  }

  // Check alternate names if provided
  if (alternateNames && alternateNames.length > 0) {
    for (const altName of alternateNames) {
      if (!altName) continue;

      const normalizedAlt = altName.toLowerCase().trim();

      // Exact match with alternate name
      if (normalizedQuery === normalizedAlt) return 1.0;

      // Jaro-Winkler with alternate name
      const altScore = jaroWinklerSimilarity(normalizedQuery, normalizedAlt);
      maxScore = Math.max(maxScore, altScore);

      // Substring match with alternate name
      if (normalizedAlt.includes(normalizedQuery)) {
        const containmentScore = normalizedQuery.length / normalizedAlt.length;
        maxScore = Math.max(maxScore, 0.7 + containmentScore * 0.3);
      }
    }
  }

  return Math.min(maxScore, 1.0); // Ensure we don't exceed 1.0
}

/**
 * Categorize match quality based on score
 */
export function getMatchQuality(score: number): 'perfect' | 'high' | 'medium' | 'low' {
  if (score >= 0.95) return 'perfect';
  if (score >= 0.85) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

/**
 * Check if a match should trigger high-confidence modal
 */
export function shouldShowHighConfidenceModal(score: number): boolean {
  return score >= 0.85;
}
