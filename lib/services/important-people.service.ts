/**
 * Important People Service - System for important people for emotional companions
 * Manages people that the AI should remember (family, friends, pets, etc.)
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from "nanoid";

export interface CreatePersonData {
  name: string;
  relationship: string; // sister, partner, friend, mother, pet, coworker, etc
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  description?: string;
  interests?: string;
  healthInfo?: string;
  birthday?: Date;
  importance?: 'low' | 'medium' | 'high';
  metadata?: any;
}

export interface UpdatePersonData {
  name?: string;
  relationship?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  description?: string;
  interests?: string;
  healthInfo?: string;
  birthday?: Date;
  importance?: 'low' | 'medium' | 'high';
  metadata?: any;
}

export const ImportantPeopleService = {
  /**
   * Add important person
   */
  async addPerson(agentId: string, userId: string, data: CreatePersonData) {
    // Verify that the agent belongs to the user
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId },
    });

    if (!agent) {
      throw new Error('Agent not found or unauthorized');
    }

    const person = await prisma.importantPerson.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        agentId,
        userId,
        name: data.name,
        relationship: data.relationship,
        age: data.age,
        gender: data.gender,
        description: data.description,
        interests: data.interests,
        healthInfo: data.healthInfo,
        birthday: data.birthday,
        importance: data.importance || 'medium',
        mentionCount: 0,
        metadata: data.metadata || {},
      },
    });

    return person;
  },

  /**
   * Update person
   */
  async updatePerson(
    personId: string,
    userId: string,
    data: UpdatePersonData
  ) {
    // Verify ownership
    const existing = await prisma.importantPerson.findFirst({
      where: { id: personId, userId },
    });

    if (!existing) {
      throw new Error('Person not found or unauthorized');
    }

    const updated = await prisma.importantPerson.update({
      where: { id: personId },
      data,
    });

    return updated;
  },

  /** Get all important people */
  async getImportantPeople(
    agentId: string,
    userId: string,
    filters: {
      relationship?: string;
      importance?: string;
      sortBy?: 'name' | 'lastMentioned' | 'mentionCount' | 'importance';
      order?: 'asc' | 'desc';
      includeAgentPeople?: boolean; // Incluir personas del mundo del agente
    } = {}
  ) {
    // If includeAgentPeople = true, fetch people from the agent AND from the user
    // If false (default), only fetch people from the user
    const where: any = {
      agentId,
      userId: filters.includeAgentPeople
        ? { in: [userId, agentId] } // Ambos grupos
        : userId, // Solo usuario
    };

    if (filters.relationship) where.relationship = filters.relationship;
    if (filters.importance) where.importance = filters.importance;

    const orderBy: any = {};
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.order || 'desc';
    } else {
      orderBy.mentionCount = 'desc'; // Default: sort by most mentioned
    }

    const people = await prisma.importantPerson.findMany({
      where,
      orderBy,
    });

    // Agregar metadata para identificar el source
    return people.map((person) => ({
      ...person,
      source: person.userId === agentId ? 'agent' : 'user',
    }));
  },

  /** Get person by ID */
  async getPerson(personId: string, userId: string) {
    const person = await prisma.importantPerson.findFirst({
      where: {
        id: personId,
        userId,
      },
    });

    return person;
  },

  /**
   * Buscar persona por nombre
   */
  async findPersonByName(agentId: string, userId: string, name: string) {
    const person = await prisma.importantPerson.findFirst({
      where: {
        agentId,
        userId,
        name: {
          contains: name,
          mode: 'insensitive',
        },
      },
    });

    return person;
  },

  /**
   * Incrementar contador de menciones
   * (llamar cuando el usuario menciona a esta persona)
   */
  async incrementMentionCount(personId: string, userId: string) {
    const person = await prisma.importantPerson.findFirst({
      where: { id: personId, userId },
    });

    if (!person) {
      throw new Error('Person not found or unauthorized');
    }

    const updated = await prisma.importantPerson.update({
      where: { id: personId },
      data: {
        mentionCount: { increment: 1 },
        lastMentioned: new Date(),
        // Auto-ajustar importancia basado en menciones
        importance:
          person.mentionCount + 1 > 20
            ? 'high'
            : person.mentionCount + 1 > 10
            ? 'medium'
            : 'low',
      },
    });

    return updated;
  },

  /**
   * Eliminar persona
   */
  async deletePerson(personId: string, userId: string) {
    const person = await prisma.importantPerson.findFirst({
      where: { id: personId, userId },
    });

    if (!person) {
      throw new Error('Person not found or unauthorized');
    }

    await prisma.importantPerson.delete({
      where: { id: personId },
    });

    return { success: true };
  },

  /** Get people with upcoming birthdays */
  async getUpcomingBirthdays(
    agentId: string,
    userId: string,
    daysAhead = 30
  ) {
    const people = await prisma.importantPerson.findMany({
      where: {
        agentId,
        userId,
        birthday: { not: null },
      },
    });

    // Filter upcoming birthdays (consider month/day, not year)
    const now = new Date();
    const _currentMonth = now.getMonth();
    const _currentDay = now.getDate();

    const upcoming = people.filter((person) => {
      if (!person.birthday) return false;

      const birthday = new Date(person.birthday);
      const birthMonth = birthday.getMonth();
      const birthDay = birthday.getDate();

      // Calculate days until the birthday
      const thisYearBirthday = new Date(
        now.getFullYear(),
        birthMonth,
        birthDay
      );
      const nextYearBirthday = new Date(
        now.getFullYear() + 1,
        birthMonth,
        birthDay
      );

      const daysUntil =
        thisYearBirthday >= now
          ? Math.ceil(
              (thisYearBirthday.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : Math.ceil(
              (nextYearBirthday.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            );

      return daysUntil >= 0 && daysUntil <= daysAhead;
    });

    // Ordenar por proximidad
    upcoming.sort((a, b) => {
      if (!a.birthday || !b.birthday) return 0;

      const now = new Date();
      const birthdayA = new Date(
        now.getFullYear(),
        new Date(a.birthday).getMonth(),
        new Date(a.birthday).getDate()
      );
      const birthdayB = new Date(
        now.getFullYear(),
        new Date(b.birthday).getMonth(),
        new Date(b.birthday).getDate()
      );

      if (birthdayA < now) {
        birthdayA.setFullYear(birthdayA.getFullYear() + 1);
      }
      if (birthdayB < now) {
        birthdayB.setFullYear(birthdayB.getFullYear() + 1);
      }

      return birthdayA.getTime() - birthdayB.getTime();
    });

    return upcoming;
  },

  /** Get statistics of people */
  async getPeopleStats(agentId: string, userId: string) {
    const [total, byRelationship, byImportance, recentlyMentioned] =
      await Promise.all([
        // Total de personas
        prisma.importantPerson.count({
          where: { agentId, userId },
        }),
        // By relationship
        prisma.importantPerson.groupBy({
          by: ['relationship'],
          where: { agentId, userId },
          _count: true,
        }),
        // Por importancia
        prisma.importantPerson.groupBy({
          by: ['importance'],
          where: { agentId, userId },
          _count: true,
        }),
        // Recently mentioned (last 7 days)
        prisma.importantPerson.count({
          where: {
            agentId,
            userId,
            lastMentioned: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

    return {
      total,
      byRelationship,
      byImportance,
      recentlyMentioned,
    };
  },

  /** Update importance automatically based on mentions */
  async updateImportanceScores(agentId: string, userId: string) {
    const people = await prisma.importantPerson.findMany({
      where: { agentId, userId },
    });

    const updates = people.map((person) => {
      let importance: 'low' | 'medium' | 'high' = 'low';

      if (person.mentionCount > 20) {
        importance = 'high';
      } else if (person.mentionCount > 10) {
        importance = 'medium';
      }

      if (person.importance !== importance) {
        return prisma.importantPerson.update({
          where: { id: person.id },
          data: { importance },
        });
      }

      return null;
    });

    const results = await Promise.all(updates.filter((u) => u !== null));
    return results;
  },
};
