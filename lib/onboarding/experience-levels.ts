/**
 * Sistema de Niveles de Experiencia para Tours
 *
 * Clasifica a los usuarios según su experiencia y muestra
 * tours relevantes para su nivel.
 */

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface UserStats {
  agentCount: number;
  groupCount: number;
  messageCount: number;
  totalMessages: number;
  daysSinceSignup: number;
  hasVisitedCommunity?: boolean;
  timeSinceLogin?: number;
}

/**
 * Determina el nivel de experiencia del usuario basándose en sus estadísticas
 */
export function getUserExperienceLevel(stats: UserStats): ExperienceLevel {
  const { agentCount, groupCount, messageCount, daysSinceSignup } = stats;

  // Expert: Usuario power avanzado
  if (
    agentCount >= 10 &&
    groupCount >= 3 &&
    messageCount >= 500 &&
    daysSinceSignup >= 14
  ) {
    return 'expert';
  }

  // Advanced: Usuario experimentado
  if (
    agentCount >= 5 &&
    groupCount >= 1 &&
    messageCount >= 100 &&
    daysSinceSignup >= 7
  ) {
    return 'advanced';
  }

  // Intermediate: User with basic experience
  if (agentCount >= 2 && messageCount >= 20) {
    return 'intermediate';
  }

  // Beginner: Usuario nuevo
  return 'beginner';
}

/**
 * Tours recomendados por nivel de experiencia
 */
export const toursByLevel: Record<ExperienceLevel, string[]> = {
  beginner: [
    'welcome',
    'first-agent',
    'community-interaction',
  ],
  intermediate: [
    'groups-intro',
    'community-tour',
    'plans-and-features',
  ],
  advanced: [
    'community-tour',
    'groups-intro',
    'plans-and-features',
  ],
  expert: [
    'plans-and-features',
  ],
};

/**
 * Descripción de cada nivel
 */
export const levelDescriptions: Record<ExperienceLevel, { name: string; nameEn: string; description: string; descriptionEn: string; icon: string; color: string }> = {
  beginner: {
    name: "Principiante",
    nameEn: "Beginner",
    description: "Estás comenzando tu viaje con AI",
    descriptionEn: "You're starting your AI journey",
    icon: "sprout",
    color: "from-green-600 to-green-800",
  },
  intermediate: {
    name: "Intermedio",
    nameEn: "Intermediate",
    description: "Ya conoces los básicos",
    descriptionEn: "You know the basics",
    icon: "leaf",
    color: "from-blue-600 to-blue-800",
  },
  advanced: {
    name: "Avanzado",
    nameEn: "Advanced",
    description: "Eres un usuario experimentado",
    descriptionEn: "You're an experienced user",
    icon: "tree-pine",
    color: "from-purple-600 to-purple-800",
  },
  expert: {
    name: "Experto",
    nameEn: "Expert",
    description: "Dominas la plataforma",
    descriptionEn: "You master the platform",
    icon: "crown",
    color: "from-amber-600 to-amber-800",
  },
};

/**
 * Obtiene los tours recomendados para un nivel específico
 */
export function getToursForLevel(level: ExperienceLevel): string[] {
  return toursByLevel[level] || [];
}

/**
 * Verifica si un tour es apropiado para el nivel del usuario
 */
export function isTourAppropriateForLevel(tourId: string, level: ExperienceLevel): boolean {
  const tours = getToursForLevel(level);
  return tours.includes(tourId);
}

/**
 * Obtiene el siguiente nivel de experiencia
 */
export function getNextLevel(currentLevel: ExperienceLevel): ExperienceLevel | null {
  const levels: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
  const currentIndex = levels.indexOf(currentLevel);

  if (currentIndex === -1 || currentIndex === levels.length - 1) {
    return null; // Ya es experto
  }

  return levels[currentIndex + 1];
}

/**
 * Calcula cuánto falta para el siguiente nivel
 */
export function getProgressToNextLevel(stats: UserStats, currentLevel: ExperienceLevel): {
  percentage: number;
  requirements: string[];
  requirementsEn: string[];
} {
  const nextLevel = getNextLevel(currentLevel);

  if (!nextLevel) {
    return {
      percentage: 100,
      requirements: ["Ya alcanzaste el nivel máximo"],
      requirementsEn: ["You've reached max level"],
    };
  }

  const requirements: string[] = [];
  const requirementsEn: string[] = [];
  let totalRequirements = 0;
  let completedRequirements = 0;

  switch (nextLevel) {
    case 'intermediate':
      totalRequirements = 2;
      if (stats.agentCount >= 2) completedRequirements++;
      else {
        requirements.push(`Crea ${2 - stats.agentCount} AI más`);
        requirementsEn.push(`Create ${2 - stats.agentCount} more AI`);
      }

      if (stats.messageCount >= 20) completedRequirements++;
      else {
        requirements.push(`Envía ${20 - stats.messageCount} mensajes más`);
        requirementsEn.push(`Send ${20 - stats.messageCount} more messages`);
      }
      break;

    case 'advanced':
      totalRequirements = 4;
      if (stats.agentCount >= 5) completedRequirements++;
      else {
        requirements.push(`Crea ${5 - stats.agentCount} AI más`);
        requirementsEn.push(`Create ${5 - stats.agentCount} more AI`);
      }

      if (stats.groupCount >= 1) completedRequirements++;
      else {
        requirements.push("Crea tu primer grupo");
        requirementsEn.push("Create your first group");
      }

      if (stats.messageCount >= 100) completedRequirements++;
      else {
        requirements.push(`Envía ${100 - stats.messageCount} mensajes más`);
        requirementsEn.push(`Send ${100 - stats.messageCount} more messages`);
      }

      if (stats.daysSinceSignup >= 7) completedRequirements++;
      else {
        requirements.push(`Espera ${7 - stats.daysSinceSignup} días más`);
        requirementsEn.push(`Wait ${7 - stats.daysSinceSignup} more days`);
      }
      break;

    case 'expert':
      totalRequirements = 4;
      if (stats.agentCount >= 10) completedRequirements++;
      else {
        requirements.push(`Crea ${10 - stats.agentCount} AI más`);
        requirementsEn.push(`Create ${10 - stats.agentCount} more AI`);
      }

      if (stats.groupCount >= 3) completedRequirements++;
      else {
        requirements.push(`Crea ${3 - stats.groupCount} grupos más`);
        requirementsEn.push(`Create ${3 - stats.groupCount} more groups`);
      }

      if (stats.messageCount >= 500) completedRequirements++;
      else {
        requirements.push(`Envía ${500 - stats.messageCount} mensajes más`);
        requirementsEn.push(`Send ${500 - stats.messageCount} more messages`);
      }

      if (stats.daysSinceSignup >= 14) completedRequirements++;
      else {
        requirements.push(`Espera ${14 - stats.daysSinceSignup} días más`);
        requirementsEn.push(`Wait ${14 - stats.daysSinceSignup} more days`);
      }
      break;
  }

  const percentage = Math.round((completedRequirements / totalRequirements) * 100);

  return {
    percentage,
    requirements,
    requirementsEn,
  };
}

/**
 * Obtiene estadísticas simuladas para testing
 * En producción, esto vendría de la API
 */
export function getMockUserStats(): UserStats {
  return {
    agentCount: 0,
    groupCount: 0,
    messageCount: 0,
    totalMessages: 0,
    daysSinceSignup: 0,
    hasVisitedCommunity: false,
    timeSinceLogin: 0,
  };
}
