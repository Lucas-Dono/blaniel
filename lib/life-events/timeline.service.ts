/**
 * Life Events Timeline Service - Narrative Arcs System
 * Detects, links, and manages narrative arcs in the user's life
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import {
  NarrativeArcDetector,
  DetectedArcEvent,
  NarrativeCategory,
  NarrativeState,
} from './narrative-arc-detector';

export interface NarrativeArc {
  id: string;
  category: string;
  theme: string;
  title?: string;
  description?: string;
  status: string;
  currentState?: string;
  startedAt: Date;
  lastEventAt: Date;
  completedAt?: Date;
  totalEvents: number;
  outcome?: string;
  confidence: number;
  events: NarrativeArcEvent[];
}

export interface NarrativeArcEvent {
  id: string;
  eventDate: Date;
  description: string;
  narrativeState?: string;
  detectionConfidence?: number;
  detectedKeywords?: any;
}

export interface CreateNarrativeEventInput {
  message: string;
  timestamp: Date;
  agentId: string;
  userId: string;
}

export const LifeEventsTimelineService = {
  /** Processes a user message and detects potential narrative events */
  async processMessage(input: CreateNarrativeEventInput): Promise<void> {
    const { message, timestamp, agentId, userId } = input;

    // Analizar mensaje con detector
    const detectedEvent = NarrativeArcDetector.analyzeMessage(message, timestamp);

    if (!detectedEvent) {
      // No relevant narrative event was detected
      return;
    }

    // Buscar si existe un arco activo relacionado
    const relatedArc = await this.findRelatedActiveArc(
      agentId,
      userId,
      detectedEvent
    );

    if (relatedArc) {
      // Agregar evento al arco existente
      await this.addEventToArc(relatedArc.id, detectedEvent, agentId, userId);
    } else {
      // Create nuevo arco narrativo
      await this.createNewArc(detectedEvent, agentId, userId);
    }
  },

  /**
   * Searches for an active arc related to the detected event
   * @deprecated - narrativeArc model no longer exists in schema
   */
  async findRelatedActiveArc(
    agentId: string,
    userId: string,
    event: DetectedArcEvent
  ): Promise<any> {
    // TODO: NarrativeArc model not yet created in Prisma schema
    // Temporarily return null until model is added
    return null;
  },

  /**
   * Crea un nuevo arco narrativo
   * @deprecated - narrativeArc model no longer exists in schema
   */
  async createNewArc(
    event: DetectedArcEvent,
    agentId: string,
    userId: string
  ) {
    // TODO: NarrativeArc model not yet created in Prisma schema
    // Temporarily just create the important event without arc
    const theme = NarrativeArcDetector.extractTheme(event.message);

    await prisma.importantEvent.create({
      data: {
        id: nanoid(),
        agentId,
        userId,
        eventDate: event.timestamp,
        type: this.mapCategoryToEventType(event.category),
        description: event.message,
        priority: 'medium',
        updatedAt: new Date(),
        metadata: {
          narrativeState: event.state,
          narrativeTheme: theme,
          detectionConfidence: event.confidence,
          detectedKeywords: event.keywords,
          emotionalTone: event.emotionalTone || 'neutral',
        },
      },
    });

    return null;
  },

  /**
   * Agrega un evento a un arco existente
   * @deprecated - narrativeArc model no longer exists in schema
   */
  async addEventToArc(
    arcId: string,
    event: DetectedArcEvent,
    agentId: string,
    userId: string
  ) {
    // TODO: NarrativeArc model not yet created in Prisma schema
    // Temporarily just create the important event
    const theme = NarrativeArcDetector.extractTheme(event.message);

    await prisma.importantEvent.create({
      data: {
        id: nanoid(),
        agentId,
        userId,
        eventDate: event.timestamp,
        type: this.mapCategoryToEventType(event.category),
        description: event.message,
        priority: 'medium',
        updatedAt: new Date(),
        metadata: {
          arcId,
          narrativeState: event.state,
          narrativeTheme: theme,
          detectionConfidence: event.confidence,
          detectedKeywords: event.keywords,
          emotionalTone: event.emotionalTone || 'neutral',
        },
      },
    });
  },

  /**
   * Obtiene todos los arcos narrativos de un agente
   * @deprecated - narrativeArc model no longer exists in schema
   */
  async getArcs(
    agentId: string,
    userId: string,
    filters: {
      category?: NarrativeCategory;
      status?: 'active' | 'completed' | 'abandoned';
      limit?: number;
    } = {}
  ): Promise<NarrativeArc[]> {
    // TODO: NarrativeArc model not yet created in Prisma schema
    // Temporarily return empty array
    return [];
  },

  /**
   * Retrieves a specific arc with all its events
   * @deprecated - narrativeArc model no longer exists in schema
   */
  async getArc(_arcId: string, _userId: string): Promise<NarrativeArc | null> {
    // TODO: NarrativeArc model not yet created in Prisma schema
    // Temporarily return null
    return null;
  },

  /**
   * Gets full timeline (all arcs sorted chronologically)
   * @deprecated - narrativeArc model no longer exists in schema
   */
  async getTimeline(
    agentId: string,
    userId: string,
    filters: {
      startDate?: Date;
      endDate?: Date;
      categories?: NarrativeCategory[];
    } = {}
  ) {
    // TODO: NarrativeArc model not yet created in Prisma schema
    // Temporarily return empty array
    return [];
  },

  /**
   * Marcar arco como abandonado
   * @deprecated - narrativeArc model no longer exists in schema
   */
  async markAsAbandoned(_arcId: string, _userId: string) {
    throw new Error('narrativeArc model no longer exists');
  },

  /**
   * Update title and description of an arc
   * @deprecated - narrativeArc model no longer exists in schema
   */
  async updateArc(
    arcId: string,
    userId: string,
    data: {
      title?: string;
      description?: string;
    }
  ) {
    throw new Error('narrativeArc model no longer exists');
  },

  /**
   * Get arc statistics
   * @deprecated - narrativeArc model no longer exists in schema
   */
  async getArcStats(_agentId: string, _userId: string) {
    // TODO: NarrativeArc model not yet created in Prisma schema
    // Temporarily return empty stats
    return {
      total: 0,
      active: 0,
      completed: 0,
      abandoned: 0,
      byCategory: [],
    };
  },

  /** Maps narrative category to event type */
  mapCategoryToEventType(category: NarrativeCategory): string {
    const mapping: Record<NarrativeCategory, string> = {
      work_career: 'special',
      relationships_love: 'special',
      education_learning: 'exam',
      health_fitness: 'medical',
      personal_projects: 'special',
      family: 'special',
      other: 'other',
    };
    return mapping[category];
  },

  /** Generates automatic title for an arc */
  generateArcTitle(event: DetectedArcEvent): string {
    const categoryLabels: Record<NarrativeCategory, string> = {
      work_career: 'Búsqueda laboral',
      relationships_love: 'Historia de amor',
      education_learning: 'Camino educativo',
      health_fitness: 'Viaje de salud',
      personal_projects: 'Proyecto personal',
      family: 'Historia familiar',
      other: 'Historia personal',
    };

    const stateLabels: Record<NarrativeState, string> = {
      seeking: 'en búsqueda',
      progress: 'en progreso',
      conclusion: 'completada',
      ongoing: 'en curso',
    };

    const category = categoryLabels[event.category] || 'Historia';
    const state = stateLabels[event.state] || '';

    return `${category} ${state}`.trim();
  },
};
