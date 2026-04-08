/** Event Service - Event system, challenges, and competitions */

import { prisma } from '@/lib/prisma';
import { nanoid } from "nanoid";

export interface CreateEventData {
  title: string;
  description: string;
  type: 'challenge' | 'competition' | 'meetup' | 'hackathon' | 'workshop';
  communityId?: string;
  startDate: Date;
  endDate: Date;
  maxParticipants?: number;
  rules?: string;
  prizes?: any;
  requirements?: string;
}

export interface UpdateEventData {
  title?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  maxParticipants?: number;
  rules?: string;
  prizes?: any;
  requirements?: string;
  status?: 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
}

export const EventService = {
  /**
   * Crear evento
   */
  async createEvent(organizerId: string, data: CreateEventData) {
    // Si es para una comunidad, verificar permisos
    if (data.communityId) {
      const member = await prisma.communityMember.findFirst({
        where: {
          communityId: data.communityId,
          userId: organizerId,
          canModerate: true,
        },
      });

      if (!member) {
        throw new Error('No tienes permisos para crear eventos en esta comunidad');
      }
    }

    const event = await prisma.communityEvent.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        organizerId,
        communityId: data.communityId,
        title: data.title,
        description: data.description,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        maxParticipants: data.maxParticipants,
        prizes: data.prizes || {},
        status: data.startDate > new Date() ? 'upcoming' : 'ongoing',
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        Community: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return event;
  },

  /**
   * Actualizar evento
   */
  async updateEvent(eventId: string, userId: string, data: UpdateEventData) {
    const event = await prisma.communityEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Evento no encontrado');
    }

    if (event.organizerId !== userId) {
      throw new Error('No tienes permisos para editar este evento');
    }

    const updated = await prisma.communityEvent.update({
      where: { id: eventId },
      data,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        Community: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        EventRegistration: true,
      },
    });

    return updated;
  },

  /**
   * Obtener evento
   */
  async getEvent(eventId: string) {
    const event = await prisma.communityEvent.findUnique({
      where: { id: eventId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        Community: {
          select: {
            id: true,
            name: true,
            slug: true,
            memberCount: true,
          },
        },
        EventRegistration: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return event;
  },

  /**
   * Listar eventos
   */
  async listEvents(filters: {
    communityId?: string;
    type?: string;
    status?: string;
    upcoming?: boolean;
  } = {}, page = 1, limit = 25) {
    const where: any = {};

    if (filters.communityId) {
      where.communityId = filters.communityId;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.upcoming) {
      where.startDate = { gte: new Date() };
    }

    const [events, total] = await Promise.all([
      prisma.communityEvent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startDate: 'asc' },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          Community: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              EventRegistration: true,
            },
          },
        },
      }),
      prisma.communityEvent.count({ where }),
    ]);

    return {
      events,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Registrarse en evento
   */
  async registerForEvent(eventId: string, userId: string, teamName?: string) {
    const event = await prisma.communityEvent.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: { EventRegistration: true },
        },
      },
    });

    if (!event) {
      throw new Error('Evento no encontrado');
    }

    if (event.status === 'completed' || event.status === 'cancelled') {
      throw new Error('This event has already ended');
    }

    if (event.maxParticipants && event._count.EventRegistration >= event.maxParticipants) {
      throw new Error('Event is full');
    }

    // Check if already registered
    const existing = await prisma.eventRegistration.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (existing) {
      throw new Error('You are already registered for this event');
    }

    const registration = await prisma.eventRegistration.create({
      data: {
        id: nanoid(),
        eventId,
        userId,
      },
    });

    // Incrementar contador
    await prisma.communityEvent.update({
      where: { id: eventId },
      data: {
        currentParticipants: { increment: 1 },
      },
    });

    return registration;
  },

  /**
   * Cancelar registro
   */
  async unregisterFromEvent(eventId: string, userId: string) {
    const registration = await prisma.eventRegistration.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!registration) {
      throw new Error('You are not registered for this event');
    }

    await prisma.eventRegistration.delete({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    // Decrementar contador
    await prisma.communityEvent.update({
      where: { id: eventId },
      data: {
        currentParticipants: { decrement: 1 },
      },
    });

    return { success: true };
  },

  /** Send submission (for competitions/challenges) */
  async submitEntry(eventId: string, userId: string, _submission: any) {
    const registration = await prisma.eventRegistration.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!registration) {
      throw new Error('Debes registrarte primero');
    }

    // NOTE: Submission system requires schema migration
    // Required fields to add to EventRegistration model:
    //   - submission: String? @db.Text  // Submission content/URL
    //   - submittedAt: DateTime?        // When the submission was made
    //   - isWinner: Boolean @default(false)     // Winner flag
    //   - position: Int?                // Winner position (1st, 2nd, 3rd)
    //   - prize: String?                // Prize description
    //
    // Once added, update this method to:
    // await prisma.eventRegistration.update({
    //   where: { eventId_userId: { eventId, userId } },
    //   data: { submission: submissionData, submittedAt: new Date() }
    // });

    return registration;
  },

  /**
   * Marcar ganadores (solo organizador)
   */
  async declareWinners(eventId: string, organizerId: string, winners: {
    userId: string;
    position: number;
    prize?: string;
  }[]) {
    const event = await prisma.communityEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Evento no encontrado');
    }

    if (event.organizerId !== organizerId) {
      throw new Error('No tienes permisos para declarar ganadores');
    }

    // NOTE: Winner system requires schema migration (see submitWork method above for required fields)
    // Once EventRegistration has isWinner, position, and prize fields, uncomment:
    //
    // const updates = winners.map(winner =>
    //   prisma.eventRegistration.update({
    //     where: {
    //       eventId_userId: {
    //         eventId,
    //         userId: winner.userId,
    //       },
    //     },
    //     data: {
    //       isWinner: true,
    //       position: winner.position,
    //       prize: winner.prize,
    //     },
    //   })
    // );
    // await Promise.all(updates);

    // Update event status
    await prisma.communityEvent.update({
      where: { id: eventId },
      data: {
        status: 'completed',
        winners: winners,
      },
    });

    return { success: true, winners };
  },

  /**
   * Obtener participantes
   */
  async getParticipants(eventId: string) {
    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId },
      orderBy: [
        { createdAt: 'asc' },
      ],
    });

    return registrations;
  },

  /**
   * Cancelar evento (solo organizador)
   */
  async cancelEvent(eventId: string, userId: string, reason?: string) {
    const event = await prisma.communityEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Evento no encontrado');
    }

    if (event.organizerId !== userId) {
      throw new Error('No tienes permisos para cancelar este evento');
    }

    await prisma.communityEvent.update({
      where: { id: eventId },
      data: {
        status: 'cancelled',
        description: reason ? `${event.description}\n\n**CANCELADO:** ${reason}` : event.description,
      },
    });

    return { success: true };
  },
};
