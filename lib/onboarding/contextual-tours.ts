/**
 * Sistema de Tours Contextuales
 *
 * Este sistema detecta automáticamente cuándo mostrar hints de tours
 * basándose en el comportamiento del usuario.
 */

export interface ContextualTrigger {
  id: string;
  tourId: string;
  condition: () => boolean | Promise<boolean>;
  priority: number; // 1-10, mayor = más urgente
  cooldown?: number; // ms antes de poder mostrar again
  maxShows?: number; // veces máximas que se puede mostrar
  message: string; // Mensaje del hint contextual
}

/**
 * Obtiene estadísticas del usuario para evaluar condiciones
 */
export async function getUserStats() {
  try {
    const res = await fetch('/api/user/onboarding-stats');

    // Si es 401, el usuario no está autenticado - redirigir a login
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
      }
      return {
        agentCount: 0,
        worldCount: 0,
        messageCount: 0,
        totalMessages: 0,
        hasVisitedCommunity: false,
        timeSinceLogin: 0,
        daysSinceSignup: 0,
      };
    }

    if (!res.ok) throw new Error('Failed to fetch stats');
    return await res.json();
  } catch (error) {
    console.error('[ContextualTours] Error fetching user stats:', error);
    return {
      agentCount: 0,
      worldCount: 0,
      messageCount: 0,
      totalMessages: 0,
      hasVisitedCommunity: false,
      timeSinceLogin: 0,
      daysSinceSignup: 0,
    };
  }
}

/**
 * Verifica si el usuario ha visitado una ruta específica
 */
function hasVisitedRoute(route: string): boolean {
  if (typeof window === 'undefined') return false;
  const visited = localStorage.getItem('visited_routes');
  if (!visited) return false;
  try {
    const routes = JSON.parse(visited) as string[];
    return routes.includes(route);
  } catch {
    return false;
  }
}

/**
 * Marca una ruta como visitada
 */
export function markRouteVisited(route: string) {
  if (typeof window === 'undefined') return;
  const visited = localStorage.getItem('visited_routes');
  let routes: string[] = [];
  if (visited) {
    try {
      routes = JSON.parse(visited);
    } catch {
      routes = [];
    }
  }
  if (!routes.includes(route)) {
    routes.push(route);
    localStorage.setItem('visited_routes', JSON.stringify(routes));
  }
}

/**
 * Obtiene el timestamp de cuando se mostró un trigger por última vez
 */
function getLastShownTimestamp(triggerId: string): number {
  if (typeof window === 'undefined') return 0;
  const stored = localStorage.getItem(`trigger_shown_${triggerId}`);
  return stored ? parseInt(stored, 10) : 0;
}

/**
 * Guarda el timestamp de cuando se mostró un trigger
 */
function setLastShownTimestamp(triggerId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`trigger_shown_${triggerId}`, Date.now().toString());
}

/**
 * Obtiene cuántas veces se ha mostrado un trigger
 */
function getShowCount(triggerId: string): number {
  if (typeof window === 'undefined') return 0;
  const stored = localStorage.getItem(`trigger_count_${triggerId}`);
  return stored ? parseInt(stored, 10) : 0;
}

/**
 * Incrementa el contador de veces mostrado
 */
function incrementShowCount(triggerId: string) {
  if (typeof window === 'undefined') return;
  const count = getShowCount(triggerId);
  localStorage.setItem(`trigger_count_${triggerId}`, (count + 1).toString());
}

/**
 * Triggers contextuales predefinidos
 */
export const contextualTriggers: ContextualTrigger[] = [
  {
    id: "first-ai-needed",
    tourId: "first-agent",
    condition: async () => {
      const stats = await getUserStats();
      return stats.agentCount === 0 && stats.timeSinceLogin > 120000; // 2 minutos
    },
    priority: 10, // Muy importante
    maxShows: 1,
    message: "¿Quieres crear tu primer AI? Te guiaremos paso a paso.",
  },
  {
    id: "first-community-interaction",
    tourId: "community-interaction",
    condition: async () => {
      const stats = await getUserStats();
      return stats.agentCount > 0 && !stats.hasVisitedCommunity;
    },
    priority: 9,
    maxShows: 2,
    message: "¡Únete a la comunidad! Aprende a compartir, interactuar y descubrir contenido.",
  },
  {
    id: "worlds-feature-discovery",
    tourId: "worlds-intro",
    condition: async () => {
      const stats = await getUserStats();
      return stats.agentCount >= 2 &&
             stats.worldCount === 0 &&
             !hasVisitedRoute('/dashboard/mundos');
    },
    priority: 5,
    cooldown: 86400000, // 1 día
    maxShows: 2,
    message: "💡 ¿Sabías que puedes crear mundos con múltiples AIs? Descubre cómo.",
  },
  {
    id: "community-engagement",
    tourId: "community-tour",
    condition: async () => {
      const stats = await getUserStats();
      return stats.agentCount >= 1 &&
             stats.messageCount >= 20 &&
             !stats.hasVisitedCommunity &&
             !hasVisitedRoute('/community');
    },
    priority: 4,
    cooldown: 86400000, // 1 día
    maxShows: 2,
    message: "Únete a nuestra comunidad y descubre contenido creado por otros usuarios.",
  },
  {
    id: "plans-upgrade-hint",
    tourId: "plans-and-features",
    condition: async () => {
      const stats = await getUserStats();
      return stats.agentCount >= 3 &&
             stats.messageCount >= 50 &&
             stats.daysSinceSignup >= 3 &&
             !hasVisitedRoute('/dashboard/billing');
    },
    priority: 3,
    cooldown: 172800000, // 2 días
    maxShows: 3,
    message: "Desbloquea más características con nuestros planes Plus y Ultra.",
  },
];

/**
 * Verifica si un trigger debe mostrarse
 */
export async function shouldShowTrigger(trigger: ContextualTrigger): Promise<boolean> {
  // Verificar maxShows
  if (trigger.maxShows !== undefined) {
    const showCount = getShowCount(trigger.id);
    if (showCount >= trigger.maxShows) {
      return false;
    }
  }

  // Verificar cooldown
  if (trigger.cooldown !== undefined) {
    const lastShown = getLastShownTimestamp(trigger.id);
    const now = Date.now();
    if (now - lastShown < trigger.cooldown) {
      return false;
    }
  }

  // Verificar condición
  try {
    const result = await trigger.condition();
    return result;
  } catch (error) {
    console.error(`[ContextualTours] Error checking condition for ${trigger.id}:`, error);
    return false;
  }
}

/**
 * Marca un trigger como mostrado
 */
export function markTriggerShown(triggerId: string) {
  setLastShownTimestamp(triggerId);
  incrementShowCount(triggerId);
}

/**
 * Obtiene el siguiente trigger que debería mostrarse
 * @returns El trigger con mayor prioridad que cumple condiciones, o null
 */
export async function getNextTrigger(): Promise<ContextualTrigger | null> {
  // Ordenar por prioridad (mayor primero)
  const sortedTriggers = [...contextualTriggers].sort((a, b) => b.priority - a.priority);

  for (const trigger of sortedTriggers) {
    if (await shouldShowTrigger(trigger)) {
      return trigger;
    }
  }

  return null;
}

/**
 * Reinicia el estado de todos los triggers (útil para testing)
 */
export function resetAllTriggers() {
  if (typeof window === 'undefined') return;
  contextualTriggers.forEach(trigger => {
    localStorage.removeItem(`trigger_shown_${trigger.id}`);
    localStorage.removeItem(`trigger_count_${trigger.id}`);
  });
  localStorage.removeItem('visited_routes');
}
