/**
 * Sistema de Gamificación para Tours de Onboarding
 *
 * Maneja recompensas, badges y features desbloqueables
 * al completar tours.
 */

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Badge {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  rarity: BadgeRarity;
  unlockedAt?: Date;
}

export interface TourReward {
  tourId: string;
  karma: number;
  badge?: {
    id: string;
    name: string;
    nameEn: string;
    description: string;
    descriptionEn: string;
    icon: string;
    rarity: BadgeRarity;
  };
  unlock?: string; // Feature ID desbloqueada
  unlockDescription?: string;
  unlockDescriptionEn?: string;
}

/**
 * Definición de recompensas por tour
 */
export const tourRewards: Record<string, TourReward> = {
  "welcome": {
    tourId: "welcome",
    karma: 50,
    badge: {
      id: "explorer",
      name: "Explorador",
      nameEn: "Explorer",
      description: "Completaste tu primer tour de bienvenida",
      descriptionEn: "Completed your first welcome tour",
      icon: "🗺️",
      rarity: "common",
    },
  },
  "first-agent": {
    tourId: "first-agent",
    karma: 100,
    badge: {
      id: "creator",
      name: "Creador",
      nameEn: "Creator",
      description: "Aprendiste a crear tu primer AI",
      descriptionEn: "Learned to create your first AI",
      icon: "🎨",
      rarity: "rare",
    },
    unlock: "advanced_personality_traits",
    unlockDescription: "Rasgos de personalidad avanzados desbloqueados",
    unlockDescriptionEn: "Advanced personality traits unlocked",
  },
  "community-interaction": {
    tourId: "community-interaction",
    karma: 75,
    badge: {
      id: "community-member",
      name: "Miembro de la Comunidad",
      nameEn: "Community Member",
      description: "Aprendiste a interactuar en la comunidad",
      descriptionEn: "Learned to interact in the community",
      icon: "👥",
      rarity: "common",
    },
  },
  "community-tour": {
    tourId: "community-tour",
    karma: 125,
    badge: {
      id: "socialite",
      name: "Socialite",
      nameEn: "Socialite",
      description: "Te uniste a la comunidad",
      descriptionEn: "Joined the community",
      icon: "🤝",
      rarity: "rare",
    },
    unlock: "community_features",
    unlockDescription: "Acceso completo a features de comunidad",
    unlockDescriptionEn: "Full access to community features",
  },
  "worlds-intro": {
    tourId: "worlds-intro",
    karma: 150,
    badge: {
      id: "world_builder",
      name: "Constructor de Mundos",
      nameEn: "World Builder",
      description: "Aprendiste a crear mundos multi-agente",
      descriptionEn: "Learned to create multi-agent worlds",
      icon: "🌍",
      rarity: "epic",
    },
    unlock: "advanced_world_scenarios",
    unlockDescription: "Escenarios de mundos avanzados desbloqueados",
    unlockDescriptionEn: "Advanced world scenarios unlocked",
  },
  "plans-and-features": {
    tourId: "plans-and-features",
    karma: 100,
    badge: {
      id: "power_user",
      name: "Usuario Avanzado",
      nameEn: "Power User",
      description: "Conoces todas las características de la plataforma",
      descriptionEn: "Know all platform features",
      icon: "⚡",
      rarity: "epic",
    },
  },
};

/**
 * Badge especial por completar todos los tours
 */
export const masterBadge: Badge = {
  id: "tour_master",
  name: "Maestro de Tours",
  nameEn: "Tour Master",
  description: "Completaste todos los tours de onboarding",
  descriptionEn: "Completed all onboarding tours",
  icon: "👑",
  rarity: "legendary",
};

/**
 * Colores por rareza de badge
 */
export const rarityColors: Record<BadgeRarity, string> = {
  common: "from-gray-400 to-gray-600",
  rare: "from-blue-400 to-blue-600",
  epic: "from-purple-400 to-purple-600",
  legendary: "from-yellow-400 to-yellow-600",
};

