/**
 * PERSON Command Interceptor
 *
 * Detects [PERSON:...] commands in AI responses and saves important people.
 * Similar to REMEMBER but for tracking people in the user's life.
 *
 * Command format:
 * [PERSON:nombre|relación|descripción]
 * [PERSON:Ana|hermana|Vive en Córdoba, estudia medicina]
 * [PERSON:Max|mascota|Perro golden de 3 años]
 */

import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { nanoid } from 'nanoid';

const log = createLogger('PersonInterceptor');

// Regex to detect PERSON commands
const PERSON_PATTERN = /\[PERSON:([^\]]+)\]/g;

export interface PersonCommand {
  raw: string;
  name: string;
  relationship: string;
  description?: string;
  age?: number;
  gender?: string;
}

export interface PersonInterceptResult {
  shouldIntercept: boolean;
  commands: PersonCommand[];
  cleanResponse: string; // Response with [PERSON:...] removed
}

/**
 * Extract PERSON commands from AI response
 */
export async function interceptPersonCommands(
  agentId: string,
  userId: string,
  response: string
): Promise<PersonInterceptResult> {
  const matches = Array.from(response.matchAll(PERSON_PATTERN));

  if (matches.length === 0) {
    return {
      shouldIntercept: false,
      commands: [],
      cleanResponse: response,
    };
  }

  const commands: PersonCommand[] = [];

  for (const match of matches) {
    try {
      const commandStr = match[1];
      const parts = commandStr.split('|').map(p => p.trim());

      if (parts.length < 2) {
        log.warn({ commandStr }, 'Invalid PERSON command: not enough parts');
        continue;
      }

      const [name, relationship, ...rest] = parts;

      // Try to extract additional info from description
      const description = rest.join('|').trim() || undefined;
      let age: number | undefined;
      let gender: string | undefined;

      // Try to extract age from description (e.g., "3 años", "25 years old")
      if (description) {
        const ageMatch = description.match(/(\d+)\s*a[ñn]os?/i) || description.match(/(\d+)\s*years?\s*old/i);
        if (ageMatch) {
          age = parseInt(ageMatch[1]);
        }
      }

      // Try to infer gender from relationship
      const maleRelationships = ['hermano', 'padre', 'papá', 'abuelo', 'novio', 'esposo', 'amigo', 'hijo'];
      const femaleRelationships = ['hermana', 'madre', 'mamá', 'abuela', 'novia', 'esposa', 'amiga', 'hija'];

      if (maleRelationships.includes(relationship.toLowerCase())) {
        gender = 'male';
      } else if (femaleRelationships.includes(relationship.toLowerCase())) {
        gender = 'female';
      } else if (relationship.toLowerCase().includes('mascota') || relationship.toLowerCase().includes('perro') || relationship.toLowerCase().includes('gato')) {
        // For pets, don't assume gender
        gender = 'unknown';
      }

      commands.push({
        raw: match[0],
        name,
        relationship,
        description,
        age,
        gender,
      });
    } catch (error) {
      log.warn({ error, match: match[0] }, 'Error parsing PERSON command');
    }
  }

  // Save all valid commands to database
  if (commands.length > 0) {
    await savePersonCommands(agentId, userId, commands);
  }

  // Remove commands from response
  const cleanResponse = response.replace(PERSON_PATTERN, '').trim();

  return {
    shouldIntercept: true,
    commands,
    cleanResponse,
  };
}

/**
 * Save PERSON commands to database
 */
async function savePersonCommands(
  agentId: string,
  userId: string,
  commands: PersonCommand[]
): Promise<void> {
  try {
    // Check for existing people and update or create
    for (const cmd of commands) {
      // Check if person already exists
      const existing = await prisma.importantPerson.findFirst({
        where: {
          agentId,
          userId,
          name: cmd.name,
        },
      });

      if (existing) {
        // Update existing person
        await prisma.importantPerson.update({
          where: { id: existing.id },
          data: {
            relationship: cmd.relationship,
            description: cmd.description || existing.description,
            age: cmd.age || existing.age,
            gender: cmd.gender || existing.gender,
            mentionCount: existing.mentionCount + 1,
            lastMentioned: new Date(),
            updatedAt: new Date(),
          },
        });

        log.info(
          { agentId, userId, name: cmd.name },
          'Updated existing person'
        );
      } else {
        // Create new person
        await prisma.importantPerson.create({
          data: {
            id: nanoid(),
            updatedAt: new Date(),
            agentId,
            userId,
            name: cmd.name,
            relationship: cmd.relationship,
            description: cmd.description,
            age: cmd.age,
            gender: cmd.gender,
            mentionCount: 1,
            lastMentioned: new Date(),
          },
        });

        log.info(
          { agentId, userId, name: cmd.name },
          'Created new person'
        );
      }
    }

    log.info(
      { agentId, userId, count: commands.length },
      'Processed PERSON commands'
    );
  } catch (error) {
    log.error({ error, agentId, userId }, 'Failed to save PERSON commands');
  }
}

