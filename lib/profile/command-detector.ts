/**
 * Intelligent Detection of Relevant Commands
 *
 * Uses semantic embeddings to detect which knowledge commands
 * are relevant to the user's question.
 *
 * Works in any language without needing dictionaries.
 */

import { generateOpenAIEmbedding, cosineSimilarity } from '@/lib/memory/openai-embeddings';
import { getProfileEmbeddings, hasProfileEmbeddings, generateProfileEmbeddings } from './profile-embeddings';
import { createLogger } from '@/lib/logger';

const log = createLogger('CommandDetector');

interface CommandMatch {
  command: string;
  score: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

interface DetectionResult {
  matches: CommandMatch[];
  topMatch: CommandMatch | null;
  queryEmbedding: number[];
  detectionTimeMs: number;
}

// Thresholds for confidence classification
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.75,    // Very relevant
  MEDIUM: 0.65,  // Possibly relevant
  LOW: 0.50,     // Maybe relevant (optimized for natural queries)
};

/**
 * Detect relevant commands for a user query
 */
export async function detectRelevantCommands(
  userQuery: string,
  agentId: string,
  options: {
    topN?: number;           // How many commands to return (default: 1)
    minScore?: number;       // Minimum score to consider (default: 0.65)
    ensureGenerated?: boolean; // Generate embeddings if they don't exist (default: true)
  } = {}
): Promise<DetectionResult> {
  const {
    topN = 1,
    minScore = CONFIDENCE_THRESHOLDS.MEDIUM,
    ensureGenerated = true,
  } = options;

  const startTime = Date.now();

  try {
    // Check if profile embeddings exist
    const hasEmbeddings = await hasProfileEmbeddings(agentId);

    if (!hasEmbeddings) {
      if (ensureGenerated) {
        log.info({ agentId }, 'Profile embeddings do not exist, generating...');
        await generateProfileEmbeddings(agentId);
      } else {
        log.warn({ agentId }, 'Profile embeddings do not exist');
        return {
          matches: [],
          topMatch: null,
          queryEmbedding: [],
          detectionTimeMs: Date.now() - startTime,
        };
      }
    }

    // Generate embedding from user query
    const queryEmbedding = await generateOpenAIEmbedding(userQuery);

    // Get embeddings from profile
    const profileEmbeddings = await getProfileEmbeddings(agentId);

    if (profileEmbeddings.length === 0) {
      log.warn({ agentId }, 'No profile embeddings available');
      return {
        matches: [],
        topMatch: null,
        queryEmbedding,
        detectionTimeMs: Date.now() - startTime,
      };
    }

    // Calculate similarity with each command
    const matches: CommandMatch[] = profileEmbeddings
      .map(section => {
        const score = cosineSimilarity(queryEmbedding, section.embedding);
        const confidence = getConfidenceLevel(score);

        return {
          command: section.command,
          score,
          confidence,
        };
      })
      .filter(match => match.score >= minScore) // Filter by minimum score
      .sort((a, b) => b.score - a.score) // Sort by descending score
      .slice(0, topN); // Take top N

    const topMatch = matches.length > 0 ? matches[0] : null;

    const detectionTime = Date.now() - startTime;

    log.debug(
      {
        agentId,
        query: userQuery.substring(0, 50),
        matchCount: matches.length,
        topCommand: topMatch?.command,
        topScore: topMatch?.score,
        timeMs: detectionTime,
      },
      'Relevant commands detected'
    );

    return {
      matches,
      topMatch,
      queryEmbedding,
      detectionTimeMs: detectionTime,
    };
  } catch (error) {
    log.error({ error, agentId, query: userQuery.substring(0, 50) }, 'Error detecting commands');

    // Return empty result in case of error
    return {
      matches: [],
      topMatch: null,
      queryEmbedding: [],
      detectionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Determine confidence level based on similarity score
 */
function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' | 'none' {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  if (score >= CONFIDENCE_THRESHOLDS.LOW) return 'low';
  return 'none';
}

/**
 * Simplified function to get the most relevant command
 */
export async function getTopRelevantCommand(
  userQuery: string,
  agentId: string
): Promise<string | null> {
  const result = await detectRelevantCommands(userQuery, agentId, {
    topN: 1,
    minScore: CONFIDENCE_THRESHOLDS.MEDIUM,
  });

  return result.topMatch?.command || null;
}

/**
 * Function to get multiple relevant commands (useful for complex queries)
 */
export async function getMultipleRelevantCommands(
  userQuery: string,
  agentId: string,
  maxCommands: number = 3
): Promise<string[]> {
  const result = await detectRelevantCommands(userQuery, agentId, {
    topN: maxCommands,
    minScore: CONFIDENCE_THRESHOLDS.MEDIUM,
  });

  return result.matches.map(m => m.command);
}

/**
 * Format result for logging/debugging
 */
export function formatDetectionResult(result: DetectionResult): string {
  if (result.matches.length === 0) {
    return 'No relevant commands found';
  }

  const lines = ['Relevant commands detected:'];
  result.matches.forEach((match, idx) => {
    const emoji = match.confidence === 'high' ? '✅' : match.confidence === 'medium' ? '🤔' : '⚠️';
    lines.push(`  ${idx + 1}. ${emoji} ${match.command} (score: ${match.score.toFixed(3)}, ${match.confidence})`);
  });
  lines.push(`Detection time: ${result.detectionTimeMs}ms`);

  return lines.join('\n');
}