/**
 * Obtiene todos los badges desbloqueados del usuario
 */
export function getUnlockedBadges(): Badge[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem('unlocked_badges');
  if (!stored) return [];

  try {
    const badgeIds = JSON.parse(stored) as string[];
    return badgeIds.map(id => {
      // Buscar en tourRewards
      for (const reward of Object.values(tourRewards)) {
        if (reward.badge?.id === id) {
          return {
            ...reward.badge,
            unlockedAt: new Date(),
          } as Badge;
        }
      }

      // Verificar master badge
      if (id === masterBadge.id) {
        return masterBadge;
      }

      return null;
    }).filter(Boolean) as Badge[];
  } catch {
    return [];
  }
}

/**
 * Desbloquea un badge
 */
export function unlockBadge(badgeId: string) {
  if (typeof window === 'undefined') return;

  const badges = getUnlockedBadges();
  if (badges.some(b => b.id === badgeId)) {
    return; // Ya desbloqueado
  }

  const badgeIds = badges.map(b => b.id);
  badgeIds.push(badgeId);

  localStorage.setItem('unlocked_badges', JSON.stringify(badgeIds));
}

/**
 * Verifica si un badge está desbloqueado
 */
export function isBadgeUnlocked(badgeId: string): boolean {
  const badges = getUnlockedBadges();
  return badges.some(b => b.id === badgeId);
}

/**
 * Obtiene el karma total del usuario
 */
export function getTotalKarma(): number {
  if (typeof window === 'undefined') return 0;

  const stored = localStorage.getItem('total_karma');
  return stored ? parseInt(stored, 10) : 0;
}

/**
 * Añade karma al usuario
 */
export function addKarma(amount: number) {
  if (typeof window === 'undefined') return;

  const current = getTotalKarma();
  localStorage.setItem('total_karma', (current + amount).toString());
}

/**
 * Obtiene features desbloqueadas
 */
export function getUnlockedFeatures(): string[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem('unlocked_features');
  if (!stored) return [];

  try {
    return JSON.parse(stored) as string[];
  } catch {
    return [];
  }
}

/**
 * Desbloquea una feature
 */
export function unlockFeature(featureId: string) {
  if (typeof window === 'undefined') return;

  const features = getUnlockedFeatures();
  if (features.includes(featureId)) {
    return; // Ya desbloqueada
  }

  features.push(featureId);
  localStorage.setItem('unlocked_features', JSON.stringify(features));
}

/**
 * Verifica si una feature está desbloqueada
 */
export function isFeatureUnlocked(featureId: string): boolean {
  const features = getUnlockedFeatures();
  return features.includes(featureId);
}

/**
 * Procesa las recompensas de completar un tour
 */
export async function awardTourCompletion(tourId: string): Promise<TourReward | null> {
  const reward = tourRewards[tourId];
  if (!reward) return null;

  // Add karma
  addKarma(reward.karma);

  // Desbloquear badge
  if (reward.badge) {
    unlockBadge(reward.badge.id);
  }

  // Desbloquear feature
  if (reward.unlock) {
    unlockFeature(reward.unlock);
  }

  return reward;
}

/**
 * Verifica si el usuario ha desbloqueado el master badge
 * (completó todos los tours requeridos)
 */
export function checkMasterBadge(completedTours: string[]): boolean {
  const requiredTourIds = ["welcome", "first-agent"]; // Tours requeridos
  const allCompleted = requiredTourIds.every(id => completedTours.includes(id));

  if (allCompleted && !isBadgeUnlocked(masterBadge.id)) {
    unlockBadge(masterBadge.id);
    addKarma(250); // Bonus por completar todos
    return true;
  }

  return false;
}

/**
 * Reinicia toda la gamificación (útil para testing)
 */
export function resetGamification() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('unlocked_badges');
  localStorage.removeItem('total_karma');
  localStorage.removeItem('unlocked_features');
}
