/**
 * Facet Inference System
 *
 * Infiere las 30 facetas de Big Five a partir de las 5 dimensiones principales.
 * Agrega varianza controlada para evitar perfiles demasiado uniformes.
 *
 * @version 1.0.0
 */

import type { BigFiveTraits } from '@/types/character-creation';
import type { BigFiveFacets } from './types';

/**
 * Clamp un valor entre min y max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Agrega ruido gaussiano a un valor base.
 *
 * @param base - Valor base (0-100)
 * @param variance - Varianza máxima a agregar (desviación estándar)
 * @returns Valor con ruido agregado, clamped a 0-100
 */
function addNoise(base: number, variance: number): number {
  // Box-Muller transform para ruido gaussiano
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

  // Escalar por varianza
  const noise = z * variance;

  return clamp(base + noise, 0, 100);
}

/**
 * Infiere las facetas de Openness desde el valor base.
 */
function inferOpennessFacets(openness: number): BigFiveFacets['openness'] {
  return {
    imagination: addNoise(openness, 5),
    artisticInterests: addNoise(openness, 8),
    emotionality: addNoise(openness, 5),
    adventurousness: addNoise(openness, 7),
    intellect: addNoise(openness, 4),
    liberalism: addNoise(openness, 10), // Mayor varianza, menos correlacionado
  };
}

/**
 * Infiere las facetas de Conscientiousness desde el valor base.
 */
function inferConscientiousnessFacets(conscientiousness: number): BigFiveFacets['conscientiousness'] {
  return {
    selfEfficacy: addNoise(conscientiousness, 6),
    orderliness: addNoise(conscientiousness, 7),
    dutifulness: addNoise(conscientiousness, 5),
    achievementStriving: addNoise(conscientiousness, 6),
    selfDiscipline: addNoise(conscientiousness, 4),
    cautiousness: addNoise(conscientiousness, 8),
  };
}

/**
 * Infiere las facetas de Extraversion desde el valor base.
 */
function inferExtraversionFacets(extraversion: number): BigFiveFacets['extraversion'] {
  return {
    friendliness: addNoise(extraversion, 6),
    gregariousness: addNoise(extraversion, 5),
    assertiveness: addNoise(extraversion, 7),
    activityLevel: addNoise(extraversion, 6),
    excitementSeeking: addNoise(extraversion, 8),
    cheerfulness: addNoise(extraversion, 5),
  };
}

/**
 * Infiere las facetas de Agreeableness desde el valor base.
 */
function inferAgreeablenessFacets(agreeableness: number): BigFiveFacets['agreeableness'] {
  return {
    trust: addNoise(agreeableness, 7),
    morality: addNoise(agreeableness, 5),
    altruism: addNoise(agreeableness, 6),
    cooperation: addNoise(agreeableness, 5),
    modesty: addNoise(agreeableness, 8), // Mayor varianza
    sympathy: addNoise(agreeableness, 4),
  };
}

/**
 * Infiere las facetas de Neuroticism desde el valor base.
 */
function inferNeuroticismFacets(neuroticism: number): BigFiveFacets['neuroticism'] {
  return {
    anxiety: addNoise(neuroticism, 5),
    anger: addNoise(neuroticism, 7),
    depression: addNoise(neuroticism, 6),
    selfConsciousness: addNoise(neuroticism, 6),
    immoderation: addNoise(neuroticism, 8),
    vulnerability: addNoise(neuroticism, 5),
  };
}

/**
 * Infiere todas las facetas de Big Five desde los valores base.
 *
 * @param bigFive - Valores Big Five (0-100 cada uno)
 * @returns Facetas inferidas con varianza controlada
 *
 * @example
 * const facets = inferFacetsFromBigFive({
 *   openness: 85,
 *   conscientiousness: 50,
 *   extraversion: 30,
 *   agreeableness: 70,
 *   neuroticism: 40
 * });
 * // facets.openness.imagination ≈ 80-90 (cerca de 85 con varianza)
 * // facets.openness.liberalism ≈ 75-95 (more variance)
 */
export function inferFacetsFromBigFive(bigFive: BigFiveTraits): BigFiveFacets {
  return {
    openness: inferOpennessFacets(bigFive.openness),
    conscientiousness: inferConscientiousnessFacets(bigFive.conscientiousness),
    extraversion: inferExtraversionFacets(bigFive.extraversion),
    agreeableness: inferAgreeablenessFacets(bigFive.agreeableness),
    neuroticism: inferNeuroticismFacets(bigFive.neuroticism),
  };
}

/**
 * Verifica si las facetas son consistentes con el Big Five base.
 *
 * @param bigFive - Valores Big Five
 * @param facets - Facetas a verificar
 * @returns Score de consistencia 0-1 (1 = perfectamente consistente)
 */
export function checkFacetConsistency(bigFive: BigFiveTraits, facets: BigFiveFacets): number {
  let totalDeviation = 0;
  let count = 0;

  // Check each dimension
  const dimensions: Array<keyof BigFiveTraits> = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];

  for (const dimension of dimensions) {
    const bigFiveValue = bigFive[dimension];
    const facetValues = Object.values(facets[dimension]);
    const avgFacet = facetValues.reduce((a, b) => a + b, 0) / facetValues.length;

    // Calculate absolute deviation
    const deviation = Math.abs(bigFiveValue - avgFacet);
    totalDeviation += deviation;
    count++;
  }

  const avgDeviation = totalDeviation / count;

  // Consistency score: 0 deviation = 1.0, 50 deviation = 0.0
  return Math.max(0, 1 - avgDeviation / 50);
}

/**
 * Ajusta las facetas para que sean más consistentes con Big Five.
 *
 * @param bigFive - Valores Big Five
 * @param facets - Facetas a ajustar
 * @param strength - Fuerza del ajuste (0-1, default 0.5)
 * @returns Facetas ajustadas
 */
export function adjustFacetsTowardsBigFive(bigFive: BigFiveTraits, facets: BigFiveFacets, strength: number = 0.5): BigFiveFacets {
  const dimensions: Array<keyof BigFiveTraits> = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];

  const adjusted: Partial<BigFiveFacets> = {};

  for (const dimension of dimensions) {
    const bigFiveValue = bigFive[dimension];
    const facetObj = facets[dimension];

    // Calcular promedio actual
    const facetValues = Object.values(facetObj);
    const avgFacet = facetValues.reduce((a, b) => a + b, 0) / facetValues.length;

    // Calcular diferencia
    const diff = bigFiveValue - avgFacet;

    // Ajustar cada faceta
    const adjustedFacets: Record<string, number> = {};
    for (const [key, value] of Object.entries(facetObj)) {
      const adjustment = diff * strength;
      adjustedFacets[key] = clamp(value + adjustment, 0, 100);
    }

    adjusted[dimension] = adjustedFacets as any;
  }

  return adjusted as BigFiveFacets;
}

/**
 * Calcula el promedio de facetas para una dimensión.
 *
 * @param facets - Objeto de facetas (e.g., facets.openness)
 * @returns Promedio de todas las facetas
 */
export function calculateFacetAverage(facets: Record<string, number>): number {
  const values = Object.values(facets);
  return values.reduce((a, b) => a + b, 0) / values.length;
}
