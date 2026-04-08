/**
 * Configuración de Vibes (Categorías Emocionales)
 * Sistema de clasificación basado en personalidad y estado emocional
 */

import type { LucideIcon } from 'lucide-react';
import { Zap, Heart, Compass, Coffee } from 'lucide-react';

export type VibeType = 'chaotic_energy' | 'comfort_zone' | 'love_connection' | 'adventure';

export interface VibeConfig {
  id: VibeType;
  title: {
    en: string;
    es: string;
  };
  subtitle: {
    en: string;
    es: string;
  };
  icon: LucideIcon;
  gradient: string;
  borderColor: string;
  bgColor: string;
  keywords: string[];
}

export const VIBE_CONFIGS: Record<VibeType, VibeConfig> = {
  chaotic_energy: {
    id: 'chaotic_energy',
    title: {
      en: 'Chaotic Energy',
      es: 'Energía Caótica'
    },
    subtitle: {
      en: 'Unpredictable, fun, wild personalities',
      es: 'Personalidades inestables, divertidas, impredecibles'
    },
    icon: Zap,
    gradient: 'from-yellow-500 to-orange-600',
    borderColor: 'border-yellow-500/30',
    bgColor: 'bg-yellow-500/10',
    keywords: [
      'loco', 'crazy', 'caótico', 'chaotic', 'impredecible', 'unpredictable',
      'energético', 'energetic', 'salvaje', 'wild', 'inestable', 'unstable',
      'explosivo', 'explosive', 'random', 'aleatorio', 'espontáneo', 'spontaneous'
    ]
  },

  comfort_zone: {
    id: 'comfort_zone',
    title: {
      en: 'Comfort Zone',
      es: 'Zona de Confort'
    },
    subtitle: {
      en: 'Calm, kind, low-conflict personalities',
      es: 'Personalidades tranquilas, amables, bajo conflicto'
    },
    icon: Coffee,
    gradient: 'from-blue-400 to-cyan-500',
    borderColor: 'border-blue-400/30',
    bgColor: 'bg-blue-400/10',
    keywords: [
      'tranquilo', 'calm', 'amable', 'kind', 'gentil', 'gentle',
      'calmado', 'peaceful', 'pacífico', 'peace', 'relajado', 'relaxed',
      'sereno', 'serene', 'acogedor', 'cozy', 'confortable', 'comfortable'
    ]
  },

  love_connection: {
    id: 'love_connection',
    title: {
      en: 'Love & Connection',
      es: 'Amor y Conexión'
    },
    subtitle: {
      en: 'Romance-oriented, deep emotional bonds',
      es: 'Orientado al romance, vínculos profundos'
    },
    icon: Heart,
    gradient: 'from-pink-500 to-rose-600',
    borderColor: 'border-pink-500/30',
    bgColor: 'bg-pink-500/10',
    keywords: [
      'romántico', 'romantic', 'amor', 'love', 'cariño', 'affection',
      'afecto', 'caring', 'pasión', 'passion', 'íntimo', 'intimate',
      'sensual', 'amoroso', 'loving', 'tierno', 'tender', 'dulce', 'sweet'
    ]
  },

  adventure: {
    id: 'adventure',
    title: {
      en: 'Adventure',
      es: 'Aventura'
    },
    subtitle: {
      en: 'Extroverted, bold, unfiltered',
      es: 'Extrovertidos, atrevidos, sin filtro'
    },
    icon: Compass,
    gradient: 'from-purple-500 to-indigo-600',
    borderColor: 'border-purple-500/30',
    bgColor: 'bg-purple-500/10',
    keywords: [
      'aventura', 'adventure', 'explorador', 'explorer', 'atrevido', 'bold',
      'extrovertido', 'extroverted', 'audaz', 'daring', 'viajero', 'traveler',
      'arriesgado', 'risky', 'valiente', 'brave', 'intrépido', 'fearless'
    ]
  }
};

/**
 * Orden por defecto de vibes (puede ser personalizado por usuario)
 */
export const DEFAULT_VIBE_ORDER: VibeType[] = [
  'love_connection',
  'adventure',
  'comfort_zone',
  'chaotic_energy'
];

/**
 * Obtener configuración de un vibe
 */
export function getVibeConfig(vibeType: VibeType): VibeConfig {
  return VIBE_CONFIGS[vibeType];
}

/**
 * Obtener todos los vibes
 */
export function getAllVibes(): VibeConfig[] {
  return Object.values(VIBE_CONFIGS);
}
