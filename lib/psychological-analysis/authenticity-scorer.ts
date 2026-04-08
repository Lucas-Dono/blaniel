/**
 * Authenticity Scorer
 *
 * Calculates authenticity score (0-100) for psychological profiles based on:
 * - Big Five ↔ Facets consistency (20%)
 * - Values ↔ Traits alignment (15%)
 * - Emotional coherence with Neuroticism (15%)
 * - Dark Triad ↔ Agreeableness coherence (10%)
 * - Attachment ↔ Extraversion coherence (10%)
 * - Predicted behaviors alignment (30%)
 *
 * @version 1.0.0
 */

import type { EnrichedPersonalityProfile, AuthenticityScore, AuthenticityBreakdown } from './types';
import { getAuthenticityLevel } from './types';

/**
 * Psychological authenticity scorer.
 */
export class AuthenticityScorer {
  /**
   * Calculates complete authenticity score.
   *
   * @param profile - Enriched psychological profile
   * @returns Authenticity score with breakdown
   */
  calculateScore(profile: EnrichedPersonalityProfile): AuthenticityScore {
    const breakdown: AuthenticityBreakdown = {
      bigFiveFacetsConsistency: this.checkBigFiveFacetsConsistency(profile),
      valuesTraitsAlignment: this.checkValuesTraitsAlignment(profile),
      emotionalCoherence: this.checkEmotionalCoherence(profile),
      darkTriadCoherence: this.checkDarkTriadCoherence(profile),
      attachmentCoherence: this.checkAttachmentCoherence(profile),
      behaviorAlignment: this.checkBehaviorAlignment(profile),
    };

    // Component weights
    const weights = {
      bigFiveFacetsConsistency: 20,
      valuesTraitsAlignment: 15,
      emotionalCoherence: 15,
      darkTriadCoherence: 10,
      attachmentCoherence: 10,
      behaviorAlignment: 30,
    };

    // Calculate weighted score
    let totalScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
      const componentScore = breakdown[key as keyof AuthenticityBreakdown];
      totalScore += componentScore * weight;
    }

    const score = Math.round(totalScore);
    const level = getAuthenticityLevel(score);

