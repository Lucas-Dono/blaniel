/**
 * Normalización de Core Values para Compatibilidad hacia Atrás
 *
 * Maneja 3 formatos posibles:
 * 1. Array de objetos con weight (formato original): [{value: "honestidad", weight: 0.9}, ...]
 * 2. Array simple de strings (simplificado): ["honestidad", "lealtad", ...]
 * 3. Objeto enriquecido (PLUS/ULTRA): {values: [...], bigFiveFacets: {...}, ...}
 */

import type { BigFiveFacets, DarkTriad, AttachmentProfile } from './types';
import type { PsychologicalNeeds } from '@/types/character-creation';

export interface CoreValueWithWeight {
  value: string;
  weight: number;
  description: string;
}

export interface EnrichedCoreValuesData {
  values: string[];
  bigFiveFacets?: BigFiveFacets;
  darkTriad?: DarkTriad;
  attachmentProfile?: AttachmentProfile;
  psychologicalNeeds?: PsychologicalNeeds;
}

/**
 * Normaliza coreValues a array de strings simples
 */
export function normalizeCoreValuesToStringArray(coreValues: any): string[] {
  // Caso 1: null o undefined
  if (!coreValues) {
    return [];
  }

  // Caso 2: Ya es array de strings
  if (Array.isArray(coreValues) && typeof coreValues[0] === 'string') {
    return coreValues;
  }

  // Caso 3: Array de objetos con weight
  if (Array.isArray(coreValues) && typeof coreValues[0] === 'object' && 'value' in coreValues[0]) {
    return coreValues.map(cv => cv.value);
  }

  // Caso 4: Objeto enriquecido (nuevo formato)
  if (!Array.isArray(coreValues) && typeof coreValues === 'object' && 'values' in coreValues) {
    return coreValues.values;
  }

  // Fallback: convertir a string si es primitivo
  if (typeof coreValues === 'string') {
    return [coreValues];
  }

  console.warn('[CoreValues] Formato no reconocido, retornando array vacío:', coreValues);
  return [];
}

/**
 * Normaliza coreValues a array de objetos con weight (formato original esperado)
 */
export function normalizeCoreValuesToWeightedArray(coreValues: any): CoreValueWithWeight[] {
  // Caso 1: null o undefined
  if (!coreValues) {
    return [];
  }

  // Caso 2: Ya es array de objetos con weight
  if (Array.isArray(coreValues) && typeof coreValues[0] === 'object' && 'value' in coreValues[0]) {
    return coreValues.map(cv => ({
      value: cv.value,
      weight: cv.weight ?? 0.5,
      description: cv.description ?? '',
    }));
  }

  // Caso 3: Array simple de strings → asignar weights uniformes
  if (Array.isArray(coreValues) && typeof coreValues[0] === 'string') {
    return coreValues.map((value, index) => ({
      value,
      weight: 1.0 - (index * 0.1), // Decrement of 0.1 per position
      description: '',
    }));
  }

  // Caso 4: Objeto enriquecido
  if (!Array.isArray(coreValues) && typeof coreValues === 'object' && 'values' in coreValues) {
    return coreValues.values.map((value: string, index: number) => ({
      value,
      weight: 1.0 - (index * 0.1),
      description: '',
    }));
  }

  console.warn('[CoreValues] Formato no reconocido, retornando array vacío:', coreValues);
  return [];
}

/**
 * Extrae dimensiones psicológicas enriquecidas si existen
 */
export function extractEnrichedDimensions(coreValues: any): {
  facets?: BigFiveFacets;
  darkTriad?: DarkTriad;
  attachment?: AttachmentProfile;
  psychologicalNeeds?: PsychologicalNeeds;
} | null {
  // Solo el formato de objeto enriquecido tiene estas dimensiones
  if (!Array.isArray(coreValues) && typeof coreValues === 'object') {
    return {
      facets: coreValues.bigFiveFacets,
      darkTriad: coreValues.darkTriad,
      attachment: coreValues.attachmentProfile,
      psychologicalNeeds: coreValues.psychologicalNeeds,
    };
  }

  return null;
}

/**
 * Verifica si coreValues tiene formato enriquecido
 */
export function hasEnrichedDimensions(coreValues: any): boolean {
  return (
    !Array.isArray(coreValues) &&
    typeof coreValues === 'object' &&
    coreValues !== null &&
    ('bigFiveFacets' in coreValues || 'darkTriad' in coreValues || 'attachmentProfile' in coreValues)
  );
}

/**
 * Migra formato antiguo a nuevo (útil para actualizaciones futuras)
 */
export function migrateToEnrichedFormat(
  coreValues: any,
  enrichedData?: {
    facets?: BigFiveFacets;
    darkTriad?: DarkTriad;
    attachmentProfile?: AttachmentProfile;
    psychologicalNeeds?: PsychologicalNeeds;
  }
): EnrichedCoreValuesData {
  const values = normalizeCoreValuesToStringArray(coreValues);

  return {
    values,
    bigFiveFacets: enrichedData?.facets,
    darkTriad: enrichedData?.darkTriad,
    attachmentProfile: enrichedData?.attachmentProfile,
    psychologicalNeeds: enrichedData?.psychologicalNeeds,
  };
}
