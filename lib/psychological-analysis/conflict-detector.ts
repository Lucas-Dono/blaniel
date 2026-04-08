/**
 * Conflict Detector
 * 
 * Detects psychological conflicts in enriched profiles using the defined rules.
 * Filters, sorts, and categorizes conflicts by severity and category.
 * 
 * @version 1.0.0
 */

import type { EnrichedPersonalityProfile, ConflictWarning, ConflictSeverity } from './types';
import {CONFLICT_RULES} from './conflict-rules';

/** Severity order (from least to most severe). */
const SEVERITY_ORDER: ConflictSeverity[] = ['info', 'warning', 'danger', 'critical'];

/**
 * Compares two severities.
 * @returns negative number if a < b, positive if a > b, 0 if equal
 */
function compareSeverity(a: ConflictSeverity, b: ConflictSeverity): number {
  return SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b);
}

/** Psychological conflict detector. */
export class ConflictDetector {
  /**
   * Detects all conflicts in a profile.
   * 
   * @param profile - Enriched psychological profile
   * @returns List of detected conflicts, sorted by severity (critical first)
   */
  detectConflicts(profile: EnrichedPersonalityProfile): ConflictWarning[] {
    const detectedConflicts: ConflictWarning[] = [];

    for (const rule of CONFLICT_RULES) {
      try {
        if (rule.detect(profile)) {
          detectedConflicts.push({
            id: rule.id,
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            implications: rule.implications,
            mitigations: rule.mitigations,
            metadata: {
              category: rule.category,
            },
          });
        }
      } catch (error) {
        // If there is an error in detection, skip silently
        console.warn(`Error detecting conflict for rule ${rule.id}:`, error);
      }
    }

    // Sort by severity (critical first)
    return detectedConflicts.sort((a, b) => compareSeverity(b.severity, a.severity));
  }

  /**
   * Detects conflicts and filters by minimum severity.
   * @param profile - Psychological profile
   * @param minSeverity - Minimum severity to include (default: 'info')
   * @returns Filtered conflicts
   */
  detectConflictsWithMinSeverity(profile: EnrichedPersonalityProfile, minSeverity: ConflictSeverity = 'info'): ConflictWarning[] {
    const allConflicts = this.detectConflicts(profile);
    const minIndex = SEVERITY_ORDER.indexOf(minSeverity);

    return allConflicts.filter((conflict) => {
      const conflictIndex = SEVERITY_ORDER.indexOf(conflict.severity);
      return conflictIndex >= minIndex;
    });
  }

  /** Detects only critical conflicts. */
  detectCriticalConflicts(profile: EnrichedPersonalityProfile): ConflictWarning[] {
    return this.detectConflicts(profile).filter((c) => c.severity === 'critical');
  }

  /**
   * Detects conflicts and groups by category.
   * @param profile - Psychological profile
   * @returns Conflicts grouped by category
   */
  detectConflictsByCategory(
    profile: EnrichedPersonalityProfile
  ): Record<string, ConflictWarning[]> {
    const conflicts = this.detectConflicts(profile);
    const grouped: Record<string, ConflictWarning[]> = {
      'big-five': [],
      facets: [],
      'dark-triad': [],
      attachment: [],
      'cross-dimensional': [],
    };

    for (const conflict of conflicts) {
      const category = conflict.metadata?.category as string | undefined;
      if (category && grouped[category]) {
        grouped[category].push(conflict);
      }
    }

    return grouped;
  }

  /**
   * Detects conflicts and groups by severity.
   * 
   * @param profile - Psychological profile
   * @returns Conflicts grouped by severity
   */
  detectConflictsBySeverity(
    profile: EnrichedPersonalityProfile
  ): Record<ConflictSeverity, ConflictWarning[]> {
    const conflicts = this.detectConflicts(profile);
    const grouped: Record<ConflictSeverity, ConflictWarning[]> = {
      info: [],
      warning: [],
      danger: [],
      critical: [],
    };

    for (const conflict of conflicts) {
      grouped[conflict.severity].push(conflict);
    }

    return grouped;
  }

  /**
   * Calculates a general conflict score (0-100).
   * 0 = no conflicts, 100 = many severe conflicts.
   * 
   * @param profile - Psychological profile
   * @returns Conflict score 0-100
   */
  calculateConflictScore(profile: EnrichedPersonalityProfile): number {
    const conflicts = this.detectConflicts(profile);

    // Pesos por severidad
    const weights = {
      info: 5,
      warning: 15,
      danger: 30,
      critical: 50,
    };

    let totalScore = 0;
    for (const conflict of conflicts) {
      totalScore += weights[conflict.severity];
    }

    // Clamp a 100
    return Math.min(100, totalScore);
  }

  /**
   * Checks if a profile has critical conflicts.
   * 
   * @param profile - Psychological profile
   * @returns true if there is at least one critical conflict
   */
  hasCriticalConflicts(profile: EnrichedPersonalityProfile): boolean {
    return this.detectCriticalConflicts(profile).length > 0;
  }

  /**
   * Gets a conflict summary.
   * 
   * @param profile - Psychological profile
   * @returns Summary with counts by severity
   */
  getConflictSummary(profile: EnrichedPersonalityProfile): {
    total: number;
    bySeverity: Record<ConflictSeverity, number>;
    score: number;
    hasCritical: boolean;
  } {
    const conflicts = this.detectConflicts(profile);
    const bySeverity = this.detectConflictsBySeverity(profile);

    return {
      total: conflicts.length,
      bySeverity: {
        info: bySeverity.info.length,
        warning: bySeverity.warning.length,
        danger: bySeverity.danger.length,
        critical: bySeverity.critical.length,
      },
      score: this.calculateConflictScore(profile),
      hasCritical: this.hasCriticalConflicts(profile),
    };
  }
}

/**
 * Convenience function to detect conflicts.
 * Equivalent to `new ConflictDetector().detectConflicts(profile)`.
 */
export function detectConflicts(profile: EnrichedPersonalityProfile): ConflictWarning[] {
  return new ConflictDetector().detectConflicts(profile);
}

/** Convenience function to detect only critical conflicts. */
export function detectCriticalConflicts(profile: EnrichedPersonalityProfile): ConflictWarning[] {
  return new ConflictDetector().detectCriticalConflicts(profile);
}

/** Convenience function to calculate conflict score. */
export function calculateConflictScore(profile: EnrichedPersonalityProfile): number {
  return new ConflictDetector().calculateConflictScore(profile);
}