    return {
      score,
      breakdown,
      level,
    };
  }

  /**
   * Check Big Five and facets consistency (20%).
   *
   * @returns Score 0-1
   */
  private checkBigFiveFacetsConsistency(profile: EnrichedPersonalityProfile): number {
    if (!profile.facets) {
      // Si no hay facetas, asumimos consistencia perfecta
      return 1.0;
    }

    const dimensions: Array<keyof typeof profile.facets> = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];

    let totalDeviation = 0;
    let count = 0;

    for (const dimension of dimensions) {
      const bigFiveValue = profile[dimension];
      const facetValues = Object.values(profile.facets[dimension]);
      const avgFacet = facetValues.reduce((a, b) => a + b, 0) / facetValues.length;

      // Calculate absolute deviation
      const deviation = Math.abs(bigFiveValue - avgFacet);
      totalDeviation += deviation;
      count++;
    }

    const avgDeviation = totalDeviation / count;

    // Score: 0 deviation = 1.0, 50 deviation = 0.0
    return Math.max(0, 1 - avgDeviation / 50);
  }

  /**
   * Verifica alineación entre valores y traits (15%).
   * Placeholder simple por ahora - puede expandirse.
   *
   * @returns Score 0-1
   */
  private checkValuesTraitsAlignment(profile: EnrichedPersonalityProfile): number {
    // Simplified implementation:
    // We assume that profiles with balanced traits have better alignment

    const { openness, conscientiousness, extraversion, agreeableness, neuroticism } = profile;

    // Calcular varianza de los traits
    const traits = [openness, conscientiousness, extraversion, agreeableness, neuroticism];
    const avg = traits.reduce((a, b) => a + b, 0) / traits.length;
    const variance = traits.reduce((sum, trait) => sum + Math.pow(trait - avg, 2), 0) / traits.length;

    // Very extreme profiles (high variance) may have less alignment
    // Variance 0 = 1.0, variance 2500 (theoretical max) = 0.5
    const alignmentScore = Math.max(0.5, 1 - variance / 5000);

    return alignmentScore;
  }

  /**
   * Verifica coherencia emocional con neuroticism (15%).
   *
   * @returns Score 0-1
   */
  private checkEmotionalCoherence(profile: EnrichedPersonalityProfile): number {
    // Si hay facetas de neuroticism, usarlas
    if (profile.facets?.neuroticism) {
      const { anxiety, anger, depression, vulnerability } = profile.facets.neuroticism;
      const avgNeuroticismFacet = (anxiety + anger + depression + vulnerability) / 4;

      // Should be close to general neuroticism
      const deviation = Math.abs(profile.neuroticism - avgNeuroticismFacet);
      return Math.max(0, 1 - deviation / 50);
    }

    // If no facets, check if neuroticism is in reasonable range
    // Very extreme neuroticism (>90 or <10) is less common
    if (profile.neuroticism > 90 || profile.neuroticism < 10) {
      return 0.7; // Penalizar ligeramente
    }

    return 0.85; // Default: bastante coherente
  }

  /**
   * Verifica coherencia Dark Triad con agreeableness (10%).
   *
   * @returns Score 0-1
   */
  private checkDarkTriadCoherence(profile: EnrichedPersonalityProfile): number {
    if (!profile.darkTriad) {
      // Sin Dark Triad, coherencia perfecta
      return 1.0;
    }

    const { machiavellianism, narcissism, psychopathy } = profile.darkTriad;
    const avgDarkTriad = (machiavellianism + narcissism + psychopathy) / 3;

    // High Dark Triad should correlate with low agreeableness
    // Si avgDarkTriad > 50, esperamos agreeableness < 50
    if (avgDarkTriad > 50 && profile.agreeableness > 60) {
      // Incoherente: Dark Triad alto con alta amabilidad
      return 0.3;
    }

    if (avgDarkTriad < 30 && profile.agreeableness < 40) {
      // Incoherente: Dark Triad bajo con baja amabilidad
      return 0.6;
    }

    // Coherente
    return 1.0;
  }

  /**
   * Verifica coherencia apego con extraversion (10%).
   *
   * @returns Score 0-1
   */
  private checkAttachmentCoherence(profile: EnrichedPersonalityProfile): number {
    if (!profile.attachment) {
      // Sin attachment, coherencia perfecta
      return 1.0;
    }

    const { primaryStyle } = profile.attachment;

    // Apego seguro tiende a correlacionar con extraversion moderada-alta
    if (primaryStyle === 'secure' && profile.extraversion < 30) {
      return 0.7; // Un poco inusual pero no imposible
    }

    // Apego evitativo tiende a correlacionar con extraversion baja
    if ((primaryStyle === 'avoidant' || primaryStyle === 'fearful-avoidant') && profile.extraversion > 70) {
      return 0.6; // Bastante inusual
    }

    // Apego ansioso puede ocurrir con cualquier nivel de extraversion
    return 0.9;
  }

  /**
   * Verifica alineación de comportamientos predichos (30%).
   *
   * @returns Score 0-1
   */
  private checkBehaviorAlignment(profile: EnrichedPersonalityProfile): number {
    // Simplified implementation: verify general coherence

    let alignmentScore = 1.0;

    // Penalizar combinaciones extremas
    if (profile.neuroticism > 80 && profile.conscientiousness < 20) {
      alignmentScore -= 0.2; // Muy desorganizado y ansioso es difícil
    }

    if (profile.extraversion > 85 && profile.neuroticism > 85) {
      alignmentScore -= 0.15; // Muy social pero muy ansioso es tenso
    }

    if (profile.openness < 20 && profile.extraversion > 80) {
      alignmentScore -= 0.1; // Muy social pero muy cerrado es inusual
    }

    // Dark Triad extremo baja coherencia
    if (profile.darkTriad) {
      const avgDarkTriad = (profile.darkTriad.machiavellianism + profile.darkTriad.narcissism + profile.darkTriad.psychopathy) / 3;
      if (avgDarkTriad > 70) {
        alignmentScore -= 0.2;
      }
    }

    return Math.max(0, alignmentScore);
  }

  /**
   * Calcula solo el score numérico (sin desglose).
   *
   * @param profile - Perfil psicológico
   * @returns Score 0-100
   */
  calculateScoreOnly(profile: EnrichedPersonalityProfile): number {
    return this.calculateScore(profile).score;
  }

  /**
   * Verifica si un perfil es altamente auténtico (score >= 80).
   *
   * @param profile - Perfil psicológico
   * @returns true si score >= 80
   */
  isHighlyAuthentic(profile: EnrichedPersonalityProfile): boolean {
    return this.calculateScoreOnly(profile) >= 80;
  }

  /**
   * Verifica si un perfil es poco realista (score < 40).
   *
   * @param profile - Perfil psicológico
   * @returns true si score < 40
   */
  isUnrealistic(profile: EnrichedPersonalityProfile): boolean {
    return this.calculateScoreOnly(profile) < 40;
  }
}

/**
 * Función de conveniencia para calcular score de autenticidad.
 */
export function calculateAuthenticityScore(profile: EnrichedPersonalityProfile): AuthenticityScore {
  return new AuthenticityScorer().calculateScore(profile);
}

/**
 * Función de conveniencia para verificar si un perfil es realista.
 */
export function isProfileRealistic(profile: EnrichedPersonalityProfile): boolean {
  const score = new AuthenticityScorer().calculateScoreOnly(profile);
  return score >= 40; // Threshold para "realista"
}
