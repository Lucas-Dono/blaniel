/**
 * Sistema para trackear y reordenar secciones del dashboard según uso del usuario
 */

export type SectionId =
  | 'recent'
  | 'my-creations'
  | 'recommended'
  | 'popular'
  | 'historical'
  | 'premium'
  | 'all';

interface SectionStats {
  sectionId: SectionId;
  views: number; // Cuántas veces vio la sección
  expansions: number; // Cuántas veces expandió (si es colapsable)
  clicks: number; // Cuántos agentes clickeó de esa sección
  lastInteraction: string; // ISO date string
  weight: number; // Score calculado para ordenamiento
}

type SectionStatsMap = Record<SectionId, SectionStats>;

const STORAGE_KEY_PREFIX = 'dashboard_section_stats_';
// Orden por defecto: Premium y Historical primero (contenido destacado)
const DEFAULT_ORDER: SectionId[] = ['premium', 'historical', 'popular', 'all'];

/**
 * Inicializar estadísticas por defecto para una sección
 */
function initSectionStats(sectionId: SectionId): SectionStats {
  return {
    sectionId,
    views: 0,
    expansions: 0,
    clicks: 0,
    lastInteraction: new Date().toISOString(),
    weight: 0,
  };
}

/**
 * Calcular peso de una sección basado en interacciones
 */
function calculateWeight(stats: SectionStats): number {
  const now = Date.now();
  const lastInteractionDate = new Date(stats.lastInteraction).getTime();
  const daysSinceLastInteraction = (now - lastInteractionDate) / (1000 * 60 * 60 * 24);

  // Temporal decay: recent interactions worth more
  // Exponential decay with half-life of 7 days
  const recencyMultiplier = Math.exp(-daysSinceLastInteraction / 7);

  // Peso = (clicks * 3 + expansions * 2 + views * 1) * recency
  const rawScore = (stats.clicks * 3) + (stats.expansions * 2) + (stats.views * 1);

  return rawScore * recencyMultiplier;
}

export class SectionOrderManager {
  /**
   * Cargar estadísticas desde localStorage
   */
  static loadStats(userId: string): SectionStatsMap {
    if (typeof window === 'undefined') {
      return SectionOrderManager.getDefaultStats();
    }

    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
      const stored = localStorage.getItem(storageKey);

      if (!stored) {
        return SectionOrderManager.getDefaultStats();
      }

      const parsed = JSON.parse(stored) as SectionStatsMap;

      // Asegurar que todas las secciones existen
      const allSections: SectionId[] = ['recent', 'my-creations', 'recommended', 'popular', 'historical', 'premium', 'all'];
      allSections.forEach((sectionId) => {
        if (!parsed[sectionId]) {
          parsed[sectionId] = initSectionStats(sectionId);
        }
      });

      return parsed;
    } catch (error) {
      console.error('Error loading section stats:', error);
      return SectionOrderManager.getDefaultStats();
    }
  }

  /**
   * Guardar estadísticas en localStorage
   */
  static saveStats(userId: string, stats: SectionStatsMap): void {
    if (typeof window === 'undefined') return;

    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
      localStorage.setItem(storageKey, JSON.stringify(stats));
    } catch (error) {
      console.error('Error saving section stats:', error);
    }
  }

  /**
   * Trackear interacción con sección
   */
  static trackInteraction(
    userId: string,
    sectionId: SectionId,
    type: 'view' | 'expansion' | 'click'
  ): void {
    const stats = SectionOrderManager.loadStats(userId);
    const sectionStats = stats[sectionId] || initSectionStats(sectionId);

    // Incrementar contador según tipo
    switch (type) {
      case 'view':
        sectionStats.views += 1;
        break;
      case 'expansion':
        sectionStats.expansions += 1;
        break;
      case 'click':
        sectionStats.clicks += 1;
        break;
    }

    // Update última interacción y peso
    sectionStats.lastInteraction = new Date().toISOString();
    sectionStats.weight = calculateWeight(sectionStats);

    // Guardar
    stats[sectionId] = sectionStats;
    SectionOrderManager.saveStats(userId, stats);
  }

  /**
   * Obtener orden óptimo de secciones dinámicas
   * (excepto las fijas: recent, my-creations, recommended)
   */
  static getOptimalOrder(userId: string): SectionId[] {
    const stats = SectionOrderManager.loadStats(userId);

    // Solo reordenar secciones dinámicas
    const dynamicSections: SectionId[] = ['popular', 'historical', 'premium', 'all'];

    // Calcular peso actualizado para cada sección
    const sectionsWithWeights = dynamicSections.map((sectionId) => {
      const sectionStats = stats[sectionId] || initSectionStats(sectionId);
      return {
        sectionId,
        weight: calculateWeight(sectionStats),
      };
    });

    // Ordenar por peso (mayor primero)
    sectionsWithWeights.sort((a, b) => b.weight - a.weight);

    return sectionsWithWeights.map((s) => s.sectionId);
  }

  /**
   * Obtener estadísticas por defecto
   */
  private static getDefaultStats(): SectionStatsMap {
    const sections: SectionId[] = ['recent', 'my-creations', 'recommended', 'popular', 'historical', 'premium', 'all'];
    const stats: Partial<SectionStatsMap> = {};

    sections.forEach((sectionId) => {
      stats[sectionId] = initSectionStats(sectionId);
    });

    return stats as SectionStatsMap;
  }

  /**
   * Resetear estadísticas de un usuario
   */
  static resetStats(userId: string): void {
    if (typeof window === 'undefined') return;

    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Error resetting section stats:', error);
    }
  }

  /**
   * Obtener orden por defecto de secciones dinámicas
   */
  static getDefaultOrder(): SectionId[] {
    return [...DEFAULT_ORDER];
  }
}