/**
 * Get all important people for an agent/user
 */
export async function getImportantPeople(
  agentId: string,
  userId: string
): Promise<any[]> {
  return prisma.importantPerson.findMany({
    where: {
      agentId,
      userId,
    },
    orderBy: [
      { mentionCount: 'desc' },
      { lastMentioned: 'desc' },
    ],
  });
}

/**
 * Get recently mentioned people (last 7 days)
 */
export async function getRecentlyMentionedPeople(
  agentId: string,
  userId: string,
  daysAgo: number = 7
): Promise<any[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

  return prisma.importantPerson.findMany({
    where: {
      agentId,
      userId,
      lastMentioned: {
        gte: cutoffDate,
      },
    },
    orderBy: {
      lastMentioned: 'desc',
    },
    take: 10,
  });
}

/**
 * Build people context for system prompt
 * Includes important people the AI should be aware of
 */
export async function buildPeopleContext(
  agentId: string,
  userId: string,
  relationshipStage: string
): Promise<string> {
  // Get all important people
  const people = await getImportantPeople(agentId, userId);

  if (people.length === 0) {
    return '';
  }

  // Only show people context if relationship is at friend level or higher
  const stageRank = STAGE_RANKS[relationshipStage.toLowerCase()] || 0;
  if (stageRank < STAGE_RANKS['friend']) {
    return ''; // Don't expose personal connections to strangers/acquaintances
  }

  let context = '\n\n## Personas Importantes del Usuario\n';
  context += 'El usuario te ha mencionado estas personas. Recuérdalas en futuras conversaciones:\n\n';

  // Group by relationship type for better organization
  const families = people.filter(p => isFamilyRelation(p.relationship));
  const friends = people.filter(p => isFriendRelation(p.relationship));
  const pets = people.filter(p => isPetRelation(p.relationship));
  const others = people.filter(p => !isFamilyRelation(p.relationship) && !isFriendRelation(p.relationship) && !isPetRelation(p.relationship));

  if (families.length > 0) {
    context += '**Familia:**\n';
    for (const person of families) {
      context += formatPersonInfo(person);
    }
    context += '\n';
  }

  if (friends.length > 0) {
    context += '**Amigos:**\n';
    for (const person of friends) {
      context += formatPersonInfo(person);
    }
    context += '\n';
  }

  if (pets.length > 0) {
    context += '**Mascotas:**\n';
    for (const person of pets) {
      context += formatPersonInfo(person);
    }
    context += '\n';
  }

  if (others.length > 0) {
    context += '**Otras personas:**\n';
    for (const person of others) {
      context += formatPersonInfo(person);
    }
    context += '\n';
  }

  context += 'USO: Menciona estas personas solo cuando sea natural en la conversación. Puedes preguntar por ellas de forma espontánea ("¿Cómo está tu hermana Ana?") si el contexto lo permite.';

  return context;
}

/**
 * Format person information for context
 */
function formatPersonInfo(person: any): string {
  let info = `- **${person.name}** (${person.relationship})`;

  if (person.age) {
    info += `, ${person.age} años`;
  }

  if (person.description) {
    info += `: ${person.description}`;
  }

  info += `\n`;

  return info;
}

/**
 * Determine if relationship is family
 */
function isFamilyRelation(relationship: string): boolean {
  const familyTerms = ['hermana', 'hermano', 'madre', 'padre', 'mamá', 'papá', 'abuelo', 'abuela', 'tío', 'tía', 'primo', 'prima', 'hijo', 'hija'];
  return familyTerms.some(term => relationship.toLowerCase().includes(term));
}

/**
 * Determine if relationship is friend
 */
function isFriendRelation(relationship: string): boolean {
  const friendTerms = ['amigo', 'amiga', 'mejor amigo', 'mejor amiga', 'compañero', 'compañera'];
  return friendTerms.some(term => relationship.toLowerCase().includes(term));
}

/**
 * Determine if relationship is pet
 */
function isPetRelation(relationship: string): boolean {
  const petTerms = ['mascota', 'perro', 'gato', 'perra', 'gata', 'conejo', 'loro', 'pájaro'];
  return petTerms.some(term => relationship.toLowerCase().includes(term));
}

const STAGE_RANKS: Record<string, number> = {
  stranger: 0,
  acquaintance: 1,
  friend: 2,
  intimate: 3,
};
