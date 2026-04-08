import { prisma } from "@/lib/prisma";

/**
 * Sistema de Fatiga Temática
 *
 * Evita que el personaje repita constantemente los mismos temas.
 * Si un tema se discute mucho, se marca como "fatigado" y se
 * sugiere al LLM explorar otros temas.
 *
 * Previene bucles como:
 * - El personaje siempre habla del mismo hobby
 * - Siempre hace la misma pregunta
 * - Siempre cuenta las misma anécdotas
 */

export interface TopicFatigueData {
  topic: string;
  mentions: number;
  lastMentionedAt: Date;
  fatigueLevel: number; // 0-1, how fatigued the topic is
  shouldAvoid: boolean;
}

// Fatigue configuration
const FATIGUE_CONFIG = {
  mentionsThreshold: 5, // How many mentions before fatigue
  decayHours: 24, // Hours for fatigue to decrease
  maxFatiguedTopics: 10, // Maximum number of fatigued topics to track
};

/**
 * Records that a topic was mentioned in a conversation
 */
export async function recordTopicMention(
  agentId: string,
  userId: string,
  topic: string
): Promise<void> {
  const normalized = topic.toLowerCase().trim();

  await prisma.$executeRaw`
    INSERT INTO "TopicFatigue" (id, "agentId", "userId", topic, mentions, "lastMentionedAt", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), ${agentId}, ${userId}, ${normalized}, 1, NOW(), NOW(), NOW())
    ON CONFLICT ("agentId", "userId", topic)
    DO UPDATE SET
      mentions = "TopicFatigue".mentions + 1,
      "lastMentionedAt" = NOW(),
      "updatedAt" = NOW()
  `;
}

/**
 * Gets fatigued topics for this conversation
 */
export async function getFatiguedTopics(
  agentId: string,
  userId: string
): Promise<TopicFatigueData[]> {
  const topics = await prisma.$queryRaw<
    Array<{
      topic: string;
      mentions: number;
      lastMentionedAt: Date;
    }>
  >`
    SELECT topic, mentions, "lastMentionedAt"
    FROM "TopicFatigue"
    WHERE "agentId" = ${agentId}
      AND "userId" = ${userId}
      AND mentions >= ${FATIGUE_CONFIG.mentionsThreshold}
    ORDER BY mentions DESC
    LIMIT ${FATIGUE_CONFIG.maxFatiguedTopics}
  `;

  // Calculate fatigue level based on mentions and time
  const now = new Date();

  return topics.map((t) => {
    const hoursSinceLastMention =
      (now.getTime() - new Date(t.lastMentionedAt).getTime()) / (1000 * 60 * 60);

    // Exponential decay: after 24 hours, fatigue reduces to half
    const decayFactor = Math.pow(0.5, hoursSinceLastMention / FATIGUE_CONFIG.decayHours);

    // Fatigue level = (mentions - threshold) / 10, with decay
    const rawFatigue = (t.mentions - FATIGUE_CONFIG.mentionsThreshold) / 10;
    const fatigueLevel = Math.min(1, rawFatigue * decayFactor);

    return {
      topic: t.topic,
      mentions: t.mentions,
      lastMentionedAt: new Date(t.lastMentionedAt),
      fatigueLevel,
      shouldAvoid: fatigueLevel > 0.3, // Avoid if fatigue > 30%
    };
  });
}

/**
 * Generates fatigue context to inject into the prompt
 */
export function generateFatigueContext(topics: TopicFatigueData[]): string {
  const fatigued = topics.filter((t) => t.shouldAvoid);

  if (fatigued.length === 0) {
    return "";
  }

  let context = "\n**Temas Recurrentes (Evitar):**\n";
  context += "Has notado que ya han hablado bastante sobre los siguientes temas:\n";

  for (const topic of fatigued) {
    context += `- ${topic.topic} (mencionado ${topic.mentions} veces)\n`;
  }

  context +=
    "\nTrata de explorar nuevos temas o ángulos diferentes. No evites estos temas por completo si el usuario los menciona, pero no seas tú quien los traiga a colación constantemente.\n";

  return context;
}

/**
 * Extracts topics mentioned in a message using simple analysis
 * (In the future, use LLM or more advanced NLP)
 */
export function extractTopics(message: string): string[] {
  const normalized = message.toLowerCase();

  // Common keywords that indicate topics
  const topicKeywords: Record<string, RegExp> = {
    work: /\b(work|employment|office|boss|project|meeting)\b/,
    family: /\b(family|mom|dad|brother|sister|son|daughter|parents)\b/,
    relationships: /\b(partner|boyfriend|girlfriend|spouse|date|love)\b/,
    health: /\b(health|exercise|gym|diet|doctor|hospital)\b/,
    hobbies: /\b(hobby|hobby|read|play|video game|movie|series)\b/,
    travel: /\b(trip|travel|vacation|tourism|country|city)\b/,
    education: /\b(study|university|career|exam|class|teacher)\b/,
    technology: /\b(technology|computer|phone|app|software|program)\b/,
    sports: /\b(sport|football|basketball|run|training)\b/,
    music: /\b(music|song|band|concert|instrument)\b/,
    food: /\b(food|cook|restaurant|recipe|eat)\b/,
    money: /\b(money|economic|financial|bank|pay)\b/,
  };

  const detected: string[] = [];

  for (const [topic, regex] of Object.entries(topicKeywords)) {
    if (regex.test(normalized)) {
      detected.push(topic);
    }
  }

  return detected;
}

/**
 * Processes a message to detect and record topics
 */
export async function processMessageForTopics(
  agentId: string,
  userId: string,
  message: string
): Promise<void> {
  const topics = extractTopics(message);

  if (topics.length > 0) {
    await Promise.all(topics.map((topic) => recordTopicMention(agentId, userId, topic)));
  }
}

/**
 * Cleans up very old topics that are no longer relevant
 */
export async function cleanupOldTopics(agentId: string, userId: string): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 días

  await prisma.$executeRaw`
    DELETE FROM "TopicFatigue"
    WHERE "agentId" = ${agentId}
      AND "userId" = ${userId}
      AND "lastMentionedAt" < ${cutoffDate}
      AND mentions < ${FATIGUE_CONFIG.mentionsThreshold}
  `;
}

/**
 * Resets the fatigue of a specific topic
 */
export async function resetTopicFatigue(
  agentId: string,
  userId: string,
  topic: string
): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "TopicFatigue"
    WHERE "agentId" = ${agentId}
      AND "userId" = ${userId}
      AND topic = ${topic.toLowerCase()}
  `;
}
