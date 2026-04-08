/**
 * Configuración de Historias (Nichos Históricos)
 * Sistema de clasificación para personajes históricos/famosos
 */

import type { LucideIcon } from 'lucide-react';
import { Swords, Star, AlertTriangle } from 'lucide-react';

export type StoryNicheType = 'war_figures' | 'pop_culture' | 'controversial';

export interface StoryNicheConfig {
  id: StoryNicheType;
  title: {
    en: string;
    es: string;
  };
  subtitle: {
    en: string;
    es: string;
  };
  icon: LucideIcon;
  badge: {
    en: string;
    es: string;
  };
  badgeColor: string;
  borderColor: string;
  bgColor: string;
}

export const STORY_NICHE_CONFIGS: Record<StoryNicheType, StoryNicheConfig> = {
  war_figures: {
    id: 'war_figures',
    title: {
      en: 'War Figures',
      es: 'Personajes Bélicos'
    },
    subtitle: {
      en: 'Military strategists, generals, war heroes',
      es: 'Estrategas militares, generales, héroes de guerra'
    },
    icon: Swords,
    badge: {
      en: 'HISTORICAL',
      es: 'HISTÓRICO'
    },
    badgeColor: 'bg-amber-600 text-white border-amber-700',
    borderColor: 'border-amber-500/50',
    bgColor: 'bg-amber-500/5'
  },

  pop_culture: {
    id: 'pop_culture',
    title: {
      en: 'Pop Culture Icons',
      es: 'Estrellas de Cine & Cultura Pop'
    },
    subtitle: {
      en: 'Movie stars, musicians, cultural icons',
      es: 'Estrellas de cine, músicos, íconos culturales'
    },
    icon: Star,
    badge: {
      en: 'ICON',
      es: 'ÍCONO'
    },
    badgeColor: 'bg-purple-600 text-white border-purple-700',
    borderColor: 'border-purple-500/50',
    bgColor: 'bg-purple-500/5'
  },

  controversial: {
    id: 'controversial',
    title: {
      en: 'Controversial Figures',
      es: 'Personajes Polémicos'
    },
    subtitle: {
      en: 'Controversial, thought-provoking personalities',
      es: 'Figuras controversiales, debate moral/ético'
    },
    icon: AlertTriangle,
    badge: {
      en: 'CONTROVERSIAL',
      es: 'POLÉMICO'
    },
    badgeColor: 'bg-red-600 text-white border-red-700',
    borderColor: 'border-red-500/50',
    bgColor: 'bg-red-500/5'
  }
};

/**
 * Mapeo manual de personajes históricos conocidos
 */
export const HISTORICAL_CHARACTER_MAPPING: Record<StoryNicheType, string[]> = {
  war_figures: [
    'Napoleon Bonaparte',
    'Napoleon',
    'Julius Caesar',
    'Caesar',
    'Alexander the Great',
    'Alexander',
    'Sun Tzu',
    'Genghis Khan',
    'Winston Churchill',
    'Churchill',
    'Dwight Eisenhower',
    'George Patton',
    'Erwin Rommel',
    'Hannibal Barca',
    'Saladin'
  ],

  pop_culture: [
    'Marilyn Monroe',
    'Monroe',
    'Elvis Presley',
    'Elvis',
    'Michael Jackson',
    'Jackson',
    'Frida Kahlo',
    'Kahlo',
    'Pablo Picasso',
    'Picasso',
    'Leonardo DiCaprio',
    'DiCaprio',
    'Audrey Hepburn',
    'Hepburn',
    'James Dean',
    'Dean',
    'David Bowie',
    'Bowie'
  ],

  controversial: [
    'Nikola Tesla',
    'Tesla',
    'Oscar Wilde',
    'Wilde',
    'Galileo Galilei',
    'Galileo',
    'Socrates',
    'Alan Turing',
    'Turing',
    'Friedrich Nietzsche',
    'Nietzsche',
    'Marquis de Sade',
    'Sade',
    'Sigmund Freud',
    'Freud'
  ]
};

/**
 * Obtener configuración de un nicho
 * @param nicheType - Tipo de nicho a obtener
 * @returns Configuración del nicho, o 'pop_culture' como fallback si no existe
 */
export function getStoryNicheConfig(nicheType: StoryNicheType | undefined | null): StoryNicheConfig {
  if (!nicheType || !STORY_NICHE_CONFIGS[nicheType]) {
    return STORY_NICHE_CONFIGS['pop_culture'];
  }
  return STORY_NICHE_CONFIGS[nicheType];
}

/**
 * Obtener todos los nichos
 */
export function getAllStoryNiches(): StoryNicheConfig[] {
  return Object.values(STORY_NICHE_CONFIGS);
}

/**
 * Detectar nicho histórico por nombre del personaje
 */
export function detectStoryNicheByName(name: string): StoryNicheType | null {
  const nameLower = name.toLowerCase();

  for (const [niche, names] of Object.entries(HISTORICAL_CHARACTER_MAPPING)) {
    if (names.some(n => nameLower.includes(n.toLowerCase()))) {
      return niche as StoryNicheType;
    }
  }

  return null;
}
