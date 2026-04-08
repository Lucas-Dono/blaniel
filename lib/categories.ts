/**
 * Categorías predefinidas para personajes
 * Cada personaje puede tener máximo 2 categorías
 */

import type { LucideIcon } from 'lucide-react';
import {
  ScrollText,
  Sparkles,
  Microscope,
  Lightbulb,
  Gamepad2,
  Users,
  Wand2,
  Sword,
  Palette,
  BookOpen,
  Drama,
  Music,
  Briefcase,
  Brain,
  Dumbbell,
  Globe,
  Heart,
  FlaskConical,
  ChefHat,
  Leaf
} from 'lucide-react';

export type CategoryKey =
  | 'philosophy'
  | 'wisdom'
  | 'science'
  | 'physics'
  | 'gaming'
  | 'friendship'
  | 'fantasy'
  | 'adventure'
  | 'art'
  | 'literature'
  | 'theater'
  | 'music'
  | 'business'
  | 'psychology'
  | 'sports'
  | 'history'
  | 'romance'
  | 'technology'
  | 'gastronomy'
  | 'nature';

export interface Category {
  key: CategoryKey;
  icon: LucideIcon;
  label: {
    en: string;
    es: string;
  };
  color: {
    text: string;
    border: string;
    bg: string;
  };
}

export const CATEGORIES: Record<CategoryKey, Category> = {
  philosophy: {
    key: 'philosophy',
    icon: ScrollText,
    label: { en: 'Philosophy', es: 'Filosofía' },
    color: {
      text: 'text-yellow-400',
      border: 'border-yellow-400/30',
      bg: 'bg-yellow-400/10'
    }
  },
  wisdom: {
    key: 'wisdom',
    icon: Sparkles,
    label: { en: 'Wisdom', es: 'Sabiduría' },
    color: {
      text: 'text-purple-400',
      border: 'border-purple-400/30',
      bg: 'bg-purple-400/10'
    }
  },
  science: {
    key: 'science',
    icon: Microscope,
    label: { en: 'Science', es: 'Ciencia' },
    color: {
      text: 'text-blue-400',
      border: 'border-blue-400/30',
      bg: 'bg-blue-400/10'
    }
  },
  physics: {
    key: 'physics',
    icon: Lightbulb,
    label: { en: 'Physics', es: 'Física' },
    color: {
      text: 'text-cyan-400',
      border: 'border-cyan-400/30',
      bg: 'bg-cyan-400/10'
    }
  },
  gaming: {
    key: 'gaming',
    icon: Gamepad2,
    label: { en: 'Gaming', es: 'Gaming' },
    color: {
      text: 'text-pink-400',
      border: 'border-pink-400/30',
      bg: 'bg-pink-400/10'
    }
  },
  friendship: {
    key: 'friendship',
    icon: Users,
    label: { en: 'Friendship', es: 'Amistad' },
    color: {
      text: 'text-orange-400',
      border: 'border-orange-400/30',
      bg: 'bg-orange-400/10'
    }
  },
  fantasy: {
    key: 'fantasy',
    icon: Wand2,
    label: { en: 'Fantasy', es: 'Fantasía' },
    color: {
      text: 'text-violet-400',
      border: 'border-violet-400/30',
      bg: 'bg-violet-400/10'
    }
  },
  adventure: {
    key: 'adventure',
    icon: Sword,
    label: { en: 'Adventure', es: 'Aventura' },
    color: {
      text: 'text-emerald-400',
      border: 'border-emerald-400/30',
      bg: 'bg-emerald-400/10'
    }
  },
  art: {
    key: 'art',
    icon: Palette,
    label: { en: 'Art', es: 'Arte' },
    color: {
      text: 'text-rose-400',
      border: 'border-rose-400/30',
      bg: 'bg-rose-400/10'
    }
  },
  literature: {
    key: 'literature',
    icon: BookOpen,
    label: { en: 'Literature', es: 'Literatura' },
    color: {
      text: 'text-amber-400',
      border: 'border-amber-400/30',
      bg: 'bg-amber-400/10'
    }
  },
  theater: {
    key: 'theater',
    icon: Drama,
    label: { en: 'Theater', es: 'Teatro' },
    color: {
      text: 'text-fuchsia-400',
      border: 'border-fuchsia-400/30',
      bg: 'bg-fuchsia-400/10'
    }
  },
  music: {
    key: 'music',
    icon: Music,
    label: { en: 'Music', es: 'Música' },
    color: {
      text: 'text-indigo-400',
      border: 'border-indigo-400/30',
      bg: 'bg-indigo-400/10'
    }
  },
  business: {
    key: 'business',
    icon: Briefcase,
    label: { en: 'Business', es: 'Negocios' },
    color: {
      text: 'text-slate-400',
      border: 'border-slate-400/30',
      bg: 'bg-slate-400/10'
    }
  },
  psychology: {
    key: 'psychology',
    icon: Brain,
    label: { en: 'Psychology', es: 'Psicología' },
    color: {
      text: 'text-teal-400',
      border: 'border-teal-400/30',
      bg: 'bg-teal-400/10'
    }
  },
  sports: {
    key: 'sports',
    icon: Dumbbell,
    label: { en: 'Sports', es: 'Deporte' },
    color: {
      text: 'text-red-400',
      border: 'border-red-400/30',
      bg: 'bg-red-400/10'
    }
  },
  history: {
    key: 'history',
    icon: Globe,
    label: { en: 'History', es: 'Historia' },
    color: {
      text: 'text-stone-400',
      border: 'border-stone-400/30',
      bg: 'bg-stone-400/10'
    }
  },
  romance: {
    key: 'romance',
    icon: Heart,
    label: { en: 'Romance', es: 'Romance' },
    color: {
      text: 'text-pink-500',
      border: 'border-pink-500/30',
      bg: 'bg-pink-500/10'
    }
  },
  technology: {
    key: 'technology',
    icon: FlaskConical,
    label: { en: 'Technology', es: 'Tecnología' },
    color: {
      text: 'text-sky-400',
      border: 'border-sky-400/30',
      bg: 'bg-sky-400/10'
    }
  },
  gastronomy: {
    key: 'gastronomy',
    icon: ChefHat,
    label: { en: 'Gastronomy', es: 'Gastronomía' },
    color: {
      text: 'text-orange-500',
      border: 'border-orange-500/30',
      bg: 'bg-orange-500/10'
    }
  },
  nature: {
    key: 'nature',
    icon: Leaf,
    label: { en: 'Nature', es: 'Naturaleza' },
    color: {
      text: 'text-green-400',
      border: 'border-green-400/30',
      bg: 'bg-green-400/10'
    }
  }
};

/**
 * Obtener categoría por clave
 */
export function getCategory(key: CategoryKey): Category | undefined {
  return CATEGORIES[key];
}

/**
 * Obtener categorías de un personaje
 * @param categories - Array de claves de categorías
 * @returns Array de categorías (máximo 2)
 */
export function getCharacterCategories(categories?: CategoryKey[]): Category[] {
  if (!categories || categories.length === 0) return [];

  return categories
    .slice(0, 2) // Máximo 2 categorías
    .map(key => CATEGORIES[key])
    .filter(Boolean);
}

/**
 * Obtener todas las categorías disponibles
 */
export function getAllCategories(): Category[] {
  return Object.values(CATEGORIES);
}
